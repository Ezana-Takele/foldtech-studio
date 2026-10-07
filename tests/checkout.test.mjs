import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTotals,
  constantTimeEqual,
  getCheckoutSettings,
  normalizeItems,
  PRODUCTS,
  signIpnPayload,
  validateCustomer,
} from '../functions/_lib/checkout.mjs';
import { requestInvoice } from '../functions/_lib/nowpayments.mjs';
import { onRequestPost as createCheckout } from '../functions/api/checkout/create.js';
import { onRequestPost as handleNowPaymentsIpn } from '../functions/api/payments/nowpayments-ipn.js';

test('server catalog matches the Fold Tech Studio real product catalog', () => {
  assert.deepEqual(Object.keys(PRODUCTS).sort(), ['bundle', 'p1', 'p2', 'p3']);
  assert.equal(PRODUCTS.p1.name, 'MagFold™ 3-in-1 Foldable Charger');
  assert.equal(PRODUCTS.p1.priceCents, 3499);
  assert.equal(PRODUCTS.p2.name, 'Volt65™ 65W GaN Travel Fast Charger');
  assert.equal(PRODUCTS.p2.priceCents, 2499);
  assert.equal(PRODUCTS.p3.name, 'MagStand™ Slim Leather Wallet & Kickstand');
  assert.equal(PRODUCTS.p3.priceCents, 1999);
  assert.equal(PRODUCTS.bundle.name, 'The Ultimate Nomad Travel Bundle (All-in-One)');
  assert.equal(PRODUCTS.bundle.priceCents, 5999);
});

test('order lines use only the server catalog and enforce quantity bounds', () => {
  assert.deepEqual(normalizeItems([{ id: 'p1', quantity: 2, price: 0.01 }]), [{
    id: 'p1',
    name: 'MagFold™ 3-in-1 Foldable Charger',
    quantity: 2,
    unitPriceCents: 3499,
    lineTotalCents: 6998,
  }]);
  assert.deepEqual(normalizeItems([{ id: 'bundle', quantity: 1 }]), [{
    id: 'bundle',
    name: 'The Ultimate Nomad Travel Bundle (All-in-One)',
    quantity: 1,
    unitPriceCents: 5999,
    lineTotalCents: 5999,
  }]);
  assert.throws(() => normalizeItems([{ id: 'not-a-product', quantity: 1 }]), /invalid product/i);
  assert.throws(() => normalizeItems([{ id: 'p4', quantity: 1 }]), /invalid product/i);
  assert.throws(() => normalizeItems([{ id: 'p1', quantity: 100 }]), /invalid product/i);
});

test('order total includes configured destination shipping and tax', () => {
  const items = normalizeItems([{ id: 'p1', quantity: 1 }]);
  assert.deepEqual(calculateTotals(items, {
    shippingCents: 500,
    taxBasisPoints: 800,
    taxableShipping: true,
  }), {
    subtotalCents: 3499,
    shippingCents: 500,
    taxCents: 320,
    totalCents: 4319,
  });
  assert.throws(() => calculateTotals(items, undefined), /not configured/i);
});

test('customer fields are normalized and country codes are validated', () => {
  const customer = validateCustomer({
    name: '  Alex Buyer ',
    email: ' alex@example.com ',
    address1: ' 12 Market Street ',
    address2: '',
    city: ' Addis Ababa ',
    region: ' Addis Ababa ',
    postalCode: '1000',
    country: 'et',
  });
  assert.equal(customer.name, 'Alex Buyer');
  assert.equal(customer.email, 'alex@example.com');
  assert.equal(customer.country, 'ET');
  assert.throws(() => validateCustomer({ ...customer, country: 'ETH' }), /valid name/i);
});

