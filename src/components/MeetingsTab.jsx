import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { saveGoogleToken, getGoogleToken } from '../lib/auth'
import { fetchCalendarEvents, buildMeetingBrief } from '../lib/calendar'
import { format, isToday, isTomorrow, isThisWeek, parseISO, differenceInMinutes } from 'date-fns'
import { requestPushPermission, schedulePreMeetingNotifications } from '../lib/pushNotifications'

const PRIORITY_DOT = {
  high: 'bg-red-400',
  medium: 'bg-yellow-400',
  low: 'bg-gray-500'
}

function MeetingBrief({ meeting, brief, onClose }) {
  const start = parseISO(meeting.start_at)
  const end = parseISO(meeting.end_at)
  const duration = differenceInMinutes(end, start)

  return (
    <div className="mt-3 bg-gray-800/60 border border-gray-700 rounded-xl p-4 space-y-5">
      {/* Attendees */}
      {brief.attendees.filter(a => !a.self).length > 0 && (
        <section>
          <h4 className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">Attendees</h4>
          <div className="flex flex-wrap gap-2">
            {brief.attendees.filter(a => !a.self).map((a, i) => (
              <span key={i} className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded-lg">
                {a.name || a.email}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Open tasks */}
      {brief.openTasks.length > 0 && (
        <section>
          <h4 className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">
            Open tasks — {brief.openTasks.length}
          </h4>
          <div className="space-y-1.5">
            {brief.openTasks.map(t => (
              <div key={t.id} className="flex items-start gap-2">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${PRIORITY_DOT[t.priority]}`} />
                <div>
                  <p className="text-gray-300 text-sm">{t.description}</p>
                  <p className="text-gray-600 text-xs">
                    {t.person?.name && `${t.person.name} · `}
                    {t.team?.name && `${t.team.name} · `}
                    {t.due_at && format(parseISO(t.due_at), 'd MMM')}
                    {t.meeting_context && ' · flagged for meeting'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Carry-forward */}
      {brief.carryForward.length > 0 && (
        <section>
          <h4 className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">
            Carry-forward from last meeting
          </h4>
          <div className="space-y-1.5">
            {brief.carryForward.map(t => (
              <div key={t.id} className="flex items-start gap-2">
                <span className="text-yellow-600 text-xs mt-0.5">↻</span>
                <p className="text-gray-400 text-sm">{t.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Related decisions */}
      {brief.relatedDecisions.length > 0 && (
        <section>
          <h4 className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">
            Recent decisions
          </h4>
          <div className="space-y-1.5">
            {brief.relatedDecisions.map(d => (
              <div key={d.id} className="flex items-start gap-2">
                <span className="text-purple-500 text-xs mt-0.5">◈</span>
                <div>
                  <p className="text-gray-300 text-sm">{d.description}</p>
                  <p className="text-gray-600 text-xs">
                    {d.team?.name && `${d.team.name} · `}
                    {format(parseISO(d.created_at), 'd MMM')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Past similar meetings */}
      {brief.similarMeetings.length > 0 && (
        <section>
          <h4 className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">
            Past similar meetings
          </h4>
          <div className="space-y-1.5">
            {brief.similarMeetings.map(m => (
              <div key={m.id} className="flex items-start gap-2">
                <span className="text-gray-600 text-xs mt-0.5">◷</span>
                <div>
                  <p className="text-gray-400 text-sm">{m.title}</p>
                  <p className="text-gray-600 text-xs">
                    {format(parseISO(m.start_at), 'd MMM yyyy')}
                    {m.meeting_log?.auto_summary && ` · ${m.meeting_log.auto_summary.slice(0, 60)}...`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {brief.openTasks.length === 0 &&
       brief.relatedDecisions.length === 0 &&
       brief.carryForward.length === 0 && (
        <p className="text-gray-700 text-sm text-center py-2">
          No related context found — add tasks with matching team or person names
        </p>
      )}
    </div>
  )
}

function MeetingCard({ meeting, isExpanded, onToggle }) {
  const [brief, setBrief] = useState(null)
  const [loadingBrief, setLoadingBrief] = useState(false)

  async function handleToggle() {
    onToggle()
    if (!brief && !isExpanded) {
      setLoadingBrief(true)
      const b = await buildMeetingBrief(meeting)
      setBrief(b)
      setLoadingBrief(false)
    }
  }

  const start = parseISO(meeting.start_at)
  const end = parseISO(meeting.end_at)
  const duration = differenceInMinutes(end, start)
  const isNow = new Date() >= start && new Date() <= end

  return (
    <div className={`bg-gray-900 border rounded-xl px-4 py-3 transition-colors ${
      isNow ? 'border-teal-800' : 'border-gray-800'
    }`}>
      <button
        className="w-full text-left"
        onClick={handleToggle}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {isNow && (
                <span className="text-xs bg-teal-800 text-teal-300 px-2 py-0.5 rounded-full">
                  Now
                </span>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-gray-600 text-xs">
                    {format(start, 'h:mm a')} – {format(end, 'h:mm a')} · {duration}min
                    {meeting.attendees?.length > 1 && ` · ${meeting.attendees.filter(a => !a.self).length} others`}
                    </p>
                    {meeting.meeting_link && (
                   <a 
                    href={meeting.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-xs bg-teal-900/50 text-teal-400 border border-teal-800 px-2 py-0.5 rounded-full hover:bg-teal-900 transition-colors"
                    >
                    Join →
                    </a>
                )}
                </div>
          </div>
          <span className="text-gray-700 text-xs mt-1 flex-shrink-0">
            {isExpanded ? '▲' : '▼'}
          </span>
        </div>
        </div>
      </button>

      {isExpanded && (
        loadingBrief
          ? <div className="mt-3 text-gray-600 text-xs text-center py-4">Building brief...</div>
          : brief && <MeetingBrief meeting={meeting} brief={brief} />
      )}
    </div>
  )
}

export default function MeetingsTab({ session }) {
  const [connected, setConnected] = useState(false)
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    checkConnectionAndLoad()
  }, [])

  async function checkConnectionAndLoad() {
    // Try to save the token from the current session (if just logged in)
    await saveGoogleToken(session)

    const tokenData = await getGoogleToken()
    if (tokenData?.calendar_connected) {
      setConnected(true)
      await loadMeetings()
    }
    setLoading(false)
  }

  async function handleConnect() {
  setSyncing(true)
  await saveGoogleToken(session)
  await fetchCalendarEvents(7)
  setConnected(true)
  const mtgs = await loadMeetings()
  await requestPushPermission()
  if (mtgs) await schedulePreMeetingNotifications(mtgs)
  setSyncing(false)
}

  async function handleSync() {
    setSyncing(true)
    await fetchCalendarEvents(7)
    await loadMeetings()
    setSyncing(false)
  }

  async function loadMeetings() {
  const { data } = await supabase
    .from('meetings')
    .select('*')
    .gte('start_at', new Date().toISOString())
    .order('start_at', { ascending: true })
    .limit(30)
  setMeetings(data || [])
  return data || []
}

  // Group meetings by day
  function groupByDay(meetings) {
    const groups = {}
    for (const m of meetings) {
      const day = format(parseISO(m.start_at), 'yyyy-MM-dd')
      if (!groups[day]) groups[day] = []
      groups[day].push(m)
    }
    return groups
  }

  function dayLabel(dateStr) {
    const d = parseISO(dateStr)
    if (isToday(d)) return 'Today'
    if (isTomorrow(d)) return 'Tomorrow'
    return format(d, 'EEEE, d MMM')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-600 text-sm">Loading...</div>
  )

  if (!connected) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">◷</div>
        <h2 className="text-white font-semibold text-lg mb-2">Connect Google Calendar</h2>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
          Sync your calendar to see upcoming meetings and get contextual briefs with relevant tasks, decisions, and history.
        </p>
        <button
          onClick={handleConnect}
          disabled={syncing}
          className="bg-white text-gray-900 font-medium px-6 py-3 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          {syncing ? 'Connecting...' : 'Connect Google Calendar'}
        </button>
        <p className="text-gray-700 text-xs mt-4">
          You already gave calendar permission when you logged in
        </p>
      </div>
    )
  }

  const grouped = groupByDay(meetings)
  const days = Object.keys(grouped).sort()

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-white font-semibold">Meetings</h2>
        <div className="flex items-center gap-3">
            <button
                onClick={async () => {
                const ok = await requestPushPermission()
                alert(ok ? 'Notifications enabled!' : 'Notifications blocked — check browser settings')
                }}
                className="text-gray-600 hover:text-gray-400 text-xs transition-colors"
            >
                🔔 Notify
            </button>
            <button
                onClick={handleSync}
                disabled={syncing}
                className="text-gray-500 hover:text-gray-300 text-xs transition-colors disabled:opacity-50"
            >
                {syncing ? 'Syncing...' : '↻ Sync'}
            </button>
            </div>
      </div>

      {days.length === 0 ? (
        <div className="text-center py-16 text-gray-700">
          <p className="text-sm">No upcoming meetings in the next 7 days</p>
          <button onClick={handleSync} className="text-gray-600 hover:text-gray-400 text-xs mt-2">
            Sync calendar
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {days.map(day => (
            <div key={day}>
              <h3 className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-3">
                {dayLabel(day)}
              </h3>
              <div className="space-y-2">
                {grouped[day].map(meeting => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    isExpanded={expandedId === meeting.id}
                    onToggle={() => setExpandedId(expandedId === meeting.id ? null : meeting.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}