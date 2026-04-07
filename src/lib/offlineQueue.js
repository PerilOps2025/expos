const QUEUE_KEY = 'expos_offline_queue'
const DRAFT_KEY = 'expos_draft'

export function saveDraft(text) {
  localStorage.setItem(DRAFT_KEY, text)
}

export function loadDraft() {
  return localStorage.getItem(DRAFT_KEY) || ''
}

export function clearDraft() {
  localStorage.removeItem(DRAFT_KEY)
}

export function queueCapture(rawText, parsedItems) {
  const queue = loadQueue()
  queue.push({
    id: crypto.randomUUID(),
    rawText,
    parsedItems,
    timestamp: new Date().toISOString(),
  })
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export function loadQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  } catch {
    return []
  }
}

export function removeFromQueue(id) {
  const queue = loadQueue().filter(item => item.id !== id)
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY)
}

export function isOnline() {
  return navigator.onLine
}