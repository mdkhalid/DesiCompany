# Category-Based Pricing & Charge Redesign

Status: Design + Implementation plan (phased). Backend implementation in progress.

## 1. Goals

1. **Admin-controllable costing per category.** When a category is created/edited (admin web or API), the admin chooses which pricing models that category supports. This must work for categories added later — nothing is hardcoded in seed beyond sensible defaults.
2. **Stop forcing every provider into fixed/hourly/daily.** A provider's allowed rate fields are gated by the parent category's pricing models.
3. **Support quote-based categories** (Shifting, Pest Control, etc.) where the provider submits an itemized or lump-sum quote instead of a rate.
4. **Itemized quotes + provider-editable extra charges** (from earlier discussion) layered on top.
5. **Live net-payout preview** for providers (amount − commission − convenience fee) before they commit.
6. **No logic breakage** — existing bookings/quotes keep working; changes are additive + backward-compatible where possible.

## 2. Pricing Model Enum (5 models)

`backendapi/src/common/enums/pricing-model.enum.ts`

```
FIXED      // flat price for the job
HOURLY     // rate per hour (needs estimatedHours)
DAILY      // rate per day (needs estimatedDays)
PER_UNIT   // rate per unit (e.g. per item / per sqft)
QUOTE_BASED // provider submits a quote (itemized or lump-sum); no fixed rates
```

`ServiceCategory.pricingModels: PricingModel[]` (≥ 1 required).
`ServiceCategory.defaultPricingModel?: PricingModel` (optional, must be in `pricingModels`).

## 3. Schema Changes

### 3.1 ServiceCategory (`services/entities/service-category.entity.ts`)
- Add `pricingModels: PricingModel[]` stored as a `simple-array` (or `jsonb`) column. Default: `[FIXED, HOURLY, DAILY]` for backward compatibility.
- Add `defaultPricingModel: PricingModel` (nullable).

### 3.2 ProviderService (`services/entities/provider-service.entity.ts`)
- Add `pricingModel: PricingModel` (nullable for migration; validated on write).
- Keep `hourlyRate`, `dailyRate`, `fixedRate` (all nullable). Add `unitRate` (nullable) for `PER_UNIT`.
- Rule: only rate fields relevant to `pricingModel` are accepted; others ignored.

### 3.3 Booking (`bookings/entities/booking.entity.ts`)
- Add `pricingModel: PricingModel` (nullable) — replaces the "guess from non-null column" logic.
- Add `unitCount: number` (nullable) for `PER_UNIT` (`rate × unitCount`).
- Existing `totalAmount`, `commissionAmount`, `providerAmount`, `convenienceFee`, `estimatedHours`, `estimatedDays`, `charges` remain.

### 3.4 Quote → itemized items (quotes module)
- Add `QuoteItem` entity: `{ quoteId, label, quantity, rate, amount, order }`.
- `Quote.amount` stays as the total (sum of items, or the lump-sum for non-itemized quotes). `Quote.pricingModel` optional.
- `QUOTE_BASED` categories always go through this path.

### 3.5 BookingCharge (`bookings/entities/booking-charge.entity.ts`)
- Already exists (`chargeType, amount, description`). Provider-editable extra charges UI will use it. Add optional `pricingModel`/`meta` later if needed (out of scope for phase 1).

## 4. DTOs

### 4.1 Category DTOs
- `CreateCategoryDto` / `UpdateCategoryDto`: add `pricingModels: PricingModel[]` (≥1) and optional `defaultPricingModel`. Validate each value is in the enum.
- Backend category controller/service persists + returns these fields.

### 4.2 ProviderService DTOs (`create-provider-service.dto.ts`, `update-provider-service.dto.ts`)
- Add `pricingModel?: PricingModel` and `unitRate?`.
- Keep the three existing rate fields (optional).
- Validation (`services.service.ts`):
  - If `pricingModel` provided, it must be in the parent category's `pricingModels` (else 400).
  - The rate fields provided must match `pricingModel` (e.g. HOURLY requires `hourlyRate`; PER_UNIT requires `unitRate`; FIXED requires `fixedRate`; QUOTE_BASED requires none here — quote handles cost).
  - If `pricingModel` omitted, fall back to existing "at least one rate" rule for backward compatibility.

### 4.3 Quote DTOs
- `CreateQuoteDto`: keep `amount`; add optional `items: QuoteItemDto[]` and `pricingModel`.

