-- ============================================================
-- Sollers Insurance — schemat bazy danych
-- Pasuje do src/types/index.ts :: Quote
-- ============================================================

create table if not exists quotes (
  -- klucz: 5-znakowy uid generowany w src/lib/pricing.ts :: uid()
  id            text primary key,

  -- timestamps
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- typ nieruchomości: PropertyType
  type          text not null
                  check (type in ('dom','mieszkanie','szeregowiec','letniskowy')),

  -- lokalizacja
  addr          text not null default '',
  lat           double precision,
  lng           double precision,
  city          text,

  -- strefa powodziowa: FloodZone
  flood_zone    text
                  check (flood_zone is null or flood_zone in ('brak','Q500','Q100')),
  flood_exp     text,                          -- wyjaśnienie AI / ISOK

  -- parametry budynku
  year          smallint not null default 1990
                  check (year between 1800 and 2030),
  material      text not null default 'mur'
                  check (material in ('mur','drewno','prefabrykat')),
  area          smallint not null default 100
                  check (area > 0),
  floors        smallint not null default 1
                  check (floors > 0),
  value         integer not null default 0
                  check (value >= 0),
  renovation    boolean not null default false,

  -- zabezpieczenia
  alarm         boolean not null default false,
  monitoring    boolean not null default false,
  doors         boolean not null default false,
  fire          boolean not null default false,

  -- zakres ochrony: Coverage[] — pasuje do Quote.covs
  -- wartości: 'mury','ruchomosci','oc','assistance','szyby','zalanie','przepięcie','kradziez','wandalizm'
  covs          text[] not null default '{}',

  -- wynik cenowy
  annual        integer not null default 0
                  check (annual >= 0),

  -- status CRM: QuoteStatus
  status        text not null default 'new'
                  check (status in ('new','contact','closed')),

  -- dane klienta (opcjonalne, wypełnia agent)
  client_name   text,
  client_email  text,
  notes         text
);

-- ============================================================
-- Trigger: automatyczna aktualizacja updated_at
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger quotes_updated_at
  before update on quotes
  for each row execute function set_updated_at();

-- ============================================================
-- Indeksy
-- ============================================================
create index quotes_status_idx     on quotes (status);
create index quotes_created_at_idx on quotes (created_at desc);
create index quotes_type_idx       on quotes (type);

-- ============================================================
-- RLS — Row Level Security
-- Logika demo: pełny publiczny dostęp (brak auth)
-- W prod: dodaj auth.uid() check dla agenta
-- ============================================================
alter table quotes enable row level security;

-- publiczny odczyt po ID (potrzebny dla /q/:id)
create policy "public select"
  on quotes for select
  using (true);

-- publiczny insert (kalkulator nie wymaga logowania)
create policy "public insert"
  on quotes for insert
  with check (true);

-- agent może zmieniać status / dane klienta
create policy "public update"
  on quotes for update
  using (true);

-- ============================================================
-- GRANT dla ról Supabase — wymagane obok RLS
-- Bez tego: "permission denied for table quotes"
-- ============================================================
grant select, insert, update, delete on table quotes to anon;
grant select, insert, update, delete on table quotes to authenticated;

-- ============================================================
-- Dane demonstracyjne (opcjonalne — można usunąć przed prod)
-- Pasują do src/lib/demoData.ts
-- ============================================================
insert into quotes (id, type, addr, lat, lng, flood_zone, year, material, area, floors, value, alarm, monitoring, doors, fire, covs, annual, status, created_at)
values
  ('A1B2C', 'dom',        'ul. Świdnicka 14, Wrocław',       51.1079, 17.0385, 'Q500', 1980, 'mur', 165, 2, 650000, true,  false, true,  false, ARRAY['mury','oc','kradziez','zalanie','assistance'], 1847, 'contact', now() - interval '2 days'),
  ('X9Y3Z', 'mieszkanie', 'ul. Marszałkowska 110, Warszawa', 52.2298, 21.0118, 'brak', 1998, 'mur',  68, 1, 480000, false, false, false, false, ARRAY['mury','oc','szyby'],                           892,  'new',     now() - interval '5 days'),
  ('K7L4M', 'dom',        'ul. Gdańska 3, Kraków',           50.0647, 19.9450, 'brak', 2015, 'mur', 210, 2, 890000, true,  true,  true,  true,  ARRAY['mury','ruchomosci','oc','kradziez','assistance','wandalizm'], 2341, 'closed',  now() - interval '10 days')
on conflict (id) do nothing;
