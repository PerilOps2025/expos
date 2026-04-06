import { useState } from 'react'
import { parseInput } from '../lib/parser'
import { resolveEntities } from '../lib/entities'

const EXAMPLES = [
  'task: Kishore / Procurement team / send vendor list / high / thu / meeting',
  'task: Jaya / - / review Q3 report / med / eow',
  'task: - / Production team / finalise packaging design / high / 15jan',
  'decision: Kishore / Procurement team / approved new vendor rates',
  'task: Rajan / Finance / submit budget / high / tmr / meeting',
]

export default function CaptureInput({ onParsed }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [showExamples, setShowExamples] = useState(false)

  async function handleSubmit() {
    if (!text.trim()) return
    setLoading(true)
    try {
      const parsed = parseInput(text)
      const resolved = await resolveEntities(parsed)
      onParsed(resolved)
      setText('')
    } catch (err) {
      alert('Parse error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-gray-300 font-medium text-sm">Quick capture</h3>
        <button
          onClick={() => setShowExamples(!showExamples)}
          className="text-gray-600 hover:text-gray-400 text-xs transition-colors"
        >
          {showExamples ? 'hide examples' : 'show examples'}
        </button>
      </div>

      {showExamples && (
        <div className="mb-3 space-y-1">
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              onClick={() => setText(ex)}
              className="block w-full text-left text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800 px-2 py-1 rounded transition-colors font-mono"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      <textarea
        className="w-full bg-gray-800 text-gray-100 text-sm rounded-xl px-3 py-3 focus:outline-none focus:ring-1 focus:ring-teal-700 resize-none font-mono placeholder-gray-600"
        rows={3}
        placeholder={'task: Person / Team / description / priority / due / flags\ndecision: Person / Team / what was decided\n\nCtrl+Enter to parse'}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      <div className="flex items-center justify-between mt-2">
        <p className="text-gray-700 text-xs">Ctrl+Enter to parse · one item per line</p>
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || loading}
          className="bg-teal-600 hover:bg-teal-500 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {loading ? 'Parsing...' : 'Parse →'}
        </button>
      </div>
    </div>
  )
}