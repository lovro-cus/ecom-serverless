const { v4: uuidv4 } = require('uuid')
const db = require('../../db')
const { ok, err, requireAuth } = require('../../auth')

module.exports.handler = async (event) => {
  try {
    const user = requireAuth(event)
    const qs = event.queryStringParameters || {}
    const id = qs.id

    if (event.httpMethod === 'GET') {
      const items = db.prepare(`
        SELECT ci.*, p.name, p.price, p.stock, p.image_url
        FROM cart_items ci JOIN products p ON p.id = ci.product_id
        WHERE ci.user_id = ?
      `).all(user.id)
      return ok(items)
    }

    if (event.httpMethod === 'POST') {
      const { product_id, quantity = 1 } = JSON.parse(event.body || '{}')
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id)
      if (!product) return err('Produkt ne obstaja', 404)
      if (product.stock < quantity) return err('Premalo zaloge')

      const existing = db.prepare('SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?').get(user.id, product_id)
      if (existing) {
        db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(quantity, existing.id)
        return ok(db.prepare('SELECT * FROM cart_items WHERE id = ?').get(existing.id))
      }

      const newId = uuidv4()
      db.prepare('INSERT INTO cart_items (id, user_id, product_id, quantity) VALUES (?, ?, ?, ?)').run(newId, user.id, product_id, quantity)
      return ok(db.prepare('SELECT * FROM cart_items WHERE id = ?').get(newId), 201)
    }

    if (event.httpMethod === 'PATCH' && id) {
      const { quantity } = JSON.parse(event.body || '{}')
      if (quantity < 1) return err('Količina mora biti vsaj 1')
      db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?').run(quantity, id, user.id)
      return ok(db.prepare('SELECT * FROM cart_items WHERE id = ?').get(id))
    }

    if (event.httpMethod === 'DELETE' && id) {
      db.prepare('DELETE FROM cart_items WHERE id = ? AND user_id = ?').run(id, user.id)
      return ok({ message: 'Artikel odstranjen iz košarice' })
    }

    return err('Not found', 404)
  } catch (e) {
    return err(e.message, e.status || 400)
  }
}
