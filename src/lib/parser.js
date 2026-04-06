import { addDays, nextDay, startOfWeek, endOfWeek, parseISO, isValid, format } from 'date-fns'

const PRIORITY_MAP = { high: 'high', h: 'high', '!': 'high', med: 'medium', medium: 'medium', m: 'medium', low: 'low', l: 'low' }

const DAY_MAP = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 }

const MONTH_MAP = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }

export function parseDueDate(raw) {
  if (!raw) return { date: null, vague: null }
  const s = raw.trim().toLowerCase()

  if (s === 'tmr' || s === 'tomorrow') {
    return { date: addDays(new Date(), 1), vague: null }
  }
  if (s === 'today') {
    return { date: new Date(), vague: null }
  }
  if (s === 'eow' || s === 'end of week') {
    return { date: endOfWeek(new Date(), { weekStartsOn: 1 }), vague: null }
  }
  if (s === 'eom' || s === 'end of month') {
    const d = new Date()
    return { date: new Date(d.getFullYear(), d.getMonth() + 1, 0), vague: null }
  }
  if (s === 'next week') {
    return { date: addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 7), vague: null }
  }
  if (s === 'soon' || s === 'asap') {
    return { date: null, vague: s }
  }

  // Day name: "thu", "friday"
  for (const [key, dayNum] of Object.entries(DAY_MAP)) {
    if (s === key || s === ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][dayNum]) {
      const today = new Date()
      const todayDay = today.getDay()
      let diff = dayNum - todayDay
      if (diff <= 0) diff += 7
      return { date: addDays(today, diff), vague: null }
    }
  }

  // Format: "15jan", "15 jan", "jan 15"
  const dateMatch = s.match(/^(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/) ||
                    s.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*(\d{1,2})$/)
  if (dateMatch) {
    const hasMonthFirst = isNaN(parseInt(dateMatch[1]))
    const day = parseInt(hasMonthFirst ? dateMatch[2] : dateMatch[1])
    const monthStr = hasMonthFirst ? dateMatch[1] : dateMatch[2]
    const month = MONTH_MAP[monthStr]
    const year = new Date().getFullYear()
    const d = new Date(year, month, day)
    if (isValid(d)) return { date: d, vague: null }
  }

  // ISO or standard date
  try {
    const d = new Date(raw)
    if (isValid(d)) return { date: d, vague: null }
  } catch {}

  return { date: null, vague: raw }
}

export function parseFlags(flagStr) {
  if (!flagStr) return {}
  const flags = {}
  const parts = flagStr.toLowerCase().split(/[\s,]+/)

  for (const part of parts) {
    if (part === 'meeting' || part === 'mtg') flags.meeting_context = true
    if (part === 'wait' || part === 'waiting') flags.status = 'waiting'
    if (part === 'deep' || part === 'deepwork') flags.energy_tag = 'deep_work'
    if (part === 'quick') flags.energy_tag = 'quick_task'
    if (part === 'followup' || part === 'follow-up') flags.energy_tag = 'follow_up'
    if (part.startsWith('blocked:')) flags.blocked_by_name = part.replace('blocked:', '')
    if (part === '!' || part === 'urgent') flags.priority = 'high'
  }
  return flags
}

export function parseInput(rawText) {
  const lines = rawText.trim().split('\n').filter(l => l.trim())
  const results = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Detect type prefix
    let type = 'task'
    let content = trimmed

    if (trimmed.toLowerCase().startsWith('decision:')) {
      type = 'decision'
      content = trimmed.slice(9).trim()
    } else if (trimmed.toLowerCase().startsWith('task:')) {
      type = 'task'
      content = trimmed.slice(5).trim()
    } else if (trimmed.toLowerCase().startsWith('event:')) {
      type = 'event'
      content = trimmed.slice(6).trim()
    }

    const slots = content.split('/').map(s => s.trim())

    const person = (slots[0] && slots[0] !== '-') ? slots[0] : null
    const team = (slots[1] && slots[1] !== '-') ? slots[1] : null
    const description = slots[2] || content
    const priorityRaw = slots[3]?.toLowerCase()
    const priority = PRIORITY_MAP[priorityRaw] || 'medium'
    const dueRaw = slots[4]
    const flagRaw = slots[5]

    const { date: due_at, vague: due_vague } = parseDueDate(dueRaw)
    const flags = parseFlags(flagRaw)

    results.push({
      id: crypto.randomUUID(),
      type,
      description: type === 'task' && slots.length > 2 ? description : content,
      person_name: person,
      team_name: team,
      priority: flags.priority || priority,
      due_at: due_at ? due_at.toISOString() : null,
      due_vague,
      meeting_context: flags.meeting_context || false,
      status: flags.status || 'active',
      energy_tag: flags.energy_tag || null,
      blocked_by_name: flags.blocked_by_name || null,
      confidence: slots.length >= 3 ? 'high' : 'low',
      raw: line
    })
  }

  return results
}