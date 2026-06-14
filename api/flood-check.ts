import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { addr, lat, lng, city, apiKey } = req.body as {
    addr: string; lat: number; lng: number; city: string; apiKey?: string
  }

  const cityName = city.split(',')[0]

  // 1. ISOK WFS — oficjalne dane Wód Polskich
  try {
    const bbox = `${lng - 0.001},${lat - 0.001},${lng + 0.001},${lat + 0.001}`

    for (const layer of ['MZP_Q100', 'MZP_Q500']) {
      const url = `https://wody.isok.gov.pl/wss/INSPIRE/INSPIRE_NZ_HY_MZPMRP_WFS`
        + `?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature`
        + `&TYPENAMES=${layer}&CRS=EPSG:4326&BBOX=${bbox}`

      const wfsRes = await fetch(url, { signal: AbortSignal.timeout(6000) })
      const xml = await wfsRes.text()

      // WFS 2.0: sprawdź numberReturned > 0 lub obecność featureMember z zawartością
      const numberReturned = xml.match(/numberReturned="(\d+)"/)?.[1]
      const hasFeatures = numberReturned
        ? parseInt(numberReturned) > 0
        : xml.includes('<wfs:member>') && !xml.includes('<wfs:member/>')

      if (hasFeatures) {
        const riskLevel = layer === 'MZP_Q100' ? 'Q100' : 'Q500'
        return res.json({
          riskLevel,
          explanation: riskLevel === 'Q100'
            ? `${cityName} leży w strefie zagrożenia powodziowego Q100 (powódź statystycznie raz na 100 lat) wg oficjalnych danych ISOK — Wody Polskie.`
            : `${cityName} leży w strefie zagrożenia powodziowego Q500 (powódź raz na 500 lat) wg danych ISOK — Wody Polskie.`,
        })
      }
    }

    // ISOK odpowiedział poprawnie — brak strefy zalewowej
    return res.json({
      riskLevel: 'brak',
      explanation: `${cityName} nie leży w strefie zagrożenia powodziowego wg oficjalnych danych ISOK — Wody Polskie.`,
    })

  } catch {
    // ISOK niedostępny (timeout / błąd serwera) — przechodzimy do AI
  }

  // 2. AI fallback — gdy ISOK nie odpowiada
  const key = process.env.ANTHROPIC_API_KEY || apiKey
  if (!key) {
    // Brak AI i brak ISOK — zwróć błąd (frontend pokaże losową strefę demo)
    return res.status(503).json({ error: 'ISOK unavailable and no AI key configured' })
  }

  try {
    const client = new Anthropic({ apiKey: key })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Oceń ryzyko powodziowe dla lokalizacji w Polsce:\nAdres: ${addr}\nWspółrzędne: ${lat.toFixed(4)}N, ${lng.toFixed(4)}E\nMiejscowość: ${city.split(',').slice(0, 2).join(',')}\n\nOdpowiedz TYLKO w formacie JSON (bez markdown):\n{"riskLevel":"brak","explanation":"jedno zdanie po polsku"}\n\nriskLevel musi być jednym z: brak / Q500 / Q100\nBazuj na geografii Polski: bliskość rzek, historyczne powodzie, ukształtowanie terenu.`,
      }],
    })
    const text = (message.content[0] as { text: string }).text
      .trim().replace(/```json|```/g, '').trim()
    const result = JSON.parse(text) as { riskLevel: string; explanation: string }
    return res.json({
      riskLevel: result.riskLevel,
      explanation: `[Ocena AI — dane ISOK tymczasowo niedostępne] ${result.explanation}`,
    })
  } catch (e) {
    console.error('AI flood check error:', e)
    return res.status(500).json({ error: 'Flood check failed' })
  }
}
