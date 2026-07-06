# Category-Based Pricing & Charge Redesign — Audit Report

**Date:** 2026-07-07  
**Audited by:** Kiro AI  
**Scope:** Phases 1–4 of the new category-based pricing and charge redesign  
**Backend build:** ✅ CLEAN (`tsc --noEmit` exits 0)

---

## 1. Overview of What Changed

The redesign introduced 5 major areas of change across backend, admin web, and Flutter app.

### 1.1 New PricingModel Enum

File: `backendapi/src/common/enums/pricing-model.enum.ts`

Five models supported:
- `FIXED` — flat price for the job
- `HOURLY` — rate per hour (needs `estimatedHours`)
- `DAILY` — rate per day (needs `estimatedDays`)
- `PER_UNIT` — rate per unit (e.g. per item, per sqft)
- `QUOTE_BASED` — provider submits itemized or lump-sum quote; no fixed rates

### 1.2 Schema Changes (Entities)

| Entity | What was added |
|--------|----------------|
| `ServiceCategory` | `pricingModels: PricingModel[]`, `defaultPricingModel?: PricingModel` |
| `ProviderService` | `pricingModel: PricingModel`, `unitRate: decimal` |
| `Booking` | `pricingModel: PricingModel`, `unitCount: decimal`, `gstAmount: decimal` |
| `Quote` | `items: QuoteItem[]` (OneToMany) |
| `QuoteItem` | New entity: `description`, `quantity`, `unitPrice`, `totalPrice`, `quote FK` |

### 1.3 Business Logic Changes

- **`recalculateTotals`** (bookings) — Replaced "guess from non-null rate" with explicit `model` switch. Falls back via `inferPricingModelFromRates()` for old bookings.
- **`acceptQuote`** — Now sets `gstAmount` and `convenienceFee` on the booking immediately at acceptance time (previously these were deferred to completion).
- **`resolveCommission`** (CommissionService) — Correct priority chain: provider → category → global → default (fixed previous `|| categoryId` hack).
- **Invoice service** — Exposed `serviceAmount`, `convenienceFee`, `gstAmount`, `commissionRate`, `providerEarnings` in separate fields instead of embedding in a single total.

### 1.4 Admin Web Changes

- `Categories.tsx` — Multi-select checkboxes for pricing models, default model dropdown, chips in table.
- `types/index.ts` — `Booking` interface gains `commissionAmount`, `providerAmount`, `convenienceFee`, `gstAmount`, `pricingModel`.

### 1.5 Flutter Changes

- `provider_services_screen.dart` — Category-aware rate fields; only shows inputs allowed by category's `pricingModels`; pricing model dropdown.
- `provider_charges_screen.dart` — NEW screen: add/remove `BookingCharge` line items during an active booking.
- Live net-payout preview widget inside the service form dialog.
- `ServiceCategory` model, `ProviderService` model, `user.dart` updated for new fields.

---

## 2. Test Results

### 2.1 Backend Unit Tests

```
npm run test (jest --no-coverage)
```

| Test Suite | Result | Notes |
|-----------|--------|-------|
| `quotes.service.spec.ts` | ✅ 31/31 PASS | All new quote flows work correctly |
| `platform-fees.service.spec.ts` | ✅ PASS | Fee calculation unchanged |
| `payments.service.spec.ts` | ✅ PASS | Payment flows unaffected |
| `wallets.service.spec.ts` | ✅ PASS | |
| `ledger.service.spec.ts` | ✅ PASS | |
| `admin-refunds.service.spec.ts` | ✅ PASS | |
| `admin-payment-gateways.service.spec.ts` | ✅ PASS | |
| `reviews.service.spec.ts` | ✅ PASS | |
| `notifications.service.spec.ts` | ✅ PASS | |
| `subscriptions.service.spec.ts` | ✅ PASS | |
| `advertisements.service.spec.ts` | ✅ PASS | |
| `webhooks.service.spec.ts` | ✅ PASS | |
| `soft-block.service.spec.ts` | ✅ PASS | |
| `app.controller.spec.ts` | ✅ PASS | |
| **`services.service.spec.ts`** | ❌ FAIL | Pre-existing: missing `ProviderBusySlotRepository` mock (added in Phase 1 when busy-slots feature landed). Not introduced by pricing redesign. |
| **`customer-feedbacks.service.spec.ts`** | ❌ 3 FAIL | Pre-existing: test expects `booking: true` but service now uses `booking: { customer: { user: true } }` (richer relation). Test not updated after service change. |
| **`chat.gateway.spec.ts`** | ❌ FAIL | Pre-existing: missing `PresenceService` mock (PresenceService was added to ChatGateway in an earlier phase). |

