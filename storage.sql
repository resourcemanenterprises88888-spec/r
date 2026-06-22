-- ResourceMan Storage Schema (SQL)
-- Target: PostgreSQL 15+ (works with minor edits for MySQL)
-- NOTE: index.js currently stores data in browser/localStorage and syncs via an external bridge.
-- This schema is meant to back that storage/bridge layer.

BEGIN;

-- Extensions (optional)
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id                TEXT PRIMARY KEY,
    email             CITEXT UNIQUE NOT NULL,
    name              TEXT NOT NULL,
    password_hash    TEXT NOT NULL,
    phone             TEXT,
    address          TEXT,
    is_admin          BOOLEAN NOT NULL DEFAULT FALSE,
    is_blocked        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- OTP / email verification
CREATE TABLE IF NOT EXISTS email_verifications (
    id                BIGSERIAL PRIMARY KEY,
    user_id           TEXT REFERENCES users(id) ON DELETE CASCADE,
    email             CITEXT NOT NULL,
    code              TEXT NOT NULL,
    expires_at       TIMESTAMPTZ NOT NULL,
    used_at           TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id                TEXT PRIMARY KEY,
    product_type     TEXT NOT NULL,
    name              TEXT NOT NULL,
    price             NUMERIC(12,2) NOT NULL,
    image             TEXT,
    description       TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_type ON products(product_type);

-- Orders: cart checkout / pending/paid/delivered/cancelled
CREATE TABLE IF NOT EXISTS orders (
    id                TEXT PRIMARY KEY,
    user_id           TEXT REFERENCES users(id) ON DELETE CASCADE,
    status            TEXT NOT NULL,
    payment_method    TEXT,
    payment_id        TEXT,
    cancel_reason     TEXT,

    -- Delivery tracking
    delivered         BOOLEAN NOT NULL DEFAULT FALSE,
    delivery_days     INTEGER,
    delivery_date     DATE,

    -- Monetary / item summary (also normalized in order_items)
    total_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,

    placed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS order_items (
    id                BIGSERIAL PRIMARY KEY,
    order_id          TEXT REFERENCES orders(id) ON DELETE CASCADE,
    product_id        TEXT REFERENCES products(id),

    item_name         TEXT NOT NULL,
    quantity          INTEGER NOT NULL DEFAULT 1,
    unit_price        NUMERIC(12,2) NOT NULL,
    line_total        NUMERIC(12,2) NOT NULL
);

-- Cart can be implemented as a separate table; to match current JS behavior,
-- cartHistory is just a list of items until checkout. We'll store carts as pending orders.
-- If you prefer a true cart table, replace the logic in your bridge layer.

-- Payments (optional separate table for references)
CREATE TABLE IF NOT EXISTS payments (
    id                TEXT PRIMARY KEY,
    order_id          TEXT REFERENCES orders(id) ON DELETE CASCADE,
    method            TEXT NOT NULL,
    reference         TEXT,
    amount            NUMERIC(12,2) NOT NULL,
    status            TEXT NOT NULL DEFAULT 'Created',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payroll / staff
CREATE TABLE IF NOT EXISTS staff (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    position          TEXT NOT NULL,
    salary            NUMERIC(12,2) NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_runs (
    id                TEXT PRIMARY KEY,
    run_date          DATE NOT NULL,
    status            TEXT NOT NULL DEFAULT 'Disbursed'
);

CREATE TABLE IF NOT EXISTS payroll_run_items (
    id                BIGSERIAL PRIMARY KEY,
    payroll_run_id   TEXT REFERENCES payroll_runs(id) ON DELETE CASCADE,
    staff_id          TEXT REFERENCES staff(id) ON DELETE CASCADE,
    count_staff       INTEGER NOT NULL DEFAULT 1,
    line_total        NUMERIC(12,2) NOT NULL
);

-- Settings / UI design configs (JSON blobs)
CREATE TABLE IF NOT EXISTS system_settings (
    key               TEXT PRIMARY KEY,
    value             JSONB,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;

