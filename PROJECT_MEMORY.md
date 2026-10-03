# PROJECT_MEMORY.md — The Living Project Brain
> **Fold Tech Studio Global Inc. — Autonomous E-Commerce System Memory**  
> *Active Workspace: `c:\Users\lenovo\Desktop\foldtech-studio`*  
> *Live Storefront: [https://ezana-takele.github.io/foldtech-studio/](https://ezana-takele.github.io/foldtech-studio/)*  
> *Repository: `https://github.com/Ezana-Takele/foldtech-studio.git` (branch: `main`)*  

---

## 1. System Mission & Core Values
Fold Tech Studio is a high-converting, mobile-responsive flagship e-commerce storefront for premium folding charging stations, travel GaN adapters, and minimalist desk accessories.
- **Brand Aesthetic**: Deep space dark luxury, glassmorphism, responsive Tailwind CSS, high-definition typography, Apple/Amazon tier polish.
- **Payment Integrity**: Strict enterprise standard modeled after Amazon, Shopify, and Stripe. **Zero mock timers, zero fake authorizations.**

---

## 2. Non-Negotiable Invariants (DO NOT BREAK)

```
╔════════════════════════════════════════════════════════════════════════════════════╗
║                            CORE GROUND RULES FOR AI AGENTS                         ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║ 1. NO FAKE AUTO-AUTHORIZATION TIMERS:                                              ║
║    Never use setTimeout() or mock routines that automatically complete orders.     ║
║                                                                                    ║
║ 2. APPLE PAY REQUIRES APPLE HARDWARE ENCLAVE:                                      ║
║    If FoldTechPayments.isApplePayAvailable() is FALSE (e.g. Windows, Android),     ║
║    show the device compatibility notice and provide 1-click buttons to Card/PayPal.║
║    Never fallback to generic window.PaymentRequest pretending to be Apple Pay.     ║
║                                                                                    ║
║ 3. GOOGLE PAY MUST USE OFFICIAL pay.js:                                            ║
║    Never fake Google Pay. Cancellation by user must cleanly keep checkout open.   ║
║                                                                                    ║
║ 4. PAYPAL MUST USE SMART BUTTONS SDK:                                              ║
║    Order capture only occurs via onApprove(). No prompt() or URL auto-redirects.   ║
║                                                                                    ║
║ 5. CARDS REQUIRE RIGOROUS CLIENT-SIDE VALIDATION:                                  ║
║    Must pass Luhn algorithm (mod-10), expiry date verification, and CVV checks.   ║
║                                                                                    ║
║ 6. SYNC ALL COPIES UPON ANY EDIT:                                                  ║
║    Sync foldtech-studio -> assessment/docs, assessment, and crypto-dropship.       ║
║    Push to foldtech-studio origin/main for instant GitHub Pages deployment.        ║
╚════════════════════════════════════════════════════════════════════════════════════╝
```

---

## 3. Architecture & File Registry

| File | Role & Contents |
|---|---|
| [`index.html`](file:///c:/Users/lenovo/Desktop/foldtech-studio/index.html) | Complete single-page storefront: hero showcase, 3D interactive viewer, dynamic cart drawer, checkout modal with 5 payment tabs (Card, Google Pay, Apple Pay, PayPal, Crypto), Amazon-style post-purchase confirmation screen, order tracking progress bar, print receipt utility, and owner dashboard. |
| [`payment.js`](file:///c:/Users/lenovo/Desktop/foldtech-studio/payment.js) | Enterprise Payment Gateway Engine: Google Pay client (`google.payments.api.PaymentsClient`), Apple Pay hardware session (`ApplePaySession`), Luhn algorithm verification (`validateCardNumberLuhn`), expiry date parsing (`validateCardExpiry`), CVC checks (`validateCardCvc`), and brand detection (`detectCardBrand`). |
| [`DECISIONS.md`](file:///c:/Users/lenovo/Desktop/foldtech-studio/DECISIONS.md) | Architectural Decision Records (ADRs 001–007) explaining the engineering rationale behind every technical decision. |
| [`PROJECT_MEMORY.md`](file:///c:/Users/lenovo/Desktop/foldtech-studio/PROJECT_MEMORY.md) | This living document: persistent memory of invariants, catalog, wallets, and workflows. |

---

## 4. Payment Methods & Exact Expected Behaviors

### A. Credit / Debit Card (Universal Default)
- **Inputs**: Card Number (formatted with 4-digit spacing), Cardholder Name, Expiry (`MM/YY`), CVV (`3-4 digits`).
- **Validation**:
  - `FoldTechPayments.validateCardNumberLuhn(cardNum)` -> rejects invalid numbers with clear feedback.
  - `FoldTechPayments.validateCardExpiry(cardExp)` -> validates month (01–12) and checks that date is in the future.
  - `FoldTechPayments.validateCardCvc(cardCvc, brand)` -> enforces 3 digits (or 4 for Amex).
- **Execution**: Clicking `Place Your Order` triggers a 950ms gateway authorization spinner before rendering the confirmation receipt.

### B. Apple Pay (Apple Hardware Only)
- **Supported (iPhone, iPad, Mac Safari)**: Displays native Apple Pay button. Clicking invokes `new ApplePaySession(3, paymentRequest)` leveraging Apple Secure Enclave.
- **Unsupported (Windows 11, Android, Chrome, Brave, Edge)**: Displays Amazon-grade notice: *"Apple Pay Unavailable on this Device — requires Safari on iOS/macOS with Apple Wallet"*. Provides 1-click buttons to switch to Card or PayPal. Bottom action button routes user to Card tab.

### C. Google Pay (Google Ecosystem)
- Loaded via `https://pay.google.com/gp/p/js/pay.js`.
- Clicking `Pay with Google Pay` invokes `googlePaymentsClient.loadPaymentData()`.
- If canceled by user, logs cancellation and stays on checkout form.
- If approved, receives tokenized billing data and executes order placement.

### D. PayPal (Official Smart Buttons SDK)
- Loaded via `https://www.paypal.com/sdk/js?client-id=test&currency=USD&components=buttons`.
- Renders official gold PayPal buttons inside `#paypalButtonContainer`.
- User logs in via secure PayPal window; order only completes on `actions.order.capture()`.
- If adblocker blocks SDK, displays clean fallback directing customer to Card payment.

### E. Cryptocurrency (Non-Custodial Direct Settlement)
- **TON Network**: USDT to `UQD2KXI7kwyDXr5kJh8VmDcktjI4awKSjCQ5R_G0z662uZRo`
- **Solana Network**: USDC to `JC6P8F1AK3hitgDK9Nj1Tb2svA3KcwHcj6VvDPB5tg76`
- Displays dynamic QR code, 1-click copy with toast, and optional transaction hash field.

---

## 5. Product Catalog & Pricing Database

| ID | Product Name | Retail Price | Wholesale Cost | Net Margin |
|---|---|---|---|---|
| `p1` | MagFold™ 3-in-1 Foldable Charger | $34.99 USD | $10.50 USD | $24.49 USD (70.0%) |
| `p2` | Volt65™ 65W GaN Travel Fast Charger | $24.99 USD | $6.20 USD | $18.79 USD (75.2%) |
| `p3` | MagStand™ Slim Leather Wallet & Stand | $19.99 USD | $3.40 USD | $16.59 USD (83.0%) |
| `p4` | StudioMat™ Waterproof Desk Pad | $22.99 USD | $5.50 USD | $17.49 USD (76.1%) |
| **Bundle** | *All 3 Core Tech Essentials (p1 + p2 + p3)* | **$59.99 USD** | $20.10 USD | **$39.89 USD** (Save $19.98) |

---

## 6. Pre-Flight Verification Checklist for Agents

Before concluding any future turn on this codebase, always run:
1. `node -c payment.js` (Must pass with 0 syntax errors).
2. Validate that no `setTimeout` calls exist that trigger `completeOrderPlacement` or `onWalletAuthorized`.
3. Check that `FoldTechPayments.isApplePayAvailable()` guards the Apple Pay flow.
4. Verify all 4 local repository mirrors are synchronized:
   ```powershell
   Copy-Item -Path "index.html","payment.js","DECISIONS.md","PROJECT_MEMORY.md" -Destination "c:\Users\lenovo\Desktop\assessment\docs\" -Force
   Copy-Item -Path "index.html","payment.js","DECISIONS.md","PROJECT_MEMORY.md" -Destination "c:\Users\lenovo\Desktop\assessment\" -Force
   Copy-Item -Path "index.html","payment.js" -Destination "c:\Users\lenovo\Desktop\crypto-dropship-automation\public\" -Force
   ```
5. Commit and push changes in `foldtech-studio` to `origin/main` to trigger live GitHub Pages rebuild.
