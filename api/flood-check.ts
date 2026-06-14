import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { addr, lat, lng, city, apiKey } = req.body as {
    addr: string; lat: number; lng: number; city: string; apiKey?: string
  }

  // 1. Try ISOK WFS (real flood zone data)
  try {
    const bbox = `${lng - 0.001},${lat - 0.001},${lng + 0.001},${lat + 0.001}`
    for (const layer of ['MZP_Q100', 'MZP_Q500']) {
      const wfsUrl = `https://wody.isok.gov.pl/wss/INSPIRE/INSPIRE_NZ_HY_MZPMRP_WFS?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=${layer}&CRS=EPSG:4326&BBOX=${bbox}`
      const wfsRes = await fetch(wfsUrl, { signal: AbortSignal.timeout(5000) })
      const xml = await wfsRes.text()
      if (xml.includes('featureMember') || xml.includes('member')) {
        const riskLevel = layer === 'MZP_Q100' ? 'Q100' : 'Q500'
        return res.json({
          riskLevel,
          explanation: riskLevel === 'Q100'
            ? `Lokalizacja ${city.split(',')[0]} leży w strefie zagrożenia powodziowego Q100 (powódź raz na 100 lat) wg danych ISOK.`
            : `Lokalizacja ${city.split(',')[0]} leży w strefie zagrożenia powodziowego Q500 (powódź raz na 500 lat) wg danych ISOK.`,
        })
      }
    }
    // WFS responded, no flood zone found
    return res.json({
      riskLevel: 'brak',
      explanation: `Lokalizacja ${city.split(',')[0]} nie wykazuje istotnego ryzyka powodziowego w danych ISOK.`,
    })
  } catch {
    // WFS unavailable — fall through to AI
  }

  // 2. AI fallback (uses server key or client-provided key for demo)
  const key = process.env.ANTHROPIC_API_KEY || apiKey
  if (!key) {
    return res.json({ riskLevel: 'brak', explanation: 'Brak danych ISOK. Nie skonfigurowano klucza API.' })
  }

  try {
    const client = new Anthropic({ apiKey: key })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Oceń ryzyko powodziowe dla lokalizacji:\nAdres: ${addr}\nWspółrzędne: ${lat.toFixed(4)}N, ${lng.toFixed(4)}E\nMiejscowość: ${city.split(',').slice(0, 2).join(',')}\n\nOdpowiedz TYLKO JSON:\n{"riskLevel":"brak","explanation":"jedno zdanie po polsku"}\n\nriskLevel: brak/Q500/Q100. Bazuj na historii powodzi, bliskości rzek i ukształtowaniu terenu Polski.`,
      }],
    })
    const text = (message.content[0] as { text: string }).text.trim().replace(/```json|```/g, '').trim()
    const result = JSON.parse(text) as { riskLevel: string; explanation: string }
    return res.json(result)
  } catch (e) {
    console.error('AI flood check error:', e)
    return res.status(500).json({ error: 'Flood check failed' })
  }
}
