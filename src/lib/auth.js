import { supabase } from './supabase'

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/gmail.send'
      ].join(' '),
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
      redirectTo: window.location.origin + '/expos/'
    }
  })
  if (error) console.error('Login error:', error)
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function saveGoogleToken(session) {
  if (!session?.provider_token) return
  await supabase.from('user_tokens').upsert({
    user_id: session.user.id,
    google_access_token: session.provider_token,
    google_refresh_token: session.provider_refresh_token,
    calendar_connected: true,
    updated_at: new Date().toISOString(),
  })
}

export async function getGoogleToken() {
  const { data } = await supabase
    .from('user_tokens')
    .select('*')
    .single()
  return data
}