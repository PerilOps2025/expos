import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { signInWithGoogle, signOut } from './lib/auth'
import CaptureInput from './components/CaptureInput'
import PendingRoom from './components/PendingRoom'

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
  const [pendingItems, setPendingItems] = useState([])
  const [confirmedCount, setConfirmedCount] = useState(0)
  const [recentTasks, setRecentTasks] = useState([])

  useEffect(() => {
    loadRecentTasks()
  }, [confirmedCount])

  async function loadRecentTasks() {
    const { data } = await supabase
      .from('tasks')
      .select('*, person:person_id(name), team:team_id(name)')
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(10)
    setRecentTasks(data || [])
  }

  function handleParsed(items) {
    setPendingItems(prev => [...prev, ...items])
  }

  function handleConfirmed() {
    setConfirmedCount(c => c + 1)
  }

  const PRIORITY_DOT = { high: 'bg-red-400', medium: 'bg-yellow-400', low: 'bg-gray-500' }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">ExPOS</h1>
          <div className="flex items-center gap-3">
            {pendingItems.length > 0 && (
              <button
                onClick={() => setPendingItems([])}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                {pendingItems.length} pending
              </button>
            )}
            <span className="text-gray-600 text-xs">{session.user.email}</span>
            <button onClick={signOut} className="text-gray-600 hover:text-gray-400 text-xs">
              sign out
            </button>
          </div>
        </div>

        {/* Capture */}
        <CaptureInput onParsed={handleParsed} />

        {/* Recent tasks */}
        <div className="mt-6">
          <h2 className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-3">
            Recent tasks
          </h2>
          {recentTasks.length === 0 ? (
            <div className="text-center py-12 text-gray-700">
              <p className="text-sm">No tasks yet</p>
              <p className="text-xs mt-1">Use the capture box above to add your first task</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentTasks.map(task => (
                <div key={task.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-200 text-sm">{task.description}</p>
                    <div className="flex gap-2 mt-0.5">
                      {task.person?.name && <span className="text-gray-600 text-xs">{task.person.name}</span>}
                      {task.team?.name && <span className="text-gray-600 text-xs">{task.team.name}</span>}
                      {task.due_at && (
                        <span className="text-gray-600 text-xs">
                          due {new Date(task.due_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                  </div>
                  {task.meeting_context && (
                    <span className="text-indigo-500 text-xs flex-shrink-0">mtg</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pending Room overlay */}
      {pendingItems.length > 0 && (
        <PendingRoom
          items={pendingItems}
          setItems={setPendingItems}
          onConfirmed={handleConfirmed}
        />
      )}
    </div>
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