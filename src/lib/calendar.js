import { supabase } from './supabase'
import { getValidGoogleToken } from './auth'
import { addDays, startOfDay, endOfDay, parseISO } from 'date-fns'

export async function fetchCalendarEvents(days = 7) {
  const accessToken = await getValidGoogleToken()
if (!accessToken) return []

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
          Authorization: `Bearer ${accessToken}`,
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

      // Extract meeting link from conference data or location
        const meetingLink =
        event.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri ||
        event.hangoutLink ||
        (event.location?.startsWith('http') ? event.location : null) ||
        null

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
        meeting_link: meetingLink,
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

  // Extract attendee first names AND email prefixes for matching
  const attendeeNames = (meeting.attendees || [])
    .filter(a => !a.self)
    .flatMap(a => {
      const parts = []
      if (a.name) {
        parts.push(a.name.split(' ')[0].toLowerCase()) // first name
        parts.push(a.name.toLowerCase()) // full name
      }
      if (a.email) {
        parts.push(a.email.split('@')[0].toLowerCase()) // email prefix
      }
      return parts
    })

  const attendeeEmails = (meeting.attendees || [])
    .filter(a => !a.self)
    .map(a => a.email?.toLowerCase())
    .filter(Boolean)

  const searchTerms = [...new Set([...keywords, ...attendeeNames])]

  // Fetch all entities to match attendees to known people
  const { data: allEntities } = await supabase
    .from('entities')
    .select('*')
    .eq('type', 'person')

  // Match attendees to entity IDs
  const attendeeEntityIds = (allEntities || [])
    .filter(e => {
      const eName = e.name.toLowerCase()
      const eEmail = e.email?.toLowerCase()
      return attendeeNames.some(an => eName.includes(an) || an.includes(eName.split(' ')[0])) ||
             (eEmail && attendeeEmails.includes(eEmail))
    })
    .map(e => e.id)

  // Fetch all active tasks
  const { data: allTasks } = await supabase
    .from('tasks')
    .select('*, person:person_id(id,name,email), team:team_id(id,name)')
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  // Fetch recent decisions (last 90 days)
  const since = addDays(new Date(), -90).toISOString()
  const { data: allDecisions } = await supabase
    .from('decisions')
    .select('*, team:team_id(name)')
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  // Fetch past meetings
  const { data: pastMeetings } = await supabase
    .from('meetings')
    .select('*')
    .lt('start_at', new Date().toISOString())
    .order('start_at', { ascending: false })
    .limit(50)

  // Score tasks — keyword match OR attendee match
  function scoreTask(task) {
    const text = [
      task.description,
      task.person?.name,
      task.team?.name,
    ].filter(Boolean).join(' ').toLowerCase()

    let score = 0

    // Keyword match
    for (const term of searchTerms) {
      if (text.includes(term.toLowerCase())) score += 2
    }

    // Direct attendee match — highest signal
    if (task.person_id && attendeeEntityIds.includes(task.person_id)) {
      score += 5
    }

    // Meeting context flag — always surface
    if (task.meeting_context) score += 3

    return score
  }

  const openTasks = (allTasks || [])
    .filter(t => t.status !== 'done')
    .map(t => ({ ...t, _score: scoreTask(t) }))
    .filter(t => t._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 10)

  const meetingContextTasks = (allTasks || [])
    .filter(t => t.meeting_context && t.status !== 'done')
    .map(t => ({ ...t, _score: scoreTask(t) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 5)

  const relatedDecisions = (allDecisions || [])
    .map(d => {
      const text = [d.description, d.team?.name].filter(Boolean).join(' ').toLowerCase()
      const score = searchTerms.filter(term => text.includes(term.toLowerCase())).length
      return { ...d, _score: score }
    })
    .filter(d => d._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 6)

  // Similar past meetings by keyword overlap
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

  // Carry-forward: meeting_context tasks since last similar meeting
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
    matchedAttendees: (allEntities || []).filter(e => attendeeEntityIds.includes(e.id)),
    searchTerms,
  }
}