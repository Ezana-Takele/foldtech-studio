# Fold Tech Studio — Architecture Decision Records (ADRs)
> **Living Technical Memory & Rationale Log**  
> *Purpose: Ensures AI agents, developers, and tools never forget WHY decisions were made, preventing architectural amnesia and regression bugs.*

---

## ADR-001: Absolute Prohibition of Mock Timers & Fake Auto-Authorizations
- **Status**: ACCEPTED & ENFORCED
- **Date**: 2026-10-04
- **Context**: 
  Earlier iterations attempted to simulate instant checkout using `setTimeout` biometric loops or mock device tokens. This caused the checkout flow to automatically advance to the post-purchase confirmation screen without an authentic charge or user approval, creating customer confusion and violating high-trust e-commerce standards.
- **Decision**: 
  Permanently ban any `setTimeout` or automatic timer that triggers order completion (`completeOrderPlacement` or `onWalletAuthorized`). All transactions must require explicit, verified customer action (card form submission with Luhn verification, Google Pay SDK token receipt, Apple Pay session authorization, or PayPal SDK approval).
- **Consequences & Invariants**: 
  - Never add mock delays that simulate success without gateway tokens.
  - An order can only transition to `checkoutStageSuccess` when authentic credentials are submitted.

---

## ADR-002: Apple Pay Hardware Enclave Guard (Amazon & Shopify Standard)
- **Status**: ACCEPTED & ENFORCED
- **Date**: 2026-10-04
- **Context**: 
  Apple Pay is fundamentally tied to Apple's proprietary **Secure Enclave** hardware chip and is only accessible via Safari on iPhone, iPad, Apple Watch, and macOS (`window.ApplePaySession.canMakePayments()`). Attempting to run Apple Pay on Windows, Android, Chrome, or Brave results in browser API errors or invalid fallbacks to generic autofill dialogs.
- **Decision**: 
  Implement the Tier-1 e-commerce standard (Shopify / Amazon):
  1. Detect capability via `FoldTechPayments.isApplePayAvailable()`.
  2. **If non-Apple device (Windows, Android, etc.)**: Never trigger Apple Pay sessions or fake browser sheets. Display the dedicated device notice: *"Apple Pay requires Safari on iOS or macOS with Apple Wallet"* and provide immediate 1-click buttons to switch to **Card** or **PayPal**.
  3. **If genuine Apple device**: Launch real `new ApplePaySession(3, paymentRequest)`.
- **Consequences & Invariants**: 
  - Never use `window.PaymentRequest` as a fake fallback for Apple Pay on non-Apple hardware.
  - Non-Apple users must always be seamlessly routed to Card or PayPal without dead ends.

---

## ADR-003: Official Google Pay SDK (`pay.js`) Integration
- **Status**: ACCEPTED & ENFORCED
- **Date**: 2026-10-04
- **Context**: 
  Google Pay must operate using official Google infrastructure to ensure device safety and customer trust across Chromium, Edge, and Android devices.
- **Decision**: 
  Load `https://pay.google.com/gp/p/js/pay.js` asynchronously. When the customer clicks **Pay with Google Pay**, invoke `googlePaymentsClient.loadPaymentData()`.
  - If the user cancels the dialog (`err.statusCode === 'CANCELED'`), cleanly terminate without error alerts and keep the checkout form active.
  - If Google Pay returns authorized data, populate buyer information and finalize order.
  - If Google Pay is unavailable or fails, display an informative guidance message directing the user to Credit / Debit Card.

---

## ADR-004: Authentic PayPal Smart Buttons SDK vs. Static Prompts
- **Status**: ACCEPTED & ENFORCED
- **Date**: 2026-10-04
- **Context**: 
  Early mock code used JavaScript `prompt()` asking for an email and automatically assumed order completion. This violated real payment flows.
- **Decision**: 
  Integrate the official PayPal Smart Buttons SDK:
  `<script src="https://www.paypal.com/sdk/js?client-id=test&currency=USD&components=buttons"></script>`.
  - Order completion is strictly wired to `onApprove: function(data, actions) { return actions.order.capture().then(...); }`.
  - If PayPal buttons fail to render due to browser privacy shields or adblockers, provide an inline fallback advising the customer to pay with Credit / Debit Card.
  - All manual prompts or redirect auto-completions are strictly eliminated.