**Summary:** 0 new test failures introduced by the pricing redesign. All failures are pre-existing issues from earlier phases.

### 2.2 Backend Build

```
npx tsc --noEmit
```
**Result: ✅ EXIT 0 — No TypeScript errors.**

---

## 3. Calculation Analysis

### 3.1 `acceptQuote` — Quote Acceptance (quotes.service.ts)

```typescript
const serviceAmount = Number(quote.amount);

const feeResult = await this.platformFeesService.getConvenienceFee(
  serviceAmount, promoCode, userId
);
const gstRate = parseFloat(process.env.GST_RATE || '0.18');
const gstAmount = Math.round(serviceAmount * gstRate * 100) / 100;

savedBooking.totalAmount = serviceAmount + feeResult.finalFee + gstAmount;
savedBooking.convenienceFee = feeResult.finalFee;
savedBooking.gstAmount = gstAmount;
```

**Assessment: ✅ CORRECT**
- GST applied only to `serviceAmount` (the agreed quote), not to `convenienceFee` — correct per Indian GST treatment where platform fee may have its own separate GST treatment.
- Total = serviceAmount + convenienceFee + gstAmount — correct.
- `Math.round(...* 100) / 100` prevents decimal drift.
- Commission/providerAmount NOT set here (correctly deferred to `recalculateTotals` on COMPLETED).

### 3.2 `recalculateTotals` — Booking Completion (bookings.service.ts)

```typescript
// Base amount determined by pricing model
let baseAmount = 0;
if (hasQuote) {
  baseAmount = Number(booking.quote.amount);        // Uses stored quote amount
} else if (hasService) {
  // switch on model → HOURLY/DAILY/PER_UNIT/FIXED/QUOTE_BASED
}

// + additional service items
// + bundle discount (if > 1 service)
// + emergency multiplier

// serviceAmount = baseAmount + extra provider charges (not convenience_fee/gst)
const serviceAmount = baseAmount + charges.filter(not fee/gst).sum();

// Convenience fee recalculated on final serviceAmount
const fee = await platformFeesService.getConvenienceFee(serviceAmount);
booking.convenienceFee = fee.finalFee;

// GST on service amount (env: GST_RATE default 0.18)
const gstRate = parseFloat(process.env.GST_RATE || '0.18');
const gstAmount = Math.round(serviceAmount * gstRate * 100) / 100;
booking.gstAmount = gstAmount;

// Commission via resolveCommission (provider → category → global → default)
const commission = await commissionService.resolveCommission(
  serviceAmount, providerId, categoryId
);

// Final totals
booking.totalAmount = serviceAmount + fee.finalFee + gstAmount;
booking.commissionAmount = commission.amount;
booking.providerAmount = serviceAmount - commission.amount;  // provider pays commission
```

**Assessment: ✅ CORRECT**
- `providerAmount = serviceAmount - commission.amount` — Provider gets service revenue minus commission. GST is NOT deducted from provider (GST is collected from customer as part of `totalAmount`).
- The `upsertCharge` helper keeps `convenience_fee` and `gst` BookingCharge records in sync with the computed values.
- Old bookings without `pricingModel` column fall back via `inferPricingModelFromRates()` — backward compatible.

### 3.3 Invoice Service — `serviceAmount` Derivation ⚠️

**File:** `backendapi/src/invoices/invoices.service.ts`

