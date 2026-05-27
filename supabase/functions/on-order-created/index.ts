// DB CHANGE EVENT: triggered by PostgreSQL trigger when a new order is inserted
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient, requireServiceRole } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    requireServiceRole(req)

    const order = await req.json()
    const supabase = createAdminClient()

    // Fetch order items (safe — called async after transaction commits via pg_net)
    const { data: items, error: iErr } = await supabase
      .from('order_items')
      .select('product_id, quantity')
      .eq('order_id', order.id)
    if (iErr) throw iErr

    // Decrement stock for each ordered product
    for (const item of items ?? []) {
      const { error } = await supabase.rpc('decrement_stock', {
        p_product_id: item.product_id,
        p_quantity: item.quantity,
      })
      if (error) throw error
    }

    console.log(`[on-order-created] Order ${order.id}: stock decremented for ${items?.length} products`)
    return Response.json({ success: true, order_id: order.id }, { headers: corsHeaders })
  } catch (err) {
    console.error('[on-order-created] Error:', err.message)
    return Response.json({ error: err.message }, { status: 400, headers: corsHeaders })
  }
})
