import { useEffect, useState } from 'react'
import type { QuoteState, ProductConfig, Quote, PayPeriod, Package } from '../../types'
import { calcPrice, fmt, coverageName, uid } from '../../lib/pricing'

const TYPE_NAMES: Record<string, string> = { dom: 'Dom jednorodzinny', mieszkanie: 'Mieszkanie', szeregowiec: 'Dom szeregowy', letniskowy: 'Dom letniskowy' }
const MAT_NAMES: Record<string, string> = { mur: 'Mur/beton', drewno: 'Drewno', prefabrykat: 'Prefabrykat' }

interface Props {
  state: QuoteState
  onUpdate: (patch: Partial<QuoteState>) => void
  cfg: ProductConfig
  apiKey: string
  onSaveQuote: (q: Quote) => void
  onReset: () => void
}

export default function StepResult({ state, onUpdate, cfg, apiKey, onSaveQuote, onReset }: Props) {
  const { annual, monthly, quarterly, lines, risks } = calcPrice(state, cfg)
  const amount = state.payPeriod === 'monthly' ? monthly : state.payPeriod === 'quarterly' ? quarterly : annual
  const per = state.payPeriod === 'monthly' ? ' / miesiąc' : state.payPeriod === 'quarterly' ? ' / kwartał' : ' / rok'
  const [qid] = useState(() => state.savedId || uid())
  const shareUrl = `${window.location.origin}/q/${qid}`

  const sec = [
    state.alarm && 'Alarm',
    state.monitoring && 'Monitoring 24h',
    state.doors && 'Drzwi antywłamaniowe',
    state.fire && 'System p.poż.',
  ].filter(Boolean) as string[]

  useEffect(() => {
    if (state.packages !== null || state.pkgLoading) return
    loadPackages()
  }, [])

  const loadPackages = async () => {
    onUpdate({ pkgLoading: true })
    try {
      const res = await fetch('/api/generate-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteState: { ...state, coverages: [...state.coverages] }, annualPremium: annual, apiKey }),
      })
      if (res.ok) {
        const pkgs = await res.json() as Package[]
        onUpdate({ packages: pkgs, pkgLoading: false })
      } else {
        throw new Error('api error')
      }
    } catch {
      onUpdate({
        packages: [
          { name: 'Podstawowy', price: Math.round(annual * 0.75), features: ['Mury i elementy stałe', 'Zalanie (standard)', 'Przepięcie elektryczne'], reason: 'Minimalna ochrona bez opcji dodatkowych. Dobra dla ograniczonego budżetu.' },
          { name: 'Standard', price: annual, features: [...state.coverages].map(coverageName).slice(0, 4), reason: `Rekomendowany dla ${TYPE_NAMES[state.type!] ?? 'tej nieruchomości'}. Optymalny stosunek ceny do zakresu.` },
          { name: 'Premium', price: Math.round(annual * 1.35), features: ['Pełny zakres + OC', 'Assistance 24h Premium', 'NNW dla domowników', 'Ubezpieczenie sprzętu'], reason: 'Kompleksowa ochrona dla wymagających. Pokrycie również poza nieruchomością.' },
        ],
        pkgLoading: false,
      })
    }
  }

  const saveQuote = () => {
    const id = state.savedId || qid
    const q: Quote = {
      id, type: state.type!, addr: state.addr, value: state.value,
      material: state.material, year: state.year, area: state.area,
      floodZone: state.floodZone, alarm: state.alarm, monitoring: state.monitoring,
      doors: state.doors, fire: state.fire, covs: [...state.coverages],
      annual, status: 'new', createdAt: new Date().toISOString(),
    }
    onSaveQuote(q)
    onUpdate({ savedId: id })
    alert(`Kwotowanie zapisane!\nLink: ${window.location.origin}/q/${id}\n\nMożesz je znaleźć w zakładce "Moje oferty".`)
  }

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl)
      .then(() => alert('Link skopiowany do schowka!'))
      .catch(() => alert('Link: ' + shareUrl))
  }

  return (
    <div className="card fade-in">
      <div className="result-top">
        <div className="res-ico"><i className="ti ti-shield-check" /></div>
        <div className="res-amount">{fmt(amount)}</div>
        <div className="res-sub">{per} · roczna {fmt(annual)}</div>
        <div className="rate-tabs" style={{ justifyContent: 'center', marginTop: 10 }}>
          {(['annual', 'quarterly', 'monthly'] as PayPeriod[]).map(p => (
            <div key={p} className={`rate-tab${state.payPeriod === p ? ' active' : ''}`} onClick={() => onUpdate({ payPeriod: p })}>
              {p === 'annual' ? 'Roczna' : p === 'quarterly' ? 'Kwartalna' : 'Miesięczna'}
            </div>
          ))}
        </div>
      </div>

      {risks.map((r, i) => (
        <div key={i} className={`rf ${r.t}`} style={{ marginBottom: 8 }}>
          <i className="ti ti-alert-triangle" /><span>{r.m}</span>
        </div>
      ))}

      <div className="sum-grid">
        <div className="sum-c"><div className="sum-l">Typ</div><div className="sum-v">{TYPE_NAMES[state.type!] ?? ''}</div></div>
        <div className="sum-c"><div className="sum-l">Wartość</div><div className="sum-v">{fmt(state.value)}</div></div>
        <div className="sum-c"><div className="sum-l">Powierzchnia</div><div className="sum-v">{state.area} m²</div></div>
        <div className="sum-c"><div className="sum-l">Materiał / rok</div><div className="sum-v">{MAT_NAMES[state.material]} · {state.year}</div></div>
        {state.addr && (
          <div className="sum-c" style={{ gridColumn: '1 / -1' }}>
            <div className="sum-l">Lokalizacja</div>
            <div className="sum-v" style={{ fontSize: 12 }}>{state.addr}</div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Zakres ochrony</div>
        {[...state.coverages].map(k => <span key={k} className="cbadge">{coverageName(k)}</span>)}
      </div>

      {sec.length > 0 && (
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: '1.25rem' }}>
          <i className="ti ti-lock" /> Zabezpieczenia: {sec.join(' · ')}
        </p>
      )}

      <div className="sep" />
      <div style={{ marginBottom: '1.25rem' }}>
        {lines.map((l, i) => (
          <div key={i} className={`ppl${l.t === 'dis' ? ' disc' : ''}`}>
            <span className="pl" style={l.t === 'base' ? { fontWeight: 600, color: 'var(--text)' } : {}}>{l.l}</span>
            <span className="pv">{l.t === 'dis' ? '−' + fmt(-l.v) : fmt(l.v)}</span>
          </div>
        ))}
        <div className="ppl tot">
          <span>Łączna składka roczna</span>
          <span className="pv">{fmt(annual)}</span>
        </div>
      </div>

      <div className="share-box">
        <i className="ti ti-link" style={{ color: 'var(--info-t)', flexShrink: 0 }} />
        <span className="share-url">{shareUrl}</span>
        <button className="btn sm" onClick={copyLink}><i className="ti ti-copy" /> Kopiuj</button>
      </div>

      <button className="btn prim" style={{ width: '100%', marginBottom: 8 }} onClick={saveQuote}>
        <i className="ti ti-device-floppy" /> Zapisz kwotowanie
      </button>
      <button className="btn" style={{ width: '100%', marginBottom: '1rem' }} onClick={() => onUpdate({ step: 5 })}>
        <i className="ti ti-edit" /> Edytuj zakres
      </button>

      {/* AI Packages */}
      {state.pkgLoading && (
        <div className="lrow"><span className="spin" /> AI generuje rekomendacje pakietów…</div>
      )}
      {state.packages && (
        <div style={{ marginTop: '1.25rem' }}>
          <div className="card-title"><i className="ti ti-stars" /> Rekomendowane pakiety</div>
          <div className="pkg-grid">
            {state.packages.map((p, i) => (
              <div key={p.name} className={`pkg${i === 1 ? ' recommended' : ''}`}>
                {i === 1 && <div className="pkg-badge"><i className="ti ti-star-filled" /> Rekomendowany</div>}
                <div className="pkg-name">{p.name}</div>
                <div className="pkg-price">{fmt(p.price)}<span> / rok</span></div>
                <ul className="pkg-feat">{p.features.map(f => <li key={f}>{f}</li>)}</ul>
                <div className="pkg-ai">{p.reason}</div>
                <button className="btn prim sm" style={{ width: '100%', marginTop: 10 }}
                  onClick={() => alert(`W wersji produkcyjnej: przejście do zamówienia pakietu ${p.name}`)}>
                  Wybierz pakiet
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button className="btn ghost" style={{ width: '100%', marginTop: 8 }} onClick={onReset}>
        <i className="ti ti-refresh" /> Nowe kwotowanie
      </button>
      <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 12, lineHeight: 1.5 }}>
        Kalkulator ma charakter orientacyjny. Ostateczna składka zależy od indywidualnej oceny ryzyka. Ceny w PLN netto.
      </p>
    </div>
  )
}
