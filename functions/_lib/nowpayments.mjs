export async function requestInvoice({ settings, apiKey, order, requestUrl }) {
  const origin = new URL(requestUrl).origin;
  const callbackUrl = new URL('/api/payments/nowpayments-ipn', origin).toString();
  const successUrl = new URL(`/?order_id=${encodeURIComponent(order.id)}`, origin).toString();
  const cancelUrl = new URL(`/?order_id=${encodeURIComponent(order.id)}&payment=cancelled`, origin).toString();
  const response = await fetch(`${settings.apiBase}/v1/invoice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      price_amount: (order.totalCents / 100).toFixed(2),
      price_currency: 'usd',
      ipn_callback_url: callbackUrl,
      order_id: order.id,
      order_description: `Fold Tech Studio order ${order.id}`,
      success_url: successUrl,
      cancel_url: cancelUrl,
    }),
  });

  const responseText = await response.text();
  let result;
  try {
    result = JSON.parse(responseText);
  } catch (error) {
    console.error('NOWPayments returned a non-JSON invoice response', {
      status: response.status,
      error,
    });
    throw new Error('The crypto payment provider returned an invalid response.');
  }

  let invoiceUrl;
  try {
    invoiceUrl = new URL(result.invoice_url);
  } catch {
    invoiceUrl = null;
  }
  if (!response.ok || !invoiceUrl ||
      invoiceUrl.protocol !== 'https:' ||
      invoiceUrl.hostname !== 'nowpayments.io' ||
      (typeof result.id !== 'string' && typeof result.id !== 'number') ||
      result.order_id !== order.id ||
      Number(result.price_amount) !== order.totalCents / 100 ||
      String(result.price_currency).toLowerCase() !== 'usd') {
    console.error('NOWPayments invoice creation failed', {
      status: response.status,
      providerError: result.message || result.error || 'invalid invoice response',
    });
    throw new Error('A secure crypto invoice could not be created. Please try again later.');
  }

  return { invoiceId: String(result.id), invoiceUrl: invoiceUrl.toString() };
}

export async function fetchPayment({ settings, apiKey, paymentId }) {
  const response = await fetch(
    `${settings.apiBase}/v1/payment/${encodeURIComponent(paymentId)}`,
    { headers: { 'x-api-key': apiKey } },
  );
  if (!response.ok) {
    console.error('NOWPayments payment lookup failed', { status: response.status, paymentId });
    throw new Error('Payment status could not be verified with the provider.');
  }
  return response.json();
}