## 5. recalculateTotals Rewrite (`bookings/bookings.service.ts:673-817`)

Replace the non-null priority guessing (lines 696-702) with:

```
const model = booking.pricingModel ?? inferFromRates(service);
let baseAmount = 0;
switch (model) {
  case HOURLY:  baseAmount = hourlyRate * (estimatedHours ?? 0); break;
  case DAILY:   baseAmount = dailyRate  * (estimatedDays  ?? 0); break;
  case PER_UNIT:baseAmount = unitRate   * (unitCount     ?? 0); break;
  case FIXED:   baseAmount = fixedRate; break;
  case QUOTE_BASED: baseAmount = quote?.amount ?? totalAmount; break; // preserve accepted quote
}
// + additional service items, bundle discount, emergency multiplier
// + convenience fee, commission (unchanged), providerAmount
```

A `inferFromRates()` helper keeps old bookings (no `pricingModel`) working with the previous priority.

## 6. Seed Defaults (`database/seed.ts:403-516`)

Assign sensible `pricingModels` per seeded category (admin can override anytime):

| Category | pricingModels | default |
|---|---|---|
| Plumber | HOURLY, DAILY, FIXED | HOURLY |
| Electrician | HOURLY, FIXED | HOURLY |
| Carpenter | HOURLY, DAILY, FIXED | DAILY |
| Painter | DAILY, FIXED | DAILY |
| Cleaning | HOURLY, FIXED, PER_UNIT | HOURLY |
| Driver | HOURLY, DAILY | HOURLY |
| AC Repair | FIXED, HOURLY | FIXED |
| Pest Control | QUOTE_BASED, FIXED | QUOTE_BASED |
| Shifting | QUOTE_BASED | QUOTE_BASED |
| Laundry | PER_UNIT, FIXED | PER_UNIT |
| Appliance Repair | FIXED, HOURLY | FIXED |
| Salon | FIXED, HOURLY | FIXED |
| Photography | HOURLY, FIXED, DAILY | HOURLY |
| Tutoring | HOURLY, FIXED | HOURLY |
| Fitness Trainer | HOURLY, FIXED | HOURLY |
| Computer Repair | FIXED, HOURLY | FIXED |
| Transporter | QUOTE_BASED | QUOTE_BASED |

### Transporter note (QUOTE_BASED extension)
A Transporter offers vehicle types (auto rickshaw, car, etc.) and is **quote-based only** — the
customer and provider negotiate the final price via chat (already supported in `chat_screen.dart`
through quote accept/decline). The provider should be able to attach **vehicle images** to show
what they offer. This needs a provider-service image gallery (separate entity
`ProviderServiceImage` or a `images: string[]` column) — tracked as a Phase 3/4 extension, NOT
blocking Phase 1. Category is simply seeded with `pricingModels: [QUOTE_BASED]`.

## 7. Admin Web UI (`adminweb/src/pages/Categories.tsx`)

- Add a multi-select (checkboxes) of the 5 pricing models in the Add/Edit form.
- `Category` interface gains `pricingModels: PricingModel[]` and `defaultPricingModel?`.
- Show the configured models as chips in the table.
- Sync `adminweb/src/types/index.ts` `Booking` type with `commissionAmount`, `providerAmount`, `convenienceFee`, `pricingModel` (for future display).

## 8. Flutter UI

- `provider_services_screen.dart`: fetch category's `pricingModels`; show only the allowed rate field(s) + a pricing-model selector defaulting to `defaultPricingModel`.
- `provider_submit_quote_screen.dart`: for `QUOTE_BASED` categories, support itemized `QuoteItem` rows; for rate-based, show the single amount as today.
- New `provider_charges_screen.dart` (or modal): add/remove `BookingCharge` line items during ACCEPTED/ON_THE_WAY/WORKING.
- Live payout preview: compute `amount − commission(getCommission) − convenienceFee(getConvenienceFee)` and show net before submit.

## 9. Phases

