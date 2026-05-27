import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { user, supabase } = await requireAuth(req)
    const url = new URL(req.url)
    const id = url.searchParams.get('id') // cart_item id

    // GET: return user's cart with product details
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('cart_items')
        .select('*, products(id, name, price, stock, image_url)')
        .eq('user_id', user.id)
      if (error) throw error
      return Response.json(data, { headers: corsHeaders })
    }

    // POST: add item to cart (upsert — increments qty if exists)
    if (req.method === 'POST') {
      const { product_id, quantity = 1 } = await req.json()

      // Check stock
      const { data: product, error: pErr } = await supabase
        .from('products')
        .select('stock')
        .eq('id', product_id)
        .single()
      if (pErr || !product) throw new Error('Product not found')
      if (product.stock < quantity) throw new Error('Insufficient stock')

      const { data, error } = await supabase
        .from('cart_items')
        .upsert(
          { user_id: user.id, product_id, quantity },
          { onConflict: 'user_id,product_id' }
        )
        .select('*, products(name, price)')
        .single()
      if (error) throw error
      return Response.json(data, { headers: corsHeaders, status: 201 })
    }

    // PATCH: update quantity of a cart item
    if (req.method === 'PATCH' && id) {
      const { quantity } = await req.json()
      if (quantity < 1) throw new Error('Quantity must be at least 1')
      const { data, error } = await supabase
        .from('cart_items')
        .update({ quantity })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()
      if (error) throw error
      return Response.json(data, { headers: corsHeaders })
    }

    // DELETE: remove item from cart
    if (req.method === 'DELETE' && id) {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
      if (error) throw error
      return Response.json({ message: 'Item removed from cart' }, { headers: corsHeaders })
    }

    return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders })
  } catch (err) {
    const status = err.message === 'Unauthorized' || err.message === 'Missing authorization header' ? 401 : 400
    return Response.json({ error: err.message }, { status, headers: corsHeaders })
  }
})
