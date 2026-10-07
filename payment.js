/**
 * Fold Tech Studio - Payment Gateway Integration
 *
 * NOTE: Client-side demo payment simulations and mock wallet handlers have been
 * removed. Payments are processed securely and fail-closed via Cloudflare Pages
 * Functions (/api/checkout/create) and hosted NOWPayments crypto settlement.
 */

(function () {
  'use strict';

  // Cleanup legacy simulation artifacts from localStorage
  try {
    localStorage.removeItem('activeCheckoutSim');
    localStorage.removeItem('simulatedOtp');
    localStorage.removeItem('simOtpCode');
    localStorage.removeItem('simOtpTimer');
  } catch (e) {
    // Ignore storage errors
  }

  window.FoldTechPayments = {
    isGooglePayAvailable: function () { return false; },
    isApplePayAvailable: function () { return false; },
    isPaymentRequestAvailable: function () { return false; },
    launchGooglePay: async function () {
      console.warn('Client-side Google Pay simulation is disabled. Use the secure hosted crypto checkout.');
      return false;
    },
    launchApplePay: async function () {
      console.warn('Client-side Apple Pay simulation is disabled. Use the secure hosted crypto checkout.');
      return false;
    }
  };
})();
