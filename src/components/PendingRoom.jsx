import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { createEntity } from '../lib/entities'
import { format } from 'date-fns'

const PRIORITY_COLORS = {
  high: 'bg-red-900/50 text-red-300 border-red-800',
  medium: 'bg-yellow-900/50 text-yellow-300 border-yellow-800',
  low: 'bg-gray-800 text-gray-400 border-gray-700'
}

function PendingCard({ item, onConfirm, onDiscard, onChange }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
              item.type === 'decision' ? 'bg-purple-900/50 text-purple-300 border-purple-800' :
              item.type === 'event' ? 'bg-blue-900/50 text-blue-300 border-blue-800' :
              'bg-teal-900/50 text-teal-300 border-teal-800'
            }`}>{item.type}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PRIORITY_COLORS[item.priority]}`}>
              {item.priority}
            </span>
            {item.meeting_context && (
              <span className="text-xs px-2 py-0.5 rounded-full border bg-indigo-900/50 text-indigo-300 border-indigo-800">meeting</span>
            )}
            {item.confidence === 'low' && (
              <span className="text-xs px-2 py-0.5 rounded-full border bg-orange-900/50 text-orange-300 border-orange-800">needs review</span>
            )}
          </div>

          <input
            className="w-full bg-transparent text-white text-sm font-medium focus:outline-none border-b border-transparent hover:border-gray-700 focus:border-gray-500 pb-0.5 mb-3"
            value={item.description}
            onChange={e => onChange(item.id, 'description', e.target.value)}
          />

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-gray-500 block mb-1">Person</label>
              <div className="flex items-center gap-1">
                <input
                  className="flex-1 bg-gray-800 text-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-600"
                  value={item.person_name || ''}
                  placeholder="—"
                  onChange={e => onChange(item.id, 'person_name', e.target.value)}
                />
                {item.person_is_new && item.person_name && (
                  <span className="text-orange-400 text-xs">new</span>
                )}
              </div>
            </div>
            <div>
              <label className="text-gray-500 block mb-1">Team</label>
              <div className="flex items-center gap-1">
                <input
                  className="flex-1 bg-gray-800 text-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-600"
                  value={item.team_name || ''}
                  placeholder="—"
                  onChange={e => onChange(item.id, 'team_name', e.target.value)}
                />
                {item.team_is_new && item.team_name && (
                  <span className="text-orange-400 text-xs">new</span>
                )}
              </div>
            </div>
            <div>
              <label className="text-gray-500 block mb-1">Priority</label>
              <select
                className="w-full bg-gray-800 text-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-600"
                value={item.priority}
                onChange={e => onChange(item.id, 'priority', e.target.value)}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="text-gray-500 block mb-1">Due</label>
              <input
                type="date"
                className="w-full bg-gray-800 text-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-600"
                value={item.due_at ? item.due_at.slice(0, 10) : ''}
                onChange={e => onChange(item.id, 'due_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
              />
            </div>
          </div>

          {item.due_vague && (
            <p className="text-orange-400 text-xs mt-2">Vague date: "{item.due_vague}" — please set a specific date above</p>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={() => onConfirm(item)}
          className="flex-1 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium py-2 rounded-lg transition-colors"
        >
          Confirm
        </button>
        <button
          onClick={() => onDiscard(item.id)}
          className="px-4 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm py-2 rounded-lg transition-colors"
        >
          Discard
        </button>
      </div>
    </div>
  )
}

export default function PendingRoom({ items, setItems, onConfirmed }) {
  async function handleConfirm(item) {
    try {
      let person_id = item.person_id
      let team_id = item.team_id

      // Create new entities if needed
      if (item.person_name && item.person_is_new) {
        const entity = await createEntity('person', item.person_name)
        person_id = entity.id
      }
      if (item.team_name && item.team_is_new) {
        const name = item.team_name.toLowerCase().endsWith('team')
          ? item.team_name
          : item.team_name + ' team'
        const entity = await createEntity('team', name)
        team_id = entity.id
      }

      if (item.type === 'decision') {
        const { error } = await supabase.from('decisions').insert({
          description: item.description,
          team_id,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.from('tasks').insert({
          description: item.description,
          person_id,
          team_id,
          priority: item.priority,
          due_at: item.due_at,
          due_vague: item.due_vague,
          meeting_context: item.meeting_context,
          status: item.status || 'active',
          energy_tag: item.energy_tag,
          source: 'text',
        })
        if (error) throw error
      }

      setItems(prev => prev.filter(i => i.id !== item.id))
      onConfirmed()
    } catch (err) {
      alert('Error saving: ' + err.message)
    }
  }

  function handleDiscard(id) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function handleChange(id, field, value) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  async function handleConfirmAll() {
    for (const item of items) {
      await handleConfirm(item)
    }
  }

  if (items.length === 0) return null

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="w-full max-w-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white font-semibold text-lg">Pending Room</h2>
            <p className="text-gray-500 text-sm">{items.length} item{items.length !== 1 ? 's' : ''} to review</p>
          </div>
          <button
            onClick={handleConfirmAll}
            className="bg-teal-700 hover:bg-teal-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Confirm all
          </button>
        </div>
        {items.map(item => (
          <PendingCard
            key={item.id}
            item={item}
            onConfirm={handleConfirm}
            onDiscard={handleDiscard}
            onChange={handleChange}
          />
        ))}
      </div>
    </div>
  )
}