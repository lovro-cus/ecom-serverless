// STORAGE EVENT: triggered by PostgreSQL trigger on storage.objects when a file is uploaded
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient, requireServiceRole } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    requireServiceRole(req)

    const payload = await req.json()
    const { bucket_id, name } = payload

    if (bucket_id !== 'product-images') {
      return Response.json({ skipped: true, reason: 'Not product-images bucket' }, { headers: corsHeaders })
    }

    // File name convention: {product_id}.{ext}
    const productId = name.split('.')[0]
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const imageUrl = `${supabaseUrl}/storage/v1/object/public/${bucket_id}/${name}`

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('products')
      .update({ image_url: imageUrl })
      .eq('id', productId)
    if (error) throw error

    console.log(`[on-file-upload] Updated image for product ${productId}: ${imageUrl}`)
    return Response.json({ success: true, product_id: productId, image_url: imageUrl }, { headers: corsHeaders })
  } catch (err) {
    console.error('[on-file-upload] Error:', err.message)
    return Response.json({ error: err.message }, { status: 400, headers: corsHeaders })
  }
})
