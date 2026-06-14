import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { lat, lng } = req.query as { lat: string; lng: string }
  if (!lat || !lng) return res.status(400).json({ error: 'Missing lat/lng' })

  const la = parseFloat(lat), lo = parseFloat(lng)
  const bbox = `${lo - 0.001},${la - 0.001},${lo + 0.001},${la + 0.001}`

  try {
    let inQ100 = false, inQ500 = false

    for (const layer of ['MZP_Q100', 'MZP_Q500']) {
      const url = `https://wody.isok.gov.pl/wss/INSPIRE/INSPIRE_NZ_HY_MZPMRP_WFS?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=${layer}&CRS=EPSG:4326&BBOX=${bbox}`
      const r = await fetch(url, { signal: AbortSignal.timeout(5000) })
      const xml = await r.text()
      const hasFeatures = xml.includes('featureMember') || xml.includes('<wfs:member')
      if (hasFeatures && layer === 'MZP_Q100') inQ100 = true
      if (hasFeatures && layer === 'MZP_Q500') inQ500 = true
    }

    res.json({ inQ100, inQ500 })
  } catch (e) {
    console.error('ISOK proxy error:', e)
    res.status(502).json({ error: 'ISOK unavailable' })
  }
}
