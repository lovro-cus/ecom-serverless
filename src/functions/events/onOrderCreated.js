// DB CHANGE EVENT: sproži se ko je ustvarjeno novo naročilo
const { v4: uuidv4 } = require('uuid')
const db = require('../../db')
const { ok, err } = require('../../auth')

module.exports.handler = async (event) => {
  try {
    const order = JSON.parse(event.body || '{}')

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id)

    for (const item of items) {
      const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(item.product_id)
      if (product && product.stock < 0) {
        db.prepare('UPDATE products SET stock = 0 WHERE id = ?').run(item.product_id)
      }
    }

    console.log(`[EVENT: DB sprememba] Novo naročilo ${order.id} — obdelano ${items.length} artiklov`)
    return ok({ success: true, order_id: order.id, items_processed: items.length })
  } catch (e) {
    return err(e.message)
  }
}
