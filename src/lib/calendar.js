import { supabase } from './supabase'
import { getGoogleToken } from './auth'
import { addDays, startOfDay, endOfDay, parseISO } from 'date-fns'

export async function fetchCalendarEvents(days = 7) {
  const tokenData = await getGoogleToken()
  if (!tokenData?.google_access_token) return []

  const now = new Date()
  const end = addDays(now, days)

  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  })

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      {
        headers: {
          Authorization: `Bearer ${tokenData.google_access_token}`,
        },
      }
    )

    if (!res.ok) {
      console.error('Calendar API error:', res.status)
      return []
    }

    const data = await res.json()
    const events = data.items || []

    // Upsert events into our meetings table
    for (const event of events) {
      if (!event.start?.dateTime && !event.start?.date) continue
      const startAt = event.start.dateTime || event.start.date
      const endAt = event.end?.dateTime || event.end?.date

      const keywords = extractKeywords(event.summary || '')

      await supabase.from('meetings').upsert({
        gcal_event_id: event.id,
        title: event.summary || 'Untitled meeting',
        start_at: startAt,
        end_at: endAt,
        attendees: (event.attendees || []).map(a => ({
          email: a.email,
          name: a.displayName || a.email,
          self: a.self || false,
        })),
        keywords,
      }, { onConflict: 'gcal_event_id' })
    }

    return events
  } catch (err) {
    console.error('Calendar fetch error:', err)
    return []
  }
}

export function extractKeywords(title) {
  // Strip common filler words, keep meaningful tokens
  const stopWords = new Set(['with', 'and', 'the', 'for', 'call', 'meeting',
    'sync', 'catch', 'up', 'chat', 'review', 'weekly', 'daily', 'monthly',
    'standup', 'check', 'in', 'on', 'at', 'a', 'an', 'of', 'to', 'about'])

  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
}

export async function buildMeetingBrief(meeting) {
  const keywords = meeting.keywords || extractKeywords(meeting.title)
  const attendeeNames = (meeting.attendees || [])
    .filter(a => !a.self)
    .map(a => a.name?.split(' ')[0] || a.email?.split('@')[0])

  // All search terms: keywords + first names of attendees
  const searchTerms = [...new Set([...keywords, ...attendeeNames])]

  // Fetch all active tasks
  const { data: allTasks } = await supabase
    .from('tasks')
    .select('*, person:person_id(name), team:team_id(name)')
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  // Fetch recent decisions (last 60 days)
  const since = addDays(new Date(), -60).toISOString()
  const { data: allDecisions } = await supabase
    .from('decisions')
    .select('*, team:team_id(name)')
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  // Fetch past meetings with similar titles
  const { data: pastMeetings } = await supabase
    .from('meetings')
    .select('*')
    .lt('start_at', new Date().toISOString())
    .order('start_at', { ascending: false })
    .limit(50)

  // Score and filter tasks
  function scoreItem(item) {
    const text = [
      item.description,
      item.person?.name,
      item.team?.name,
    ].filter(Boolean).join(' ').toLowerCase()

    let score = 0
    for (const term of searchTerms) {
      if (text.includes(term.toLowerCase())) score++
    }
    if (item.meeting_context) score += 3
    return score
  }

  const openTasks = (allTasks || [])
    .filter(t => t.status !== 'done')
    .map(t => ({ ...t, _score: scoreItem(t) }))
    .filter(t => t._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 8)

  const meetingContextTasks = (allTasks || [])
    .filter(t => t.meeting_context && t.status !== 'done')
    .map(t => ({ ...t, _score: scoreItem(t) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 5)

  const relatedDecisions = (allDecisions || [])
    .map(d => ({
      ...d,
      _score: searchTerms.filter(term =>
        d.description.toLowerCase().includes(term.toLowerCase()) ||
        d.team?.name?.toLowerCase().includes(term.toLowerCase())
      ).length
    }))
    .filter(d => d._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 5)

  // Find past meetings with overlapping keywords
  const similarMeetings = (pastMeetings || [])
    .map(m => {
      const mKeywords = m.keywords || extractKeywords(m.title)
      const overlap = mKeywords.filter(k =>
        keywords.some(mk => mk.includes(k) || k.includes(mk))
      ).length
      return { ...m, _overlap: overlap }
    })
    .filter(m => m._overlap > 0 && m.id !== meeting.id)
    .sort((a, b) => b._overlap - a._overlap)
    .slice(0, 3)

  // Carry-forward: tasks created after the last similar meeting
  const lastSimilar = similarMeetings[0]
  const carryForward = lastSimilar
    ? (allTasks || []).filter(t =>
        t.meeting_context &&
        t.status !== 'done' &&
        new Date(t.created_at) > new Date(lastSimilar.start_at)
      ).slice(0, 5)
    : []

  return {
    openTasks,
    meetingContextTasks,
    relatedDecisions,
    similarMeetings,
    carryForward,
    attendees: meeting.attendees || [],
    searchTerms,
  }
}