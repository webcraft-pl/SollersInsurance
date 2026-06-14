import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'

const ISOK_WFS = 'https://wody.isok.gov.pl/wss/INSPIRE/INSPIRE_NZ_HY_MZPMRP_WFS'

function extractCityName(displayName: string): string {
  const SKIP = /^(województwo|powiat|gmina|Polska)/i
  const parts = displayName.split(',').map(s => s.trim()).reverse()
  for (const p of parts) {
    if (p && !SKIP.test(p)) return p
  }
  return parts[parts.length - 1] ?? displayName
}

// Odkryj rzeczywiste nazwy warstw przez GetCapabilities (cache w module)
let _layerNames: string[] | null = null
async function discoverLayerNames(): Promise<string[]> {
  if (_layerNames) return _layerNames
  try {
    const url = `${ISOK_WFS}?SERVICE=WFS&REQUEST=GetCapabilities`
    const r = await fetch(url, {
      headers: { 'User-Agent': 'SollersInsurance/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) return []
    const xml = await r.text()
    // Wyciągnij wszystkie <Name> z FeatureType
    const matches = [...xml.matchAll(/<Name[^>]*>([\w:.-]+)<\/Name>/g)]
    const names = matches.map(m => m[1]).filter(n => /q100|q500|mzp|flood|hazard/i.test(n))
    _layerNames = names.length > 0 ? names : []
    console.log('ISOK WFS discovered layers:', _layerNames)
    return _layerNames
  } catch {
    return []
  }
}

async function checkViaWFS(layer: string, lat: number, lng: number): Promise<boolean | null> {
  const d = 0.003
  const bboxes = [
    `${lng - d},${lat - d},${lng + d},${lat + d}`,
    `${lat - d},${lng - d},${lat + d},${lng + d}`,
  ]

  for (const bbox of bboxes) {
    const url = `${ISOK_WFS}?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature`
      + `&TYPENAMES=${encodeURIComponent(layer)}&SRSNAME=EPSG:4326`
      + `&BBOX=${bbox},EPSG:4326&COUNT=1`

    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'SollersInsurance/1.0' },
        signal: AbortSignal.timeout(5000),
      })
      if (!r.ok) continue
      const xml = await r.text()

      if (xml.includes('ExceptionReport') || xml.includes('ServiceException')) {
        console.warn(`WFS exception for ${layer}:`, xml.substring(0, 200))
        return null
      }

      const m = xml.match(/numberReturned="(\d+)"/)
      if (m) return parseInt(m[1]) > 0

      if (xml.includes('<wfs:member>') && !xml.includes('<wfs:member/>')) return true
      if (xml.includes('<gml:featureMember>')) return true
      return false
    } catch {
      // timeout — spróbuj drugiej kolejności
    }
  }
  return null
}

// Spróbuj MZP_Q100/Q500 i warianty z namespace
async function checkFloodLevel(
  targetLevel: 'Q100' | 'Q500', lat: number, lng: number
): Promise<boolean | null> {
  // Znane warianty nazw warstw ISOK MZP
  const candidates = targetLevel === 'Q100'
    ? ['MZP_Q100', 'mzp:MZP_Q100', 'NZ_HY:MZP_Q100', 'INSPIRE_NZ:MZP_Q100']
    : ['MZP_Q500', 'mzp:MZP_Q500', 'NZ_HY:MZP_Q500', 'INSPIRE_NZ:MZP_Q500']

  // Dodaj odkryte z GetCapabilities
  const discovered = await discoverLayerNames()
  const matchKey = targetLevel.toLowerCase()
  const fromCaps = discovered.filter(n => n.toLowerCase().includes(matchKey))
  const allLayers = [...new Set([...candidates, ...fromCaps])]

  for (const layer of allLayers) {
    const result = await checkViaWFS(layer, lat, lng)
    if (result !== null) return result  // dostaliśmy odpowiedź (true lub false)
  }
  return null  // WFS niedostępny / wszystkie warianty nieudane
}

