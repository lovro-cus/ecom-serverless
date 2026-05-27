// LOG/MONITORING EVENT: triggered when product stock drops below threshold
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient, requireServiceRole } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    requireServiceRole(req)

    const payload = await req.json()
    const { id, name, stock } = payload

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('stock_alerts')
      .insert({
        product_id: id,
        product_name: name,
        stock_level: stock,
        message: `Nizka zaloga: produkt "${name}" ima samo ${stock} kosov`,
      })
      .select()
      .single()
    if (error) throw error

    console.log(`[on-low-stock] Alert: ${name} ima samo ${stock} kosov`)
    return Response.json(data, { headers: corsHeaders })
  } catch (err) {
    console.error('[on-low-stock] Error:', err.message)
    return Response.json({ error: err.message }, { status: 400, headers: corsHeaders })
  }
})
