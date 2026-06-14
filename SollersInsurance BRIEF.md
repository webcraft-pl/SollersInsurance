# BRIEF.md — Sollers Insurance Calculator
*Wersja 1.0 · Status: prototyp gotowy → przekazać do implementacji*

## Kontekst i cel

Demonstracyjna aplikacja webowa pokazująca możliwości AI-assisted development, stworzona na potrzeby prezentacji dla zarządu Sollers Consulting. Kalkulator ubezpieczeń nieruchomości z brandingiem Sollers Insurance, funkcjami AI, bazą danych kwotowań i panelem konfiguracji produktu ubezpieczeniowego (nawiązanie do platformy RIFE).

**Argument biznesowy:** "Ten produkt zbudowałem sam, bez programisty, za pomocą AI. Oto co AI może zrobić dla Sollers."

---

## Prototyp

Plik: `sollers-insurance.html` — w pełni działający standalone HTML.
Przed implementacją przeczytaj go w całości — zawiera kompletną logikę biznesową, pricing engine, UI i flow UX.

**Co jest w prototypie (do przeniesienia 1:1):**
- Kalkulator 5-krokowy z logiką warunkową
- Pricing engine (`calcPrice()`) z mnożnikami
- Flood check (Nominatim + opcjonalnie Anthropic API)
- Mapa Leaflet z warstwą ISOK WMS
- Porównanie 3 pakietów (AI lub fallback)
- Zapisywanie kwotowań
- Panel agenta ze statusami
- Konfigurator produktu (hasło: `sollers`)
- Dark mode
- PWA manifest

---

## Stack

```
Frontend:   React 18 + Vite + TypeScript
Styling:    Tailwind CSS v4
Backend:    Vercel Serverless Functions (API routes)
Database:   Supabase (PostgreSQL)
PWA:        vite-plugin-pwa
Hosting:    Vercel
```

---

## Struktura projektu

```
sollers-insurance/
├── src/
│   ├── components/
│   │   ├── Calculator/
│   │   │   ├── Step1Type.tsx
│   │   │   ├── Step2Location.tsx     # Mapa + flood check
│   │   │   ├── Step3Building.tsx
│   │   │   ├── Step4Security.tsx
│   │   │   ├── Step5Coverage.tsx
│   │   │   └── StepResult.tsx        # Wynik + pakiety + zapis
│   │   ├── PricePanel.tsx            # Sticky panel ceny (live update)
│   │   ├── ProgressBar.tsx
│   │   ├── QuotesList.tsx            # Zakładka "Moje oferty"
│   │   ├── AgentPanel.tsx            # Zakładka agenta
│   │   └── ProductConfigurator.tsx   # Zakładka konfiguracji (hasło: sollers)
│   ├── pages/
│   │   └── SharedQuote.tsx           # /q/:id — podgląd kwotowania
│   ├── lib/
│   │   ├── pricing.ts                # calcPrice() — port z prototypu
│   │   ├── config.ts                 # CFG object — parametry produktu
│   │   └── supabase.ts               # Klient Supabase
│   ├── hooks/
│   │   ├── useFloodCheck.ts          # Geocoding + AI flood assessment
│   │   └── usePackages.ts            # AI package generation
│   ├── types/
│   │   └── index.ts                  # QuoteState, Config, Package, etc.
│   └── App.tsx
├── api/
│   ├── flood-check.ts                # Proxy: Nominatim + Anthropic API
│   ├── generate-packages.ts          # Anthropic API — 3 pakiety
│   └── isok-proxy.ts                 # Proxy: ISOK WFS flood zone check
├── public/
│   └── icons/
├── supabase/
│   └── migrations/
│       └── 001_initial.sql
├── vite.config.ts
├── tailwind.config.ts
└── .env.example
```

---

## Supabase — schemat bazy danych

```sql
-- 001_initial.sql

create table quotes (
  id          text primary key,              -- 5-char uppercase uid (np. A1B2C)
  created_at  timestamptz default now(),
  type        text not null,                 -- dom | mieszkanie | szeregowiec | letniskowy
  addr        text,
  lat         float,
  lng         float,
  flood_zone  text,                          -- brak | Q500 | Q100 | null
  year        int,
  material    text,                          -- mur | drewno | prefabrykat
  area        int,
  floors      int,
  value       int,
  renovation  boolean default false,
  alarm       boolean default false,
  monitoring  boolean default false,
  doors       boolean default false,
  fire        boolean default false,
  coverages   text[],                        -- ['mury', 'oc', 'kradziez', ...]
  annual      int,                           -- obliczona składka roczna
  status      text default 'new',            -- new | contact | closed
  client_name text,
  client_email text,
  notes       text
);

-- RLS: publiczny odczyt po ID (dla linka /q/:id), zapis bez auth
alter table quotes enable row level security;
create policy "public read by id" on quotes for select using (true);
create policy "public insert" on quotes for insert with check (true);
create policy "public update status" on quotes for update using (true);
```

---

## Vercel API Routes

### `/api/flood-check`
```typescript
// POST { addr: string }
// 1. Geocoding przez Nominatim (nie wymaga klucza)
// 2. Sprawdzenie strefy w ISOK WFS (punkt w strefie zalewowej?)
// 3. Fallback: Anthropic AI assessment jeśli WFS nie odpowie
// Returns: { lat, lng, city, riskLevel: 'brak'|'Q500'|'Q100', explanation }

// ISOK WFS endpoint:
// https://wody.isok.gov.pl/wss/INSPIRE/INSPIRE_NZ_HY_MZPMRP_WFS
// GetFeature z INTERSECTS(geometry, POINT(lng lat))
// Layers: MZP_Q100, MZP_Q500
```