async function checkViaAI(
  key: string, addr: string, lat: number, lng: number, cityName: string
): Promise<{ riskLevel: 'brak' | 'Q500' | 'Q100'; explanation: string }> {
  const client = new Anthropic({ apiKey: key })
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 250,
    system: `Jesteś ekspertem od polskich map zagrożenia powodziowego (ISOK/MZP — Wody Polskie).
Znasz strefy Q100 i Q500 dla wszystkich polskich rzek i miast.

Pewne obszary Q100 (powódź 1 na 100 lat): centrum Kłodzka i dolina Nysy Kłodzko (powodzie 1997, 2024), brzeg Wisły w Sandomierzu (powódź 2010), Ostrów Tumski Wrocław i Kozanów (Odra 1997), centrum Raciborza (Odra), ul. Wiślana/Nadbrzeżna w Krakowie, Płock nad Wisłą, Opole nad Odrą.

Pewne obszary Q500 (powódź 1 na 500 lat): tereny przyrzeczne kilkaset metrów od stref Q100 w tych miastach, doliny rzeczne poza miastami.

Brak strefy: tereny wyżej położone, dzielnice z dala od rzek, wyżyny, pogórza.`,
    messages: [{
      role: 'user',
      content: `Oceń strefę zagrożenia powodziowego dla:
Adres: ${addr}
Współrzędne: ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E
Miejscowość/obszar: ${cityName}

Odpowiedz TYLKO w JSON bez markdown:
{"riskLevel":"brak","explanation":"jedno zdanie po polsku"}

riskLevel: "brak" | "Q500" | "Q100"`,
    }],
  })
  const raw = (msg.content[0] as { text: string }).text
    .trim().replace(/```json|```/g, '').trim()
  return JSON.parse(raw) as { riskLevel: 'brak' | 'Q500' | 'Q100'; explanation: string }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { addr, lat, lng, city, apiKey } = req.body as {
    addr: string; lat: number; lng: number; city: string; apiKey?: string
  }

  const cityName = extractCityName(city)
  const key = process.env.ANTHROPIC_API_KEY || apiKey

  // === Ścieżka 1: AI primary + ISOK jako weryfikacja ===
  if (key) {
    try {
      const ai = await checkViaAI(key, addr, lat, lng, cityName)

      if (ai.riskLevel !== 'brak') {
        const wfs = await checkFloodLevel(ai.riskLevel, lat, lng).catch(() => null)
        if (wfs === true) {
          return res.json({
            riskLevel: ai.riskLevel,
            source: 'isok+ai',
            explanation: `${cityName} leży w strefie zagrożenia powodziowego ${ai.riskLevel} wg oficjalnych danych ISOK — Wody Polskie. ${ai.explanation}`,
          })
        }
        return res.json({
          riskLevel: ai.riskLevel,
          source: 'ai',
          explanation: ai.explanation,
        })
      }

      return res.json({
        riskLevel: 'brak',
        source: 'ai',
        explanation: `${cityName} nie leży w strefie zagrożenia powodziowego wg oceny AI na podstawie danych ISOK — Wody Polskie.`,
      })

    } catch (e) {
      console.error('AI flood check error:', e)
    }
  }

  // === Ścieżka 2: tylko ISOK WFS (brak klucza AI) ===
  const q100 = await checkFloodLevel('Q100', lat, lng)
  if (q100 === true) {
    return res.json({
      riskLevel: 'Q100', source: 'isok',
      explanation: `${cityName} leży w strefie zagrożenia powodziowego Q100 wg danych ISOK — Wody Polskie.`,
    })
  }
  if (q100 === false) {
    const q500 = await checkFloodLevel('Q500', lat, lng)
    if (q500 === true) {
      return res.json({
        riskLevel: 'Q500', source: 'isok',
        explanation: `${cityName} leży w strefie zagrożenia powodziowego Q500 wg danych ISOK — Wody Polskie.`,
      })
    }
    if (q500 === false) {
      return res.json({
        riskLevel: 'brak', source: 'isok',
        explanation: `${cityName} nie leży w strefie zagrożenia powodziowego wg danych ISOK — Wody Polskie.`,
      })
    }
  }

  // WFS niedostępny, brak klucza AI
  return res.status(503).json({ error: 'Flood check unavailable: configure ANTHROPIC_API_KEY in Vercel env vars' })
}
