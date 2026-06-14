import type { QuoteState, ProductConfig } from '../../types'

interface Props {
  state: QuoteState
  onUpdate: (patch: Partial<QuoteState>) => void
  cfg: ProductConfig
}

type SecurityField = 'alarm' | 'monitoring' | 'doors' | 'fire'

export default function Step4Security({ state, onUpdate, cfg }: Props) {
  const isHouse = state.type !== 'mieszkanie'

  const toggle = (field: SecurityField) => onUpdate({ [field]: !state[field] } as Partial<QuoteState>)

  const toggles: { id: SecurityField; n: string; d: string; di: string }[] = [
    { id: 'alarm',      n: 'System alarmowy',       d: 'Aktywny alarm z powiadomieniem centrum',   di: `–${cfg.secDisc.alarm}% składki` },
    { id: 'monitoring', n: 'Monitoring 24h',         d: 'Kamera lub ochrona fizyczna obiektu',      di: `–${cfg.secDisc.monitoring}% składki` },
    { id: 'doors',      n: 'Drzwi antywłamaniowe',   d: 'Klasa C lub wyższa (certyfikat RC3+)',      di: `–${cfg.secDisc.doors}% składki` },
    ...(isHouse ? [{ id: 'fire' as SecurityField, n: 'System p.poż.', d: 'Czujniki dymu, hydrant lub gaśnice', di: `–${cfg.secDisc.fire}% składki` }] : []),
  ]

  return (
    <div className="card fade-in">
      <div className="step-h">Zabezpieczenia nieruchomości</div>
      <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: '1rem' }}>
        Każde aktywne zabezpieczenie obniża składkę roczną.
      </p>
      {toggles.map(t => (
        <div className="tog-row" key={t.id}>
          <div>
            <div className="tog-n">{t.n}</div>
            <div className="tog-d">{t.d}</div>
            <div className="tog-disc">{t.di}</div>
          </div>
          <button
            className={`toggle${state[t.id] ? ' on' : ''}`}
            onClick={() => toggle(t.id)}
          />
        </div>
      ))}
      <div className="nav">
        <button className="btn ghost" onClick={() => onUpdate({ step: 3 })}>
          <i className="ti ti-arrow-left" /> Wstecz
        </button>
        <button className="btn prim" onClick={() => onUpdate({ step: 5 })}>
          Dalej <i className="ti ti-arrow-right" />
        </button>
      </div>
    </div>
  )
}
