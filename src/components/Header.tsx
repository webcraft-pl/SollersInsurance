import { useState, useEffect } from 'react'
import type { Tab } from '../types'

interface Props {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  quotesCount: number
  onToggleDark: () => void
  onShowApiBanner: () => void
}

export default function Header({ activeTab, onTabChange, quotesCount, onToggleDark, onShowApiBanner }: Props) {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
  }, [])

  const handleToggleDark = () => {
    onToggleDark()
    setIsDark(d => !d)
  }

  return (
    <header className="hdr">
      <div className="hdr-inner">
        <div className="logo" onClick={() => onTabChange('calc')}>
          <div className="logo-mark"><i className="ti ti-shield-check" /></div>
          <div className="logo-text">
            <div className="logo-top">Sollers Insurance</div>
            <div className="logo-bot">Property Calculator · Demo</div>
          </div>
        </div>
        <nav className="nav-tabs">
          {(['calc', 'quotes', 'agent', 'config'] as Tab[]).map(tab => (
            <button
              key={tab}
              className={`nav-tab${activeTab === tab ? ' active' : ''}`}
              onClick={() => onTabChange(tab)}
            >
              {tab === 'calc'   && <><i className="ti ti-calculator" /> Kalkulator</>}
              {tab === 'quotes' && <><i className="ti ti-file-text" /> Moje oferty <span className="badge-count">{quotesCount}</span></>}
              {tab === 'agent'  && <><i className="ti ti-users" /> Panel agenta</>}
              {tab === 'config' && <><i className="ti ti-settings" /> Konfiguracja produktu</>}
            </button>
          ))}
        </nav>
        <div className="hdr-actions">
          <button className="btn-icon" onClick={handleToggleDark} title="Zmień motyw">
            <i className={`ti ${isDark ? 'ti-sun' : 'ti-moon'}`} />
          </button>
          <button className="btn-icon" onClick={onShowApiBanner} title="Klucz API">
            <i className="ti ti-key" />
          </button>
        </div>
      </div>
    </header>
  )
}
