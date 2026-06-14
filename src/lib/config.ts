import type { ProductConfig } from '../types'

export const DEFAULT_CFG: ProductConfig = {
  baseRate: 0.0015,
  matMult: { mur: 1.0, drewno: 1.35, prefabrykat: 1.1 },
  ageMult: { pre1945nr: 1.3, pre1945r: 1.1, y45_70: 1.15, y70_00: 1.05, modern: 1.0 },
  secDisc: { alarm: 7, monitoring: 9, doors: 4, fire: 3 },
  opts: {
    ruchomosci: { on: true, pct: 0.0004, fixed: null, label: 'Ruchomości domowe' },
    oc:         { on: true, pct: null, fixed: 149, label: 'OC w życiu prywatnym' },
    assistance: { on: true, pct: null, fixed: 119, label: 'Assistance 24h' },
    szyby:      { on: true, pct: null, fixed: 79,  label: 'Szyby i oszklenia' },
    zalanie:    { on: true, pct: null, fixed: 149, label: 'Zalanie i powódź', q500: 269, q100: 499 },
    przepięcie: { on: true, pct: null, fixed: 49,  label: 'Przepięcie elektryczne' },
    kradziez:   { on: true, pct: 0.00025, fixed: null, label: 'Kradzież z włamaniem' },
    wandalizm:  { on: true, pct: null, fixed: 59,  label: 'Wandalizm' },
  },
  minVal: 100000,
  maxVal: 5000000,
}
