# Phase 08 — Payment Integration

## Goal

Wire up real payment collection so users can purchase Pro access through multiple channels: direct online sales (Stripe/LemonSqueezy), Mac App Store, and Microsoft Store. Each channel activates the existing license system — no new gating logic needed.

---

## Current State

The license system is fully implemented with:

- Ed25519 offline-verifiable license keys (`CC-PRO-{payload}.{signature}`)
- Feature-based licensing (per-feature unlock) and tier-based (full Pro)
- 14-day trial, activation/deactivation, persistence in `.cc-config.json`
- `handleAppStorePurchase()` exists in `lib/license-manager.js` but has no real store integration
- Electron IPC `purchase-pro` handler currently just opens a URL placeholder
- `scripts/generate-license-key.js` already supports `--features` flag for per-feature keys

### Already Complete

- `--features` flag in `generate-license-key.js` (supports `--features skillz,agentic`)
- `handleAppStorePurchase()` exported from `lib/license-manager.js`
- All 4 license API routes in `server.js` (`GET /api/license`, `POST activate/deactivate/trial`)
- Electron IPC bridge methods in `preload.js` (`getLicenseInfo`, `activateLicense`, `purchasePro`, `restorePurchases`, `onPurchaseComplete`)
- `UpgradePrompt.jsx` with trial, key activation, and platform-aware purchase button

### Not Yet Implemented

- `POST /api/license/appstore` receipt validation endpoint
- Electron `inAppPurchase` API integration (current handler just opens URL)
- `CC_DISTRIBUTION` build-time flag for channel detection
- `electron-builder.config.js` Mac App Store (`mas`) target
- Distribution-aware purchase button text in UpgradePrompt
- External: payment landing page and webhook server

---

## Payment Channels

### Channel 1: Direct Online Sales (Stripe or LemonSqueezy)

**Why:** Highest margin (~5% vs 30% app store cut), works for all distribution formats (web, Electron, sideloaded), you control the customer relationship.

**Architecture:**

```
User clicks "Buy Pro" → Opens th3rdai.com/pro
  → Stripe Checkout / LemonSqueezy hosted page
  → Payment succeeds
  → Webhook fires to your API server
  → Server generates Ed25519 license key
  → Key emailed to customer + shown on success page
  → User pastes key in Settings → License → Activate
```

**Implementation Tasks:**

1. **Payment landing page** (`th3rdai.com/pro`)
   - Product description, pricing, testimonials
   - "Buy Now" button → Stripe Checkout session or LemonSqueezy checkout
   - Success page that displays the generated license key
   - Copy-to-clipboard button for the key

2. **License generation webhook server** (separate repo/service)
   - Express or serverless function (Vercel/Netlify/AWS Lambda)
   - Listens for purchase webhook (`checkout.session.completed` for Stripe, or LemonSqueezy equivalent)
   - **Must verify webhook signature** — Stripe: `stripe.webhooks.constructEvent(body, sig, secret)`, LemonSqueezy: HMAC-SHA256 signature in `X-Signature` header
   - Extracts customer email from webhook payload
   - Calls `generate-license-key.js` logic to create a signed key (requires the Ed25519 private key on the server)
   - Stores key + customer record in a simple DB (SQLite/Postgres)
   - Sends key via email (SendGrid/Resend/SES)
   - Returns key to the success page via redirect URL param

3. **Key management dashboard** (optional, future)
   - Admin page to view issued keys, revoke, extend expiry
   - Customer self-service: re-send key, view expiry

**Vendor comparison:**

|                      | Stripe                                | LemonSqueezy                      |
| -------------------- | ------------------------------------- | --------------------------------- |
| Fees                 | 2.9% + $0.30                          | 5% + $0.50 (verify current rates) |
| Tax handling         | You handle (or use Stripe Tax add-on) | Built-in global tax compliance    |
| Webhook DX           | Excellent, well-documented            | Good, simpler                     |
| License key delivery | Build yourself                        | Built-in license key feature      |
| Complexity           | More control, more work               | Less work, less control           |
| Refund handling      | Webhooks for `charge.refunded`        | Webhooks for refund events        |

