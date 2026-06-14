import { useState } from 'react'
import type { ProductConfig } from '../types'
import { calcPrice, fmt } from '../lib/pricing'

const PREVIEW_STATE = {
  step: 6, type: 'dom' as const, addr: '', lat: null, lng: null, city: '',
  floodZone: null, floodExp: '', floodLoading: false,
  year: 2005, material: 'mur' as const, area: 150, value: 600000, floors: 2,
  renovation: false, alarm: true, monitoring: false, doors: true, fire: false,
  coverages: new Set<import('../types').Coverage>(['mury', 'oc', 'kradziez', 'zalanie']),
  packages: null, pkgLoading: false, payPeriod: 'annual' as const, savedId: null,
}

interface Props {
  cfg: ProductConfig
  onCfgChange: (cfg: ProductConfig) => void
  unlocked: boolean
  onUnlock: () => void
}

export default function ProductConfigurator({ cfg, onCfgChange, unlocked, onUnlock }: Props) {
  const [pw, setPw] = useState('')

  const update = (patch: Partial<ProductConfig>) => onCfgChange({ ...cfg, ...patch })

  if (!unlocked) {
    return (
      <div className="card">
        <div className="cfg-lock">
          <div className="cfg-lock-icon"><i className="ti ti-lock" /></div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Konfiguracja produktu ubezpieczeniowego</h3>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: '1.25rem' }}>
            Ten panel pozwala ubezpieczycielowi konfigurować parametry produktu — stawki, mnożniki, dostępność opcji — na wzór platformy RIFE.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
            <input
              type="password"
              placeholder="Hasło dostępu"
              style={{ width: 200 }}
              value={pw}
              onChange={e => setPw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (pw === 'sollers' ? onUnlock() : alert('Nieprawidłowe hasło.'))}
            />
            <button className="btn prim" onClick={() => pw === 'sollers' ? onUnlock() : alert('Nieprawidłowe hasło.')}>
              <i className="ti ti-lock-open" /> Odblokuj
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10 }}>
            Demo: hasło to <code style={{ background: 'var(--bg2)', padding: '2px 6px', borderRadius: 4 }}>sollers</code>
          </p>
        </div>
      </div>
    )
  }

  const prev = calcPrice(PREVIEW_STATE as Parameters<typeof calcPrice>[0], cfg)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}><i className="ti ti-settings" /> Konfiguracja produktu</h2>
        <span style={{ fontSize: 12, color: 'var(--ok-t)' }}><i className="ti ti-lock-open" /> Tryb ubezpieczyciela</span>
      </div>
      <div className="cfg-grid">
        <div>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="cfg-section-title"><i className="ti ti-percentage" /> Stawki bazowe</div>
            <div className="cfg-row">
              <div className="cfg-row-l">
                <div className="cfg-row-n">Stawka bazowa</div>
                <div className="cfg-row-d">% wartości nieruchomości rocznie</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)' }}>{(cfg.baseRate * 100).toFixed(3)}%</div>
                <input
                  type="range" className="cfg-slider" min="0.05" max="0.50" step="0.01"
                  value={(cfg.baseRate * 100).toFixed(2)}
                  onChange={e => update({ baseRate: parseFloat(e.target.value) / 100 })}
                />
              </div>
            </div>

            <div className="cfg-section-title" style={{ marginTop: '1rem' }}><i className="ti ti-layers-intersect" /> Mnożniki materiałowe</div>
            {(Object.entries(cfg.matMult) as [keyof typeof cfg.matMult, number][]).map(([k, v]) => (
              <div className="cfg-row" key={k}>
                <div className="cfg-row-l"><div className="cfg-row-n">{k.charAt(0).toUpperCase() + k.slice(1)}</div></div>
                <input type="number" className="cfg-input" value={v} min="0.5" max="3" step="0.05"
                  onChange={e => update({ matMult: { ...cfg.matMult, [k]: parseFloat(e.target.value) || 1 } })} />
              </div>
            ))}

            <div className="cfg-section-title" style={{ marginTop: '1rem' }}><i className="ti ti-calendar" /> Mnożniki wiekowe</div>
            {([
              ['pre1945nr', 'Przed 1945 (bez remontu)'],
              ['pre1945r', 'Przed 1945 (po remoncie)'],
              ['y45_70', '1945–1970'],
              ['y70_00', '1970–2000'],
              ['modern', 'Po 2000'],
            ] as [keyof typeof cfg.ageMult, string][]).map(([k, lbl]) => (
              <div className="cfg-row" key={k}>
                <div className="cfg-row-l"><div className="cfg-row-n">{lbl}</div></div>
                <input type="number" className="cfg-input" value={cfg.ageMult[k]} min="0.5" max="3" step="0.05"
                  onChange={e => update({ ageMult: { ...cfg.ageMult, [k]: parseFloat(e.target.value) || 1 } })} />
              </div>
            ))}
          </div>

          <div className="card">
            <div className="cfg-section-title"><i className="ti ti-lock" /> Rabaty za zabezpieczenia (%)</div>
            {(Object.entries(cfg.secDisc) as [keyof typeof cfg.secDisc, number][]).map(([k, v]) => (
              <div className="cfg-row" key={k}>
                <div className="cfg-row-l">
                  <div className="cfg-row-n">{{ alarm: 'Alarm', monitoring: 'Monitoring 24h', doors: 'Drzwi antywłam.', fire: 'System p.poż.' }[k]}</div>
                </div>
                <input type="number" className="cfg-input" value={v} min="0" max="30" step="1"
                  onChange={e => update({ secDisc: { ...cfg.secDisc, [k]: parseInt(e.target.value) || 0 } })} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="preview-box card" style={{ marginBottom: '1rem' }}>
            <div className="preview-title"><i className="ti ti-eye" /> Podgląd na żywo — przykładowy klient</div>
            <div style={{ fontSize: 12, color: 'var(--green-dd)', marginBottom: 10 }}>
              Dom murowy 2005 r., 150 m², wartość 600 000 PLN, alarm + drzwi, mury + OC + kradzież + zalanie
            </div>
            <div className="preview-amount">{fmt(prev.annual)}</div>
            <div style={{ fontSize: 12, color: 'var(--green-dd)', marginTop: 2 }}>/rok · {fmt(prev.monthly)}/mies.</div>
            <div style={{ marginTop: '.75rem' }}>
              {prev.lines.map((l, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--green-dd)', padding: '2px 0', borderBottom: '1px solid rgba(120,167,66,.2)' }}>
                  <span>{l.l}</span>
                  <span>{l.t === 'dis' ? '−' + fmt(-l.v) : fmt(l.v)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="cfg-section-title"><i className="ti ti-toggle-right" /> Dostępność opcji</div>
            {(Object.entries(cfg.opts) as [keyof typeof cfg.opts, typeof cfg.opts[keyof typeof cfg.opts]][]).map(([k, o]) => (
              <div className="cfg-row" key={k}>
                <div className="cfg-row-l">
                  <div className="cfg-row-n">{o.label}</div>
                  <div className="cfg-row-d">{o.fixed !== null ? `${o.fixed} zł/rok` : o.pct !== null ? `${((o.pct) * 100).toFixed(3)}% wartości` : ''}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {o.fixed !== null ? (
                    <input type="number" className="cfg-input" style={{ width: 70 }} value={o.fixed} min="0" step="10"
                      onChange={e => update({ opts: { ...cfg.opts, [k]: { ...o, fixed: parseInt(e.target.value) || 0 } } })} />
                  ) : o.pct !== null ? (
                    <input type="number" className="cfg-input" style={{ width: 70 }} value={((o.pct) * 10000).toFixed(1)} min="0" step="0.1"
                      onChange={e => update({ opts: { ...cfg.opts, [k]: { ...o, pct: parseFloat(e.target.value) / 10000 || 0 } } })} />
                  ) : null}
                  <button
                    className={`toggle${o.on ? ' on' : ''}`}
                    onClick={() => update({ opts: { ...cfg.opts, [k]: { ...o, on: !o.on } } })}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
