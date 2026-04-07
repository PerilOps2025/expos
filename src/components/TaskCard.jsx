import { useState } from 'react'
import { supabase } from '../lib/supabase'
import CompletionModal from './CompletionModal'
import { format, parseISO } from 'date-fns'

const PRIORITY_STYLES = {
  high: { dot: 'bg-red-400', badge: 'text-red-400 bg-red-900/30 border-red-800/50' },
  medium: { dot: 'bg-yellow-400', badge: 'text-yellow-400 bg-yellow-900/30 border-yellow-800/50' },
  low: { dot: 'bg-gray-500', badge: 'text-gray-400 bg-gray-800 border-gray-700' },
}

export default function TaskCard({ task, onUpdated }) {
  const [showCompletion, setShowCompletion] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({
    description: task.description,
    priority: task.priority,
    due_at: task.due_at ? task.due_at.slice(0, 10) : '',
    status: task.status,
  })
  const [saving, setSaving] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const priority = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium
  const isOverdue = task.due_at && new Date(task.due_at) < new Date() && task.status === 'active'
  const displayStatus = isOverdue ? 'overdue' : task.status

  async function handleStatusChange(newStatus) {
    if (newStatus === 'done') { setShowCompletion(true); return }
    await supabase.from('tasks').update({
      status: newStatus, updated_at: new Date().toISOString()
    }).eq('id', task.id)
    onUpdated()
  }

  async function handleSaveEdit() {
    setSaving(true)
    await supabase.from('tasks').update({
      description: editData.description,
      priority: editData.priority,
      due_at: editData.due_at ? new Date(editData.due_at).toISOString() : null,
      status: editData.status,
      updated_at: new Date().toISOString(),
    }).eq('id', task.id)
    setSaving(false)
    setEditing(false)
    onUpdated()
  }

  async function handleDelete() {
    if (!confirm(`Delete "${task.description}"? This cannot be undone.`)) return
    await supabase.from('tasks').delete().eq('id', task.id)
    onUpdated()
  }

  async function handleArchive() {
    await supabase.from('tasks').update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', task.id)
    onUpdated()
  }

  const dueDate = task.due_at
    ? format(parseISO(task.due_at), 'd MMM')
    : task.due_vague || null

  if (editing) {
    return (
      <div className="bg-gray-900 border border-teal-800 rounded-xl px-4 py-3 mb-2">
        <input
          className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2 mb-2 focus:outline-none focus:ring-1 focus:ring-teal-600"
          value={editData.description}
          onChange={e => setEditData(p => ({ ...p, description: e.target.value }))}
        />
        <div className="grid grid-cols-3 gap-2 mb-3">
          <select
            className="bg-gray-800 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
            value={editData.priority}
            onChange={e => setEditData(p => ({ ...p, priority: e.target.value }))}
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            className="bg-gray-800 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
            value={editData.status}
            onChange={e => setEditData(p => ({ ...p, status: e.target.value }))}
          >
            <option value="active">Active</option>
            <option value="waiting">Waiting</option>
            <option value="blocked">Blocked</option>
          </select>
          <input
            type="date"
            className="bg-gray-800 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
            value={editData.due_at}
            onChange={e => setEditData(p => ({ ...p, due_at: e.target.value }))}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSaveEdit}
            disabled={saving}
            className="flex-1 bg-teal-600 hover:bg-teal-500 text-white text-xs py-2 rounded-lg transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-3 bg-gray-800 text-gray-500 text-xs py-2 rounded-lg"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className={`bg-gray-900 border rounded-xl px-4 py-3 mb-2 group ${
        isOverdue ? 'border-red-900/50' : 'border-gray-800 hover:border-gray-700'
      } transition-colors`}>
        <div className="flex items-start gap-3">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${priority.dot}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm ${task.status === 'done' ? 'text-gray-600 line-through' : 'text-gray-200'}`}>
              {task.description}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
              {task.person?.name && <span className="text-gray-500 text-xs">{task.person.name}</span>}
              {task.team?.name && <span className="text-gray-500 text-xs">{task.team.name}</span>}
              {dueDate && (
                <span className={`text-xs ${isOverdue ? 'text-red-400 font-medium' : 'text-gray-600'}`}>
                  {isOverdue && 'overdue · '}{dueDate}
                </span>
              )}
              {task.meeting_context && <span className="text-indigo-500 text-xs">meeting</span>}
              {task.parent_task_id && <span className="text-gray-600 text-xs">↳ follow-up</span>}
              {task.energy_tag && <span className="text-gray-600 text-xs">{task.energy_tag.replace(/_/g, ' ')}</span>}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${priority.badge}`}>
              {task.priority[0].toUpperCase()}
            </span>
            {task.status !== 'done' && (
              <select
                className="bg-gray-800 text-gray-400 text-xs rounded-lg px-2 py-1 focus:outline-none border border-gray-700"
                value={displayStatus}
                onChange={e => handleStatusChange(e.target.value)}
              >
                <option value="active">Active</option>
                <option value="waiting">Waiting</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done ✓</option>
              </select>
            )}

            {/* Kebab menu */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="text-gray-700 hover:text-gray-400 text-lg leading-none px-1 transition-colors"
              >
                ⋮
              </button>
              {showMenu && (
                <div className="absolute right-0 top-6 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-20 min-w-32 overflow-hidden">
                  <button
                    onClick={() => { setEditing(true); setShowMenu(false) }}
                    className="w-full text-left px-4 py-2.5 text-gray-300 text-sm hover:bg-gray-700 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => { handleArchive(); setShowMenu(false) }}
                    className="w-full text-left px-4 py-2.5 text-gray-400 text-sm hover:bg-gray-700 transition-colors"
                  >
                    Archive
                  </button>
                  <button
                    onClick={() => { handleDelete(); setShowMenu(false) }}
                    className="w-full text-left px-4 py-2.5 text-red-400 text-sm hover:bg-gray-700 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showCompletion && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <CompletionModal
            task={task}
            onClose={() => setShowCompletion(false)}
            onDone={onUpdated}
          />
        </div>
      )}
    </>
  )
}