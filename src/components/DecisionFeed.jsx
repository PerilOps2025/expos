import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format, parseISO } from 'date-fns'

export default function DecisionFeed() {
  const [decisions, setDecisions] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')

  useEffect(() => { loadDecisions() }, [])

  async function loadDecisions() {
    const { data } = await supabase
      .from('decisions')
      .select('*, team:team_id(name), superseded:superseded_by(description)')
      .order('created_at', { ascending: false })
    setDecisions(data || [])
    setLoading(false)
  }

  async function handleDelete(id, description) {
    if (!confirm(`Delete decision: "${description}"?`)) return
    await supabase.from('decisions').delete().eq('id', id)
    setDecisions(prev => prev.filter(d => d.id !== id))
  }

  async function handleEdit(decision) {
    setEditingId(decision.id)
    setEditText(decision.description)
  }

  async function handleSaveEdit(id) {
    await supabase.from('decisions').update({
      description: editText
    }).eq('id', id)
    setDecisions(prev => prev.map(d =>
      d.id === id ? { ...d, description: editText } : d
    ))
    setEditingId(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-600 text-sm">Loading...</div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-white font-semibold">Decision feed</h2>
        <span className="text-gray-600 text-sm">{decisions.length} decisions</span>
      </div>

      {decisions.length === 0 ? (
        <div className="text-center py-16 text-gray-700">
          <p className="text-sm">No decisions logged yet</p>
          <p className="text-xs mt-1">Confirm a "decision:" item or tag a task completion as "Decision Made"</p>
        </div>
      ) : (
        <div className="space-y-3">
          {decisions.map(d => (
            <div
              key={d.id}
              className={`bg-gray-900 border rounded-xl px-4 py-3 group ${
                d.superseded_by ? 'border-gray-800 opacity-50' : 'border-gray-700 hover:border-gray-600'
              } transition-colors`}
            >
              {editingId === d.id ? (
                <div>
                  <textarea
                    className="w-full bg-gray-800 text-gray-200 text-sm rounded-lg px-3 py-2 mb-2 focus:outline-none resize-none"
                    rows={2}
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveEdit(d.id)}
                      className="bg-teal-600 hover:bg-teal-500 text-white text-xs px-3 py-1.5 rounded-lg"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="bg-gray-800 text-gray-500 text-xs px-3 py-1.5 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className={`text-sm ${d.superseded_by ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                      {d.description}
                    </p>
                    <div className="flex gap-3 mt-1.5">
                      {d.team?.name && <span className="text-gray-600 text-xs">{d.team.name}</span>}
                      <span className="text-gray-700 text-xs">
                        {format(parseISO(d.created_at), 'd MMM yyyy')}
                      </span>
                      {d.superseded_by && (
                        <span className="text-yellow-700 text-xs">superseded</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-purple-600 text-xs">◈</span>
                    <button
                      onClick={() => handleEdit(d)}
                      className="text-gray-700 hover:text-gray-400 text-xs opacity-0 group-hover:opacity-100 transition-all"
                    >
                      edit
                    </button>
                    <button
                      onClick={() => handleDelete(d.id, d.description)}
                      className="text-gray-700 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-all"
                    >
                      delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}