import type { QuoteState, ProductConfig, PriceResult, PriceLine, PriceRisk, Coverage } from '../types'

export const COVERAGE_NAMES: Record<string, string> = {
  mury:       'Mury i elementy stałe',
  ruchomosci: 'Ruchomości domowe',
  oc:         'OC w życiu prywatnym',
  assistance: 'Assistance 24h',
  szyby:      'Szyby i oszklenia',
  zalanie:    'Zalanie i powódź',
  przepięcie: 'Przepięcie elektryczne',
  kradziez:   'Kradzież z włamaniem',
  wandalizm:  'Wandalizm',
}

export const coverageName = (k: string) => COVERAGE_NAMES[k] ?? k

export function calcPrice(s: QuoteState, cfg: ProductConfig): PriceResult {
  const v = s.value || 0
  if (!v || !s.type) return { annual: 0, monthly: 0, quarterly: 0, lines: [], risks: [] }

  const base = v * cfg.baseRate
  const mm = cfg.matMult[s.material] ?? 1
  const yr = +s.year
  let am = 1, al = ''

  if (yr < 1945) {
    am = s.renovation ? cfg.ageMult.pre1945r : cfg.ageMult.pre1945nr
    al = s.renovation ? 'Budynek historyczny (po remoncie)' : 'Budynek historyczny'
  } else if (yr < 1970) {
    am = cfg.ageMult.y45_70; al = 'Budynek sprzed 1970 r.'
  } else if (yr < 2000) {
    am = cfg.ageMult.y70_00; al = 'Budynek z lat 70–00'
  }

  const bm = base * mm
  let p = bm * am
  const lines: PriceLine[] = []
  const risks: PriceRisk[] = []

  if (mm > 1) lines.push({ l: `Dopłata — materiał (${s.material})`, v: Math.round((mm - 1) * base), t: 'sur' })
  if (am > 1) lines.push({ l: al, v: Math.round((am - 1) * bm), t: 'sur' })

  let sm = 1
  if (s.alarm)      sm *= (1 - cfg.secDisc.alarm / 100)
  if (s.monitoring) sm *= (1 - cfg.secDisc.monitoring / 100)
  if (s.doors)      sm *= (1 - cfg.secDisc.doors / 100)
  if (s.fire)       sm *= (1 - cfg.secDisc.fire / 100)
  const disc = Math.round(p * (1 - sm))
  p *= sm

  if (disc > 0) lines.push({ l: 'Rabat — aktywne zabezpieczenia', v: -disc, t: 'dis' })
  lines.push({ l: 'Mury i elementy stałe', v: Math.round(p), t: 'base' })

  let ex = 0

  for (const [k, o] of Object.entries(cfg.opts)) {
    if (!o.on || !s.coverages.has(k as Coverage) || k === 'zalanie' || k === 'kradziez') continue
    const c = o.fixed !== null ? o.fixed : Math.round(v * (o.pct ?? 0))
    lines.push({ l: coverageName(k), v: c, t: 'ext' })
    ex += c
  }

  if (s.coverages.has('zalanie') && cfg.opts.zalanie.on) {
    let fc = cfg.opts.zalanie.fixed ?? 149
    if (s.floodZone === 'Q500') {
      fc = cfg.opts.zalanie.q500 ?? 269
      risks.push({ t: 'w', m: 'Strefa Q500 — dopłata do ubezpieczenia przeciwpowodziowego +80%' })
    }
    if (s.floodZone === 'Q100') {
      fc = cfg.opts.zalanie.q100 ?? 499
      risks.push({ t: 'd', m: 'Strefa Q100 — wysokie ryzyko powodzi, istotna dopłata do składki' })
    }
    lines.push({ l: 'Zalanie i powódź' + (s.floodZone && s.floodZone !== 'brak' ? ` (${s.floodZone})` : ''), v: fc, t: s.floodZone === 'Q100' ? 'sur' : 'ext' })
    ex += fc
  }

  if (s.coverages.has('kradziez') && cfg.opts.kradziez.on) {
    let tc = Math.round(v * (cfg.opts.kradziez.pct ?? 0.00025))
    const noSecurity = !s.alarm && !s.monitoring
    if (noSecurity) {
      tc = Math.round(tc * 1.3)
      risks.push({ t: 'w', m: 'Brak alarmu i monitoringu — podwyżka za kradzież +30%' })
    } else if (!s.alarm || !s.monitoring) {
      tc = Math.round(tc * 1.15)
    }
    lines.push({ l: 'Kradzież z włamaniem', v: tc, t: 'ext' })
    ex += tc
  }

  if (s.material === 'drewno' && !s.fire)
    risks.push({ t: 'w', m: 'Budynek drewniany bez systemu p.poż. — podwyższone ryzyko pożaru' })
  if (s.floodZone === 'Q100' && !s.coverages.has('zalanie'))
    risks.push({ t: 'd', m: 'Strefa Q100 bez ochrony przeciwpowodziowej — ryzyko bez pokrycia!' })

  const annual = Math.round(p + ex)
  return { annual, monthly: Math.round(annual / 12), quarterly: Math.round(annual / 4), lines, risks }
}

export const fmt = (n: number) => Math.round(n).toLocaleString('pl-PL') + ' zł'
export const fmtR = (n: number) => (Math.round(n / 100) * 100).toLocaleString('pl-PL') + ' zł'
export const uid = () => Math.random().toString(36).substring(2, 7).toUpperCase()
