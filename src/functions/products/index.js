const { v4: uuidv4 } = require('uuid')
const db = require('../../db')
const { ok, err, requireAuth } = require('../../auth')
const { handler: onLowStock } = require('../events/onLowStock')

module.exports.handler = async (event) => {
  try {
    const qs = event.queryStringParameters || {}
    const id = qs.id

    if (event.httpMethod === 'GET') {
      const rows = id
        ? [db.prepare('SELECT * FROM products WHERE id = ?').get(id)]
        : db.prepare('SELECT * FROM products ORDER BY created_at DESC').all()
      return ok(rows.filter(Boolean))
    }

    const user = requireAuth(event)
    const body = JSON.parse(event.body || '{}')

    if (event.httpMethod === 'POST') {
      const { name, description, price, stock = 0 } = body
      if (!name || price == null) return err('Ime in cena sta obvezna')
      const newId = uuidv4()
      db.prepare('INSERT INTO products (id, name, description, price, stock) VALUES (?, ?, ?, ?, ?)').run(newId, name, description || null, price, stock)
      return ok(db.prepare('SELECT * FROM products WHERE id = ?').get(newId), 201)
    }

    if (event.httpMethod === 'PUT' && id) {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id)
      if (!product) return err('Produkt ne obstaja', 404)

      const fields = Object.keys(body).map(k => `${k} = ?`).join(', ')
      db.prepare(`UPDATE products SET ${fields} WHERE id = ?`).run(...Object.values(body), id)
      const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id)

      // MONITORING EVENT: sproži če zaloga pade pod 5
      if (updated.stock < 5 && product.stock >= 5) {
        await onLowStock({ body: JSON.stringify(updated) })
      }

      return ok(updated)
    }

    if (event.httpMethod === 'DELETE' && id) {
      db.prepare('DELETE FROM products WHERE id = ?').run(id)
      return ok({ message: 'Produkt izbrisan' })
    }

    return err('Not found', 404)
  } catch (e) {
    return err(e.message, e.status || 400)
  }
}
