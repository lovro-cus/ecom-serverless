// USER EVENT: triggered by PostgreSQL trigger on auth.users when a new user registers
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient, requireServiceRole } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    requireServiceRole(req)

    const payload = await req.json()
    // Trigger passes NEW row from auth.users
    const user = payload.record ?? payload

    if (!user?.id) throw new Error('Invalid payload: missing user id')

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('user_profiles')
      .insert({
        id: user.id,
        full_name: user.raw_user_meta_data?.full_name ?? null,
      })

    // Ignore duplicate (profile may already exist from direct SQL trigger)
    if (error && error.code !== '23505') throw error

    console.log(`[on-user-registered] Profile created for user ${user.id}`)
    return Response.json({ success: true, user_id: user.id }, { headers: corsHeaders })
  } catch (err) {
    console.error('[on-user-registered] Error:', err.message)
    return Response.json({ error: err.message }, { status: 400, headers: corsHeaders })
  }
})
