import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function createUserClient(req: Request) {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
  )
}

export function createAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

export async function requireAuth(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) throw new Error('Missing authorization header')

  const supabase = createUserClient(req)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Unauthorized')

  return { user, supabase }
}

export function requireServiceRole(req: Request) {
  const authHeader = req.headers.get('Authorization')
  const expected = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
  if (authHeader !== expected) throw new Error('Unauthorized')
}
