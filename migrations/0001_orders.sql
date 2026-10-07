CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (
    status IN (
      'creating_invoice',
      'awaiting_payment',
      'paid',
      'expired',
      'failed',
      'refunded',
      'checkout_failed'
    )
  ),
  items_json TEXT NOT NULL,
  customer_json TEXT NOT NULL,
  country TEXT NOT NULL CHECK (length(country) = 2),
  currency TEXT NOT NULL CHECK (currency = 'USD'),
  method TEXT NOT NULL CHECK (method = 'crypto'),
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents > 0),
  shipping_cents INTEGER NOT NULL CHECK (shipping_cents >= 0),
  tax_cents INTEGER NOT NULL CHECK (tax_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents > 0),
  terms_url TEXT NOT NULL,
  privacy_url TEXT NOT NULL,
  policies_accepted_at TEXT NOT NULL,
  provider_invoice_id TEXT,
  provider_payment_id TEXT UNIQUE,
  invoice_url TEXT,
  provider_status TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS orders_status_created_idx ON orders(status, created_at);

CREATE TABLE IF NOT EXISTS checkout_rate_limits (
  ip_hash TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts > 0),
  PRIMARY KEY (ip_hash, window_start)
);
