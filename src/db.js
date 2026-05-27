const Database = require('better-sqlite3')
const path = require('path')

const db = new Database(path.join(__dirname, '..', 'ecom.db'))

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_profiles (
    id TEXT PRIMARY KEY REFERENCES users(id),
    full_name TEXT,
    phone TEXT,
    address TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    stock INTEGER DEFAULT 0,
    image_url TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    status TEXT DEFAULT 'pending',
    total REAL NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    product_id TEXT NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    price REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cart_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    product_id TEXT NOT NULL REFERENCES products(id),
    quantity INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id)
  );

  CREATE TABLE IF NOT EXISTS stock_alerts (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    stock_level INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS daily_reports (
    id TEXT PRIMARY KEY,
    report_date TEXT NOT NULL UNIQUE,
    total_orders INTEGER DEFAULT 0,
    total_revenue REAL DEFAULT 0,
    completed_orders INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`)

module.exports = db
