// CRON EVENT: triggered daily at 08:00 UTC by pg_cron
// Can also be triggered manually via POST request with service role key
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {

    const supabase = createAdminClient()

    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const reportDate = yesterday.toISOString().split('T')[0]
    const startOf = `${reportDate}T00:00:00+00:00`
    const endOf = `${today.toISOString().split('T')[0]}T00:00:00+00:00`

    const { data: orders, error: oErr } = await supabase
      .from('orders')
      .select('total, status')
      .gte('created_at', startOf)
      .lt('created_at', endOf)
    if (oErr) throw oErr

    const totalOrders = orders?.length ?? 0
    const totalRevenue = orders?.reduce((sum: number, o: { total: number }) => sum + Number(o.total), 0) ?? 0
    const completedOrders = orders?.filter((o: { status: string }) => o.status === 'completed').length ?? 0

    const { data: report, error: rErr } = await supabase
      .from('daily_reports')
      .upsert({
        report_date: reportDate,
        total_orders: totalOrders,
        total_revenue: totalRevenue,
        completed_orders: completedOrders,
      })
      .select()
      .single()
    if (rErr) throw rErr

    console.log(`[daily-report] ${reportDate}: ${totalOrders} orders, revenue ${totalRevenue}`)
    return Response.json(report, { headers: corsHeaders })
  } catch (err) {
    console.error('[daily-report] Error:', err.message)
    return Response.json({ error: err.message }, { status: 400, headers: corsHeaders })
  }
})
