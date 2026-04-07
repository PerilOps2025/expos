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
    token_expires_at: session.expires_at
      ? new Date(session.expires_at * 1000).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString(),
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

export async function getValidGoogleToken() {
  const tokenData = await getGoogleToken()
  if (!tokenData) return null

  // Check if token expires within 5 minutes
  const expiresAt = tokenData.token_expires_at
    ? new Date(tokenData.token_expires_at)
    : null

  const needsRefresh = expiresAt
    ? expiresAt.getTime() - Date.now() < 5 * 60 * 1000
    : false

  if (!needsRefresh) return tokenData.google_access_token

  // Try to refresh via Supabase session refresh
  const { data: { session }, error } = await supabase.auth.refreshSession()
  if (error || !session?.provider_token) {
    console.warn('Token refresh failed — user may need to re-login')
    return tokenData.google_access_token // Return old token as fallback
  }

  // Save refreshed token
  await saveGoogleToken(session)
  return session.provider_token
}