**Recommendation:** LemonSqueezy for v1 — it has built-in license key management, handles global tax, and is purpose-built for software sales. Migrate to Stripe later if you need more control. **Verify current LemonSqueezy fees before committing** — rates may have changed.

---

### Channel 2: Mac App Store (In-App Purchase)

**Why:** Required if distributing via Mac App Store. Users expect native purchase flow. Apple handles payments, refunds, tax.

**Architecture:**

```
User clicks "Purchase in App Store" in UpgradePrompt
  → Electron inAppPurchase.purchaseProduct('cc_pro_lifetime')
  → Apple payment sheet appears
  → User completes purchase
  → 'transactions-updated' event fires
  → App validates receipt locally (v1) or via Apple's API (v2)
  → Calls handleAppStorePurchase() → tier = 'pro', features = all pro features
  → 'purchase-complete' IPC sent to renderer → UI updates immediately
```

**Purchase model:** Non-consumable (one-time purchase, lifetime access). Not a subscription — avoids renewal complexity and App Store subscription requirements.

**Implementation Tasks:**

1. **App Store Connect setup**
   - Register app in App Store Connect
   - Create In-App Purchase product: `cc_pro_lifetime` (Non-Consumable)
   - Set pricing tier ($X.99)
   - Create sandbox test accounts for testing

2. **Distribution channel detection** (prerequisite for all store integrations)

   Add build-time flag to distinguish distribution channels:

   ```javascript
   // electron/main.js — detect at runtime
   const CC_DISTRIBUTION = process.env.CC_DISTRIBUTION || "direct";
   // Values: 'direct', 'appstore-mac', 'appstore-win'

   // Expose to renderer via IPC
   ipcMain.handle("get-distribution", () => CC_DISTRIBUTION);
   ```

   ```javascript
   // electron/preload.js — add to electronAPI
   getDistribution: () => ipcRenderer.invoke('get-distribution'),
   ```

   ```javascript
   // electron-builder.config.js — set per build target
   // Mac App Store build:
   env: {
     CC_DISTRIBUTION: "appstore-mac";
   }
   // Direct build:
   env: {
     CC_DISTRIBUTION: "direct";
   }
   ```