```typescript
const convenienceFee = Number(booking.convenienceFee ?? 0);
const gstAmount = Number(booking.gstAmount ?? 0);
const totalAmount = Number(booking.totalAmount);
const serviceAmount = totalAmount - convenienceFee - gstAmount;  // ← BUG
```

**Assessment: ⚠️ KNOWN BUG (documented in design doc)**

This derivation `serviceAmount = totalAmount - convenienceFee - gstAmount` is **only correct if no extra provider charges have been added via `BookingCharge`**. When a provider adds extra charges during the job (e.g. materials cost), those charges increase `serviceAmount`, which in turn increases `totalAmount`. But `convenienceFee` and `gstAmount` are also recalculated on the updated `serviceAmount`. So:

```
totalAmount = (serviceAmount + extra_charges) + convenienceFee(on new SA) + gstAmount(on new SA)
```

The subtraction in the invoice would produce:
```
serviceAmount_derived = totalAmount - convenienceFee - gstAmount
                      = (serviceAmount + extra_charges)   ← accidentally correct in this case!
```

Actually on second analysis: since `convenienceFee` and `gstAmount` stored on the booking are already computed against the final `serviceAmount` (which includes extra charges), the subtraction does happen to recover the correct `serviceAmount`. **However**, it fails if `totalAmount` was ever manually set without also updating `convenienceFee`/`gstAmount` (e.g. for old bookings migrated without those columns, where both would be 0).

**Better fix:** Store `serviceAmount` explicitly as a column on `Booking` (or derive it from `providerAmount + commissionAmount`):
```typescript
// Reliable alternative:
const serviceAmount = Number(booking.providerAmount ?? 0) + Number(booking.commissionAmount ?? 0);
```
This works because `providerAmount = serviceAmount - commission` and `commissionAmount = commission`, so their sum is always `serviceAmount`.

**Risk level:** Low for new bookings going through the new flow. Medium for old bookings where `gstAmount`/`convenienceFee` columns are 0 (invoice will show inflated serviceAmount).

### 3.4 Flutter Payout Preview — ⚠️ GST Deduction Bug

**File:** `frontendapp/lib/screens/provider_services_screen.dart`

```dart
Widget _buildNetPayoutPreview() {
  final amount = _computedServiceAmount();
  final gst = amount * 0.18;          // ← GST calculated
  final commission = amount * 0.10;
  final net = amount - gst - commission;  // ← GST deducted from provider!
  ...
}
```

**Assessment: ❌ WRONG CALCULATION**

GST is **customer-paid** — it is collected from the customer on top of the service amount. The provider never pays GST from their own pocket. The correct provider earnings calculation is:

```
Provider earns = serviceAmount - commission
```

NOT:
```
Provider earns = serviceAmount - GST - commission   ← WRONG
```

The preview shows the provider earning less than they actually will, which is misleading and could cause providers to set higher rates to compensate for a deduction that doesn't exist.

**Correct implementation:**
```dart
Widget _buildNetPayoutPreview() {
  final amount = _computedServiceAmount();
  if (amount <= 0) return const SizedBox.shrink();
  final gst = amount * 0.18;          // shown as info (paid by customer)
  final commission = amount * 0.10;
  final net = amount - commission;    // ← provider only loses commission
  ...
}
```

The GST line can still be shown in the preview as "GST (18%) — paid by customer" to be informative, but it must NOT be subtracted from the provider's earnings.

---

## 4. Overflow / Precision Analysis

All monetary calculations use the `Math.round(value * 100) / 100` pattern, which rounds to 2 decimal places correctly for INR. No floating-point accumulation issues found.

| Location | Pattern Used | Safe? |
|----------|-------------|-------|
| `acceptQuote` gstAmount | `Math.round(serviceAmount * gstRate * 100) / 100` | ✅ |
| `recalculateTotals` gstAmount | `Math.round(serviceAmount * gstRate * 100) / 100` | ✅ |
| `getConvenienceFee` baseFee | `Math.round(baseFee * 100) / 100` | ✅ |
| `getConvenienceFee` finalFee | `Math.max(0, Math.round((baseFee - discount) * 100) / 100)` | ✅ |
| `QuoteItemsService` totalPrice | `Math.round(quantity * unitPrice * 100) / 100` | ✅ |
| TypeORM entity columns | `decimal(10,2)` — DB-level precision | ✅ |
| Flutter payout preview | Plain Dart `double` multiplication, no rounding for display | ⚠️ Minor: `toStringAsFixed(0)` truncates (not rounds) sub-rupee values. Low risk. |

