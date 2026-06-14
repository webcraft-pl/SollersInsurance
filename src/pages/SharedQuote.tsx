import { useParams, Link } from 'react-router-dom'
import type { Quote } from '../types'
import { fmt, coverageName } from '../lib/pricing'

const TYPE_NAMES: Record<string, string> = { dom: 'Dom jednorodzinny', mieszkanie: 'Mieszkanie', szeregowiec: 'Dom szeregowy', letniskowy: 'Dom letniskowy' }
const MAT_NAMES: Record<string, string> = { mur: 'Mur/beton', drewno: 'Drewno', prefabrykat: 'Prefabrykat' }
const FLOOD_LABELS: Record<string, string> = { brak: 'Brak ryzyka', Q500: 'Strefa Q500', Q100: 'Strefa Q100' }

interface Props {
  quotes: Quote[]
}

export default function SharedQuote({ quotes }: Props) {
  const { id } = useParams<{ id: string }>()
  const quote = quotes.find(q => q.id === id)

  if (!quote) {
    return (
      <div style={{ maxWidth: 600, margin: '4rem auto', padding: '0 1.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: '1rem' }}><i className="ti ti-file-off" /></div>
        <h2 style={{ marginBottom: 8 }}>Kwotowanie nie znalezione</h2>
        <p style={{ color: 'var(--text3)', marginBottom: '1.5rem' }}>ID: {id} — może być niezapisane lub wygasło.</p>
        <Link to="/" className="btn prim"><i className="ti ti-home" /> Strona główna</Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 600, margin: '2rem auto', padding: '0 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <div className="logo" style={{ marginBottom: '1rem' }}>
          <div className="logo-mark"><i className="ti ti-shield-check" /></div>
          <div className="logo-text">
            <div className="logo-top">Sollers Insurance</div>
            <div className="logo-bot">Oferta ubezpieczenia · {quote.id}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="result-top">
          <div className="res-ico"><i className="ti ti-shield-check" /></div>
          <div className="res-amount">{fmt(quote.annual)}</div>
          <div className="res-sub">/ rok · {fmt(Math.round(quote.annual / 12))} / miesiąc</div>
        </div>

        <div className="sum-grid">
          <div className="sum-c"><div className="sum-l">Typ</div><div className="sum-v">{TYPE_NAMES[quote.type]}</div></div>
          <div className="sum-c"><div className="sum-l">Wartość</div><div className="sum-v">{fmt(quote.value)}</div></div>
          <div className="sum-c"><div className="sum-l">Powierzchnia</div><div className="sum-v">{quote.area} m²</div></div>
          <div className="sum-c"><div className="sum-l">Materiał / rok</div><div className="sum-v">{MAT_NAMES[quote.material]} · {quote.year}</div></div>
          {quote.addr && (
            <div className="sum-c" style={{ gridColumn: '1 / -1' }}>
              <div className="sum-l">Lokalizacja</div>
              <div className="sum-v" style={{ fontSize: 12 }}>{quote.addr}</div>
            </div>
          )}
          {quote.floodZone && (
            <div className="sum-c">
              <div className="sum-l">Strefa powodziowa</div>
              <div className="sum-v">{FLOOD_LABELS[quote.floodZone] ?? quote.floodZone}</div>
            </div>
          )}
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
            Zakres ochrony
          </div>
          {quote.covs.map(k => <span key={k} className="cbadge">{coverageName(k)}</span>)}
        </div>

        <div style={{ padding: '12px 0', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text3)' }}>
          Oferta wygenerowana {new Date(quote.createdAt).toLocaleDateString('pl-PL')} · ID: {quote.id}
        </div>
      </div>

      <div style={{ marginTop: '1rem', textAlign: 'center' }}>
        <Link to="/" className="btn prim"><i className="ti ti-calculator" /> Oblicz własną składkę</Link>
      </div>
    </div>
  )
}
