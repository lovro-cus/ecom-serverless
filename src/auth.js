const jwt = require('jsonwebtoken')

const SECRET = process.env.JWT_SECRET || 'local-dev-secret-key'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
}

function ok(data, status = 200) {
  return { statusCode: status, headers: cors, body: JSON.stringify(data) }
}

function err(message, status = 400) {
  return { statusCode: status, headers: cors, body: JSON.stringify({ error: message }) }
}

function requireAuth(event) {
  const header = event.headers?.Authorization || event.headers?.authorization
  if (!header) throw { status: 401, message: 'Missing authorization header' }
  const token = header.replace('Bearer ', '')
  try {
    return jwt.verify(token, SECRET)
  } catch {
    throw { status: 401, message: 'Invalid token' }
  }
}

function signToken(userId, email) {
  return jwt.sign({ id: userId, email }, SECRET, { expiresIn: '7d' })
}

module.exports = { ok, err, requireAuth, signToken }
