// CRON EVENT: sproži se vsak dan ob 8:00 (ali ročno)
const { v4: uuidv4 } = require('uuid')
const db = require('../../db')
const { ok, err } = require('../../auth')

module.exports.handler = async (event) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    const orders = db.prepare(`
      SELECT * FROM orders
      WHERE created_at >= ? AND created_at < ?
    `).all(`${yesterday} 00:00:00`, `${today} 00:00:00`)

    const totalOrders = orders.length
    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0)
    const completedOrders = orders.filter(o => o.status === 'completed').length

    const existing = db.prepare('SELECT id FROM daily_reports WHERE report_date = ?').get(yesterday)
    const reportId = existing?.id || uuidv4()

    if (existing) {
      db.prepare('UPDATE daily_reports SET total_orders = ?, total_revenue = ?, completed_orders = ? WHERE id = ?').run(totalOrders, totalRevenue, completedOrders, reportId)
    } else {
      db.prepare('INSERT INTO daily_reports (id, report_date, total_orders, total_revenue, completed_orders) VALUES (?, ?, ?, ?, ?)').run(reportId, yesterday, totalOrders, totalRevenue, completedOrders)
    }

    const report = db.prepare('SELECT * FROM daily_reports WHERE id = ?').get(reportId)
    console.log(`[EVENT: Cron] Porocilo za ${yesterday}: ${totalOrders} narocil, ${totalRevenue} prihodek`)
    return ok(report)
  } catch (e) {
    return err(e.message)
  }
}
