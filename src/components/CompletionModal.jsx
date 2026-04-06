import { useState } from 'react'
import { supabase } from '../lib/supabase'

const COMPLETION_TAGS = ['Meeting Context', 'Decision Made', 'Follow-up Needed', 'For Record Only']
const ROUTE_OPTIONS = ['Pre-Meeting Brief', 'Decision Feed', 'Archive Only']

export default function CompletionModal({ task, onClose, onDone }) {
  const [note, setNote] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [routeTo, setRouteTo] = useState([])
  const [followUps, setFollowUps] = useState([])
  const [saving, setSaving] = useState(false)

  function toggleTag(tag) {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  function toggleRoute(route) {
    setRouteTo(prev =>
      prev.includes(route) ? prev.filter(r => r !== route) : [...prev, route]
    )
  }

  function addFollowUp() {
    setFollowUps(prev => [...prev, {
      id: crypto.randomUUID(),
      description: '',
      person_id: task.person_id,
      person_name: task.person?.name || '',
      team_id: task.team_id,
      team_name: task.team?.name || '',
      priority: task.priority,
      due_at: null,
    }])
  }

  function updateFollowUp(id, field, value) {
    setFollowUps(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f))
  }

  function removeFollowUp(id) {
    setFollowUps(prev => prev.filter(f => f.id !== id))
  }

  async function handleSave() {
    setSaving(true)
    try {
      // Mark task as done
      const { error: taskError } = await supabase
        .from('tasks')
        .update({
          status: 'done',
          completion_note: note,
          completion_tags: selectedTags,
          completion_routed_to: routeTo,
          archived_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', task.id)
      if (taskError) throw taskError

      // If Decision Made — log to decisions table
      if (selectedTags.includes('Decision Made') && note) {
        await supabase.from('decisions').insert({
          description: note,
          team_id: task.team_id,
          project_id: task.project_id,
          source_task_id: task.id,
        })
      }

      // Save follow-up tasks
      for (const fu of followUps) {
        if (!fu.description.trim()) continue
        await supabase.from('tasks').insert({
          description: fu.description,
          person_id: fu.person_id || null,
          team_id: fu.team_id || null,
          priority: fu.priority,
          due_at: fu.due_at,
          parent_task_id: task.id,
          source: 'manual',
          status: 'active',
          meeting_context: selectedTags.includes('Meeting Context'),
        })
      }

      onDone()
      onClose()
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '2rem 1rem' }}>
      <div className="w-full max-w-lg bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-800">
          <p className="text-gray-500 text-xs mb-1">Completing task</p>
          <p className="text-white font-medium">{task.description}</p>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Section 1: Completion note */}
          <div>
            <label className="text-gray-400 text-xs font-medium uppercase tracking-wider block mb-2">
              Completion note
            </label>
            <textarea
              className="w-full bg-gray-800 text-gray-100 text-sm rounded-xl px-3 py-3 focus:outline-none focus:ring-1 focus:ring-teal-700 resize-none"
              rows={3}
              placeholder="What happened? What was decided? What's next?"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {COMPLETION_TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    selectedTags.includes(tag)
                      ? 'bg-teal-800 text-teal-200 border-teal-700'
                      : 'bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Follow-up tasks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-gray-400 text-xs font-medium uppercase tracking-wider">
                Follow-up tasks
              </label>
              <button
                onClick={addFollowUp}
                className="text-teal-500 hover:text-teal-400 text-xs transition-colors"
              >
                + Add follow-up
              </button>
            </div>
            {followUps.length === 0 && (
              <p className="text-gray-700 text-xs">No follow-ups — click above to add one</p>
            )}
            {followUps.map(fu => (
              <div key={fu.id} className="bg-gray-800 rounded-xl p-3 mb-2">
                <input
                  className="w-full bg-transparent text-gray-200 text-sm focus:outline-none mb-2 border-b border-gray-700 pb-1"
                  placeholder="Follow-up task description..."
                  value={fu.description}
                  onChange={e => updateFollowUp(fu.id, 'description', e.target.value)}
                />
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-gray-700 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
                    placeholder="Person"
                    value={fu.person_name}
                    onChange={e => updateFollowUp(fu.id, 'person_name', e.target.value)}
                  />
                  <select
                    className="bg-gray-700 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
                    value={fu.priority}
                    onChange={e => updateFollowUp(fu.id, 'priority', e.target.value)}
                  >
                    <option value="high">High</option>
                    <option value="medium">Med</option>
                    <option value="low">Low</option>
                  </select>
                  <input
                    type="date"
                    className="bg-gray-700 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
                    value={fu.due_at ? fu.due_at.slice(0, 10) : ''}
                    onChange={e => updateFollowUp(fu.id, 'due_at', e.target.value || null)}
                  />
                  <button
                    onClick={() => removeFollowUp(fu.id)}
                    className="text-gray-600 hover:text-red-400 text-xs transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Section 3: Route note */}
          <div>
            <label className="text-gray-400 text-xs font-medium uppercase tracking-wider block mb-2">
              Surface this note in
            </label>
            <div className="flex flex-wrap gap-2">
              {ROUTE_OPTIONS.map(route => (
                <button
                  key={route}
                  onClick={() => toggleRoute(route)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    routeTo.includes(route)
                      ? 'bg-indigo-800 text-indigo-200 border-indigo-700'
                      : 'bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  {route}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm font-medium py-2.5 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-teal-600 hover:bg-teal-500 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
          >
            {saving ? 'Saving...' : 'Complete task'}
          </button>
        </div>
      </div>
    </div>
  )
}