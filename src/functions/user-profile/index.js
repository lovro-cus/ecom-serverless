const db = require('../../db')
const { ok, err, requireAuth } = require('../../auth')

module.exports.handler = async (event) => {
  try {
    const user = requireAuth(event)

    if (event.httpMethod === 'GET') {
      const profile = db.prepare('SELECT * FROM user_profiles WHERE id = ?').get(user.id)
      return ok(profile || { id: user.id, email: user.email })
    }

    if (event.httpMethod === 'PUT') {
      const { full_name, phone, address } = JSON.parse(event.body || '{}')
      const existing = db.prepare('SELECT id FROM user_profiles WHERE id = ?').get(user.id)

      if (existing) {
        db.prepare('UPDATE user_profiles SET full_name = ?, phone = ?, address = ? WHERE id = ?').run(full_name, phone, address, user.id)
      } else {
        db.prepare('INSERT INTO user_profiles (id, full_name, phone, address) VALUES (?, ?, ?, ?)').run(user.id, full_name, phone, address)
      }

      return ok(db.prepare('SELECT * FROM user_profiles WHERE id = ?').get(user.id))
    }

    return err('Not found', 404)
  } catch (e) {
    return err(e.message, e.status || 400)
  }
}
