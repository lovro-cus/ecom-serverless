import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { user, supabase } = await requireAuth(req)
    const url = new URL(req.url)
    const id = url.searchParams.get('id')

    // GET: list user's orders or single order
    if (req.method === 'GET') {
      if (id) {
        const { data, error } = await supabase
          .from('orders')
          .select('*, order_items(*, products(name, price, image_url))')
          .eq('id', id)
          .eq('user_id', user.id)
          .single()
        if (error) throw error
        return Response.json(data, { headers: corsHeaders })
      }

      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*, products(name, price))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return Response.json(data, { headers: corsHeaders })
    }

    // POST: create new order from items array
    if (req.method === 'POST') {
      const { items } = await req.json() // [{ product_id, quantity }]
      if (!items || items.length === 0) throw new Error('Order must have at least one item')

      const productIds = items.map((i: { product_id: string }) => i.product_id)
      const { data: products, error: pErr } = await supabase
        .from('products')
        .select('id, price, stock, name')
        .in('id', productIds)
      if (pErr) throw pErr

      // Validate stock and compute total
      let total = 0
      for (const item of items) {
        const product = products.find((p: { id: string }) => p.id === item.product_id)
        if (!product) throw new Error(`Product ${item.product_id} not found`)
        if (product.stock < item.quantity) throw new Error(`Insufficient stock for "${product.name}"`)
        total += product.price * item.quantity
      }

      const { data: order, error: oErr } = await supabase
        .from('orders')
        .insert({ user_id: user.id, total, status: 'pending' })
        .select()
        .single()
      if (oErr) throw oErr

      const orderItems = items.map((item: { product_id: string; quantity: number }) => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: products.find((p: { id: string }) => p.id === item.product_id).price,
      }))

      const { error: iErr } = await supabase.from('order_items').insert(orderItems)
      if (iErr) throw iErr

      // Clear user's cart after successful order
      await supabase.from('cart_items').delete().eq('user_id', user.id)

      return Response.json(order, { headers: corsHeaders, status: 201 })
    }

    // PATCH: update order status
    if (req.method === 'PATCH' && id) {
      const { status } = await req.json()
      const { data, error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id)
        .eq('user_id', user.id)
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