3. **Electron main process** (`electron/main.js`)

   Replace the current placeholder `purchase-pro` handler:

   ```javascript
   const { inAppPurchase } = require("electron");

   // Only use inAppPurchase for App Store builds
   if (CC_DISTRIBUTION === "appstore-mac") {
     // Check if IAP is available
     ipcMain.handle("purchase-pro", async () => {
       if (!inAppPurchase.canMakePayments()) {
         return {
           success: false,
           error: "Purchases not available on this device",
         };
       }
       // Purchase is async — result comes via 'transactions-updated' event
       inAppPurchase.purchaseProduct("cc_pro_lifetime");
       return { success: true, action: "purchase-initiated" };
     });

     ipcMain.handle("restore-purchases", async () => {
       inAppPurchase.restoreCompletedTransactions();
       return { success: true };
     });

     // Listen for transaction updates
     inAppPurchase.on("transactions-updated", (event, transactions) => {
       for (const tx of transactions) {
         switch (tx.transactionState) {
           case "purchased":
           case "restored":
             if (tx.productIdentifier === "cc_pro_lifetime") {
               // Activate Pro via server API
               fetch(`http://localhost:${actualPort}/api/license/appstore`, {
                 method: "POST",
                 headers: { "Content-Type": "application/json" },
                 body: JSON.stringify({ receipt: tx.transactionReceipt }),
               }).catch((err) =>
                 console.error("[Main] App Store activation error:", err),
               );
               // Notify renderer
               mainWindow?.webContents.send("purchase-complete", {
                 success: true,
                 tier: "pro",
               });
             }
             // Must finish the transaction or Apple will re-deliver it
             inAppPurchase.finishTransactionByDate(tx.transactionDate);
             break;

           case "failed":
             mainWindow?.webContents.send("purchase-complete", {
               success: false,
               error: tx.errorMessage || "Purchase cancelled or failed",
             });
             break;

           case "purchasing":
             // Transaction in progress — no action needed
             break;

           case "deferred":
             // Ask to Buy / parental approval pending
             mainWindow?.webContents.send("purchase-complete", {
               success: false,
               error: "Purchase is pending approval",
               deferred: true,
             });
             break;
         }
       }
     });
   } else {
     // Direct distribution — open purchase page
     ipcMain.handle("purchase-pro", async () => {
       shell.openExternal("https://th3rdai.com/pro");
       return { success: true, action: "opened-purchase-page" };
     });

     ipcMain.handle("restore-purchases", async () => {
       return {
         success: false,
         error: "Restore is only available for App Store purchases",
       };
     });
   }
   ```

4. **Receipt validation endpoint** (`server.js`)

   ```javascript
   // POST /api/license/appstore — called by Electron after purchase
   app.post("/api/license/appstore", (req, res) => {
     const { receipt } = req.body || {};
     // v1: Trust the Electron transaction event (receipt is informational)
     // v2: Validate receipt with Apple's verifyReceipt API
     //     POST https://buy.itunes.apple.com/verifyReceipt (production)
     //     POST https://sandbox.itunes.apple.com/verifyReceipt (sandbox)
     const result = handleAppStorePurchase();
     log("INFO", `App Store purchase activated: tier=${result.tier}`);
     res.json(result);
   });
   ```

   **v1 security note:** Local-only receipt validation is acceptable for launch since the Electron app controls the transaction flow. Receipt spoofing requires modifying the app binary, which is mitigated by code signing.

5. **Build configuration** (`electron-builder.config.js`)
   - Add `mas` target for Mac App Store builds
   - Set `hardenedRuntime: true`
   - Add entitlements file for App Store sandbox:
     ```xml
     <!-- build/entitlements.mas.plist -->
     <key>com.apple.security.app-sandbox</key><true/>
     <key>com.apple.security.network.client</key><true/>
     <key>com.apple.security.files.user-selected.read-write</key><true/>
     <key>com.apple.application-identifier</key><string>TEAM_ID.com.th3rdai.codecompanion</string>
     ```
   - Provisioning profile from Apple Developer account

6. **Restore purchases flow**
   - "Restore Purchases" button in Settings → License (IPC already in preload.js)
   - Calls `inAppPurchase.restoreCompletedTransactions()`
   - Handles `restored` transaction state same as `purchased`
   - **Apple requirement:** Must be visible and functional or app will be rejected

7. **Update UpgradePrompt for distribution channel awareness**

   ```jsx
   // Replace current isElectron check with distribution-aware logic
   const [distribution, setDistribution] = useState("web");
   useEffect(() => {
     if (window.electronAPI?.getDistribution) {
       window.electronAPI.getDistribution().then(setDistribution);
     }
   }, []);

   // Render appropriate purchase button
   {
     distribution === "appstore-mac" ? (
       <button onClick={() => window.electronAPI?.purchasePro?.()}>
         Purchase in App Store
       </button>
     ) : distribution === "appstore-win" ? (
       <button onClick={() => window.electronAPI?.purchasePro?.()}>
         Purchase in Microsoft Store
       </button>
     ) : distribution === "direct" ? (
       <button onClick={() => window.electronAPI?.purchasePro?.()}>
         Buy Pro at th3rdai.com
       </button>
     ) : (
       <p>
         Get a license key at <span>th3rdai.com</span>
       </p>
     );
   }
   ```

**Apple requirements:**

- Must include "Restore Purchases" button (App Store rejection if missing)
- Must handle interrupted purchases gracefully (deferred state for Ask to Buy)
- Must call `finishTransactionByDate()` or Apple re-delivers the transaction
- Sandbox testing before submission
- App Review can take 1-7 days

---

### Channel 3: Microsoft Store

**Why:** Required if distributing via Microsoft Store. Similar to Mac App Store but Windows-specific.

**Architecture:**

```
User clicks "Purchase in Microsoft Store"
  → Windows.Services.Store API via Electron native module
  → Microsoft payment flow
  → Purchase confirmed
  → handleAppStorePurchase() called
