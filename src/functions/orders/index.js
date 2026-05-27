const { v4: uuidv4 } = require('uuid')
const db = require('../../db')
const { ok, err, requireAuth } = require('../../auth')
const { handler: onOrderCreated } = require('../events/onOrderCreated')

module.exports.handler = async (event) => {
  try {
    const user = requireAuth(event)
    const qs = event.queryStringParameters || {}
    const id = qs.id

    if (event.httpMethod === 'GET') {
      if (id) {
        const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(id, user.id)
        if (!order) return err('Naročilo ne obstaja', 404)
        const items = db.prepare(`
          SELECT oi.*, p.name, p.image_url FROM order_items oi
          JOIN products p ON p.id = oi.product_id
          WHERE oi.order_id = ?
        `).all(id)
        return ok({ ...order, items })
      }
      const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(user.id)
      return ok(orders)
    }

    if (event.httpMethod === 'POST') {
      const { items } = JSON.parse(event.body || '{}')
      if (!items || items.length === 0) return err('Naročilo mora imeti vsaj en artikel')

      const productIds = items.map(i => i.product_id)
      const products = db.prepare(`SELECT * FROM products WHERE id IN (${productIds.map(() => '?').join(',')})`).all(...productIds)

      let total = 0
      for (const item of items) {
        const product = products.find(p => p.id === item.product_id)
        if (!product) return err(`Produkt ${item.product_id} ne obstaja`, 404)
        if (product.stock < item.quantity) return err(`Premalo zaloge za "${product.name}"`)
        total += product.price * item.quantity
      }

      const orderId = uuidv4()
      db.prepare('INSERT INTO orders (id, user_id, total, status) VALUES (?, ?, ?, ?)').run(orderId, user.id, total, 'pending')

      for (const item of items) {
        const product = products.find(p => p.id === item.product_id)
        db.prepare('INSERT INTO order_items (id, order_id, product_id, quantity, price) VALUES (?, ?, ?, ?, ?)').run(uuidv4(), orderId, item.product_id, item.quantity, product.price)
        db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(item.quantity, item.product_id)
      }

      db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(user.id)

      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)

      // DB CHANGE EVENT: sproži ob novem naročilu
      await onOrderCreated({ body: JSON.stringify(order) })

      return ok(order, 201)
    }

    if (event.httpMethod === 'PATCH' && id) {
      const { status } = JSON.parse(event.body || '{}')
      db.prepare('UPDATE orders SET status = ? WHERE id = ? AND user_id = ?').run(status, id, user.id)
      return ok(db.prepare('SELECT * FROM orders WHERE id = ?').get(id))
    }

    return err('Not found', 404)
  } catch (e) {
    return err(e.message, e.status || 400)
  }
}
