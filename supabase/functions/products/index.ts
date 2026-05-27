import { corsHeaders } from '../_shared/cors.ts'
import { createUserClient, requireAuth } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const url = new URL(req.url)
    const id = url.searchParams.get('id')

    // GET: public, no auth required
    if (req.method === 'GET') {
      const supabase = createUserClient(req)
      let query = supabase.from('products').select('*').order('created_at', { ascending: false })
      if (id) query = query.eq('id', id)
      const { data, error } = await query
      if (error) throw error
      return Response.json(data, { headers: corsHeaders })
    }

    // All other methods require auth
    const { supabase } = await requireAuth(req)

    if (req.method === 'POST') {
      const body = await req.json()
      const { data, error } = await supabase
        .from('products')
        .insert(body)
        .select()
        .single()
      if (error) throw error
      return Response.json(data, { headers: corsHeaders, status: 201 })
    }

    if (req.method === 'PUT' && id) {
      const body = await req.json()
      const { data, error } = await supabase
        .from('products')
        .update(body)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return Response.json(data, { headers: corsHeaders })
    }

    if (req.method === 'DELETE' && id) {
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) throw error
      return Response.json({ message: 'Product deleted' }, { headers: corsHeaders })
    }

    return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders })
  } catch (err) {
    const status = err.message === 'Unauthorized' || err.message === 'Missing authorization header' ? 401 : 400
    return Response.json({ error: err.message }, { status, headers: corsHeaders })
  }
})
