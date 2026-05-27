const bcrypt = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')
const db = require('../../db')
const { ok, err, signToken } = require('../../auth')
const { handler: onUserRegistered } = require('../events/onUserRegistered')

module.exports.handler = async (event) => {
  try {
    const { email, password } = JSON.parse(event.body || '{}')
    if (!email || !password) return err('Email in geslo sta obvezna')

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
    if (existing) return err('Email že obstaja', 409)

    const id = uuidv4()
    const hashed = await bcrypt.hash(password, 10)
    db.prepare('INSERT INTO users (id, email, password) VALUES (?, ?, ?)').run(id, email, hashed)

    // USER EVENT: sproži ob registraciji
    await onUserRegistered({ body: JSON.stringify({ id, email }) })

    const token = signToken(id, email)
    return ok({ token, user: { id, email } }, 201)
  } catch (e) {
    return err(e.message)
  }
}
