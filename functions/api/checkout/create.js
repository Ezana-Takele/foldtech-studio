import {
  calculateTotals,
  getCheckoutSettings,
  hashRateLimitKey,
  normalizeItems,
  validateCustomer,
} from '../../_lib/checkout.mjs';
import { requestInvoice } from '../../_lib/nowpayments.mjs';

function jsonError(message, status) {
  return Response.json({ error: message }, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

export async function onRequestPost({ request, env }) {
  if (request.headers.get('Origin') !== new URL(request.url).origin) {
    return jsonError('This checkout request was not accepted.', 403);
  }
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    return jsonError('Invalid checkout request.', 415);
  }
  const settings = getCheckoutSettings(env);
  if (!settings.enabled) {
    return jsonError('Secure crypto checkout is not configured yet.', 503);
  }

  const now = Date.now();
  const windowStart = Math.floor(now / 900000) * 900000;
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) return jsonError('Checkout is temporarily unavailable.', 503);
  const ipKey = await hashRateLimitKey(ip, env.RATE_LIMIT_SECRET, windowStart);
  try {
    await env.DB.prepare('DELETE FROM checkout_rate_limits WHERE window_start < ?')
      .bind(now - 86400000).run();
    const rateResult = await env.DB.prepare(
      `INSERT INTO checkout_rate_limits (ip_hash, window_start, attempts)
       VALUES (?, ?, 1)
       ON CONFLICT (ip_hash, window_start)
       DO UPDATE SET attempts = attempts + 1
       RETURNING attempts`,
    ).bind(ipKey, windowStart).first();
    if (!rateResult || rateResult.attempts > 5) {
      return jsonError('Too many checkout attempts. Please wait and try again.', 429);
    }
  } catch (error) {
    console.error('Checkout rate limit could not be enforced', error);
    return jsonError('Secure checkout is temporarily unavailable.', 503);
  }

  let body;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 12000) return jsonError('Checkout details are too large.', 413);
    body = JSON.parse(rawBody);
  } catch {
    return jsonError('Checkout details are invalid.', 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonError('Checkout details are invalid.', 400);
  }
  if (body.acceptedPolicies !== true) {
    return jsonError('Accept the store terms and privacy policy to continue.', 400);
  }

  let items;
  let customer;
  let totals;
  try {
    items = normalizeItems(body.items);
    customer = validateCustomer(body.customer);
    const rate = settings.shippingTaxRates[customer.country];
    totals = calculateTotals(items, rate);
  } catch (error) {
    return jsonError(error.message, 400);
  }

  const orderId = crypto.randomUUID();
  const createdAt = new Date(now).toISOString();
  const customerJson = JSON.stringify(customer);
  const itemsJson = JSON.stringify(items);
  try {
    await env.DB.prepare(
      `INSERT INTO orders (
        id, status, items_json, customer_json, country, currency, method,
        subtotal_cents, shipping_cents, tax_cents, total_cents,
        terms_url, privacy_url, policies_accepted_at, created_at, updated_at
      ) VALUES (?, 'creating_invoice', ?, ?, ?, 'USD', 'crypto', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      orderId,
      itemsJson,
      customerJson,
      customer.country,
      totals.subtotalCents,
      totals.shippingCents,
      totals.taxCents,
      totals.totalCents,
      settings.termsUrl,
      settings.privacyUrl,
      createdAt,
      createdAt,
      createdAt,
    ).run();
  } catch (error) {
    console.error('Could not persist checkout order', error);
    return jsonError('Your order could not be created. Please try again later.', 503);
  }

  try {
    const invoice = await requestInvoice({
      settings,
      apiKey: env.NOWPAYMENTS_API_KEY,
      order: { id: orderId, totalCents: totals.totalCents },
      requestUrl: request.url,
    });
    await env.DB.prepare(
      `UPDATE orders SET status = 'awaiting_payment', provider_invoice_id = ?,
       invoice_url = ?, updated_at = ? WHERE id = ?`,
    ).bind(invoice.invoiceId, invoice.invoiceUrl, new Date().toISOString(), orderId).run();

    return Response.json({
      orderId,
      checkoutUrl: invoice.invoiceUrl,
      totalCents: totals.totalCents,
      currency: 'USD',
    }, {
      status: 201,
      headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch (error) {
    console.error('Could not create a crypto invoice for order', orderId, error);
    try {
      await env.DB.prepare(
        `UPDATE orders SET status = 'checkout_failed', updated_at = ? WHERE id = ?`,
      ).bind(new Date().toISOString(), orderId).run();
    } catch (updateError) {
      console.error('Could not record the failed invoice state', orderId, updateError);
    }
    return jsonError('A secure crypto invoice could not be created. Please try again later.', 502);
  }
}
