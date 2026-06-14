import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { DEFAULT_CFG } from './lib/config'
import { DEMO_QUOTES } from './lib/demoData'
import type { QuoteState, ProductConfig, Quote, Tab, QuoteStatus } from './types'
import Header from './components/Header'
import ApiBanner from './components/ApiBanner'
import Calculator from './components/Calculator'
import QuotesList from './components/QuotesList'
import AgentPanel from './components/AgentPanel'
import ProductConfigurator from './components/ProductConfigurator'
import SharedQuote from './pages/SharedQuote'
import {
  isSupabaseConfigured,
  loadAllQuotesFromDb,
  updateQuoteStatusInDb,
  deleteQuoteFromDb,
} from './lib/supabase'

export const INITIAL_STATE: QuoteState = {
  step: 1, type: null, addr: '', lat: null, lng: null, city: '',
  floodZone: null, floodExp: '', floodLoading: false,
  year: 1990, material: 'mur', area: 120, value: 500000, floors: 2,
  renovation: false, alarm: false, monitoring: false, doors: false, fire: false,
  coverages: new Set(['mury']), packages: null, pkgLoading: false,
  payPeriod: 'annual', savedId: null,
}

export default function App() {
  const [state, setState] = useState<QuoteState>(INITIAL_STATE)
  const [cfg, setCfg] = useState<ProductConfig>(DEFAULT_CFG)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('calc')
  const [cfgUnlocked, setCfgUnlocked] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    const key = sessionStorage.getItem('si_api_key') || ''
    setApiKey(key)
    const theme = localStorage.getItem('si_theme') || 'light'
    document.documentElement.setAttribute('data-theme', theme)

    // Sprawdź czy serwer ma skonfigurowany klucz AI — jeśli tak, nie pokazuj banera
    fetch('/api/health')
      .then(r => r.ok ? r.json() : null)
      .then((h: { ai?: boolean } | null) => {
        if (!h?.ai && !key) setTimeout(() => setShowBanner(true), 1500)
      })
      .catch(() => {
        if (!key) setTimeout(() => setShowBanner(true), 1500)
      })

    // Ładuj z Supabase, fallback do sessionStorage, fallback do demo
    if (isSupabaseConfigured()) {
      loadAllQuotesFromDb().then(dbQuotes => {
        if (dbQuotes.length > 0) {
          setQuotes(dbQuotes)
        } else {
          // Baza pusta lub brak połączenia — użyj demo
          setQuotes(DEMO_QUOTES)
        }
      }).catch(() => {
        const saved = sessionStorage.getItem('si_quotes')
        setQuotes(saved ? JSON.parse(saved) : DEMO_QUOTES)
      })
    } else {
      // Supabase nie skonfigurowany — użyj sessionStorage / demo
      const saved = sessionStorage.getItem('si_quotes')
      if (saved) {
        setQuotes(JSON.parse(saved))
      } else {
        setQuotes(DEMO_QUOTES)
      }
    }
  }, [])

  // Synchronizuj quotes do sessionStorage (dla /q/:id i offline)
  useEffect(() => {
    if (quotes.length > 0) sessionStorage.setItem('si_quotes', JSON.stringify(quotes))
  }, [quotes])

  const saveQuote = (q: Quote) =>
    setQuotes(prev => [q, ...prev.filter(x => x.id !== q.id)])

  const deleteQuote = (id: string) => {
    setQuotes(prev => prev.filter(q => q.id !== id))
    deleteQuoteFromDb(id)
  }

  const changeStatus = (id: string, status: QuoteStatus) => {
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, status } : q))
    updateQuoteStatusInDb(id, status)
  }

  const toggleDark = () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark')
    localStorage.setItem('si_theme', isDark ? 'light' : 'dark')
  }

  return (
    <Routes>
      <Route path="/q/:id" element={<SharedQuote quotes={quotes} />} />
      <Route path="*" element={
        <>
          {showBanner && (
            <ApiBanner
              onSave={(key) => {
                setApiKey(key)
                sessionStorage.setItem('si_api_key', key)
                setShowBanner(false)
              }}
              onClose={() => setShowBanner(false)}
            />
          )}
          <Header
            activeTab={activeTab}
            onTabChange={setActiveTab}
            quotesCount={quotes.length}
            onToggleDark={toggleDark}
            onShowApiBanner={() => setShowBanner(true)}
          />
          <div className="main">
            {activeTab === 'calc' && (
              <Calculator
                state={state}
                setState={setState}
                cfg={cfg}
                apiKey={apiKey}
                onSaveQuote={saveQuote}
                onReset={() => setState(INITIAL_STATE)}
              />
            )}
            {activeTab === 'quotes' && (
              <QuotesList
                quotes={quotes}
                onDelete={deleteQuote}
                onNewQuote={() => { setState(INITIAL_STATE); setActiveTab('calc') }}
              />
            )}
            {activeTab === 'agent' && (
              <AgentPanel
                quotes={quotes}
                onStatusChange={changeStatus}
              />
            )}
            {activeTab === 'config' && (
              <ProductConfigurator
                cfg={cfg}
                onCfgChange={setCfg}
                unlocked={cfgUnlocked}
                onUnlock={() => setCfgUnlocked(true)}
              />
            )}
          </div>
        </>
      } />
    </Routes>
  )
}
