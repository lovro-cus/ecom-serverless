import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { user, supabase } = await requireAuth(req)

    // GET: return user profile
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      // PGRST116 = row not found — return empty profile
      if (error && error.code !== 'PGRST116') throw error
      return Response.json(data ?? { id: user.id, email: user.email }, { headers: corsHeaders })
    }

    // PUT: create or update profile
    if (req.method === 'PUT') {
      const body = await req.json()
      const { full_name, phone, address } = body

      const { data, error } = await supabase
        .from('user_profiles')
        .upsert({ id: user.id, full_name, phone, address })
        .select()
        .single()
      if (error) throw error
      return Response.json(data, { headers: corsHeaders })
    }

    return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders })
  } catch (err) {
    const status = err.message === 'Unauthorized' || err.message === 'Missing authorization header' ? 401 : 400
    return Response.json({ error: err.message }, { status, headers: corsHeaders })
  }
})
