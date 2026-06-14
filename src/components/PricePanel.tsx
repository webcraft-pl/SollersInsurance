import type { QuoteState, ProductConfig, PayPeriod } from '../types'
import { calcPrice, fmt } from '../lib/pricing'

interface Props {
  state: QuoteState
  cfg: ProductConfig
  onPayPeriodChange: (p: PayPeriod) => void
}

export default function PricePanel({ state, cfg, onPayPeriodChange }: Props) {
  const { annual, monthly, quarterly, lines, risks } = calcPrice(state, cfg)
  const has = annual > 0
  const amount = state.payPeriod === 'monthly' ? monthly : state.payPeriod === 'quarterly' ? quarterly : annual
  const per = state.payPeriod === 'monthly' ? ' / miesiąc' : state.payPeriod === 'quarterly' ? ' / kwartał' : ' / rok'

  return (
    <div className="pp fade-in">
      <div className="pp-label">Szacowana składka</div>
      {has ? (
        <>
          <div className="pp-amount">{fmt(amount)}</div>
          <div className="pp-mo">{per}</div>
          <div className="rate-tabs">
            {(['annual', 'quarterly', 'monthly'] as PayPeriod[]).map(p => (
              <div
                key={p}
                className={`rate-tab${state.payPeriod === p ? ' active' : ''}`}
                onClick={() => onPayPeriodChange(p)}
              >
                {p === 'annual' ? 'Roczna' : p === 'quarterly' ? 'Kwartalna' : 'Miesięczna'}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="pp-amount" style={{ fontSize: 22, color: 'var(--text3)' }}>—</div>
          <div className="pp-mo">Uzupełnij dane kalkulatora</div>
        </>
      )}
      {lines.length > 0 && (
        <>
          <div className="sep" />
          {lines.map((l, i) => (
            <div key={i} className={`ppl${l.t === 'dis' ? ' disc' : ''}`}>
              <span className="pl" style={l.t === 'base' ? { fontWeight: 600, color: 'var(--text)' } : {}}>{l.l}</span>
              <span className="pv">{l.t === 'dis' ? '−' + fmt(-l.v) : fmt(l.v)}</span>
            </div>
          ))}
          <div className="ppl tot">
            <span>Łącznie / rok</span>
            <span className="pv">{fmt(annual)}</span>
          </div>
        </>
      )}
      {risks.length > 0 && (
        <>
          <div className="sep" />
          {risks.map((r, i) => (
            <div key={i} className={`rf ${r.t}`}>
              <i className="ti ti-alert-triangle" />
              <span>{r.m}</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
