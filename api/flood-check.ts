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

// AI check — Claude zna polskie strefy powodziowe z ISOK/MZP
async function checkViaAI(
  key: string, addr: string, lat: number, lng: number, cityName: string
): Promise<{ riskLevel: 'brak' | 'Q500' | 'Q100'; explanation: string }> {
  const client = new Anthropic({ apiKey: key })
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 250,
    system: `Jesteś ekspertem od polskich map zagrożenia powodziowego (ISOK/MZP — Wody Polskie).
Znasz strefy Q100 i Q500 dla wszystkich polskich rzek.
Przykłady stref Q100: centrum Kłodzka (Nysa Kłodzka), brzeg Wisły w Sandomierzu i Płocku, Ostrów Tumski we Wrocławiu (Odra), centrum Raciborza (Odra), ul. Wiślna w Krakowie, nisko położone dzielnice Wrocławia (Kozanów, Leśnica).
Przykłady Q500: tereny zalewowe kilkaset metrów od rzek w miastach powodziowych.
Brak strefy: tereny wyżej położone, z dala od rzek, na wyżynach/górach.`,
    messages: [{
      role: 'user',
      content: `Oceń strefę zagrożenia powodziowego wg ISOK/MZP dla:
Adres: ${addr}
Współrzędne: ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E
Miasto/obszar: ${cityName}

Odpowiedz TYLKO w JSON (bez markdown):
{"riskLevel":"brak","explanation":"jedno zdanie po polsku opisujące sytuację powodziową"}

riskLevel: "brak" | "Q500" | "Q100"`,
    }],
  })
  const raw = (msg.content[0] as { text: string }).text
    .trim().replace(/```json|```/g, '').trim()
  return JSON.parse(raw) as { riskLevel: 'brak' | 'Q500' | 'Q100'; explanation: string }
}

// ISOK WFS — weryfikacja przez oficjalne dane (backup / weryfikacja AI)
async function checkViaWFS(
  layer: string, lat: number, lng: number
): Promise<boolean | null> {
  const d = 0.003  // ~330m
  // Próbujemy obu kolejności osi dla EPSG:4326
  const bboxes = [
    `${lng - d},${lat - d},${lng + d},${lat + d}`,  // lon,lat (praktyka GIS)
    `${lat - d},${lng - d},${lat + d},${lng + d}`,  // lat,lon (standard EPSG)
  ]

  for (const bbox of bboxes) {
    const url = `${ISOK_WFS}?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature`
      + `&TYPENAMES=${encodeURIComponent(layer)}&SRSNAME=EPSG:4326`
      + `&BBOX=${bbox},EPSG:4326&COUNT=1`

    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'SollersInsurance/1.0 (demo)' },
        signal: AbortSignal.timeout(5000),
      })
      if (!r.ok) continue
      const xml = await r.text()

      // Błąd WFS (złe parametry, niedostępna warstwa itp.)
      if (xml.includes('ExceptionReport') || xml.includes('ServiceException')) {
        console.warn(`WFS exception for ${layer}:`, xml.substring(0, 200))
        return null
      }

      // WFS 2.0 — numberReturned jest najbardziej wiarygodne
      const m = xml.match(/numberReturned="(\d+)"/)
      if (m) return parseInt(m[1]) > 0

      // WFS 1.x fallback
      if (xml.includes('<wfs:member>') && !xml.includes('<wfs:member/>')) return true
      if (xml.includes('<gml:featureMember>')) return true

      // Jeśli BBOX zwr 0 dla pierwszego porządku — drugi może dać inny wynik;
      // jeśli numberReturned="0" to wiemy na pewno → nie kontynuujemy
      return false

    } catch {
      // timeout — spróbuj drugiej kolejności osi
    }
  }
  return null  // obie próby nieudane
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { addr, lat, lng, city, apiKey } = req.body as {
    addr: string; lat: number; lng: number; city: string; apiKey?: string
  }

  const cityName = extractCityName(city)
  const key = process.env.ANTHROPIC_API_KEY || apiKey

  // === Ścieżka 1: AI primary (spójny wynik, zna polskie strefy z ISOK/MZP) ===
  if (key) {
    try {
      const aiResult = await checkViaAI(key, addr, lat, lng, cityName)

      // Dla stref powodziowych spróbuj potwierdzić przez ISOK WFS
      if (aiResult.riskLevel !== 'brak') {
        const layer = aiResult.riskLevel === 'Q100' ? 'MZP_Q100' : 'MZP_Q500'
        const wfsResult = await checkViaWFS(layer, lat, lng).catch(() => null)

        if (wfsResult === false) {
          // WFS mówi brak — ale AI mówi ryzyko — ufamy AI, oznaczamy źródło
          return res.json({
            riskLevel: aiResult.riskLevel,
            explanation: `${aiResult.explanation} (ocena AI; serwer ISOK nie potwierdził tej strefy dla podanych koordynatów)`,
          })
        }
        if (wfsResult === true) {
          // Obydwa potwierdzają — podajemy oficjalne źródło
          return res.json({
            riskLevel: aiResult.riskLevel,
            explanation: `${cityName} leży w strefie zagrożenia powodziowego ${aiResult.riskLevel} wg oficjalnych danych ISOK — Wody Polskie. ${aiResult.explanation}`,
          })
        }
        // wfsResult === null (WFS niedostępny) — ufamy AI
      }

      return res.json({
        riskLevel: aiResult.riskLevel,
        explanation: aiResult.riskLevel === 'brak'
          ? `${cityName} nie leży w strefie zagrożenia powodziowego wg danych ISOK — Wody Polskie.`
          : aiResult.explanation,
      })

    } catch (e) {
      console.error('AI flood check error:', e)
      // AI failed — fall through to WFS-only
    }
  }

  // === Ścieżka 2: tylko ISOK WFS (brak klucza AI) ===
  try {
    const q100 = await checkViaWFS('MZP_Q100', lat, lng)
    if (q100 === true) {
      return res.json({
        riskLevel: 'Q100',
        explanation: `${cityName} leży w strefie zagrożenia powodziowego Q100 wg oficjalnych danych ISOK — Wody Polskie.`,
      })
    }
    if (q100 === false) {
      const q500 = await checkViaWFS('MZP_Q500', lat, lng)
      if (q500 === true) {
        return res.json({
          riskLevel: 'Q500',
          explanation: `${cityName} leży w strefie zagrożenia powodziowego Q500 wg oficjalnych danych ISOK — Wody Polskie.`,
        })
      }
      if (q500 === false) {
        return res.json({
          riskLevel: 'brak',
          explanation: `${cityName} nie leży w strefie zagrożenia powodziowego wg danych ISOK — Wody Polskie.`,
        })
      }
    }
  } catch {
    // WFS error
  }

  // === Ścieżka 3: brak klucza i WFS niedostępny ===
  return res.status(503).json({ error: 'Flood check unavailable: no AI key and ISOK WFS unreachable' })
}