```

**Implementation Tasks:**

1. **Microsoft Partner Center setup**
   - Register app in Partner Center
   - Create add-on: `cc_pro_lifetime` (Durable with unlimited lifetime)
   - Set pricing

2. **Windows Store API integration**
   - Use `windows-store` npm package or native Node addon
   - Check license status on startup via `StoreContext.getAppLicenseAsync()`
   - Purchase flow: `StoreContext.requestPurchaseAsync('cc_pro_lifetime')`
   - Handle purchase result states (Succeeded, AlreadyPurchased, NotPurchased, NetworkError)

3. **Build configuration**
   - Set `CC_DISTRIBUTION=appstore-win`
   - Enable `appx` target in electron-builder
   - Sign with Microsoft certificate from Partner Center
   - Package identity must match Partner Center registration

**Note:** Microsoft Store integration is more complex than Mac due to native module requirements. **Recommend deferring to Phase 8c** and initially distributing Windows builds as direct downloads with LemonSqueezy/Stripe keys.

---

## Recommended Rollout Order

| Priority | Channel                     | Effort   | Revenue Impact                        |
| -------- | --------------------------- | -------- | ------------------------------------- |
| **1**    | Direct sales (LemonSqueezy) | 1-2 days | Immediate — works for all users       |
| **2**    | Mac App Store IAP           | 3-5 days | High — Mac users expect it            |
| **3**    | Microsoft Store             | 3-5 days | Medium — can use direct sales instead |

### Phase 8a: Direct Sales (LemonSqueezy)

- Set up LemonSqueezy product + license key delivery
- Build `th3rdai.com/pro` landing page
- Wire webhook for automatic key generation (with signature verification)
- Update "Buy Pro" links in UpgradePrompt and Settings
- Handle refund webhooks (deactivate key on refund)

### Phase 8b: Mac App Store IAP

- Distribution channel detection (`CC_DISTRIBUTION` flag)
- App Store Connect product setup + sandbox accounts
- Electron `inAppPurchase` integration (replace placeholder handlers)
- `POST /api/license/appstore` receipt validation endpoint
- Distribution-aware UpgradePrompt buttons
- Restore Purchases flow
- Sandbox testing → App Store submission

### Phase 8c: Microsoft Store (Future)

- Partner Center setup
- Windows Store API integration via native module
- APPX packaging and signing
- Store submission

---

## Feature-Based Licensing (Already Implemented)

The license system supports per-feature keys in addition to full Pro:

```javascript
// Full Pro key (legacy — grants all pro features)
{ email, tier: 'pro', exp, nonce }