**No overflow issues found.** All values use `decimal(10,2)` columns (max 99,999,999.99) which is sufficient for Indian service marketplace amounts.

---

## 5. Pre-Existing Test Issues (Not Caused by This Redesign)

These 3 test suite failures were present before the pricing redesign and need separate fixes:

### 5.1 `services.service.spec.ts` — Missing `ProviderBusySlotRepository`

When `ProviderBusySlot` was introduced (Phase 1 of the busy-slots feature), `ServicesService` gained a new constructor dependency but the test file was not updated.

**Fix needed:** Add to test providers array:
```typescript
{ provide: getRepositoryToken(ProviderBusySlot), useValue: makeRepoMock() },
```

### 5.2 `customer-feedbacks.service.spec.ts` — Stale Relation Expectation

Service changed `booking` relation from `true` to `{ customer: { user: true } }` to eager-load customer data (needed for the feedback screen to show who left the feedback). Tests still assert the old shape.

**Fix needed:** Update 3 test assertions:
```typescript
// Old (in test):
relations: { booking: true, customer: { user: true } }

// New (match service):
relations: { booking: { customer: { user: true } }, customer: { user: true } }
```

### 5.3 `chat.gateway.spec.ts` — Missing `PresenceService`

When `PresenceService` was injected into `ChatGateway` for online-status tracking, the spec was not updated.

**Fix needed:** Add to test providers array:
```typescript
{ provide: PresenceService, useValue: { setUserOnline: jest.fn(), setUserOffline: jest.fn(), isUserOnline: jest.fn() } },
```

---

## 6. Summary of Bugs Found

| # | Severity | Location | Bug | Status |
|---|----------|----------|-----|--------|
| 1 | ⚠️ Medium | `invoices.service.ts` | `serviceAmount` derived by subtraction (`totalAmount - fee - gst`) — incorrect for old bookings where fee/gst columns are 0 | ✅ **Fixed** — now uses `providerAmount + commissionAmount` with fallback |
| 2 | ❌ High | Flutter `provider_services_screen.dart` `_buildNetPayoutPreview` | GST incorrectly deducted from provider earnings (`net = amount - gst - commission`). GST is customer-paid. | ✅ **Fixed** — `net = amount - commission`. GST shown as info note only. |
| 3 | 🔧 Test | `services.service.spec.ts` | Missing `ProviderBusySlotRepository`, `SettingsService`, `PresenceService` mocks | ✅ **Fixed** |
| 4 | 🔧 Test | `customer-feedbacks.service.spec.ts` | Test expects `booking: true`, service now uses `booking: { customer: { user: true } }` | ✅ **Fixed** |
| 5 | 🔧 Test | `chat.gateway.spec.ts` | Missing `PresenceService` mock + `gateway.server` not assigned in test setup | ✅ **Fixed** |

---

## 7. What Was Done Correctly