### Phase 1 — Backend foundation (DONE)
- [x] Create `PricingModel` enum (`common/enums/pricing-model.enum.ts`).
- [x] Add `pricingModels` + `defaultPricingModel` to `ServiceCategory` entity.
- [x] Add `pricingModel` + `unitRate` to `ProviderService` entity.
- [x] Add `pricingModel` + `unitCount` to `Booking` entity.
- [x] Category create/update (controller + service) accept + validate `pricingModels`/`defaultPricingModel`.
- [x] ProviderService DTOs + `validateProviderServicePricing` against category models.
- [x] `recalculateTotals` rewrite with `inferPricingModelFromRates` fallback (backward compatible).
- [x] Seed defaults for 16 categories + new **Transporter** (QUOTE_BASED).
- [x] **Add `gstAmount` column** to Booking entity. GST = `serviceAmount × GST_RATE` (default 0.18).
- [x] **Fix commission override bug** — new `resolveCommission` on CommissionService correctly prioritizes provider→category→global→default (no more `|| categoryId` hack).
- [x] **Fix quote-booking amount override** — `recalculateTotals` now uses `quote.amount` when a quote exists, NOT the providerService rate card.
- [x] **Fix quote-booking early-return** — `recalculateTotals` no longer early-returns for quote-only bookings; commission/providerAmount now computed at completion.
- [x] **GST in acceptQuote** — `acceptQuote` now includes `gstAmount` in `totalAmount` at acceptance time.
- [x] **Invoice** updated to show `serviceAmount`, `convenienceFee`, `gstAmount`, `commissionRate` (on serviceAmount), `providerEarnings`.
- [x] Backend `nest build` passes; lint clean except 5 pre-existing `chat.*` enum-comparison errors.
- [ ] Run backend e2e (needs DB; pending).
- Note: columns added via entity; ensure TypeORM `synchronize`/migration applies them at runtime.

### Phase 2 — Admin web (DONE)
- [x] `Categories.tsx` pricing-model multi-select checkboxes + default model dropdown + table chips (FIXED/HOURLY/DAILY/PER_UNIT/QUOTE_BASED).
- [x] `types/index.ts` updated: `Booking` gains `commissionAmount`, `providerAmount`, `convenienceFee`, `gstAmount`, `pricingModel`. `ProviderService` updated to match entity (nullable rates + `pricingModel`).
- [x] Build + all 49 tests pass.

### Phase 3 — Quote itemization (backend done, Flutter deferred)
- [x] `QuoteItem` entity (`quote_items` table: description, quantity, unitPrice, totalPrice, quote FK).
- [x] `CreateQuoteItemDto` / `UpdateQuoteItemDto` with class-validator.
- [x] `items: QuoteItem[]` OneToMany on `Quote` entity.
- [x] `createQuote` optionally accepts items array; auto-computes `totalPrice = quantity × unitPrice`.
- [x] `QuoteItemsController` (`POST/GET /quotes/:quoteId/items`, `PATCH/DELETE :itemId`) with provider ownership guard.
- [x] `QuoteItemsService` with full CRUD + auto-recompute totalPrice on update.
- [x] `findQuotesForJobRequest` / `findMyQuotes` load items relation.
- [x] Registered in `QuotesModule`.
- [ ] *Deferred:* Flutter itemized quote UI for `QUOTE_BASED`.

### Phase 4 — Flutter provider UX (DONE)
- [x] Category-aware rate fields in `provider_services_screen.dart` — form dialog dynamically shows only rate fields matching category's `pricingModels` (FIXED/HOURLY/DAILY/PER_UNIT), with pricing model dropdown when multiple models exist.
- [x] `provider_charges_screen.dart` — extra-charge add/remove screen with POST/DELETE `/bookings/charges` endpoints; route registered in `main.dart`.
- [x] Live net-payout preview — shows subtotal, GST (18%), commission (10%), and provider earnings estimate in real-time as rates are entered.
- [x] `ServiceCategory` model now includes `pricingModels`, `defaultPricingModel`, `nameHi`.
- [x] `ProviderService` model now includes `pricingModel`, `unitRate`, `category`.
- [x] Service cards show pricing model chip + unit rate + existing rates.
- [x] `flutter analyze` — 0 new issues (all 23 pre-existing).

### Phase 5 — Verification
- [ ] Flutter `flutter test` + `flutter analyze`.
- [ ] Adminweb `npm test` + `npm run build`.
- [ ] Backend e2e for new pricing flows.

## 10. Non-goals (this round)
- GST stored as a booking column (still invoice-derived) — can follow later.
- Persisting lead fee as a wallet transaction (already logged).
- Dynamic-pricing engine integration with quote bookings.
