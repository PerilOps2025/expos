import { addDays, addWeeks, addMonths, nextDay, startOfWeek, endOfWeek,
         startOfMonth, endOfMonth, startOfQuarter, endOfQuarter,
         startOfYear, endOfYear, parseISO, isValid, setDate, getMonth,
         getYear, addYears, nextMonday, nextTuesday, nextWednesday,
         nextThursday, nextFriday } from 'date-fns'

const PRIORITY_MAP = {
  high: 'high', h: 'high', '!': 'high', urgent: 'high', asap: 'high',
  med: 'medium', medium: 'medium', m: 'medium', normal: 'medium',
  low: 'low', l: 'low', later: 'low'
}

const MONTH_MAP = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11
}

const DAY_NEXT_FN = {
  mon: nextMonday, monday: nextMonday,
  tue: nextTuesday, tuesday: nextTuesday,
  wed: nextWednesday, wednesday: nextWednesday,
  thu: nextThursday, thursday: nextThursday,
  fri: nextFriday, friday: nextFriday,
}

export function parseDueDate(raw) {
  if (!raw) return { date: null, vague: null }
  const s = raw.trim().toLowerCase().replace(/\s+/g, ' ')

  // ── Relative: named shortcuts ──
  if (['today', 'tod'].includes(s)) return { date: new Date(), vague: null }
  if (['tmr', 'tomorrow', 'tom'].includes(s)) return { date: addDays(new Date(), 1), vague: null }
  if (['overmorrow', 'day after tomorrow', 'dat'].includes(s)) return { date: addDays(new Date(), 2), vague: null }

  // ── End of period ──
  if (['eod', 'end of day'].includes(s)) return { date: new Date(), vague: null }
  if (['eow', 'end of week', 'this week'].includes(s)) return { date: endOfWeek(new Date(), { weekStartsOn: 1 }), vague: null }
  if (['eom', 'end of month', 'this month', 'month end'].includes(s)) return { date: endOfMonth(new Date()), vague: null }
  if (['eoq', 'end of quarter', 'quarter end'].includes(s)) return { date: endOfQuarter(new Date()), vague: null }
  if (['eoy', 'end of year', 'year end'].includes(s)) return { date: endOfYear(new Date()), vague: null }

  // ── Start of period ──
  if (['sow', 'start of week', 'next week'].includes(s)) return { date: addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 7), vague: null }
  if (['som', 'start of month', 'next month'].includes(s)) return { date: startOfMonth(addMonths(new Date(), 1)), vague: null }
  if (['soq', 'start of quarter', 'next quarter', 'q start'].includes(s)) return { date: startOfQuarter(addMonths(new Date(), 3)), vague: null }

  // ── Quarter shortcuts: Q1 Q2 Q3 Q4 ──
  const qMatch = s.match(/^q([1-4])(\s+(\d{4}))?$/)
  if (qMatch) {
    const qNum = parseInt(qMatch[1])
    const year = qMatch[3] ? parseInt(qMatch[3]) : getYear(new Date())
    const qStartMonth = (qNum - 1) * 3
    return { date: endOfQuarter(new Date(year, qStartMonth, 1)), vague: null }
  }

  // ── N days/weeks/months from now ──
  const inMatch = s.match(/^in (\d+) (day|days|week|weeks|month|months)$/)
  if (inMatch) {
    const n = parseInt(inMatch[1])
    const unit = inMatch[2]
    if (unit.startsWith('day')) return { date: addDays(new Date(), n), vague: null }
    if (unit.startsWith('week')) return { date: addWeeks(new Date(), n), vague: null }
    if (unit.startsWith('month')) return { date: addMonths(new Date(), n), vague: null }
  }

  // ── Next <day>: next monday, next fri ──
  const nextDayMatch = s.match(/^next (mon|monday|tue|tuesday|wed|wednesday|thu|thursday|fri|friday)$/)
  if (nextDayMatch) {
    const fn = DAY_NEXT_FN[nextDayMatch[1]]
    if (fn) return { date: fn(new Date()), vague: null }
  }

  // ── Day name alone: thu, friday ──
  for (const [key, fn] of Object.entries(DAY_NEXT_FN)) {
    if (s === key) {
      const d = fn(new Date())
      return { date: d, vague: null }
    }
  }

  // ── Sat / Sun (not in nextXxx helpers) ──
  if (['sat', 'saturday'].includes(s)) {
    const today = new Date()
    const diff = (6 - today.getDay() + 7) % 7 || 7
    return { date: addDays(today, diff), vague: null }
  }
  if (['sun', 'sunday'].includes(s)) {
    const today = new Date()
    const diff = (0 - today.getDay() + 7) % 7 || 7
    return { date: addDays(today, diff), vague: null }
  }

  // ── "15 jan", "jan 15", "15jan" ──
  const dmMatch = s.match(/^(\d{1,2})\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s*(\d{4}))?$/)
  const mdMatch = s.match(/^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{1,2})(?:\s*(\d{4}))?$/)

  if (dmMatch) {
    const day = parseInt(dmMatch[1])
    const month = MONTH_MAP[dmMatch[2].slice(0, 3).toLowerCase()]
    const year = dmMatch[3] ? parseInt(dmMatch[3]) : getYear(new Date())
    const d = new Date(year, month, day)
    if (isValid(d)) return { date: d, vague: null }
  }
  if (mdMatch) {
    const month = MONTH_MAP[mdMatch[1].slice(0, 3).toLowerCase()]
    const day = parseInt(mdMatch[2])
    const year = mdMatch[3] ? parseInt(mdMatch[3]) : getYear(new Date())
    const d = new Date(year, month, day)
    if (isValid(d)) return { date: d, vague: null }
  }

  // ── DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY ──
  const slashMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/)
  if (slashMatch) {
    const day = parseInt(slashMatch[1])
    const month = parseInt(slashMatch[2]) - 1
    const year = slashMatch[3].length === 2 ? 2000 + parseInt(slashMatch[3]) : parseInt(slashMatch[3])
    const d = new Date(year, month, day)
    if (isValid(d)) return { date: d, vague: null }
  }

  // ── YYYY-MM-DD (ISO) ──
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const d = parseISO(s)
    if (isValid(d)) return { date: d, vague: null }
  }

  // ── Month name alone: "january", "jan" → last day of that month ──
  const monthOnly = MONTH_MAP[s]
  if (monthOnly !== undefined) {
    const now = new Date()
    let year = getYear(now)
    if (monthOnly < getMonth(now)) year++
    return { date: endOfMonth(new Date(year, monthOnly, 1)), vague: null }
  }

  // ── Vague / flag as needs review ──
  const vagueTerms = ['soon', 'later', 'someday', 'tbd', 'whenever', 'no rush',
                      'next sprint', 'this sprint', 'backlog', 'eventually']
  if (vagueTerms.includes(s)) return { date: null, vague: s }

  // ── Last fallback: try native Date parse ──
  try {
    const d = new Date(raw)
    if (isValid(d) && d.getFullYear() > 2020) return { date: d, vague: null }
  } catch {}

  // ── Couldn't parse — flag as vague ──
  return { date: null, vague: raw }
}

