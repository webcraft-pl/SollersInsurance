import type { QuoteState, ProductConfig, Coverage } from '../../types'
import { fmt, coverageName } from '../../lib/pricing'

interface Props {
  state: QuoteState
  onUpdate: (patch: Partial<QuoteState>) => void
  cfg: ProductConfig
}

export default function Step5Coverage({ state, onUpdate, cfg }: Props) {
  const v = state.value || 500000
  const isLetniskowy = state.type === 'letniskowy'
  const fz = state.floodZone

  const floodCost = fz === 'Q100' ? (cfg.opts.zalanie.q100 ?? 499)
    : fz === 'Q500' ? (cfg.opts.zalanie.q500 ?? 269)
    : (cfg.opts.zalanie.fixed ?? 149)

  const theftCost = Math.round(
    v * (cfg.opts.kradziez.pct ?? 0.00025) *
    (!state.alarm && !state.monitoring ? 1.3 : (!state.alarm || !state.monitoring) ? 1.15 : 1)
  )

  const opts: { id: Coverage; locked?: boolean; show?: boolean; warn?: boolean; n: string; d: string; p: string }[] = [
    { id: 'mury',       locked: true,  n: 'Mury i elementy stałe',       d: 'Ściany, dach, fundamenty, stałe elementy wyposażenia',                 p: fmt(Math.round(v * cfg.baseRate)) },
    { id: 'ruchomosci', show: cfg.opts.ruchomosci.on, n: 'Ruchomości domowe',        d: 'Meble, AGD, elektronika, odzież i inne',                        p: fmt(Math.round(v * (cfg.opts.ruchomosci.pct ?? 0.0004))) },
    { id: 'oc',         show: cfg.opts.oc.on && !isLetniskowy,           n: 'OC w życiu prywatnym',         d: 'Odpowiedzialność za szkody wyrządzone osobom trzecim',              p: `${cfg.opts.oc.fixed ?? 149} zł` },
    { id: 'assistance', show: cfg.opts.assistance.on, n: 'Assistance 24h',             d: 'Pomoc hydraulika, elektryka, ślusarza 24/7',                    p: `${cfg.opts.assistance.fixed ?? 119} zł` },
    { id: 'szyby',      show: cfg.opts.szyby.on,      n: 'Szyby i oszklenia',           d: 'Stłuczenia szyb okiennych, drzwiowych, witryn',                 p: `${cfg.opts.szyby.fixed ?? 79} zł` },
    { id: 'zalanie',    show: cfg.opts.zalanie.on,    warn: fz === 'Q100' || fz === 'Q500',
      n: 'Zalanie i powódź' + (fz && fz !== 'brak' ? ` — strefa ${fz}` : ''),
      d: fz === 'Q100' ? '⚠ Wysoka strefa ryzyka — znaczna dopłata za ryzyko powodziowe'
        : fz === 'Q500' ? '⚠ Umiarkowana strefa ryzyka — dopłata za ryzyko powodziowe'
        : 'Zalanie wodą opadową, pęknięcie rur, powódź rzeczna',
      p: fmt(floodCost) + (fz && fz !== 'brak' ? ' *' : ''),
    },
    { id: 'przepięcie', show: cfg.opts.przepięcie.on, n: 'Przepięcie elektryczne',       d: 'Uszkodzenia sprzętu od przepięcia w sieci energetycznej',        p: `${cfg.opts.przepięcie.fixed ?? 49} zł` },
    { id: 'kradziez',   show: cfg.opts.kradziez.on,   n: 'Kradzież z włamaniem',         d: 'Kradzież mienia na skutek włamania' + (!state.alarm && !state.monitoring ? ' — dopłata za brak zabezpieczeń' : ''), p: fmt(theftCost) },
    { id: 'wandalizm',  show: cfg.opts.wandalizm.on,  n: 'Wandalizm',                    d: 'Umyślne zniszczenie lub uszkodzenie nieruchomości',              p: `${cfg.opts.wandalizm.fixed ?? 59} zł` },
  ].filter(o => o.locked || o.show)

  const toggleCov = (id: Coverage) => {
    if (id === 'mury') return
    const newCovs = new Set(state.coverages)
    if (newCovs.has(id)) newCovs.delete(id)
    else newCovs.add(id)
    onUpdate({ coverages: newCovs })
  }

  return (
    <div className="card fade-in">
      <div className="step-h">Wybierz zakres ochrony</div>
      <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: '1rem' }}>
        Ceny podane rocznie. Kliknij, aby włączyć lub wyłączyć opcję.
      </p>
      {opts.map(o => {
        const sel = state.coverages.has(o.id)
        const cls = o.locked ? 'cov cov-l'
          : sel && o.warn ? 'cov cov-s cov-w'
          : o.warn ? 'cov cov-w'
          : sel ? 'cov cov-s'
          : 'cov'
        return (
          <div key={o.id} className={cls} onClick={() => !o.locked && toggleCov(o.id)}>
            <div className="ccb">
              {(sel || o.locked) && <i className="ti ti-check" style={{ fontSize: 11, color: 'white' }} />}
            </div>
            <div className="cbody">
              <div className="cn">{o.n}</div>
              <div className="cd">{o.d}</div>
            </div>
            <div className="cp">{o.p}</div>
          </div>
        )
      })}
      {fz && fz !== 'brak' && (
        <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
          * Cena uwzględnia dopłatę za strefę zagrożenia powodziowego {fz}.
        </p>
      )}
      <div className="nav">
        <button className="btn ghost" onClick={() => onUpdate({ step: 4 })}>
          <i className="ti ti-arrow-left" /> Wstecz
        </button>
        <button className="btn prim" onClick={() => onUpdate({ step: 6, packages: null })}>
          Zobacz ofertę <i className="ti ti-arrow-right" />
        </button>
      </div>
    </div>
  )
}
