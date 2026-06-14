import { useState } from 'react'
import type { Quote, QuoteStatus } from '../types'
import { fmt, fmtR } from '../lib/pricing'

const TYPE_NAMES: Record<string, string> = { dom: 'Dom jednorodzinny', mieszkanie: 'Mieszkanie', szeregowiec: 'Dom szeregowy', letniskowy: 'Dom letniskowy' }
const STATUS_LABEL: Record<QuoteStatus, string> = { new: 'Nowe', contact: 'W kontakcie', closed: 'Zamknięte' }
const STATUS_CLS: Record<QuoteStatus, string> = { new: 'st-new', contact: 'st-contact', closed: 'st-closed' }

interface Props {
  quotes: Quote[]
  onStatusChange: (id: string, status: QuoteStatus) => void
}

export default function AgentPanel({ quotes, onStatusChange }: Props) {
  const [filter, setFilter] = useState<'all' | QuoteStatus>('all')

  const nw = quotes.filter(q => q.status === 'new').length
  const ct = quotes.filter(q => q.status === 'contact').length
  const cl = quotes.filter(q => q.status === 'closed').length
  const totalVal = quotes.reduce((s, q) => s + q.annual, 0)

  const filtered = filter === 'all' ? quotes : quotes.filter(q => q.status === filter)

  const copyLink = (id: string) => {
    const url = `${window.location.origin}/q/${id}`
    navigator.clipboard.writeText(url).then(() => alert('Link skopiowany!')).catch(() => alert('Link: ' + url))
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Panel agenta</h2>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value as typeof filter)}
          style={{ fontSize: 13, padding: '6px 10px', width: 'auto' }}
        >
          <option value="all">Wszystkie statusy</option>
          <option value="new">Nowe</option>
          <option value="contact">W kontakcie</option>
          <option value="closed">Zamknięte</option>
        </select>
      </div>

      <div className="agent-stats">
        <div className="stat-card">
          <div className="stat-n">Wszystkie kwotowania</div>
          <div className="stat-v">{quotes.length}</div>
          <div className="stat-sub">od uruchomienia</div>
        </div>
        <div className="stat-card">
          <div className="stat-n"><span className="status-badge st-new">Nowe</span></div>
          <div className="stat-v">{nw}</div>
          <div className="stat-sub">wymaga kontaktu</div>
        </div>
        <div className="stat-card">
          <div className="stat-n"><span className="status-badge st-contact">W kontakcie</span></div>
          <div className="stat-v">{ct}</div>
          <div className="stat-sub">trwa rozmowa</div>
        </div>
        <div className="stat-card">
          <div className="stat-n">Portfolio roczne</div>
          <div className="stat-v" style={{ fontSize: 18 }}>{fmtR(totalVal)}</div>
          <div className="stat-sub">potencjalne składki</div>
        </div>
      </div>

      {!filtered.length ? (
        <div className="empty" style={{ padding: '2rem' }}>
          <i className="ti ti-inbox" />
          <p>Brak kwotowań{filter !== 'all' ? ' w tym statusie' : ''}.</p>
        </div>
      ) : (
        filtered.map(q => (
          <div className="ql-item" key={q.id}>
            <div className="ql-icon">
              <i className={`ti ${q.type === 'mieszkanie' ? 'ti-building' : 'ti-home-2'}`} />
            </div>
            <div className="ql-body">
              <div className="ql-title">
                {TYPE_NAMES[q.type]} · {q.area} m² · {q.year} r.
                <span className={`status-badge ${STATUS_CLS[q.status]}`} style={{ marginLeft: 6 }}>
                  {STATUS_LABEL[q.status]}
                </span>
              </div>
              <div className="ql-sub">{q.addr || '—'} · {fmt(q.value)} · ID: {q.id}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="ql-price">{fmt(q.annual)}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>/rok</div>
            </div>
            <div className="ql-actions">
              <select
                value={q.status}
                onChange={e => onStatusChange(q.id, e.target.value as QuoteStatus)}
                style={{ fontSize: 12, padding: '4px 8px', width: 'auto' }}
              >
                <option value="new">Nowe</option>
                <option value="contact">W kontakcie</option>
                <option value="closed">Zamknięte</option>
              </select>
              <button className="btn sm" onClick={() => copyLink(q.id)}><i className="ti ti-link" /></button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
