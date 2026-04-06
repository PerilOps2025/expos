import { supabase } from './supabase'

export async function resolveEntities(parsedItems) {
  const { data: entities } = await supabase.from('entities').select('*')
  if (!entities) return parsedItems

  return parsedItems.map(item => {
    const resolved = { ...item }

    if (item.person_name) {
      const match = entities.find(e =>
        e.type === 'person' &&
        (e.name.toLowerCase() === item.person_name.toLowerCase() ||
         (e.aliases || []).some(a => a.toLowerCase() === item.person_name.toLowerCase()))
      )
      resolved.person_id = match?.id || null
      resolved.person_is_new = !match
    }

    if (item.team_name) {
      const teamName = item.team_name.toLowerCase().replace(/\s*team\s*$/, '').trim()
      const match = entities.find(e =>
        e.type === 'team' &&
        (e.name.toLowerCase().replace(/\s*team\s*$/, '').trim() === teamName ||
         (e.aliases || []).some(a => a.toLowerCase().replace(/\s*team\s*$/, '').trim() === teamName))
      )
      resolved.team_id = match?.id || null
      resolved.team_is_new = !match
    }

    return resolved
  })
}

export async function createEntity(type, name, extra = {}) {
  const { data, error } = await supabase
    .from('entities')
    .insert({ type, name, ...extra })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getAllEntities() {
  const { data } = await supabase.from('entities').select('*').order('name')
  return data || []
}