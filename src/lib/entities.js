import { supabase } from './supabase'

function normalize(name) {
  return name.toLowerCase().trim().replace(/\s*team\s*$/i, '').trim()
}

function isSimilar(a, b) {
  const na = normalize(a)
  const nb = normalize(b)
  if (na === nb) return true
  // Check aliases
  return false
}

export async function resolveEntities(parsedItems) {
  const { data: entities } = await supabase.from('entities').select('*')
  if (!entities) return parsedItems

  return parsedItems.map(item => {
    const resolved = { ...item }

    if (item.person_name) {
      const match = entities.find(e =>
        e.type === 'person' && (
          normalize(e.name) === normalize(item.person_name) ||
          (e.aliases || []).some(a => normalize(a) === normalize(item.person_name))
        )
      )
      resolved.person_id = match?.id || null
      resolved.person_is_new = !match
    }

    if (item.team_name) {
      const match = entities.find(e =>
        e.type === 'team' && (
          normalize(e.name) === normalize(item.team_name) ||
          (e.aliases || []).some(a => normalize(a) === normalize(item.team_name))
        )
      )
      resolved.team_id = match?.id || null
      resolved.team_is_new = !match
    }

    return resolved
  })
}

export async function createEntity(type, name, extra = {}) {
  // Check for duplicate before inserting
  const { data: existing } = await supabase
    .from('entities')
    .select('*')
    .eq('type', type)

  const duplicate = (existing || []).find(e =>
    normalize(e.name) === normalize(name) ||
    (e.aliases || []).some(a => normalize(a) === normalize(name))
  )

  if (duplicate) return duplicate // Return existing instead of creating

  const finalName = type === 'team' && !name.toLowerCase().endsWith('team')
    ? name + ' team'
    : name

  const { data, error } = await supabase
    .from('entities')
    .insert({ type, name: finalName, ...extra })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getAllEntities() {
  const { data } = await supabase.from('entities').select('*').order('name')
  return data || []
}