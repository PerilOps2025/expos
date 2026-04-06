import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import TaskCard from './TaskCard'
import { isToday, isTomorrow, isThisWeek, addDays, isPast } from 'date-fns'

const VIEWS = ['Pulse', 'Team Follow-up', 'Upcoming', 'Team Load', 'People', 'Focus']

export default function Dashboard() {
  const [view, setView] = useState('Pulse')
  const [tasks, setTasks] = useState([])
  const [entities, setEntities] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [selectedPerson, setSelectedPerson] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: taskData }, { data: entityData }] = await Promise.all([
      supabase
        .from('tasks')
        .select('*, person:person_id(id,name), team:team_id(id,name)')
        .is('archived_at', null)
        .neq('status', 'done')
        .order('created_at', { ascending: false }),
      supabase.from('entities').select('*').order('name')
    ])
    setTasks(taskData || [])
    setEntities(entityData || [])
    setLoading(false)
  }

  const teams = entities.filter(e => e.type === 'team')
  const people = entities.filter(e => e.type === 'person')

  // Compute derived task lists
  const overdueTasks = tasks.filter(t =>
    t.due_at && isPast(new Date(t.due_at)) && t.status === 'active'
  )
  const waitingTooLong = tasks.filter(t =>
    t.status === 'waiting' &&
    t.updated_at &&
    (Date.now() - new Date(t.updated_at).getTime()) > 3 * 24 * 60 * 60 * 1000
  )
  const highPriority = tasks.filter(t => t.priority === 'high' && t.status === 'active')

  // Upcoming buckets
  const tomorrow = tasks.filter(t => t.due_at && isTomorrow(new Date(t.due_at)))
  const next3days = tasks.filter(t => {
    if (!t.due_at) return false
    const d = new Date(t.due_at)
    const now = new Date()
    return d > addDays(now, 1) && d <= addDays(now, 3)
  })
  const thisWeek = tasks.filter(t => {
    if (!t.due_at) return false
    const d = new Date(t.due_at)
    return isThisWeek(d, { weekStartsOn: 1 }) && d > addDays(new Date(), 3)
  })

  // Team load
  const teamLoad = teams.map(team => ({
    ...team,
    tasks: tasks.filter(t => t.team?.id === team.id),
    high: tasks.filter(t => t.team?.id === team.id && t.priority === 'high').length,
    medium: tasks.filter(t => t.team?.id === team.id && t.priority === 'medium').length,
    low: tasks.filter(t => t.team?.id === team.id && t.priority === 'low').length,
  }))

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-600 text-sm">Loading...</div>
  )

  function PrioritySort(arr) {
    const order = { high: 0, medium: 1, low: 2 }
    return [...arr].sort((a, b) => (order[a.priority] ?? 1) - (order[b.priority] ?? 1))
  }

  function UpcomingColumn({ title, items }) {
    return (
      <div className="flex-1 min-w-0">
        <h3 className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-3">{title}</h3>
        {items.length === 0
          ? <p className="text-gray-700 text-xs">Nothing due</p>
          : PrioritySort(items).map(t => <TaskCard key={t.id} task={t} onUpdated={loadData} />)
        }
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* View tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {VIEWS.map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors flex-shrink-0 ${
              view === v
                ? 'bg-gray-800 text-white font-medium'
                : 'text-gray-600 hover:text-gray-400'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {/* ── VIEW: PULSE ── */}
      {view === 'Pulse' && (
        <div className="space-y-6">
          {overdueTasks.length > 0 && (
            <section>
              <h2 className="text-red-400 text-xs font-medium uppercase tracking-wider mb-3">
                Overdue — {overdueTasks.length}
              </h2>
              <div className="space-y-2">
                {overdueTasks.map(t => <TaskCard key={t.id} task={t} onUpdated={loadData} />)}
              </div>
            </section>
          )}
          {waitingTooLong.length > 0 && (
            <section>
              <h2 className="text-yellow-400 text-xs font-medium uppercase tracking-wider mb-3">
                Waiting too long — {waitingTooLong.length}
              </h2>
              <div className="space-y-2">
                {waitingTooLong.map(t => <TaskCard key={t.id} task={t} onUpdated={loadData} />)}
              </div>
            </section>
          )}
          <section>
            <h2 className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-3">
              High priority — {highPriority.length}
            </h2>
            <div className="space-y-2">
              {highPriority.length === 0
                ? <p className="text-gray-700 text-sm">No high priority tasks</p>
                : highPriority.map(t => <TaskCard key={t.id} task={t} onUpdated={loadData} />)
              }
            </div>
          </section>
        </div>
      )}

      {/* ── VIEW: TEAM FOLLOW-UP ── */}
      {view === 'Team Follow-up' && (
        <div>
          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              onClick={() => setSelectedTeam(null)}
              className={`px-3 py-1 rounded-lg text-xs transition-colors ${!selectedTeam ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              All teams
            </button>
            {teams.map(team => (
              <button
                key={team.id}
                onClick={() => setSelectedTeam(team.id === selectedTeam ? null : team.id)}
                className={`px-3 py-1 rounded-lg text-xs transition-colors ${selectedTeam === team.id ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                {team.name}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {tasks
              .filter(t => t.person_id && (!selectedTeam || t.team?.id === selectedTeam))
              .map(t => <TaskCard key={t.id} task={t} onUpdated={loadData} />)
            }
          </div>
        </div>
      )}

      {/* ── VIEW: UPCOMING ── */}
      {view === 'Upcoming' && (
        <div className="flex flex-col md:flex-row gap-6">
          <UpcomingColumn title="Tomorrow" items={tomorrow} />
          <UpcomingColumn title="Next 3 days" items={next3days} />
          <UpcomingColumn title="This week" items={thisWeek} />
        </div>
      )}

      {/* ── VIEW: TEAM LOAD ── */}
      {view === 'Team Load' && (
        <div className="space-y-4">
          {teamLoad.length === 0 && (
            <p className="text-gray-600 text-sm">No teams yet — add tasks with team names to see load</p>
          )}
          {teamLoad.map(team => (
            <div key={team.id}>
              <div
                className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 cursor-pointer hover:border-gray-700 transition-colors"
                onClick={() => setSelectedTeam(selectedTeam === team.id ? null : team.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-200 text-sm font-medium">{team.name}</span>
                  <span className="text-gray-500 text-xs">{team.tasks.length} tasks</span>
                </div>
                <div className="flex h-2 rounded-full overflow-hidden bg-gray-800 gap-px">
                  {team.high > 0 && (
                    <div className="bg-red-500" style={{ width: `${(team.high / team.tasks.length) * 100}%` }} />
                  )}
                  {team.medium > 0 && (
                    <div className="bg-yellow-500" style={{ width: `${(team.medium / team.tasks.length) * 100}%` }} />
                  )}
                  {team.low > 0 && (
                    <div className="bg-gray-500" style={{ width: `${(team.low / team.tasks.length) * 100}%` }} />
                  )}
                </div>
                <div className="flex gap-3 mt-1.5">
                  {team.high > 0 && <span className="text-red-400 text-xs">{team.high} high</span>}
                  {team.medium > 0 && <span className="text-yellow-400 text-xs">{team.medium} med</span>}
                  {team.low > 0 && <span className="text-gray-500 text-xs">{team.low} low</span>}
                </div>
              </div>
              {selectedTeam === team.id && (
                <div className="mt-2 space-y-2 pl-2">
                  {team.tasks.map(t => <TaskCard key={t.id} task={t} onUpdated={loadData} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── VIEW: PEOPLE ── */}
      {view === 'People' && (
        <div className="space-y-4">
          {people.length === 0 && (
            <p className="text-gray-600 text-sm">No people yet — add tasks with person names to see load</p>
          )}
          {people.map(person => {
            const personTasks = tasks.filter(t => t.person?.id === person.id)
            if (personTasks.length === 0) return null
            return (
              <div key={person.id}>
                <div
                  className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 cursor-pointer hover:border-gray-700 transition-colors"
                  onClick={() => setSelectedPerson(selectedPerson === person.id ? null : person.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-gray-200 text-sm font-medium">{person.name}</span>
                    <div className="flex gap-2 items-center">
                      {personTasks.filter(t => t.priority === 'high').length > 0 && (
                        <span className="text-red-400 text-xs">{personTasks.filter(t => t.priority === 'high').length} high</span>
                      )}
                      <span className="text-gray-500 text-xs">{personTasks.length} total</span>
                    </div>
                  </div>
                </div>
                {selectedPerson === person.id && (
                  <div className="mt-2 space-y-2 pl-2">
                    {personTasks.map(t => <TaskCard key={t.id} task={t} onUpdated={loadData} />)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── VIEW: FOCUS ── */}
      {view === 'Focus' && (
        <div className="space-y-2">
          <p className="text-gray-600 text-xs mb-4">Today · Overdue · High priority · Your tasks</p>
          {PrioritySort([
            ...overdueTasks,
            ...tasks.filter(t => t.due_at && isToday(new Date(t.due_at))),
            ...highPriority.filter(t => !overdueTasks.includes(t))
          ].filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i))
            .map(t => <TaskCard key={t.id} task={t} onUpdated={loadData} />)
          }
        </div>
      )}
    </div>
  )
}