import { useState, useEffect } from 'react'
import { parseInput } from '../lib/parser'
import { resolveEntities } from '../lib/entities'
import {
  saveDraft, loadDraft, clearDraft,
  queueCapture, loadQueue, removeFromQueue,
  isOnline
} from '../lib/offlinequeue'
import VoiceRecorder from './VoiceRecorder'
import CaptureInput from './CaptureInput'

const EXAMPLES = [
  'task: Kishore / Procurement team / send vendor list / high / thu / meeting',
  'task: Jaya / Finance team / review Q3 report / med / eow',
  'decision: Kishore / Procurement team / approved new vendor rates',
  'task: - / Production team / finalise packaging / high / 15jan',
]

export default function CaptureTab({ onParsed, pendingCount }) {
  const [mode, setMode] = useState('text') // text | voice
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [online, setOnline] = useState(isOnline())
  const [offlineQueue, setOfflineQueue] = useState([])
  const [showExamples, setShowExamples] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    // Restore draft
    const draft = loadDraft()
    if (draft) setText(draft)

    // Load offline queue
    setOfflineQueue(loadQueue())

    // Online/offline listeners
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Auto-save draft as user types
  useEffect(() => {
    saveDraft(text)
  }, [text])

  async function handleSubmit() {
    if (!text.trim()) return
    setLoading(true)
    try {
      const parsed = parseInput(text)

      if (!isOnline()) {
        // Queue for later
        queueCapture(text, parsed)
        setOfflineQueue(loadQueue())
        setText('')
        clearDraft()
        alert('You\'re offline — capture saved to queue and will sync when you reconnect.')
        return
      }

      const resolved = await resolveEntities(parsed)
      onParsed(resolved)
      setText('')
      clearDraft()
    } catch (err) {
      alert('Parse error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function syncQueue() {
    if (!isOnline() || offlineQueue.length === 0) return
    setSyncing(true)
    for (const item of offlineQueue) {
      try {
        const resolved = await resolveEntities(item.parsedItems)
        onParsed(resolved)
        removeFromQueue(item.id)
      } catch (err) {
        console.error('Sync error:', err)
      }
    }
    setOfflineQueue(loadQueue())
    setSyncing(false)
  }

  function handleVoiceTranscript(transcript) {
    setText(transcript)
    setMode('text')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold">Capture</h2>
        <div className="flex items-center gap-3">
          {!online && (
            <span className="text-xs bg-yellow-900/50 text-yellow-400 border border-yellow-800 px-2 py-0.5 rounded-full">
              Offline
            </span>
          )}
          {offlineQueue.length > 0 && online && (
            <button
              onClick={syncQueue}
              disabled={syncing}
              className="text-xs text-teal-500 hover:text-teal-400 transition-colors"
            >
              {syncing ? 'Syncing...' : `↑ Sync ${offlineQueue.length} queued`}
            </button>
          )}
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 mb-4 bg-gray-900 border border-gray-800 rounded-xl p-1">
        <button
          onClick={() => setMode('text')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'text' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:text-gray-400'
          }`}
        >
          Text
        </button>
        <button
          onClick={() => setMode('voice')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'voice' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:text-gray-400'
          }`}
        >
          Voice
        </button>
      </div>

      {/* Voice mode */}
      {mode === 'voice' && (
        <VoiceRecorder onTranscript={handleVoiceTranscript} />
      )}

      {/* Text mode */}
      {mode === 'text' && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-gray-500 text-xs">One item per line · Ctrl+Enter to parse</p>
            <button
              onClick={() => setShowExamples(!showExamples)}
              className="text-gray-700 hover:text-gray-500 text-xs transition-colors"
            >
              {showExamples ? 'hide examples' : 'examples'}
            </button>
          </div>

          {showExamples && (
            <div className="mb-3 space-y-1 bg-gray-800/50 rounded-xl p-3">
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setText(ex)}
                  className="block w-full text-left text-xs text-gray-600 hover:text-gray-300 py-0.5 font-mono transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}

          <textarea
            className="w-full bg-gray-800 text-gray-100 text-sm rounded-xl px-3 py-3 focus:outline-none focus:ring-1 focus:ring-teal-700 resize-none font-mono placeholder-gray-700"
            rows={4}
            placeholder={'task: Person / Team / description / priority / due / flags\ndecision: Person / Team / what was decided'}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          <div className="flex items-center justify-between mt-2">
            {text && (
              <button
                onClick={() => { setText(''); clearDraft() }}
                className="text-gray-700 hover:text-gray-500 text-xs transition-colors"
              >
                clear
              </button>
            )}
            <div className="ml-auto">
              <button
                onClick={handleSubmit}
                disabled={!text.trim() || loading}
                className="bg-teal-600 hover:bg-teal-500 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors"
              >
                {loading ? 'Parsing...' : 'Parse →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending indicator */}
      {pendingCount > 0 && (
        <div className="mt-4 bg-teal-900/20 border border-teal-800/40 rounded-xl px-4 py-3">
          <p className="text-teal-400 text-sm">
            {pendingCount} item{pendingCount !== 1 ? 's' : ''} in Pending Room — review and confirm
          </p>
        </div>
      )}

      {/* Offline queue list */}
      {offlineQueue.length > 0 && (
        <div className="mt-6">
          <h3 className="text-gray-600 text-xs font-medium uppercase tracking-wider mb-2">
            Offline queue — {offlineQueue.length} item{offlineQueue.length !== 1 ? 's' : ''}
          </h3>
          <div className="space-y-2">
            {offlineQueue.map(item => (
              <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                <p className="text-gray-500 text-xs font-mono">{item.rawText}</p>
                <p className="text-gray-700 text-xs mt-1">
                  Captured {new Date(item.timestamp).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>
          {online && (
            <button
              onClick={syncQueue}
              disabled={syncing}
              className="mt-3 w-full bg-teal-900/40 hover:bg-teal-900/60 text-teal-400 text-sm py-2.5 rounded-xl transition-colors"
            >
              {syncing ? 'Syncing...' : `Sync all ${offlineQueue.length} items now`}
            </button>
          )}
        </div>
      )}

      {/* Format reference */}
      <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-gray-600 text-xs font-medium uppercase tracking-wider mb-3">Format reference</p>
        <div className="space-y-1 font-mono text-xs text-gray-700">
          <p><span className="text-gray-500">task:</span> Person / Team / description / priority / due / flags</p>
          <p><span className="text-gray-500">decision:</span> Person / Team / what was decided</p>
          <p className="pt-2"><span className="text-gray-600">Priority:</span> high · med · low</p>
          <p><span className="text-gray-600">Due:</span> tmr · eow · eom · mon · tue · wed · thu · fri · 15jan</p>
          <p><span className="text-gray-600">Flags:</span> meeting · wait · deep · quick · followup</p>
          <p><span className="text-gray-600">Skip slot:</span> use - as placeholder</p>
        </div>
      </div>
    </div>
  )
}