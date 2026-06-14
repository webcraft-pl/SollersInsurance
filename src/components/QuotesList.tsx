import type { Quote } from '../types'
import { fmt } from '../lib/pricing'

const TYPE_ICONS: Record<string, string> = { mieszkanie: 'ti-building', letniskowy: 'ti-tent', dom: 'ti-home-2', szeregowiec: 'ti-home-2' }
const TYPE_NAMES: Record<string, string> = { dom: 'Dom jednorodzinny', mieszkanie: 'Mieszkanie', szeregowiec: 'Dom szeregowy', letniskowy: 'Dom letniskowy' }

interface Props {
  quotes: Quote[]
  onDelete: (id: string) => void
  onNewQuote: () => void
}

export default function QuotesList({ quotes, onDelete, onNewQuote }: Props) {
  const copyLink = (id: string) => {
    const url = `${window.location.origin}/q/${id}`
    navigator.clipboard.writeText(url).then(() => alert('Link skopiowany!')).catch(() => alert('Link: ' + url))
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Moje oferty</h2>
        <button className="btn sm" onClick={onNewQuote}><i className="ti ti-plus" /> Nowe kwotowanie</button>
      </div>
      {!quotes.length ? (
        <div className="empty">
          <i className="ti ti-file-off" />
          <p>Brak zapisanych ofert.</p>
          <button className="btn prim" onClick={onNewQuote} style={{ marginTop: '1rem' }}>
            <i className="ti ti-plus" /> Nowe kwotowanie
          </button>
        </div>
      ) : (
        quotes.map(q => (
          <div className="ql-item" key={q.id}>
            <div className="ql-icon"><i className={`ti ${TYPE_ICONS[q.type] ?? 'ti-home-2'}`} /></div>
            <div className="ql-body">
              <div className="ql-title">{TYPE_NAMES[q.type]} · {q.area} m² · {q.year} r.</div>
              <div className="ql-sub">{q.addr || 'Brak adresu'} · Wartość: {fmt(q.value)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="ql-price">{fmt(q.annual)}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>/ rok</div>
            </div>
            <div className="ql-actions">
              <button className="btn sm" onClick={() => copyLink(q.id)}><i className="ti ti-link" /></button>
              <button className="btn sm" onClick={() => confirm('Usunąć to kwotowanie?') && onDelete(q.id)}>
                <i className="ti ti-trash" style={{ color: 'var(--err-t)' }} />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
