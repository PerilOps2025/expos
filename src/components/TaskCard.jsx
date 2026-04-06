import { useState } from 'react'
import { supabase } from '../lib/supabase'
import CompletionModal from './CompletionModal'

const PRIORITY_STYLES = {
  high: { dot: 'bg-red-400', badge: 'text-red-400 bg-red-900/30 border-red-800/50' },
  medium: { dot: 'bg-yellow-400', badge: 'text-yellow-400 bg-yellow-900/30 border-yellow-800/50' },
  low: { dot: 'bg-gray-500', badge: 'text-gray-400 bg-gray-800 border-gray-700' },
}

const STATUS_STYLES = {
  active: 'text-teal-400',
  waiting: 'text-yellow-400',
  blocked: 'text-red-400',
  overdue: 'text-red-500',
  done: 'text-gray-600',
}

export default function TaskCard({ task, onUpdated }) {
  const [showCompletion, setShowCompletion] = useState(false)
  const [updating, setUpdating] = useState(false)

  const priority = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium
  const isOverdue = task.due_at && new Date(task.due_at) < new Date() && task.status === 'active'
  const displayStatus = isOverdue ? 'overdue' : task.status

  async function handleStatusChange(newStatus) {
    if (newStatus === 'done') {
      setShowCompletion(true)
      return
    }
    setUpdating(true)
    await supabase.from('tasks').update({
      status: newStatus,
      updated_at: new Date().toISOString()
    }).eq('id', task.id)
    setUpdating(false)
    onUpdated()
  }

  const dueDate = task.due_at
    ? new Date(task.due_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : task.due_vague || null

  return (
    <>
      <div className={`bg-gray-900 border rounded-xl px-4 py-3 ${
        isOverdue ? 'border-red-900/50' : 'border-gray-800'
      }`}>
        <div className="flex items-start gap-3">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${priority.dot}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm ${task.status === 'done' ? 'text-gray-600 line-through' : 'text-gray-200'}`}>
              {task.description}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
              {task.person?.name && (
                <span className="text-gray-500 text-xs">{task.person.name}</span>
              )}
              {task.team?.name && (
                <span className="text-gray-500 text-xs">{task.team.name}</span>
              )}
              {dueDate && (
                <span className={`text-xs ${isOverdue ? 'text-red-400 font-medium' : 'text-gray-600'}`}>
                  {isOverdue ? 'overdue · ' : ''}{dueDate}
                </span>
              )}
              {task.meeting_context && (
                <span className="text-indigo-500 text-xs">meeting</span>
              )}
              {task.parent_task_id && (
                <span className="text-gray-600 text-xs">↳ follow-up</span>
              )}
              {task.energy_tag && (
                <span className="text-gray-600 text-xs">{task.energy_tag.replace('_', ' ')}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium border ${priority.badge}`}>
              {task.priority[0].toUpperCase()}
            </span>
            {task.status !== 'done' && (
              <select
                className="bg-gray-800 text-gray-400 text-xs rounded-lg px-2 py-1 focus:outline-none border border-gray-700"
                value={displayStatus}
                onChange={e => handleStatusChange(e.target.value)}
                disabled={updating}
              >
                <option value="active">Active</option>
                <option value="waiting">Waiting</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done ✓</option>
              </select>
            )}
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