---

## ADR-005: PCI-DSS Compliant Card Validation (Luhn Checksum, Expiry & CVV)
- **Status**: ACCEPTED & ENFORCED
- **Date**: 2026-10-04
- **Context**: 
  Credit/debit card processing requires rigorous client-side format checks before submission to prevent invalid authorizations.
- **Decision**: 
  Implement comprehensive validation:
  1. **Luhn Algorithm (`validateCardNumberLuhn`)**: Validates mathematical integrity of 13-19 digit PANs.
  2. **Expiration Logic (`validateCardExpiry`)**: Parses `MM/YY`, checks month boundaries (1-12), and ensures the date is in the future.
  3. **CVV Length (`validateCardCvc`)**: 3 digits for Visa/Mastercard/Discover, 4 digits for Amex.
  4. **Card Brand Detection (`detectCardBrand`)**: Automatically highlights active Mastercard, Visa, Amex, or Discover logos based on card prefix.
  5. **Submission State**: Button displays a loading spinner (`Authorizing with Secure Gateway...`) before showing the post-purchase confirmation.

---

## ADR-006: Direct Non-Custodial Cryptocurrency Settlement
- **Status**: ACCEPTED & ENFORCED
- **Date**: 2026-10-04
- **Context**: 
  Fold Tech Studio supports direct cross-border crypto settlement without intermediary banking lockouts.
- **Decision**: 
  Provide non-custodial treasury options:
  - **TON Network**: USDT (`UQD2KXI7kwyDXr5kJh8VmDcktjI4awKSjCQ5R_G0z662uZRo`)
  - **Solana Network**: USDC (`JC6P8F1AK3hitgDK9Nj1Tb2svA3KcwHcj6VvDPB5tg76`)
  Includes dynamic QR code generation, 1-click clipboard copy with animated toast, and optional transaction hash input for ledger reconciliation.

---

## ADR-007: Multi-Repo & GitHub Pages Sync Pipeline
- **Status**: ACCEPTED & ENFORCED
- **Date**: 2026-10-04
- **Context**: 
  The project is deployed to GitHub Pages via `https://github.com/Ezana-Takele/foldtech-studio.git` on branch `main`, while mirrored locally in assessment directories. Stale caches or desynchronized mirrors can cause older code versions to re-emerge.
- **Decision**: 
  Whenever changes are made to `payment.js` or `index.html`:
  1. Run `node -c payment.js` syntax validation.
  2. Synchronize all mirror targets:
     - `c:\Users\lenovo\Desktop\assessment\docs\`
     - `c:\Users\lenovo\Desktop\assessment\`
     - `c:\Users\lenovo\Desktop\crypto-dropship-automation\public\`
  3. Commit and push directly to `origin/main` on `foldtech-studio` to update live GitHub Pages (`https://ezana-takele.github.io/foldtech-studio/`).

---

## ADR-008: Dedicated Local Asset Hosting for 24 Flagship Products
* **Status:** Accepted
* **Context:** Stock photography from external CDNs led to generic workspace scenes rather than exact physical products, causing buyer confusion and slow load times.
* **Decision:**
  - Scraped and rendered high-definition commercial product assets for all 24 items (`images/p1.jpg` through `images/p24.jpg`).
  - Saved directly to local `images/` directory in GitHub Pages repository for sub-100ms load times and 0% broken CDN rate.
  - Retained graceful fallback URLs in `PRODUCTS` schema.

---

## ADR-009: Stealth Owner Portal & Financial Data Privacy
* **Status:** Accepted
* **Context:** The public footer link to `[Store Admin Dashboard & Payout Tracker]` was accessible to any customer, exposing wholesale costs and analytics.
* **Decision:**
  - Removed public admin button from the footer for standard visitors (`#ownerPortalFooterTrigger` hidden by default).
  - Gated executive access exclusively behind:
    1. Secret URL query parameter: `https://ezana-takele.github.io/foldtech-studio/?admin=ezana` (sets `foldtech_is_owner` and unlocks dashboard).
    2. Hotkey: `Ctrl + Shift + A` (or `Cmd + Shift + A`).
    3. Triple-click on footer brand icon.
    4. Master PIN security check (`2026`).
  - Purged development test orders and test payout figures, ensuring verified starting state of 0 orders, $0.00 USD, and 0 ETB.
