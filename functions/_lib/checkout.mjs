export const PRODUCTS = Object.freeze({
  p1: { name: 'MagFold™ 3-in-1 Foldable Charger', priceCents: 3499 },
  p2: { name: 'Volt65™ 65W GaN Travel Fast Charger', priceCents: 2499 },
  p3: { name: 'MagStand™ Slim Leather Wallet & Kickstand', priceCents: 1999 },
  bundle: { name: 'The Ultimate Nomad Travel Bundle (All-in-One)', priceCents: 5999 },
});

const API_BASES = new Set([
  'https://api.nowpayments.io',
  'https://api-sandbox.nowpayments.io',
]);

function parseJsonSetting(value, name) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.error(`Invalid ${name} JSON configuration`, error);
    return null;
  }
}

function validHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function getCheckoutSettings(env) {
  const shippingTaxRates = parseJsonSetting(env.SHIPPING_TAX_RATES_JSON, 'SHIPPING_TAX_RATES_JSON');
  const apiBase = env.NOWPAYMENTS_API_BASE || 'https://api.nowpayments.io';
  const isProduction = env.APP_ENV === 'production' &&
    apiBase === 'https://api.nowpayments.io' &&
    env.NOWPAYMENTS_PAYOUTS_VERIFIED === 'true' &&
    env.FULFILLMENT_VERIFIED === 'true';
  const isTest = env.APP_ENV === 'test' && apiBase === 'https://api-sandbox.nowpayments.io';
  const supportEmailIsValid = typeof env.SUPPORT_EMAIL === 'string' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.SUPPORT_EMAIL);
  const rateLimitSecretIsValid = typeof env.RATE_LIMIT_SECRET === 'string' &&
    env.RATE_LIMIT_SECRET.length >= 32;
  const ratesAreValid = shippingTaxRates &&
    typeof shippingTaxRates === 'object' &&
    !Array.isArray(shippingTaxRates) &&
    Object.keys(shippingTaxRates).length > 0 &&
    Object.entries(shippingTaxRates).every(([country, rate]) =>
      /^[A-Z]{2}$/.test(country) &&
      rate &&
      Number.isSafeInteger(rate.shippingCents) &&
      rate.shippingCents >= 0 &&
      Number.isInteger(rate.taxBasisPoints) &&
      rate.taxBasisPoints >= 0 &&
      rate.taxBasisPoints <= 10000 &&
      typeof rate.taxableShipping === 'boolean'
    );
  const complete = Boolean(
    env.DB &&
    env.NOWPAYMENTS_API_KEY &&
    env.NOWPAYMENTS_IPN_SECRET &&
    (isProduction || isTest) &&
    rateLimitSecretIsValid &&
    supportEmailIsValid &&
    validHttpsUrl(env.STORE_TERMS_URL) &&
    validHttpsUrl(env.STORE_PRIVACY_URL) &&
    ratesAreValid &&
    API_BASES.has(apiBase)
  );

  return {
    enabled: complete,
    apiBase,
    shippingTaxRates: complete ? shippingTaxRates : null,
    termsUrl: complete ? env.STORE_TERMS_URL : null,
    privacyUrl: complete ? env.STORE_PRIVACY_URL : null,
    supportEmail: complete ? env.SUPPORT_EMAIL : null,
  };
}

export function normalizeItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 20) {
    throw new Error('Your bag is empty or contains too many different products.');
  }

  const quantities = new Map();
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || !Object.hasOwn(PRODUCTS, item.id) ||
        !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      throw new Error('The bag contains an invalid product or quantity. Please review it and try again.');
    }
    quantities.set(item.id, (quantities.get(item.id) || 0) + item.quantity);
    if (quantities.get(item.id) > 99) {
      throw new Error('The bag exceeds the maximum quantity for a product.');
    }
  }

  return [...quantities].map(([id, quantity]) => ({
    id,
    name: PRODUCTS[id].name,
    quantity,
    unitPriceCents: PRODUCTS[id].priceCents,
    lineTotalCents: PRODUCTS[id].priceCents * quantity,
  }));
}

export function calculateTotals(items, rate) {
  if (!rate || !Number.isSafeInteger(rate.shippingCents) || rate.shippingCents < 0 ||
      !Number.isInteger(rate.taxBasisPoints) || rate.taxBasisPoints < 0 || rate.taxBasisPoints > 10000 ||
      typeof rate.taxableShipping !== 'boolean') {
    throw new Error('Shipping and tax are not configured for this destination.');
  }

  const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const taxableCents = subtotalCents + (rate.taxableShipping ? rate.shippingCents : 0);
  const taxCents = Math.round(taxableCents * rate.taxBasisPoints / 10000);
  const totalCents = subtotalCents + rate.shippingCents + taxCents;

  if (!Number.isSafeInteger(totalCents) || totalCents <= 0 || totalCents > 100000000) {
    throw new Error('The order total is invalid.');
  }

  return { subtotalCents, shippingCents: rate.shippingCents, taxCents, totalCents };
}

export function validateCustomer(customer) {
  if (!customer || typeof customer !== 'object') {
    throw new Error('Enter your contact and shipping details.');
  }
  const fields = {
    name: customer.name,
    email: customer.email,
    address1: customer.address1,
    address2: customer.address2 || '',
    city: customer.city,
    region: customer.region,
    postalCode: customer.postalCode,
    country: customer.country,
  };

  for (const [key, value] of Object.entries(fields)) {
    if (typeof value !== 'string' || value.length > (key === 'address2' ? 150 : 254)) {
      throw new Error('One or more shipping fields are invalid.');
    }
    fields[key] = value.trim();
  }

  if (fields.name.length < 2 || fields.email.length < 5 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email) ||
      fields.address1.length < 4 || fields.city.length < 2 ||
      fields.region.length < 1 || fields.postalCode.length < 2 ||
      !/^[A-Z]{2}$/.test(fields.country.toUpperCase())) {
    throw new Error('Enter a valid name, email, and complete shipping address.');
  }

  fields.country = fields.country.toUpperCase();
  return fields;
}

export function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((sorted, key) => {
      sorted[key] = sortObject(value[key]);
      return sorted;
    }, {});
  }
  return value;
}

export async function signIpnPayload(payload, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );
  const canonicalPayload = JSON.stringify(sortObject(payload));
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(canonicalPayload));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function constantTimeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function hashRateLimitKey(ip, secret, windowStart) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const bytes = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${ip}:${windowStart}`),
  );
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