export function parseFlags(flagStr) {
  if (!flagStr) return {}
  const flags = {}
  const parts = flagStr.toLowerCase().split(/[\s,]+/)
  for (const part of parts) {
    if (['meeting', 'mtg', 'brief'].includes(part)) flags.meeting_context = true
    if (['wait', 'waiting', 'wf', 'waitingfor'].includes(part)) flags.status = 'waiting'
    if (['blocked', 'block'].includes(part)) flags.status = 'blocked'
    if (['deep', 'deepwork', 'focus'].includes(part)) flags.energy_tag = 'deep_work'
    if (['quick', 'qk', 'fast'].includes(part)) flags.energy_tag = 'quick_task'
    if (['followup', 'follow-up', 'fu'].includes(part)) flags.energy_tag = 'follow_up'
    if (['!', 'urgent', 'asap'].includes(part)) flags.priority = 'high'
    if (['low', 'l', 'later'].includes(part)) flags.priority = 'low'
    if (part.startsWith('blocked:')) flags.blocked_by_name = part.replace('blocked:', '')
    if (part.startsWith('recur:')) flags.recurrence = part.replace('recur:', '')
  }
  return flags
}

export function parseInput(rawText) {
  const lines = rawText.trim().split('\n').filter(l => l.trim())
  const results = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    let type = 'task'
    let content = trimmed

    if (trimmed.toLowerCase().startsWith('decision:')) {
      type = 'decision'; content = trimmed.slice(9).trim()
    } else if (trimmed.toLowerCase().startsWith('task:')) {
      type = 'task'; content = trimmed.slice(5).trim()
    } else if (trimmed.toLowerCase().startsWith('event:')) {
      type = 'event'; content = trimmed.slice(6).trim()
    } else if (trimmed.toLowerCase().startsWith('note:')) {
      type = 'note'; content = trimmed.slice(5).trim()
    }

    const slots = content.split('/').map(s => s.trim())
    const person    = (slots[0] && slots[0] !== '-') ? slots[0] : null
    const team      = (slots[1] && slots[1] !== '-') ? slots[1] : null
    const description = slots[2] || content
    const priorityRaw = slots[3]?.toLowerCase()
    const priority  = PRIORITY_MAP[priorityRaw] || 'medium'
    const dueRaw    = slots[4]
    const flagRaw   = slots[5]

    const { date: due_at, vague: due_vague } = parseDueDate(dueRaw)
    const flags = parseFlags(flagRaw)

    results.push({
      id: crypto.randomUUID(),
      type,
      description: slots.length >= 3 ? description : content,
      person_name: person,
      team_name: team,
      priority: flags.priority || priority,
      due_at: due_at ? due_at.toISOString() : null,
      due_vague,
      meeting_context: flags.meeting_context || false,
      status: flags.status || 'active',
      energy_tag: flags.energy_tag || null,
      blocked_by_name: flags.blocked_by_name || null,
      recurrence: flags.recurrence || null,
      confidence: slots.length >= 3 ? 'high' : 'low',
      raw: line
    })
  }
  return results
}