import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'

const ISOK_WMS = 'https://wody.isok.gov.pl/wss/service/wms/guest/ISOK_POWODZIOWE/MapServer/WMSServer'
const ISOK_WFS = 'https://wody.isok.gov.pl/wss/INSPIRE/INSPIRE_NZ_HY_MZPMRP_WFS'

function extractCityName(displayName: string): string {
  // Nominatim: "ulica, dzielnica, miasto, powiat X, województwo Y, Polska"
  // Pomijamy od końca: Polska, województwo..., powiat..., gmina...
  const SKIP = /^(województwo|powiat|gmina|Polska)/i
  const parts = displayName.split(',').map(s => s.trim()).reverse()
  for (const p of parts) {
    if (p && !SKIP.test(p)) return p
  }
  return parts[parts.length - 1] ?? displayName
}

// Try ISOK via WMS GetFeatureInfo — more reliable than WFS for ArcGIS Server
// Returns: 'Q100' | 'Q500' | 'brak' | null (null = server error/unavailable)
async function queryISOKviaWMS(lat: number, lng: number): Promise<'Q100' | 'Q500' | 'brak' | null> {
  const d = 0.01  // ~1km box — wide enough to find nearby zones
  // WMS 1.3.0 + CRS=EPSG:4326: BBOX is minLat,minLng,maxLat,maxLng
  const bbox = `${lat - d},${lng - d},${lat + d},${lng + d}`
  const url = `${ISOK_WMS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo`
    + `&LAYERS=0,1&QUERY_LAYERS=0,1&CRS=EPSG:4326&BBOX=${bbox}`
    + `&WIDTH=201&HEIGHT=201&I=100&J=100`
    + `&INFO_FORMAT=text/xml&FEATURE_COUNT=5`

  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'SollersInsurance/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) return null
    const xml = await r.text()

    // Error response → treat as unavailable
    if (xml.includes('ServiceException') || xml.includes('ExceptionReport')) return null

    // ArcGIS returns GetFeatureInfo as XML with layer info
    // Q100 is typically layer 0, Q500 is layer 1
    const hasQ100 = xml.includes('LAYER_ID="0"') || xml.includes("layerId='0'") || xml.includes('layerid="0"')
      || (xml.toLowerCase().includes('q100') && xml.toLowerCase().includes('feature'))
    const hasQ500 = xml.includes('LAYER_ID="1"') || xml.includes("layerId='1'") || xml.includes('layerid="1"')
      || (xml.toLowerCase().includes('q500') && xml.toLowerCase().includes('feature'))
    const hasAnyFeature = xml.includes('<FeatureInfo>') || xml.includes('<FIELDS ')
      || xml.includes('<fields ') || xml.includes('<feature')

    if (!hasAnyFeature) return 'brak'
    if (hasQ100) return 'Q100'
    if (hasQ500) return 'Q500'
    if (hasAnyFeature) return 'Q100' // found something in flood layers — assume worst case
    return 'brak'
  } catch {
    return null  // network error / timeout
  }
}

