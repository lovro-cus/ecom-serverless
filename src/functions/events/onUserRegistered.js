// USER EVENT: sproži se ob registraciji novega uporabnika
const db = require('../../db')
const { ok, err } = require('../../auth')

module.exports.handler = async (event) => {
  try {
    const user = JSON.parse(event.body || '{}')

    const existing = db.prepare('SELECT id FROM user_profiles WHERE id = ?').get(user.id)
    if (!existing) {
      db.prepare('INSERT INTO user_profiles (id, full_name) VALUES (?, ?)').run(user.id, user.full_name || null)
    }

    console.log(`[EVENT: User] Profil ustvarjen za uporabnika ${user.email}`)
    return ok({ success: true, user_id: user.id })
  } catch (e) {
    return err(e.message)
  }
}
