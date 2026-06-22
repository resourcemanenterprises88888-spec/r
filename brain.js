/*
ResourceMan "Brain" (DB access + business logic skeleton)

This project currently runs as a frontend-only app (index.html + index.js).
To actually use the SQL, you need a backend (API) that connects to the DB.
brain.js is a ready-to-plug Node module that can be used by your storage-bridge.

Install (example):
  npm i pg

Environment variables (example):
  DATABASE_URL=postgres://user:pass@host:5432/dbname
*/

'use strict';

// Choose one: pg (PostgreSQL)
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// --------------------
// Helpers
// --------------------

async function query(text, params) {
  return pool.query(text, params);
}

function normalizeProductType(productType) {
  const t = String(productType || '').toLowerCase();
  if (t.includes('shoe') && !t.includes('shoe-l')) return 'shoe';
  if (t.includes('shoeland')) return 'shoelander';
  if (t.includes('marikina')) return 'marikina';
  if (t.includes('tech')) return 'technology';
  if (t.includes('product') || t.includes('other')) return 'product';
  return t || null;
}

// --------------------
// Customers / Auth
// --------------------

async function createUser({ id, email, name, passwordHash, phone = null, address = null, isAdmin = false }) {
  const res = await query(
    `INSERT INTO users (id, email, name, password_hash, phone, address, is_admin, is_blocked)
     VALUES ($1,$2,$3,$4,$5,$6,$7,false)
     RETURNING id, email, name, phone, address, is_admin as isAdmin, is_blocked as isBlocked, created_at as createdAt, updated_at as updatedAt`,
    [id, email, name, passwordHash, phone, address, !!isAdmin]
  );
  return res.rows[0];
}

async function getUserByEmail(email) {
  const res = await query(
    `SELECT id, email, name, password_hash as passwordHash, phone, address,
            is_admin as isAdmin, is_blocked as isBlocked,
            created_at as createdAt, updated_at as updatedAt
     FROM users
     WHERE email = $1`,
    [email]
  );
  return res.rows[0] || null;
}

async function setUserBlocked({ email, isBlocked }) {
  const res = await query(
    `UPDATE users
     SET is_blocked = $1, updated_at = NOW()
     WHERE email = $2
     RETURNING id, email, name, phone, address, is_admin as isAdmin, is_blocked as isBlocked`,
    [!!isBlocked, email]
  );
  return res.rows[0] || null;
}

// --------------------
// OTP verification
// --------------------

async function createEmailVerification({ userId, email, code, expiresAt }) {
  const res = await query(
    `INSERT INTO email_verifications (user_id, email, code, expires_at, used_at)
     VALUES ($1,$2,$3,$4,NULL)
     RETURNING *`,
    [userId || null, email, String(code), expiresAt]
  );
  return res.rows[0];
}

async function verifyEmailCode({ email, code, now = new Date() }) {
  const res = await query(
    `SELECT *
     FROM email_verifications
     WHERE email = $1
       AND code = $2
       AND used_at IS NULL
       AND expires_at > $3
     ORDER BY created_at DESC
     LIMIT 1`,
    [email, String(code), now]
  );
  return res.rows[0] || null;
}

async function markEmailVerificationUsed({ verificationId }) {
  const res = await query(
    `UPDATE email_verifications
     SET used_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [verificationId]
  );
  return res.rows[0] || null;
}

// --------------------
// Products / Catalog
// --------------------

async function upsertProduct({ id, productType, name, price, image, description }) {
  const pType = normalizeProductType(productType);
  if (!pType) throw new Error('Invalid productType');

  const res = await query(
    `INSERT INTO products (id, product_type, name, price, image, description)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (id) DO UPDATE SET
       product_type = EXCLUDED.product_type,
       name = EXCLUDED.name,
       price = EXCLUDED.price,
       image = EXCLUDED.image,
       description = EXCLUDED.description,
       updated_at = NOW()
     RETURNING *`,
    [id, pType, name, price, image || null, description || null]
  );
  return res.rows[0];
}

async function deleteProductById(id) {
  await query(`DELETE FROM products WHERE id = $1`, [id]);
}

async function listCatalogGrouped() {
  const res = await query(
    `SELECT id, product_type, name, price, image, description
     FROM products
     ORDER BY product_type, name`
  );

  const shoes = [];
  const techProducts = [];
  const otherProducts = [];
  const shoelanders = [];
  const marikinaCollection = [];
  const ppeProducts = [];
  const moreProducts = [];

  for (const row of res.rows) {
    const item = {
      id: row.id,
      name: row.name,
      // brain returns numeric price; your bridge can format like index.js expects.
      price: row.price,
      image: row.image,
      desc: row.description || ''
    };

    switch (row.product_type) {
      case 'shoe':
        shoes.push(item);
        break;
      case 'technology':
        techProducts.push(item);
        break;
      case 'product':
        otherProducts.push(item);
        break;
      case 'shoelander':
        shoelanders.push(item);
        break;
      case 'marikina':
        marikinaCollection.push(item);
        break;
      default:
        otherProducts.push(item);
    }
  }

  return {
    shoes,
    techProducts,
    otherProducts,
    shoelanders,
    marikinaCollection
  };
}

// --------------------
// Orders / Checkout
// --------------------

async function createOrder({ id, userId, status, paymentMethod, paymentId, items, totalAmount, cancelReason = null }) {
  // items: [{ productId, itemName, quantity, unitPrice }]
  const res = await query(
    `INSERT INTO orders (id, user_id, status, payment_method, payment_id, cancel_reason, total_amount)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [id, userId, status, paymentMethod || null, paymentId || null, cancelReason, totalAmount]
  );

  for (const it of (items || [])) {
    await query(
      `INSERT INTO order_items (order_id, product_id, item_name, quantity, unit_price, line_total)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, it.productId || null, it.itemName, it.quantity || 1, it.unitPrice, (it.unitPrice || 0) * (it.quantity || 1)]
    );
  }

  return res.rows[0];
}

async function setOrderStatus({ orderId, status, paymentMethod = null, paymentId = null }) {
  const res = await query(
    `UPDATE orders
     SET status = $1,
         payment_method = COALESCE($2, payment_method),
         payment_id = COALESCE($3, payment_id),
         updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [status, paymentMethod, paymentId, orderId]
  );
  return res.rows[0] || null;
}

async function markOrderDelivered({ orderId, deliveryDays = 1 }) {
  const res = await query(
    `UPDATE orders
     SET delivered = true,
         delivery_days = $2,
         delivery_date = CURRENT_DATE,
         status = 'Delivered',
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [orderId, deliveryDays]
  );
  return res.rows[0] || null;
}

// --------------------
// Settings
// --------------------

async function setSetting({ key, value }) {
  const res = await query(
    `INSERT INTO system_settings (key, value)
     VALUES ($1,$2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
     RETURNING *`,
    [key, value]
  );
  return res.rows[0];
}

async function getSetting(key) {
  const res = await query(`SELECT key, value, updated_at FROM system_settings WHERE key = $1`, [key]);
  return res.rows[0] || null;
}

module.exports = {
  // auth
  createUser,
  getUserByEmail,
  setUserBlocked,

  // email verification
  createEmailVerification,
  verifyEmailCode,
  markEmailVerificationUsed,

  // products
  upsertProduct,
  deleteProductById,
  listCatalogGrouped,

  // orders
  createOrder,
  setOrderStatus,
  markOrderDelivered,

  // settings
  setSetting,
  getSetting
};

