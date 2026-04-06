import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { signOut } from '../lib/auth'

export default function ConfigScreen() {
  const [entities, setEntities] = useState([])
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('settings')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [{ data: entityData }, { data: configData }] = await Promise.all([
      supabase.from('entities').select('*').order('type').order('name'),
      supabase.from('config').select('*')
    ])
    setEntities(entityData || [])
    const cfg = {}
    ;(configData || []).forEach(r => { cfg[r.key] = r.value })
    setConfig(cfg)
    setLoading(false)
  }

  async function saveConfig(key, value) {
    await supabase.from('config').upsert({ key, value, updated_at: new Date().toISOString() })
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  async function deleteEntity(id) {
    if (!confirm('Delete this entity? Tasks linked to them will not be deleted.')) return
    await supabase.from('entities').delete().eq('id', id)
    setEntities(prev => prev.filter(e => e.id !== id))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-600 text-sm">Loading...</div>
  )

  const people = entities.filter(e => e.type === 'person')
  const teams = entities.filter(e => e.type === 'team')

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h2 className="text-white font-semibold mb-6">Config & settings</h2>

      <div className="flex gap-2 mb-6">
        {['settings', 'people', 'teams'].map(s => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors capitalize ${
              activeSection === s ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {activeSection === 'settings' && (
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-4 space-y-4">
            <div>
              <label className="text-gray-400 text-xs block mb-1">Pre-meeting brief trigger (minutes before)</label>
              <input
                type="number"
                className="bg-gray-800 text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none w-32"
                value={config.brief_trigger_minutes || '60'}
                onChange={e => saveConfig('brief_trigger_minutes', e.target.value)}
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Escalation threshold for "Waiting On" (days)</label>
              <input
                type="number"
                className="bg-gray-800 text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none w-32"
                value={config.escalation_days || '3'}
                onChange={e => saveConfig('escalation_days', e.target.value)}
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Daily digest email</label>
              <input
                type="email"
                className="bg-gray-800 text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none w-full"
                placeholder="you@bizzoppo.com"
                value={config.digest_email || ''}
                onChange={e => saveConfig('digest_email', e.target.value)}
              />
            </div>
          </div>
          <button
            onClick={signOut}
            className="text-gray-600 hover:text-red-400 text-sm transition-colors"
          >
            Sign out
          </button>
        </div>
      )}

      {activeSection === 'people' && (
        <div className="space-y-2">
          {people.length === 0 && <p className="text-gray-600 text-sm">No people in registry yet</p>}
          {people.map(e => (
            <div key={e.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-gray-200 text-sm">{e.name}</p>
                {e.email && <p className="text-gray-600 text-xs">{e.email}</p>}
                {e.aliases?.length > 0 && <p className="text-gray-700 text-xs">also: {e.aliases.join(', ')}</p>}
              </div>
              <button
                onClick={() => deleteEntity(e.id)}
                className="text-gray-700 hover:text-red-400 text-xs transition-colors"
              >
                remove
              </button>
            </div>
          ))}
        </div>
      )}

      {activeSection === 'teams' && (
        <div className="space-y-2">
          {teams.length === 0 && <p className="text-gray-600 text-sm">No teams in registry yet</p>}
          {teams.map(e => (
            <div key={e.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center justify-between">
              <p className="text-gray-200 text-sm">{e.name}</p>
              <button
                onClick={() => deleteEntity(e.id)}
                className="text-gray-700 hover:text-red-400 text-xs transition-colors"
              >
                remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}