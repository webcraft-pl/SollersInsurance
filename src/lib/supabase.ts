import { createClient } from '@supabase/supabase-js'
import type { Quote, QuoteStatus } from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null

// ---- field mapping: DB (snake_case) <-> TS (camelCase) ----

type DbQuote = {
  id: string
  created_at: string
  updated_at: string
  type: string
  addr: string
  lat: number | null
  lng: number | null
  city: string | null
  flood_zone: string | null
  flood_exp: string | null
  year: number
  material: string
  area: number
  floors: number
  value: number
  renovation: boolean
  alarm: boolean
  monitoring: boolean
  doors: boolean
  fire: boolean
  covs: string[]
  annual: number
  status: string
  client_name: string | null
  client_email: string | null
  notes: string | null
}

function fromDb(row: DbQuote): Quote {
  return {
    id:           row.id,
    createdAt:    row.created_at,
    type:         row.type as Quote['type'],
    addr:         row.addr,
    value:        row.value,
    material:     row.material as Quote['material'],
    year:         row.year,
    area:         row.area,
    floodZone:    row.flood_zone as Quote['floodZone'],
    alarm:        row.alarm,
    monitoring:   row.monitoring,
    doors:        row.doors,
    fire:         row.fire,
    covs:         row.covs as Quote['covs'],
    annual:       row.annual,
    status:       row.status as Quote['status'],
    client_name:  row.client_name ?? undefined,
    client_email: row.client_email ?? undefined,
    notes:        row.notes ?? undefined,
  }
}

function toDb(q: Quote): Omit<DbQuote, 'updated_at'> {
  return {
    id:           q.id,
    created_at:   q.createdAt,
    type:         q.type,
    addr:         q.addr,
    lat:          null,
    lng:          null,
    city:         null,
    flood_zone:   q.floodZone ?? null,
    flood_exp:    null,
    year:         q.year,
    material:     q.material,
    area:         q.area,
    floors:       1,
    value:        q.value,
    renovation:   false,
    alarm:        q.alarm,
    monitoring:   q.monitoring,
    doors:        q.doors,
    fire:         q.fire,
    covs:         q.covs,
    annual:       q.annual,
    status:       q.status,
    client_name:  q.client_name ?? null,
    client_email: q.client_email ?? null,
    notes:        q.notes ?? null,
  }
}

// ---- public API ----

export async function saveQuoteToDb(q: Quote): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('quotes').upsert(toDb(q))
  if (error) console.error('Supabase save error:', error.message)
}

export async function loadQuoteFromDb(id: string): Promise<Quote | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return fromDb(data as DbQuote)
}

export async function loadAllQuotesFromDb(): Promise<Quote[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return (data as DbQuote[]).map(fromDb)
}

export async function updateQuoteStatusInDb(id: string, status: QuoteStatus): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('quotes')
    .update({ status })
    .eq('id', id)
  if (error) console.error('Supabase update error:', error.message)
}
