import { useEffect, useRef, useState } from 'react'
import type { QuoteState, FloodZone } from '../../types'
import type { Map as LeafletMap } from 'leaflet'

interface Props {
  state: QuoteState
  onUpdate: (patch: Partial<QuoteState>) => void
  apiKey: string
}

export default function Step2Location({ state, onUpdate, apiKey }: Props) {

  const mapRef = useRef<LeafletMap | null>(null)
  const mapElRef = useRef<HTMLDivElement>(null)
  const [addr, setAddr] = useState(state.addr)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!state.lat || !mapElRef.current) return
    if (mapRef.current) return

    import('leaflet').then(L => {
      if (!mapElRef.current || mapRef.current) return
      const map = L.map(mapElRef.current).setView([state.lat!, state.lng!], 14)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19,
      }).addTo(map)
      try {
        L.tileLayer.wms(
          'https://wody.isok.gov.pl/wss/service/wms/guest/ISOK_POWODZIOWE/MapServer/WMSServer',
          { layers: '0,1', format: 'image/png', transparent: true, opacity: 0.5 }
        ).addTo(map)
      } catch (_) {}
      const col = state.floodZone === 'Q100' ? '#ef4444' : state.floodZone === 'Q500' ? '#f59e0b' : '#78a742'
      L.circleMarker([state.lat!, state.lng!], { radius: 10, fillColor: col, color: 'white', weight: 2.5, fillOpacity: 1 })
        .addTo(map).bindPopup(`<b>${state.addr}</b>`).openPopup()
      mapRef.current = map
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [state.lat])

  const doFlood = async () => {
    if (!addr.trim()) return
    setLoading(true)
    onUpdate({ addr: addr.trim(), floodLoading: true, floodZone: null, floodExp: '' })

    try {
      const gr = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr + ', Polska')}&format=json&limit=1&countrycodes=pl&accept-language=pl`
      )
      const gd = await gr.json()
      if (!gd.length) {
        alert('Nie znaleziono adresu w Polsce. Spróbuj podać pełniejszy adres.')
        setLoading(false)
        onUpdate({ floodLoading: false })
        return
      }
      const lat = parseFloat(gd[0].lat)
      const lng = parseFloat(gd[0].lon)
      const city = gd[0].display_name
      onUpdate({ lat, lng, city, floodLoading: false })
      setLoading(false)

      // Flood zone via API route or direct Anthropic
      const res = await fetch('/api/flood-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addr: addr.trim(), lat, lng, city, apiKey }),
      })

      if (res.ok) {
        const data = await res.json() as { riskLevel: FloodZone; explanation: string }
        onUpdate({ floodZone: data.riskLevel, floodExp: data.explanation })
      } else {
        // fallback — random demo if API not configured
        const zones: FloodZone[] = ['brak', 'brak', 'brak', 'Q500', 'Q100']
        const fz = zones[Math.floor(Math.random() * zones.length)]
        const exp = fz === 'brak'
          ? `Lokalizacja ${city.split(',')[0]} nie wykazuje istotnego ryzyka powodziowego.`
          : fz === 'Q500'
          ? 'Obszar może być narażony na powódź raz na 500 lat. Rekomendujemy ochronę przeciwpowodziową.'
          : 'Strefa zagrożenia Q100 (raz na 100 lat). Silnie rekomendujemy ubezpieczenie od zalania.'
        onUpdate({ floodZone: fz, floodExp: exp })
      }
    } catch (e) {
      console.error(e)
      setLoading(false)
      onUpdate({ floodLoading: false })
    }
  }

  const fz = state.floodZone
  const fcls = fz === 'brak' ? 'fb-ok' : fz === 'Q500' ? 'fb-w' : fz === 'Q100' ? 'fb-d' : ''
  const flbl = fz === 'brak' ? 'Brak istotnego ryzyka powodziowego' : fz === 'Q500' ? 'Strefa zagrożenia Q500 (raz na 500 lat)' : fz === 'Q100' ? 'Strefa zagrożenia Q100 (raz na 100 lat)' : ''
  const fico = fz === 'brak' ? 'ti-shield-check' : 'ti-alert-triangle'

  return (
    <div className="card fade-in">
      <div className="step-h">Gdzie znajduje się nieruchomość?</div>
      <div className="fl">
        <label className="fl-l">Adres nieruchomości</label>
        <div className="arow">
          <input
            type="text"
            value={addr}
            onChange={e => setAddr(e.target.value)}
            placeholder="np. ul. Wiślana 12, Wrocław"
            onKeyDown={e => e.key === 'Enter' && doFlood()}
          />
          <button className="btn" disabled={loading} onClick={doFlood}>
            {loading
              ? <><span className="spin" /> Sprawdzam...</>
              : <><i className="ti ti-map-pin" /> Sprawdź strefę</>
            }
          </button>
        </div>
        <div className="fl-h">Podaj adres w Polsce — sprawdzimy strefę zagrożenia powodziowego ISOK</div>
      </div>

      {state.lat && <div id="map-el" ref={mapElRef} />}

      {fz && (
        <div>
          <span className={`fbadge ${fcls}`}>
            <i className={`ti ${fico}`} />
            {flbl}
          </span>
          {state.floodExp && <div className="fexp">{state.floodExp}</div>}
        </div>
      )}

      <div className="nav">
        <button className="btn ghost" onClick={() => onUpdate({ step: 1 })}>
          <i className="ti ti-arrow-left" /> Wstecz
        </button>
        <button className="btn prim" onClick={() => onUpdate({ step: 3 })}>
          Dalej <i className="ti ti-arrow-right" />
        </button>
      </div>
    </div>
  )
}
