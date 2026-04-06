import { supabase } from './supabase'

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/gmail.send',
      redirectTo: window.location.origin + '/expos/'
    }
  })
  if (error) console.error('Login error:', error)
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) console.error('Sign out error:', error)
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}