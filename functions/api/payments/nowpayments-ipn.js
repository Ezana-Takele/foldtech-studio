import {
  constantTimeEqual,
  getCheckoutSettings,
  signIpnPayload,
} from '../../_lib/checkout.mjs';
import { fetchPayment } from '../../_lib/nowpayments.mjs';

function jsonError(message, status) {
  return Response.json({ error: message }, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

export async function onRequestPost({ request, env }) {
  const settings = getCheckoutSettings(env);
  if (!settings.enabled) return jsonError('Payment notification endpoint is not configured.', 503);

  let payload;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 64000) return jsonError('Notification is too large.', 413);
    payload = JSON.parse(rawBody);
  } catch {
    return jsonError('Invalid payment notification.', 400);
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      typeof payload.payment_id !== 'string' && typeof payload.payment_id !== 'number' ||
      typeof payload.order_id !== 'string') {
    return jsonError('Invalid payment notification.', 400);
  }

  let expectedSignature;
  try {
    expectedSignature = await signIpnPayload(payload, env.NOWPAYMENTS_IPN_SECRET);
  } catch (error) {
    console.error('Could not verify the NOWPayments notification signature', error);
    return jsonError('Payment notification verification failed.', 503);
  }
  if (!constantTimeEqual(expectedSignature, request.headers.get('x-nowpayments-sig'))) {
    return jsonError('Payment notification signature is invalid.', 401);
  }

  let order;
  try {
    order = await env.DB.prepare(
      `SELECT id, status, method, total_cents FROM orders WHERE id = ?`,
    ).bind(payload.order_id).first();
  } catch (error) {
    console.error('Could not load order for payment notification', error);
    return jsonError('Payment notification could not be processed.', 503);
  }
  if (!order) return jsonError('Order not found.', 404);

  let payment;
  try {
    payment = await fetchPayment({
      settings,
      apiKey: env.NOWPAYMENTS_API_KEY,
      paymentId: String(payload.payment_id),
    });
  } catch (error) {
    console.error('Could not verify NOWPayments notification against provider', {
      orderId: order.id,
      error,
    });
    return jsonError('Payment status could not be verified.', 503);
  }

  if (String(payment.payment_id) !== String(payload.payment_id) ||
      payment.order_id !== order.id ||
      Number(payment.price_amount) !== order.total_cents / 100 ||
      String(payment.price_currency).toLowerCase() !== 'usd') {
    console.error('Provider payment details did not match the stored order', {
      orderId: order.id,
      paymentId: String(payload.payment_id),
    });
    return jsonError('Payment details did not match the order.', 409);
  }

  const providerStatus = String(payment.payment_status || '').toLowerCase();
  const orderStatus = providerStatus === 'finished'
    ? 'paid'
    : providerStatus === 'expired'
      ? 'expired'
      : providerStatus === 'failed'
        ? 'failed'
        : providerStatus === 'refunded'
          ? 'refunded'
          : 'awaiting_payment';
  const now = new Date().toISOString();

  try {
    await env.DB.prepare(
      `UPDATE orders
       SET status = CASE
         WHEN status = 'paid' AND ? != 'refunded' THEN status
         ELSE ?
       END,
       provider_payment_id = ?,
       provider_status = ?,
       updated_at = ?
       WHERE id = ?`,
    ).bind(
      orderStatus,
      orderStatus,
      String(payment.payment_id),
      providerStatus,
      now,
      order.id,
    ).run();
  } catch (error) {
    console.error('Could not persist verified payment status', {
      orderId: order.id,
      error,
    });
    return jsonError('Verified payment status could not be recorded.', 503);
  }

  return new Response(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  });
}
