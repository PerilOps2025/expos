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
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Top bar — laptop */}
      <div className="hidden md:flex items-center justify-between px-6 py-3 border-b border-gray-900">
        <h1 className="text-white font-bold text-lg tracking-tight">ExPOS</h1>
        <nav className="flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'
              }`}
            >
              {tab.label}
              {tab.id === 'capture' && pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-teal-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto pb-20 md:pb-6">
        {children}
      </div>

      {/* Bottom nav — mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-950 border-t border-gray-900 flex">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center py-3 gap-0.5 relative transition-colors ${
              activeTab === tab.id ? 'text-white' : 'text-gray-600'
            }`}
          >
            <span className="text-base">{tab.icon}</span>
            <span className="text-xs">{tab.label}</span>
            {tab.id === 'capture' && pendingCount > 0 && (
              <span className="absolute top-1 right-1/4 bg-teal-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}