- ✅ `recalculateTotals` correctly uses `quote.amount` as base for QUOTE_BASED bookings (no rate-card override).
- ✅ Commission priority chain `resolveCommission` is correct: provider → category → global → default.
- ✅ GST is always applied on `serviceAmount` only, not on `convenienceFee`.
- ✅ `providerAmount = serviceAmount - commission` correctly excludes GST (provider doesn't pay GST).
- ✅ All decimal calculations use `Math.round(...* 100) / 100`.
- ✅ `recalculateTotals` no longer early-returns for quote-based bookings — commission and providerAmount are now computed at completion.
- ✅ `upsertCharge` keeps `convenience_fee` and `gst` BookingCharge rows in sync.
- ✅ Backward compatibility: old bookings without `pricingModel` fall back via `inferPricingModelFromRates()`.
- ✅ Backend TypeScript build is clean.
- ✅ 31/31 `quotes.service.spec.ts` tests pass.

---

## 8. Recommended Fixes — All Applied ✅

### Fix 1: Invoice `serviceAmount` — Use `providerAmount + commissionAmount` ✅ DONE

In `backendapi/src/invoices/invoices.service.ts`:
```typescript
// APPLIED:
const derivedFromComponents = Number(booking.providerAmount ?? 0) + Number(booking.commissionAmount ?? 0);
const serviceAmount = derivedFromComponents > 0
  ? derivedFromComponents
  : totalAmount - convenienceFee - gstAmount; // fallback for legacy bookings
```

### Fix 2: Flutter Net Payout Preview — GST not deducted from provider ✅ DONE

In `frontendapp/lib/screens/provider_services_screen.dart`:
```dart
// APPLIED:
final net = amount - commission;  // GST is customer-paid, not deducted from provider
// GST shown as info note: "GST 18% (₹X) is added to customer's total"
```

### Fix 3–5: Test Specs ✅ ALL DONE

- `services.service.spec.ts` — Added `ProviderBusySlotRepository`, `SettingsService`, `PresenceService` mocks; added default `find → []` for `busySlotRepo` and `bookingRepo`; fixed booking `scheduledDate` to use local time so `getHours()` matches slot times correctly.
- `customer-feedbacks.service.spec.ts` — Updated all 3 assertions from `booking: true` to `booking: { customer: { user: true } }`.
- `chat.gateway.spec.ts` — Added `PresenceService` mock; assigned `gateway.server` mock after module compile; corrected "accepts" and "extracts token" tests to pre-set `client.data.userId` (middleware sets this before `handleConnection` fires).

---

## 9. Final Verification

```
Test Suites: 22 passed, 22 total
Tests:       329 passed, 329 total
tsc --noEmit: EXIT 0 (clean)
```

---

## 10. Files Modified in This Redesign (Reference)

### Backend
- `src/common/enums/pricing-model.enum.ts` — New
- `src/services/entities/service-category.entity.ts` — Added `pricingModels`, `defaultPricingModel`
- `src/services/entities/provider-service.entity.ts` — Added `pricingModel`, `unitRate`
- `src/bookings/entities/booking.entity.ts` — Added `pricingModel`, `unitCount`, `gstAmount`
- `src/quotes/entities/quote-item.entity.ts` — New entity
- `src/quotes/entities/quote.entity.ts` — Added `items` relation
- `src/quotes/dto/create-quote.dto.ts` — Added `items[]`
- `src/quotes/quote-items.service.ts` — New
- `src/quotes/quote-items.controller.ts` — New
- `src/quotes/quotes.service.ts` — `acceptQuote` now sets `gstAmount`/`convenienceFee`; `createQuote` saves `QuoteItem`s
- `src/quotes/quotes.module.ts` — Registered QuoteItem repo + QuoteItemsService/Controller
- `src/quotes/quotes.service.spec.ts` — Updated (31 tests passing)
- `src/bookings/bookings.service.ts` — `recalculateTotals` rewrite with pricing model switch
- `src/commissions/commission.service.ts` — Added `resolveCommission` with correct priority
- `src/invoices/invoices.service.ts` — Exposes `serviceAmount`, `gstAmount`, `commissionRate`, `providerEarnings`
- `src/services/services.service.ts` — `validateProviderServicePricing` against category models
- `src/database/seed.ts` — 17 categories seeded with `pricingModels` + `defaultPricingModel`

### Admin Web
- `adminweb/src/pages/Categories.tsx` — Pricing model multi-select + chips
- `adminweb/src/types/index.ts` — Updated `Booking`, `ProviderService` interfaces

### Flutter
- `frontendapp/lib/screens/provider_services_screen.dart` — Category-aware rate fields + live payout preview
- `frontendapp/lib/screens/provider_charges_screen.dart` — New screen
- `frontendapp/lib/models/user.dart` — Updated `ServiceCategory` + `ProviderService` models
- `frontendapp/lib/main.dart` — Route for `ProviderChargesScreen`
