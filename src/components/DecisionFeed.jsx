import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

export default function DecisionFeed() {
  const [decisions, setDecisions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadDecisions() }, [])

  async function loadDecisions() {
    const { data } = await supabase
      .from('decisions')
      .select('*, team:team_id(name), superseded:superseded_by(description)')
      .order('created_at', { ascending: false })
    setDecisions(data || [])
    setLoading(false)
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
              className={`bg-gray-900 border rounded-xl px-4 py-3 ${
                d.superseded_by ? 'border-gray-800 opacity-60' : 'border-gray-700'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className={`text-sm ${d.superseded_by ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                    {d.description}
                  </p>
                  <div className="flex gap-3 mt-1.5">
                    {d.team?.name && (
                      <span className="text-gray-600 text-xs">{d.team.name}</span>
                    )}
                    <span className="text-gray-700 text-xs">
                      {format(new Date(d.created_at), 'd MMM yyyy')}
                    </span>
                  </div>
                  {d.superseded_by && (
                    <p className="text-yellow-600 text-xs mt-1">
                      Superseded → {d.superseded?.description}
                    </p>
                  )}
                </div>
                <span className="text-purple-500 text-xs flex-shrink-0 mt-0.5">decision</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}