// Feature-specific key (grants only listed features)
{ email, features: ['skillz', 'agentic'], exp, nonce }
```

Generate feature-specific keys:

```bash
node scripts/generate-license-key.js --email user@example.com --features skillz,agentic --expires 2027-01-01
```

This enables future pricing models:

- **Individual feature packs** — Buy just Skillz for $X
- **Bundle tiers** — Basic (1 feature), Pro (all features)
- **Time-limited feature trials** — Unlock Agentic for 7 days
- **Promotional keys** — Give away specific features for marketing

---

## Edge Cases & Error Handling

### Offline purchases

- **Direct sales:** Key is emailed, user activates later when app is open — no issue
- **App Store:** iOS/macOS queues the transaction and delivers it when the app next launches via `transactions-updated` event. The `inAppPurchase` listener must be registered at app startup (not lazily) to catch queued transactions

### Failed/interrupted transactions

- **Deferred (Ask to Buy):** Apple's parental approval flow. Show "Purchase pending approval" message, don't block the UI. Transaction completes later via `transactions-updated`
- **Network failure during purchase:** Apple retries automatically. Transaction arrives on next app launch
- **Payment method declined:** `failed` state received — show error, allow retry

### Refunds

- **Direct sales:** LemonSqueezy/Stripe sends refund webhook → webhook server should revoke the key (add to revocation list or mark expired in DB). App doesn't need to check in real-time — key stays active until next validation
- **App Store:** Apple handles refunds directly. For v1, no action needed (user keeps access). For v2, implement Server Notifications v2 to detect refunds and revoke via `deactivateLicense()`

### Key expiry and renewal

- Current model is **one-time purchase, time-limited key** (e.g., 1-year expiry)
- When key expires, `initLicense()` detects it and reverts to free tier — no data loss
- User must purchase a new key to renew (or key can be re-generated with extended expiry)
- **No auto-renewal** — keeps things simple, avoids subscription App Store requirements
- Future option: subscription model with auto-renewing keys via webhook

### Multiple devices

- **Direct sales:** Same key works on multiple devices (no device binding in v1). Acceptable for indie software — key sharing is low risk
- **App Store:** Tied to Apple ID, works across user's devices automatically via Restore Purchases
- **v2 device binding:** Hash machine ID into key payload, validate on activation. Limits to N devices per key

---

## Security Considerations

| Concern              | v1 (Launch)                                             | v2 (Hardened)                                         |
| -------------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| **Key sharing**      | Honor system — acceptable for indie launch              | Device binding (machine ID hash in payload)           |
| **Receipt spoofing** | Trust Electron transaction event (code-signed app)      | Server-side receipt validation via Apple's API        |
| **Webhook forgery**  | **Must verify signatures** — non-negotiable even for v1 | Same                                                  |
| **Key revocation**   | Not implemented — expired keys auto-revoke              | Revocation list (JSON file or API) checked on startup |
| **Refund abuse**     | No detection                                            | Webhook-driven key revocation on refund events        |
| **Binary tampering** | Code signing (Electron)                                 | Code signing + integrity checks                       |

**Critical for v1:** Webhook signature verification is the only non-deferrable security item. Without it, anyone can POST fake purchase events to your webhook server and generate free keys.

---

## Files to Create/Modify

### In This Codebase

| File                               | Changes                                                                                                                                                       | Phase |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `electron/main.js`                 | Replace placeholder `purchase-pro`/`restore-purchases` with `inAppPurchase` integration; add `get-distribution` IPC; register transaction listener at startup | 8b    |
| `electron/preload.js`              | Add `getDistribution` IPC bridge method                                                                                                                       | 8b    |
| `server.js`                        | Add `POST /api/license/appstore` receipt validation route                                                                                                     | 8b    |
| `src/components/UpgradePrompt.jsx` | Distribution-aware purchase button text; listen for `purchase-complete` IPC                                                                                   | 8b    |
| `src/components/SettingsPanel.jsx` | Add "Restore Purchases" button (visible only for App Store builds)                                                                                            | 8b    |
| `electron-builder.config.js`       | Add `mas` target, entitlements, `CC_DISTRIBUTION` env var per target                                                                                          | 8b    |
| `build/entitlements.mas.plist`     | New — Mac App Store sandbox entitlements                                                                                                                      | 8b    |

### External (Separate Repos/Services)

| Resource                 | Purpose                                                                      | Phase  |
| ------------------------ | ---------------------------------------------------------------------------- | ------ |
| `th3rdai.com/pro`        | Payment landing page with LemonSqueezy checkout                              | 8a     |
| License webhook server   | Receives purchase webhooks, generates + emails keys, stores customer records | 8a     |
| Key management dashboard | Admin: view/revoke/extend keys. Customer: re-send key                        | Future |
