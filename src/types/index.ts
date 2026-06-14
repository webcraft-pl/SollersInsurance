export type PropertyType = 'dom' | 'mieszkanie' | 'szeregowiec' | 'letniskowy'
export type Material = 'mur' | 'drewno' | 'prefabrykat'
export type FloodZone = 'brak' | 'Q500' | 'Q100'
export type ConfigurableCoverage = 'ruchomosci' | 'oc' | 'assistance' | 'szyby' | 'zalanie' | 'przepięcie' | 'kradziez' | 'wandalizm'
export type Coverage = 'mury' | ConfigurableCoverage
export type QuoteStatus = 'new' | 'contact' | 'closed'
export type PayPeriod = 'annual' | 'quarterly' | 'monthly'
export type Tab = 'calc' | 'quotes' | 'agent' | 'config'

export interface QuoteState {
  step: number
  type: PropertyType | null
  addr: string
  lat: number | null
  lng: number | null
  city: string
  floodZone: FloodZone | null
  floodExp: string
  floodLoading: boolean
  year: number
  material: Material
  area: number
  value: number
  floors: number
  renovation: boolean
  alarm: boolean
  monitoring: boolean
  doors: boolean
  fire: boolean
  coverages: Set<Coverage>
  packages: Package[] | null
  pkgLoading: boolean
  payPeriod: PayPeriod
  savedId: string | null
}

export interface Package {
  name: string
  price: number
  features: string[]
  reason: string
}

export interface PriceLine {
  l: string
  v: number
  t: 'base' | 'sur' | 'dis' | 'ext'
}

export interface PriceRisk {
  t: 'w' | 'd'
  m: string
}

export interface PriceResult {
  annual: number
  monthly: number
  quarterly: number
  lines: PriceLine[]
  risks: PriceRisk[]
}

export interface CoverageOption {
  on: boolean
  pct: number | null
  fixed: number | null
  label: string
  q500?: number
  q100?: number
}

export interface ProductConfig {
  baseRate: number
  matMult: Record<Material, number>
  ageMult: {
    pre1945nr: number
    pre1945r: number
    y45_70: number
    y70_00: number
    modern: number
  }
  secDisc: {
    alarm: number
    monitoring: number
    doors: number
    fire: number
  }
  opts: Record<ConfigurableCoverage, CoverageOption>
  minVal: number
  maxVal: number
}

export interface Quote {
  id: string
  type: PropertyType
  addr: string
  value: number
  material: Material
  year: number
  area: number
  floodZone: FloodZone | null
  alarm: boolean
  monitoring: boolean
  doors: boolean
  fire: boolean
  covs: Coverage[]
  annual: number
  status: QuoteStatus
  createdAt: string
  client_name?: string
  client_email?: string
  notes?: string
}
