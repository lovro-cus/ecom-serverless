const bcrypt = require('bcryptjs')
const db = require('../../db')
const { ok, err, signToken } = require('../../auth')

module.exports.handler = async (event) => {
  try {
    const { email, password } = JSON.parse(event.body || '{}')
    if (!email || !password) return err('Email in geslo sta obvezna')

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
    if (!user) return err('Napačen email ali geslo', 401)

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return err('Napačen email ali geslo', 401)

    const token = signToken(user.id, user.email)
    return ok({ token, user: { id: user.id, email: user.email } })
  } catch (e) {
    return err(e.message)
  }
}
