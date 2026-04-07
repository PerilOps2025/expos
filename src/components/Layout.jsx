import { useState } from 'react'

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '▦' },
  { id: 'capture', label: 'Capture', icon: '✦' },
  { id: 'meetings', label: 'Meetings', icon: '◷' },
  { id: 'decisions', label: 'Decisions', icon: '◈' },
  { id: 'config', label: 'Config', icon: '⚙' },
]

export default function Layout({ activeTab, setActiveTab, pendingCount, children }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
      {/* Top bar — laptop */}
      <div className="hidden md:flex items-center justify-between px-6 py-3"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
            style={{ background: 'var(--accent)', color: 'white' }}>E</div>
          <span className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>ExPOS</span>
        </div>
        <nav className="flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                background: activeTab === tab.id ? 'var(--bg-elevated)' : 'transparent',
                color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: activeTab === tab.id ? '1px solid var(--border-focus)' : '1px solid transparent',
              }}
            >
              {tab.label}
              {tab.id === 'capture' && pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold"
                  style={{ background: 'var(--teal)', fontSize: '10px' }}>
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Main */}
      <div className="flex-1 overflow-auto pb-20 md:pb-6">
        {children}
      </div>

      {/* Bottom nav — mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 flex"
        style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border)' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 flex flex-col items-center py-3 gap-0.5 relative transition-colors"
            style={{ color: activeTab === tab.id ? 'var(--teal)' : 'var(--text-muted)' }}
          >
            <span style={{ fontSize: '16px' }}>{tab.icon}</span>
            <span style={{ fontSize: '10px' }}>{tab.label}</span>
            {tab.id === 'capture' && pendingCount > 0 && (
              <span className="absolute top-1 right-1/4 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center"
                style={{ background: 'var(--teal)', fontSize: '10px' }}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* FAB */}
      <button
        onClick={() => setActiveTab('capture')}
        className="md:hidden fixed bottom-20 right-4 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 z-40"
        style={{ background: 'var(--accent)' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
      </button>
    </div>
  )
}