test('checkout remains disabled until production settings and explicit payout checks exist', () => {
  const configured = {
    DB: {},
    APP_ENV: 'production',
    NOWPAYMENTS_API_BASE: 'https://api.nowpayments.io',
    NOWPAYMENTS_API_KEY: 'configured',
    NOWPAYMENTS_IPN_SECRET: 'configured',
    NOWPAYMENTS_PAYOUTS_VERIFIED: 'true',
    FULFILLMENT_VERIFIED: 'true',
    RATE_LIMIT_SECRET: '01234567890123456789012345678901',
    SUPPORT_EMAIL: 'support@example.com',
    STORE_TERMS_URL: 'https://shop.example.com/terms',
    STORE_PRIVACY_URL: 'https://shop.example.com/privacy',
    SHIPPING_TAX_RATES_JSON: JSON.stringify({
      US: { shippingCents: 500, taxBasisPoints: 0, taxableShipping: false },
    }),
  };
  assert.equal(getCheckoutSettings(configured).enabled, true);
  assert.equal(getCheckoutSettings({
    ...configured,
    NOWPAYMENTS_PAYOUTS_VERIFIED: 'false',
  }).enabled, false);
  assert.equal(getCheckoutSettings({
    ...configured,
    FULFILLMENT_VERIFIED: 'false',
  }).enabled, false);
  assert.equal(getCheckoutSettings({
    ...configured,
    APP_ENV: 'production',
    NOWPAYMENTS_API_BASE: 'https://api-sandbox.nowpayments.io',
  }).enabled, false);
  assert.equal(getCheckoutSettings({
    ...configured,
    SHIPPING_TAX_RATES_JSON: '{}',
  }).enabled, false);
});

test('NOWPayments signatures are stable for equivalent object key order and compared safely', async () => {
  const secret = 'test-only-secret';
  const first = await signIpnPayload({ order_id: 'o-1', payment_id: 4, nested: { b: 2, a: 1 } }, secret);
  const second = await signIpnPayload({ nested: { a: 1, b: 2 }, payment_id: 4, order_id: 'o-1' }, secret);
  assert.equal(first, second);
  assert.equal(constantTimeEqual(first, second), true);
  assert.equal(constantTimeEqual(first, `${first}00`), false);
});

test('hosted invoice leaves payment coin selection to NOWPayments', async (context) => {
  let requestBody;
  context.mock.method(globalThis, 'fetch', async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return Response.json({
      id: 'invoice-123',
      order_id: 'order-123',
      price_amount: 43.19,
      price_currency: 'usd',
      invoice_url: 'https://nowpayments.io/payment/?iid=invoice-123',
    });
  });
  const invoice = await requestInvoice({
    settings: { apiBase: 'https://api.nowpayments.io' },
    apiKey: 'test-api-key',
    order: { id: 'order-123', totalCents: 4319 },
    requestUrl: 'https://shop.example.com/api/checkout/create',
  });
  assert.equal(invoice.invoiceId, 'invoice-123');
  assert.equal(requestBody.price_amount, '43.19');
  assert.equal(requestBody.price_currency, 'usd');
  assert.equal('pay_currency' in requestBody, false);
  assert.equal(requestBody.ipn_callback_url, 'https://shop.example.com/api/payments/nowpayments-ipn');
});

test('hosted invoice rejects non-provider redirects', async (context) => {
  context.mock.method(console, 'error', () => {});
  context.mock.method(globalThis, 'fetch', async () => Response.json({
    id: 'invoice-123',
    order_id: 'order-123',
    price_amount: 43.19,
    price_currency: 'usd',
    invoice_url: 'https://attacker.example/payment',
  }));
  await assert.rejects(requestInvoice({
    settings: { apiBase: 'https://api.nowpayments.io' },
    apiKey: 'test-api-key',
    order: { id: 'order-123', totalCents: 4319 },
    requestUrl: 'https://shop.example.com/api/checkout/create',
  }), /could not be created/i);
});

function configuredEnvironment(database) {
  return {
    DB: database,
    APP_ENV: 'production',
    NOWPAYMENTS_API_BASE: 'https://api.nowpayments.io',
    NOWPAYMENTS_API_KEY: 'test-api-key',
    NOWPAYMENTS_IPN_SECRET: '01234567890123456789012345678901',
    NOWPAYMENTS_PAYOUTS_VERIFIED: 'true',
    FULFILLMENT_VERIFIED: 'true',
    RATE_LIMIT_SECRET: '01234567890123456789012345678901',
    SUPPORT_EMAIL: 'support@example.com',
    STORE_TERMS_URL: 'https://shop.example.com/terms',
    STORE_PRIVACY_URL: 'https://shop.example.com/privacy',
    SHIPPING_TAX_RATES_JSON: JSON.stringify({
      US: { shippingCents: 500, taxBasisPoints: 800, taxableShipping: true },
    }),
  };
}

