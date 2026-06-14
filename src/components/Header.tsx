import { useState, useEffect, useRef } from 'react'
import type { Tab } from '../types'

interface Props {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  quotesCount: number
  onToggleDark: () => void
  onShowApiBanner: () => void
}

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'calc',   icon: 'ti-calculator', label: 'Kalkulator' },
  { id: 'quotes', icon: 'ti-file-text',  label: 'Moje oferty' },
  { id: 'agent',  icon: 'ti-users',      label: 'Panel agenta' },
  { id: 'config', icon: 'ti-settings',   label: 'Konfiguracja' },
]

export default function Header({ activeTab, onTabChange, quotesCount, onToggleDark, onShowApiBanner }: Props) {
  const [isDark, setIsDark] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
  }, [])

  // Zamknij menu przy kliknięciu poza nim
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const handleToggleDark = () => { onToggleDark(); setIsDark(d => !d) }

  const handleTabChange = (tab: Tab) => { onTabChange(tab); setMenuOpen(false) }

  return (
    <header className="hdr">
      <div className="hdr-inner">
        <div className="logo" onClick={() => handleTabChange('calc')}>
          <div className="logo-mark"><i className="ti ti-shield-check" /></div>
          <div className="logo-text">
            <div className="logo-top">Sollers Insurance</div>
            <div className="logo-bot">Property Calculator · Demo</div>
          </div>
        </div>

        {/* Desktop nav */}
        <nav className="nav-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`nav-tab${activeTab === t.id ? ' active' : ''}`}
              onClick={() => handleTabChange(t.id)}
            >
              <i className={`ti ${t.icon}`} />
              {' '}{t.label}
              {t.id === 'quotes' && <span className="badge-count">{quotesCount}</span>}
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
          {/* Burger — tylko mobile */}
          <div ref={menuRef} className="burger-wrap">
            <button
              className={`btn-icon burger${menuOpen ? ' open' : ''}`}
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Menu"
            >
              <i className={`ti ${menuOpen ? 'ti-x' : 'ti-menu-2'}`} />
            </button>
            {menuOpen && (
              <div className="burger-menu">
                {TABS.map(t => (
                  <button
                    key={t.id}
                    className={`burger-item${activeTab === t.id ? ' active' : ''}`}
                    onClick={() => handleTabChange(t.id)}
                  >
                    <i className={`ti ${t.icon}`} />
                    {t.label}
                    {t.id === 'quotes' && <span className="badge-count" style={{ marginLeft: 6 }}>{quotesCount}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
