import { useEffect, useRef, useState } from 'react'
import type { QuoteState, FloodZone } from '../../types'
import type { Map as LeafletMap } from 'leaflet'

interface Props {
  state: QuoteState
  onUpdate: (patch: Partial<QuoteState>) => void
  apiKey: string
}

function cityFromDisplay(displayName: string): string {
  const SKIP = /^(województwo|powiat|gmina|Polska)/i
  const parts = displayName.split(',').map(s => s.trim()).reverse()
  for (const p of parts) {
    if (p && !SKIP.test(p)) return p
  }
  return parts[parts.length - 1] ?? displayName
}

export default function Step2Location({ state, onUpdate, apiKey }: Props) {

  const mapRef = useRef<LeafletMap | null>(null)
  const mapElRef = useRef<HTMLDivElement>(null)
  const [addr, setAddr] = useState(state.addr)
  const [loading, setLoading] = useState(false)
  const [floodSource, setFloodSource] = useState<'isok' | 'ai' | 'isok+ai' | 'demo' | ''>('')

  useEffect(() => {
    if (!state.lat || !mapElRef.current) return

    let cancelled = false

    // Leaflet zostawia _leaflet_id na elemencie nawet po .remove() —
    // React 18 StrictMode odpala efekty dwukrotnie, co powoduje
    // "Map container is already initialized". Usuwamy _leaflet_id ręcznie.
    const el = mapElRef.current as HTMLElement & { _leaflet_id?: number }
    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
    }
    delete el._leaflet_id

    import('leaflet').then(L => {
      if (cancelled || !mapElRef.current) return
      // Ponowne sprawdzenie po async: może inny efekt zdążył zainicjować mapę
      const container = mapElRef.current as HTMLElement & { _leaflet_id?: number }
      if (container._leaflet_id) return

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
      if (!cancelled) mapRef.current = map
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [state.lat])

  const [floodStatus, setFloodStatus] = useState('')

  const doFlood = async () => {
    if (!addr.trim()) return
    setLoading(true)
    setFloodStatus('Szukam adresu…')
    onUpdate({ addr: addr.trim(), floodLoading: true, floodZone: null, floodExp: '' })

    try {
      const gr = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr + ', Polska')}&format=json&limit=1&countrycodes=pl&accept-language=pl`
      )
      const gd = await gr.json()
      if (!gd.length) {
        alert('Nie znaleziono adresu w Polsce. Spróbuj podać pełniejszy adres.')
        setLoading(false)
        setFloodStatus('')
        onUpdate({ floodLoading: false })
        return
      }
      const lat = parseFloat(gd[0].lat)
      const lng = parseFloat(gd[0].lon)
      const city = gd[0].display_name
      onUpdate({ lat, lng, city })
      setFloodStatus('Trwa sprawdzanie strefy powodziowej ISOK…')

      const res = await fetch('/api/flood-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addr: addr.trim(), lat, lng, city, apiKey }),
      })

      if (res.ok) {
        const data = await res.json() as { riskLevel: FloodZone; explanation: string; source?: string }
        setFloodSource((data.source as typeof floodSource) || '')
        onUpdate({ floodZone: data.riskLevel, floodExp: data.explanation, floodLoading: false })
      } else {
        const zones: FloodZone[] = ['brak', 'brak', 'brak', 'Q500', 'Q100']
        const fz = zones[Math.floor(Math.random() * zones.length)]
        const exp = fz === 'brak'
          ? `Lokalizacja ${cityFromDisplay(city)} nie wykazuje istotnego ryzyka powodziowego.`
          : fz === 'Q500'
          ? 'Obszar może być narażony na powódź raz na 500 lat. Rekomendujemy ochronę przeciwpowodziową.'
          : 'Strefa zagrożenia Q100 (raz na 100 lat). Silnie rekomendujemy ubezpieczenie od zalania.'
        setFloodSource('demo')
        onUpdate({ floodZone: fz, floodExp: exp, floodLoading: false })
      }
    } catch (e) {
      console.error(e)
      onUpdate({ floodLoading: false })
    } finally {
      setLoading(false)
      setFloodStatus('')
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

      {floodStatus && (
        <div className="lrow" style={{ margin: '8px 0' }}>
          <span className="spin" />
          {floodStatus}
        </div>
      )}

      {fz && (
        <div>
          <span className={`fbadge ${fcls}`}>
            <i className={`ti ${fico}`} />
            {flbl}
          </span>
          {floodSource && (
            <span style={{
              marginLeft: 8, fontSize: 10, fontWeight: 600, padding: '2px 7px',
              borderRadius: 10, verticalAlign: 'middle',
              background: floodSource === 'isok' || floodSource === 'isok+ai'
                ? 'rgba(34,139,34,.12)' : floodSource === 'ai'
                ? 'rgba(59,130,246,.12)' : 'rgba(120,120,120,.12)',
              color: floodSource === 'isok' || floodSource === 'isok+ai'
                ? '#166534' : floodSource === 'ai'
                ? '#1d4ed8' : '#555',
            }}>
              {floodSource === 'isok' && <><i className="ti ti-database" /> Wody Polskie ISOK</>}
              {floodSource === 'ai' && <><i className="ti ti-sparkles" /> AI (Claude)</>}
              {floodSource === 'isok+ai' && <><i className="ti ti-database" /> ISOK + AI</>}
              {floodSource === 'demo' && <><i className="ti ti-test-pipe" /> tryb demo</>}
            </span>
          )}
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