test('checkout API derives its invoice amount on the server and persists an unpaid order', async (context) => {
  const statements = [];
  const database = {
    prepare(sql) {
      const statement = {
        bind(...values) {
          this.values = values;
          return this;
        },
        async first() {
          if (sql.includes('RETURNING attempts')) return { attempts: 1 };
          return null;
        },
        async run() {
          statements.push({ sql, values: this.values });
          return {};
        },
      };
      return statement;
    },
  };
  let providerInvoice;
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    providerInvoice = JSON.parse(options.body);
    const orderId = providerInvoice.order_id;
    return Response.json({
      id: 'invoice-123',
      order_id: orderId,
      price_amount: 43.19,
      price_currency: 'usd',
      invoice_url: 'https://nowpayments.io/payment/?iid=invoice-123',
    });
  });

  const orderRequest = {
    acceptedPolicies: true,
    items: [{ id: 'p1', quantity: 1, price: 0.01 }],
    customer: {
      name: 'Alex Buyer',
      email: 'alex@example.com',
      address1: '12 Market Street',
      address2: '',
      city: 'New York',
      region: 'NY',
      postalCode: '10001',
      country: 'US',
    },
  };
  const request = new Request('https://shop.example.com/api/checkout/create', {
    method: 'POST',
    headers: {
      Origin: 'https://shop.example.com',
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '192.0.2.10',
    },
    body: JSON.stringify(orderRequest),
  });
  const response = await createCheckout({
    request,
    env: configuredEnvironment(database),
  });
  const result = await response.json();
  assert.equal(response.status, 201);
  assert.equal(providerInvoice.price_amount, '43.19');
  assert.equal('pay_currency' in providerInvoice, false);
  assert.equal(result.checkoutUrl, 'https://nowpayments.io/payment/?iid=invoice-123');
  assert.equal(statements.some(({ sql }) => sql.includes("'creating_invoice'")), true);
  assert.equal(statements.some(({ sql }) => sql.includes("status = 'awaiting_payment'")), true);
});

test('signed provider callback verifies payment server-side before marking the order paid', async (context) => {
  const orderId = '123e4567-e89b-42d3-a456-426614174000';
  const payload = { payment_id: 123, order_id: orderId, payment_status: 'finished' };
  const signature = await signIpnPayload(payload, '01234567890123456789012345678901');
  let persistedValues;
  const database = {
    prepare(sql) {
      return {
        bind(...values) {
          this.values = values;
          return this;
        },
        async first() {
          return { id: orderId, status: 'awaiting_payment', method: 'crypto', total_cents: 4319 };
        },
        async run() {
          persistedValues = this.values;
          return {};
        },
      };
    },
  };
  context.mock.method(globalThis, 'fetch', async () => Response.json({
    payment_id: 123,
    order_id: orderId,
    payment_status: 'finished',
    price_amount: 43.19,
    price_currency: 'usd',
    pay_currency: 'some-supported-crypto',
  }));
  const response = await handleNowPaymentsIpn({
    request: new Request('https://shop.example.com/api/payments/nowpayments-ipn', {
      method: 'POST',
      headers: { 'x-nowpayments-sig': signature },
      body: JSON.stringify(payload),
    }),
    env: configuredEnvironment(database),
  });
  assert.equal(response.status, 204);
  assert.equal(persistedValues[0], 'paid');
  assert.equal(persistedValues[2], '123');
  assert.equal(persistedValues[3], 'finished');
  assert.equal(persistedValues[5], orderId);
});

test('invalid provider callback signature is rejected before provider lookup', async (context) => {
  let providerWasCalled = false;
  context.mock.method(globalThis, 'fetch', async () => {
    providerWasCalled = true;
    throw new Error('Provider lookup should not run.');
  });
  const response = await handleNowPaymentsIpn({
    request: new Request('https://shop.example.com/api/payments/nowpayments-ipn', {
      method: 'POST',
      headers: { 'x-nowpayments-sig': 'bad-signature' },
      body: JSON.stringify({ payment_id: 123, order_id: 'missing-order' }),
    }),
    env: configuredEnvironment({}),
  });
  assert.equal(response.status, 401);
  assert.equal(providerWasCalled, false);
});
