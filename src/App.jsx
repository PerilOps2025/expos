import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { signInWithGoogle, signOut } from './lib/auth'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import CaptureInput from './components/CaptureInput'
import PendingRoom from './components/PendingRoom'
import DecisionFeed from './components/DecisionFeed'
import ConfigScreen from './components/ConfigScreen'
import MeetingsTab from './components/MeetingsTab'

function LoginScreen() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold text-white tracking-tight">ExPOS</h1>
          <p className="text-gray-400 mt-2 text-base">Executive Personal Operating System</p>
        </div>
        <button
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 font-medium py-3 px-4 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  )
}

function MainApp({ session }) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [pendingItems, setPendingItems] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)

  function handleParsed(items) {
    setPendingItems(prev => [...prev, ...items])
    setActiveTab('capture')
  }

  function handleConfirmed() {
    setRefreshKey(k => k + 1)
  }

  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      pendingCount={pendingItems.length}
    >
      {activeTab === 'dashboard' && <Dashboard key={refreshKey} />}

      {activeTab === 'capture' && (
        <div className="max-w-2xl mx-auto px-4 py-6">
          <h2 className="text-white font-semibold mb-4">Capture</h2>
          <CaptureInput onParsed={handleParsed} />

          {pendingItems.length > 0 && (
            <div className="mt-4 bg-teal-900/20 border border-teal-800/40 rounded-xl px-4 py-3 flex items-center justify-between">
              <p className="text-teal-400 text-sm">
                {pendingItems.length} item{pendingItems.length !== 1 ? 's' : ''} waiting in Pending Room
              </p>
              <button
                onClick={() => setPendingItems([])}
                className="text-gray-600 hover:text-gray-400 text-xs"
              >
                clear
              </button>
            </div>
          )}

          <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-3">Input format</p>
            <div className="space-y-1 font-mono text-xs text-gray-600">
              <p><span className="text-gray-400">task:</span> Person / Team / description / priority / due / flags</p>
              <p><span className="text-gray-400">decision:</span> Person / Team / what was decided</p>
              <p className="pt-2 text-gray-700">Priority: high · med · low</p>
              <p className="text-gray-700">Due: tmr · eow · eom · mon · thu · 15jan</p>
              <p className="text-gray-700">Flags: meeting · wait · deep · quick · followup</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'meetings' && <MeetingsTab session={session} />}

      {activeTab === 'decisions' && <DecisionFeed />}
      {activeTab === 'config' && <ConfigScreen />}

      {pendingItems.length > 0 && (
        <PendingRoom
          items={pendingItems}
          setItems={setPendingItems}
          onConfirmed={handleConfirmed}
        />
      )}
    </Layout>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-gray-600 text-sm">Loading...</div>
    </div>
  )

  return session ? <MainApp session={session} /> : <LoginScreen />
}