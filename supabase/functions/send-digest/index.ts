import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Use service role client for all DB operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Get digest data
    const { data: digestData, error: digestError } = await supabase
      .rpc('get_digest_data')

    if (digestError) throw new Error('Digest data error: ' + digestError.message)

    // Get user email from config
    const { data: configData } = await supabase
      .from('config')
      .select('value')
      .eq('key', 'digest_email')
      .single()

    const toEmail = configData?.value
    if (!toEmail) {
      return new Response(
        JSON.stringify({ message: 'No digest email configured — set it in Config settings' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Google token
    const { data: tokenData } = await supabase
      .from('user_tokens')
      .select('google_access_token')
      .single()

    if (!tokenData?.google_access_token) {
      return new Response(
        JSON.stringify({ message: 'No Google token found — try signing out and back in' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const d = digestData || {}
    const today = new Date().toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long'
    })

    const html = buildDigestHTML(d, today)

    // Send via Gmail API
    const emailContent = [
      `To: ${toEmail}`,
      `Subject: ExPOS Daily Digest — ${today}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=utf-8`,
      ``,
      html
    ].join('\n')

    const encoded = btoa(unescape(encodeURIComponent(emailContent)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    const gmailRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenData.google_access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: encoded }),
      }
    )

    if (!gmailRes.ok) {
      const err = await gmailRes.text()
      throw new Error(`Gmail API error: ${err}`)
    }

    return new Response(
      JSON.stringify({ success: true, sentTo: toEmail }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function buildDigestHTML(d: any, today: string): string {
  const taskRow = (t: any) => `
    <div style="background:#1a1a1a;border-radius:8px;padding:10px 14px;margin-bottom:6px">
      <p style="color:#e5e5e5;margin:0;font-size:14px">${t.description || ''}</p>
      <p style="color:#666;margin:4px 0 0;font-size:12px">
        ${t.person ? t.person + ' · ' : ''}${t.team ? t.team + ' · ' : ''}${t.due_at ? 'Due ' + new Date(t.due_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
      </p>
    </div>`

  const section = (title: string, color: string, items: any[], renderer: (i: any) => string) => {
    if (!items || items.length === 0) return ''
    return `
      <div style="margin-bottom:24px">
        <h2 style="color:${color};font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px">${title} — ${items.length}</h2>
        ${items.map(renderer).join('')}
      </div>`
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#0f0f0f;color:#e5e5e5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:24px">
  <div style="max-width:600px;margin:0 auto">
    <div style="margin-bottom:32px">
      <h1 style="color:#fff;font-size:28px;font-weight:700;margin:0">ExPOS</h1>
      <p style="color:#666;margin:4px 0 0;font-size:14px">${today}</p>
    </div>

    ${section('Overdue', '#f87171', d.overdue || [], (t) => `
      <div style="background:#1a1a1a;border-left:3px solid #ef4444;border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:6px">
        <p style="color:#fca5a5;margin:0;font-size:14px">${t.description || ''}</p>
        <p style="color:#666;margin:4px 0 0;font-size:12px">${t.person || ''} ${t.team ? '· ' + t.team : ''}</p>
      </div>`
    )}

    ${section('Due today', '#34d399', d.due_today || [], taskRow)}
    ${section('High priority', '#fbbf24', d.high_priority || [], taskRow)}

    ${d.waiting && d.waiting.length > 0 ? `
    <div style="margin-bottom:24px">
      <h2 style="color:#f59e0b;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px">Waiting on — ${d.waiting.length}</h2>
      ${d.waiting.map((t: any) => `
        <div style="background:#1a1a1a;border-radius:8px;padding:10px 14px;margin-bottom:6px">
          <p style="color:#e5e5e5;margin:0;font-size:14px">${t.description || ''}</p>
          <p style="color:#666;margin:4px 0 0;font-size:12px">${t.person || ''} · waiting ${t.days_waiting} day${t.days_waiting !== 1 ? 's' : ''}</p>
        </div>`).join('')}
    </div>` : ''}

    ${d.decisions_today && d.decisions_today.length > 0 ? `
    <div style="margin-bottom:24px">
      <h2 style="color:#a78bfa;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px">Decisions yesterday</h2>
      ${d.decisions_today.map((dec: any) => `
        <div style="background:#1a1a1a;border-radius:8px;padding:10px 14px;margin-bottom:6px">
          <p style="color:#e5e5e5;margin:0;font-size:14px">${dec.description || ''}</p>
          ${dec.team ? `<p style="color:#666;margin:4px 0 0;font-size:12px">${dec.team}</p>` : ''}
        </div>`).join('')}
    </div>` : ''}

    ${d.team_load && d.team_load.length > 0 ? `
    <div style="margin-bottom:24px">
      <h2 style="color:#60a5fa;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px">Team load</h2>
      ${d.team_load.map((t: any) => `
        <div style="background:#1a1a1a;border-radius:8px;padding:10px 14px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center">
          <span style="color:#e5e5e5;font-size:14px">${t.team || ''}</span>
          <span style="color:#666;font-size:13px">${t.total} tasks · ${t.high} high</span>
        </div>`).join('')}
    </div>` : ''}

    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #222">
      <a href="https://lsamxcqqmpbpfugwggyd.supabase.co" style="color:#2dd4bf;font-size:13px;text-decoration:none">Open ExPOS →</a>
    </div>
  </div>
</body>
</html>`
}