### `/api/generate-packages`
```typescript
// POST { quoteState: QuoteState, annualPremium: number }
// Anthropic API — generuje 3 pakiety (Basic/Standard/Premium)
// Returns: Package[]
```

### `/api/isok-proxy`
```typescript
// GET ?lat=...&lng=...
// Proxy dla ISOK WFS — omija CORS
// Parsuje GML response, zwraca { inQ100: boolean, inQ500: boolean }
```

---

## Zmienne środowiskowe

```env
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
VITE_APP_URL=https://sollers-insurance.vercel.app
```

---

## Kluczowa logika biznesowa

### Pricing engine (`src/lib/pricing.ts`)
Port funkcji `calcPrice()` z prototypu. Parametry bierze z `CFG` (config.ts).

```typescript
export function calcPrice(state: QuoteState, cfg: ProductConfig): PriceResult {
  // 1. Base: value * baseRate
  // 2. Material multiplier
  // 3. Age multiplier (4 progi wiekowe)
  // 4. Security discounts (kumulowane multiplikatywnie)
  // 5. Fixed costs per coverage option
  // 6. Flood zone surcharge (zalanie: +80% Q500, +235% Q100)
  // 7. Theft surcharge (brak alarmu+monitoring: +30%)
  // Returns: { annual, monthly, quarterly, lines[], risks[] }
}
```

### Logika warunkowa UI
- `type === 'letniskowy'` → ukryj OC
- `year < 1945` → pokaż pytanie o remont kapitalny
- `material === 'drewno'` → risk flag w panelu ceny
- `floodZone === 'Q100'` → force-highlight opcji zalanie, badge danger
- Opcje wyłączone w CFG (`opts.X.on === false`) → ukryte w Step 5

### Product Configurator
- Dostęp po haśle `sollers` (można zmienić w config)
- Zmiany CFG działają natychmiast (React state)
- Live preview: przykładowy klient (dom, 2005, mur, 600k, alarm+drzwi, mury+oc+kradziez+zalanie)
- **W wersji produkcyjnej:** CFG zapisywać do Supabase per insurer account

---

## Branding Sollers

- Primary color: `#78a742` (Sollers green — z ich logo CSS)
- Dark: `#5a8030`, Darker: `#3d5a1f`
- Light: `#e8f4d9`, Lightest: `#f2fae8`
- Dark mode: forest green scheme (`#161d10` background)
- Logo: ikona tarczy (`shield-check`) + "Sollers Insurance" + "Property Calculator · Demo"
- Czcionka: system-ui / -apple-system (nie ładuj Google Fonts — szybkość)
- Ikony: Tabler Icons (webfont z jsdelivr)

---

## PWA

```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa'

VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'Sollers Insurance',
    short_name: 'Sollers Ins.',
    theme_color: '#78a742',
    background_color: '#f2fae8',
    display: 'standalone',
    // icons: wygenerować z logo
  }
})
```

---

## Routing

```
/                     → Kalkulator (default tab)
/q/:id               → Podgląd udostępnionego kwotowania (public)
/agent               → Panel agenta (w demo: bez auth)
/config              → Konfigurator produktu (hasło: sollers)
```

---

## Flood check — szczegóły integracji ISOK

```
Nominatim API:
GET https://nominatim.openstreetmap.org/search
  ?q={addr}, Polska&format=json&limit=1&countrycodes=pl

ISOK WFS (przez /api/isok-proxy):
POST https://wody.isok.gov.pl/wss/INSPIRE/INSPIRE_NZ_HY_MZPMRP_WFS
  SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature
  &TYPENAMES=MZP_Q100&CRS=EPSG:4326
  &BBOX={lng-0.001},{lat-0.001},{lng+0.001},{lat+0.001}

Jeśli WFS zwraca features → punkt w strefie Q100
Jeśli brak → sprawdź Q500
Jeśli WFS nie odpowie → Anthropic AI fallback
```

---

## Demo dane (seed)

Aplikacja startuje z 3 przykładowymi kwotowaniami (patrz `init()` w prototypie):
- Dom Wrocław, strefa Q500, status: w kontakcie
- Mieszkanie Warszawa, brak ryzyka, status: nowe
- Dom Kraków, pełne zabezpieczenia, status: zamknięte

---

## Priorytety implementacji

**P0 (must have na demo):**
1. Kalkulator 5-krokowy + pricing engine
2. Sollers branding + dark mode
3. Flood check (Nominatim + AI fallback)
4. Zapis kwotowań do Supabase
5. Link do udostępnienia (/q/:id)
6. Panel agenta
7. Konfigurator produktu (hasło: sollers)
8. PWA

**P1 (nice to have):**
- Email z ofertą (Resend)
- Auth dla agenta (Supabase Auth)
- Eksport PDF (Puppeteer serverless)
- Animacje przejść między krokami

**P2 (future):**
- Multi-tenancy (różni ubezpieczyciele, różne CFG)
- API dla zewnętrznych systemów
- ISOK WFS realny (bez AI fallback)

---

## Uruchomienie

```bash
npm create vite@latest sollers-insurance -- --template react-ts
cd sollers-insurance
npm install tailwindcss @tailwindcss/vite @supabase/supabase-js vite-plugin-pwa leaflet @types/leaflet
# skopiuj sollers-insurance.html jako referencję
# zaimplementuj wg tej struktury
```

---

*Brief wygenerowany przez Claude Sonnet 4.6 · projekt skycommons*
