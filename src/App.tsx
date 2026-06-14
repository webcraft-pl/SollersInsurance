import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { DEFAULT_CFG } from './lib/config'
import { DEMO_QUOTES } from './lib/demoData'
import type { QuoteState, ProductConfig, Quote, Tab } from './types'
import Header from './components/Header'
import ApiBanner from './components/ApiBanner'
import Calculator from './components/Calculator'
import QuotesList from './components/QuotesList'
import AgentPanel from './components/AgentPanel'
import ProductConfigurator from './components/ProductConfigurator'
import SharedQuote from './pages/SharedQuote'

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
    const saved = sessionStorage.getItem('si_quotes')
    const key = sessionStorage.getItem('si_api_key') || ''
    setApiKey(key)
    if (saved) {
      setQuotes(JSON.parse(saved))
    } else {
      setQuotes(DEMO_QUOTES)
      sessionStorage.setItem('si_quotes', JSON.stringify(DEMO_QUOTES))
    }
    const theme = localStorage.getItem('si_theme') || 'light'
    document.documentElement.setAttribute('data-theme', theme)
    if (!key) setTimeout(() => setShowBanner(true), 1500)
  }, [])

  const persistQuotes = (qs: Quote[]) => {
    sessionStorage.setItem('si_quotes', JSON.stringify(qs))
    setQuotes(qs)
  }

  const saveQuote = (q: Quote) => persistQuotes([q, ...quotes.filter(x => x.id !== q.id)])

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
                onDelete={(id) => persistQuotes(quotes.filter(q => q.id !== id))}
                onNewQuote={() => { setState(INITIAL_STATE); setActiveTab('calc') }}
              />
            )}
            {activeTab === 'agent' && (
              <AgentPanel
                quotes={quotes}
                onStatusChange={(id, status) =>
                  persistQuotes(quotes.map(q => q.id === id ? { ...q, status } : q))
                }
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
