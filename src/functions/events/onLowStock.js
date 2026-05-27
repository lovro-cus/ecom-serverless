// MONITORING EVENT: sproži se ko zalog pade pod 5
const { v4: uuidv4 } = require('uuid')
const db = require('../../db')
const { ok, err } = require('../../auth')

module.exports.handler = async (event) => {
  try {
    const product = JSON.parse(event.body || '{}')

    const alert = {
      id: uuidv4(),
      product_id: product.id,
      product_name: product.name,
      stock_level: product.stock,
      message: `Nizka zaloga: produkt "${product.name}" ima samo ${product.stock} kosov`,
    }

    db.prepare('INSERT INTO stock_alerts (id, product_id, product_name, stock_level, message) VALUES (?, ?, ?, ?, ?)').run(
      alert.id, alert.product_id, alert.product_name, alert.stock_level, alert.message
    )

    console.log(`[EVENT: Monitoring] ${alert.message}`)
    return ok(alert)
  } catch (e) {
    return err(e.message)
  }
}
