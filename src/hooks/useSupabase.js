import { supabase } from '../lib/supabaseClient'
import { useAuth } from './useAuth'

export function useSupabase() {
  const { user } = useAuth()

  async function logActivity(actionType, description) {
    if (!user) return
    await supabase.from('activity_log').insert({
      user_id: user.id,
      action_type: actionType,
      description,
    })
  }

  return { supabase, logActivity }
}
