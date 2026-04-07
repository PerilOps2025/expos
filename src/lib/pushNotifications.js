const PUBLIC_VAPID_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'

export async function requestPushPermission() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  const registration = await navigator.serviceWorker.ready

  const existing = await registration.pushManager.getSubscription()
  if (existing) {
    await savePushSubscription(existing)
    return true
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
  })

  await savePushSubscription(subscription)
  return true
}

async function savePushSubscription(subscription) {
  const { supabase } = await import('./supabase')
  await supabase.from('config').upsert({
    key: 'push_subscription',
    value: JSON.stringify(subscription),
    updated_at: new Date().toISOString()
  })
}

export async function schedulePreMeetingNotifications(meetings) {
  if (!('Notification' in window)) return

  for (const meeting of meetings) {
    const startTime = new Date(meeting.start_at).getTime()
    const notifyTime = startTime - 60 * 60 * 1000 // 60 min before
    const now = Date.now()
    const delay = notifyTime - now

    if (delay < 0 || delay > 24 * 60 * 60 * 1000) continue // Skip past or >24h away

    setTimeout(() => {
      if (Notification.permission === 'granted') {
        new Notification(`Meeting in 60 min: ${meeting.title}`, {
          body: 'Tap to open your pre-meeting brief',
          icon: '/expos/icons/icon.svg',
          badge: '/expos/icons/icon.svg',
          tag: `meeting-brief-${meeting.id}`,
          data: { meetingId: meeting.id }
        })
      }
    }, delay)
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)))
}