// WFS fallback — tries both coordinate orders for EPSG:4326
async function queryISOKviaWFS(layer: string, lat: number, lng: number): Promise<boolean | null> {
  const d = 0.002
  // Try both BBOX orderings: WFS 2.0 standard = lat,lng; ArcGIS practice = lng,lat
  const bboxes = [
    `${lng - d},${lat - d},${lng + d},${lat + d}`,  // lon,lat (ArcGIS/GIS convention)
    `${lat - d},${lng - d},${lat + d},${lng + d}`,  // lat,lon (EPSG:4326 standard)
  ]

  for (const bbox of bboxes) {
    const url = `${ISOK_WFS}?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature`
      + `&TYPENAMES=${layer}&SRSNAME=EPSG:4326&BBOX=${bbox},EPSG:4326&COUNT=1`

    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'SollersInsurance/1.0' },
        signal: AbortSignal.timeout(7000),
      })
      if (!r.ok) continue
      const xml = await r.text()

      // WFS error → stop trying, signal unavailable
      if (xml.includes('ExceptionReport') || xml.includes('ServiceException')) {
        console.error(`WFS exception for ${layer}:`, xml.substring(0, 300))
        return null
      }

      const matched = xml.match(/numberReturned="(\d+)"/)
      if (matched) {
        return parseInt(matched[1]) > 0
      }
      // Older WFS format
      if (xml.includes('<wfs:member>') && !xml.includes('<wfs:member/>')) return true
      if (xml.includes('<gml:featureMember>')) return true
    } catch {
      // timeout — try next bbox
    }
  }
  return null  // all attempts failed
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { addr, lat, lng, city, apiKey } = req.body as {
    addr: string; lat: number; lng: number; city: string; apiKey?: string
  }

  const cityName = extractCityName(city)

  // 1. Try WMS GetFeatureInfo (primary — more reliable on ArcGIS)
  const wmsResult = await queryISOKviaWMS(lat, lng)
  if (wmsResult !== null) {
    const labels: Record<string, string> = {
      Q100: `${cityName} leży w strefie zagrożenia powodziowego Q100 (raz na 100 lat) wg danych ISOK — Wody Polskie.`,
      Q500: `${cityName} leży w strefie zagrożenia powodziowego Q500 (raz na 500 lat) wg danych ISOK — Wody Polskie.`,
      brak: `${cityName} nie leży w strefie zagrożenia powodziowego wg oficjalnych danych ISOK — Wody Polskie.`,
    }
    return res.json({ riskLevel: wmsResult, explanation: labels[wmsResult] })
  }

  // 2. WFS fallback
  try {
    const q100 = await queryISOKviaWFS('MZP_Q100', lat, lng)
    if (q100 === true) {
      return res.json({
        riskLevel: 'Q100',
        explanation: `${cityName} leży w strefie zagrożenia powodziowego Q100 (raz na 100 lat) wg danych ISOK — Wody Polskie.`,
      })
    }
    if (q100 === false) {
      const q500 = await queryISOKviaWFS('MZP_Q500', lat, lng)
      if (q500 === true) {
        return res.json({
          riskLevel: 'Q500',
          explanation: `${cityName} leży w strefie zagrożenia powodziowego Q500 (raz na 500 lat) wg danych ISOK — Wody Polskie.`,
        })
      }
      if (q500 === false) {
        return res.json({
          riskLevel: 'brak',
          explanation: `${cityName} nie leży w strefie zagrożenia powodziowego wg oficjalnych danych ISOK — Wody Polskie.`,
        })
      }
    }
    // q100 === null — WFS unavailable, fall through to AI
  } catch {
    // unexpected error — fall through to AI
  }

  // 3. AI fallback — ISOK całkowicie niedostępny
  const key = process.env.ANTHROPIC_API_KEY || apiKey
  if (!key) {
    return res.status(503).json({ error: 'ISOK unavailable and no AI key configured' })
  }

  try {
    const client = new Anthropic({ apiKey: key })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Oceń ryzyko powodziowe dla lokalizacji w Polsce:\nAdres: ${addr}\nWspółrzędne: ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E\nMiejscowość: ${cityName}\n\nOdpowiedz TYLKO w formacie JSON (bez markdown):\n{"riskLevel":"brak","explanation":"jedno zdanie po polsku"}\n\nriskLevel musi być jednym z: brak / Q500 / Q100\nBazuj na: bliskość rzek (Odra, Wisła, Nysa, Warta, Bug, San...), historyczne powodzie, teren zalewowy, ukształtowanie.`,
      }],
    })
    const text = (message.content[0] as { text: string }).text
      .trim().replace(/```json|```/g, '').trim()
    const result = JSON.parse(text) as { riskLevel: string; explanation: string }
    return res.json({
      riskLevel: result.riskLevel,
      explanation: `[Ocena AI — serwer ISOK tymczasowo niedostępny] ${result.explanation}`,
    })
  } catch (e) {
    console.error('AI flood check error:', e)
    return res.status(500).json({ error: 'Flood check failed' })
  }
}
