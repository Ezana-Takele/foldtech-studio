import { getCheckoutSettings } from '../../_lib/checkout.mjs';

export async function onRequestGet({ env }) {
  const settings = getCheckoutSettings(env);
  let enabled = settings.enabled;

  if (enabled) {
    try {
      await env.DB.prepare('SELECT id FROM orders LIMIT 1').first();
    } catch (error) {
      console.error('Checkout database is not ready', error);
      enabled = false;
    }
  }

  return Response.json({
    enabled,
    termsUrl: enabled ? settings.termsUrl : null,
    privacyUrl: enabled ? settings.privacyUrl : null,
    supportEmail: enabled ? settings.supportEmail : null,
    message: enabled
      ? ''
      : 'Secure crypto checkout is being configured. No payment can be made yet.',
  }, {
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
