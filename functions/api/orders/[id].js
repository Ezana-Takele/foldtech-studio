export async function onRequestGet({ params, env }) {
  const orderId = params.id;
  if (typeof orderId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
    return Response.json({ error: 'Order not found.' }, { status: 404 });
  }

  try {
    const order = await env.DB.prepare(
      `SELECT status, total_cents, currency FROM orders WHERE id = ?`,
    ).bind(orderId).first();
    if (!order) return Response.json({ error: 'Order not found.' }, { status: 404 });
    return Response.json({
      status: order.status,
      totalCents: order.total_cents,
      currency: order.currency,
    }, {
      headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch (error) {
    console.error('Could not read order status', error);
    return Response.json({ error: 'Order status is temporarily unavailable.' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  }
}
