# DesiCompany — App Improvement Roadmap

Phased improvement plan based on a targeted review of all three apps
(`backendapi` NestJS, `frontendapp` Flutter, `adminweb` React).
Ordered by impact and dependency. Each phase builds on the previous.

---

## Phase 0 — Quick Wins (low risk) — ✅ COMPLETE
- **CSP / security headers: already implemented** via Helmet in `backendapi/src/main.ts:84-135` (CSP, HSTS, frameguard `deny`, referrerPolicy `same-origin`, `xPoweredBy: false`). No change needed — verified, not redundant.
- ✅ Replaced raw `console.error` with `this.logger.error` at `backendapi/src/bookings/bookings.service.ts:273` (loyalty award failure now uses the service `Logger`).
- ✅ Masked PII (phone numbers) in logs: added `maskPhone()` helper in `backendapi/src/sms/sms.service.ts` and applied to both success + error logs (keeps last 4 digits, masks the rest).
- ✅ Pre-commit hooks enabled at repo root: added `package.json` (husky + lint-staged), `.husky/pre-commit` (`npx lint-staged`), and lint-staged config running `npm run lint` for backend + adminweb and `flutter analyze` for frontend. `.gitignore` updated to track this roadmap (`!project-docs/IMPROVEMENTS.md`).

## Phase 1 — Security Hardening (critical, do first) — ✅ COMPLETE
- ✅ **Flutter:** moved JWT access/refresh tokens from `SharedPreferences` → `flutter_secure_storage` (Android Keystore / iOS Keychain) in `frontendapp/lib/services/auth_service.dart`. `_keyToken`/`_keyRefreshToken` now use `_secureStorage.write/read/delete`; non-secret cached `userData` stays in `SharedPreferences`. `flutter_secure_storage` was already a dependency. Verified with `flutter analyze` (no issues).
- ✅ **Secret-handling audit:** verified clean. `JWT_SECRET` / `PAYMENT_GATEWAY_ENCRYPTION_KEY` are used only as crypto secrets (JWT sign/verify, AES key) — never passed to `logger`/`console`. No change needed.
- ✅ **Adminweb guards:** verified present. `components/ProtectedRoute.tsx:5` redirects unauthenticated users to `/login`; `services/api.ts` clears tokens on 401. Optional follow-up: force a client-side redirect to `/login` when a 401 occurs mid-session (currently only tokens are cleared).

## Phase 2 — Performance & Scalability (needs DB migration) — 🟡 PARTIAL
**Indexes + migration: ✅ DONE.** Pagination: already present on key endpoints (see notes). Caching: deferred follow-up.

- ✅ Added `@Index()` to FK / filter columns on high-traffic entities:
  - `bookings/entities/booking.entity.ts` → `customer_id`, `provider_id`, `status`, `created_at`
  - `payments/entities/payment.entity.ts` → `booking_id`, `status`, `gateway`, `created_at`
  - `chat/entities/message.entity.ts` → `booking_id`, `created_at`
  - Note: TypeORM does **not** auto-index `@ManyToOne` relations, so these were missing.
- ✅ Hand-wrote migration `src/database/migrations/1720000002000-AddPerfIndexes.ts` (CREATE INDEX IF NOT EXISTS, reversible via `down()`). **Not auto-generated** because the DB on the configured port (5433) is not running and the reachable 5432 instance is a stale/out-of-sync schema that would have produced destructive DROP statements. **APPLIED 2026-07-11** (see note below).
- ℹ️ **Pagination:** Already implemented on the main user-facing list endpoints — chat (`chat.service.ts` `findAndCount` + `chat.controller.ts` `page`), notifications, wallet transactions (`wallets.service.ts`), error logs, activity logs, admin bookings. The remaining unpaginated `repository.find({...})` calls are single-record/internal lookups or small reference data (categories, settings, service catalogs) where the Flutter app intentionally expects the full list — paginating those would break the contract. **No change needed.**
- ⏳ **Redis caching (optional follow-up):** Hot reads (services list, categories) could use cache-aside with TTL + invalidation on writes. Deferred — additive, needs invalidation care. Recommend as a separate task.

## Phase 3 — Reliability & Resilience — ✅ COMPLETE
- ✅ **Loyalty award resilience:** `awardPointsForBooking` now takes a `bookingId` and is **idempotent** (stores `last_awarded_booking_id`, skips re-award). `bookings.service.ts` awards via a new `awardLoyaltyWithRetry()` helper (3 attempts, backoff, structured warn/error logs) so transient failures don't silently lose points and retries can't double-award. Migration `1720000003000-AddLoyaltyAwardIdempotency.ts` adds the column. **APPLIED 2026-07-11.**
- ✅ **FCM send guarded:** `firebase-push.provider.ts` `send()` wrapped in try/catch — push failures are best-effort and no longer break the calling business flow.
- ✅ **Adminweb global error boundary:** already present (`components/ErrorBoundary.tsx`, applied in `App.tsx:42` and `Dashboard.tsx`). Verified, no change needed.
- ℹ️ **External-call guards:** SMS (`sms.service.ts`), payment gateways (`cash.gateway.ts`, `payment-gateway.factory.ts`), and webhooks (`webhooks.service.ts`) already wrap external calls in try/catch with logging. No change needed.
- ⏳ **Data-fetching layer (React Query/SWR):** deferred — large refactor of all adminweb API calls; recommend as a separate task with its own migration plan.

## Phase 4 — Code Quality & Maintainability — ✅ COMPLETE
- ✅ **Auth token boilerplate deduped:** `frontendapp/lib/services/auth_service.dart` now funnels all token/userData writes through a single `_persistSession()` helper (register/switchRole/addRole/verifyOtp). `flutter analyze` passes.
- ✅ **Adminweb `apiClient` already consolidated:** `adminweb/src/services/api.ts` is the typed client (`api.get/post/put/patch/delete` + auth + 401 refresh + redirect to `/login`); services use it. No duplication to fix.
- ✅ **DTO validation already enforced:** global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`) in `main.ts`; all 35 DTOs import `class-validator`, and the rest (e.g. `update-quote.dto.ts`) inherit decorators via `PartialType`. No gaps found.

## Phase 5 — Testing & CI — 🟡 PARTIAL (testing done, CI deferred)
Per instruction, only the **testing** portion was done; CI wiring was skipped.

- ✅ **Payment reconciliation coverage added:** `payments.service.spec.ts` now has 4 `reconcileStuckPayments` tests (success→SUCCESS, failed→FAILED, no stuck payments→noop, subscription activation via `platformFeesService`). All pass.
- ✅ **Webhook unit tests already present:** `webhooks.service.spec.ts` covers signature rejection, cash webhooks, duplicate events, and successful-payment wallet credit.
- ✅ **E2E smoke tests already present:** `backendapi/test/flow.e2e-spec.ts`, `app.e2e-spec.ts`, and `jest-e2e.json` exist (run with `npm run test:e2e` once infra is up).
- ⏳ **CI wiring (deferred):** add a workflow running `lint` + `test` + `build` per PR for `backendapi`, `frontendapp`, `adminweb`.

---

## Suggested execution order
Phase 0 + Phase 1 (token storage) in parallel → Phase 2 (indexes + migration) → Phase 3 → Phase 4 → Phase 5.

## Key findings reference
| Severity | Area | Location | Phase | Status |
|----------|------|----------|-------|--------|
| High (security) | Flutter plaintext token storage | `frontendapp/lib/services/auth_service.dart:9-11, 34-37` | 1 | ✅ done |
| Medium (perf) | Missing DB indexes on FK columns | `booking`, `payment`, `message` entities | 2 | ✅ done (migration written) |
| Medium (reliability) | Swallowed loyalty error | `backendapi/src/bookings/bookings.service.ts:268-273` | 3 | ✅ done (idempotent retry) |
| Low (hygiene) | PII in logs | `backendapi/src/sms/sms.service.ts:19` | 0 | ✅ done |
| Low (hygiene) | Raw console.error vs Logger | `backendapi/src/bookings/bookings.service.ts:273` | 0 | ✅ done |
| Low (hygiene) | Missing CSP/security headers | `backendapi/src/main.ts` | 0 | ✅ done (already present via Helmet) |
| Low (hygiene) | No pre-commit hooks | repo root | 0 | ✅ done (husky + lint-staged) |

---

## Progress Log
- **Phase 0 — COMPLETE** (2026-07-11)
  - Verified Helmet CSP/security headers already configured in `main.ts` (no change).
  - `bookings.service.ts:273`: `console.error` → `this.logger.error`.
  - `sms.service.ts`: added `maskPhone()`; PII no longer logged in plain text.
  - Root `package.json` + `.husky/pre-commit` + lint-staged config installed; pre-commit runs lint per app + `flutter analyze`. `.gitignore` updated so this roadmap stays tracked.
- **Phase 1 — COMPLETE** (2026-07-11)
  - `auth_service.dart`: tokens/refresh now in `FlutterSecureStorage`; `flutter analyze` passes.
  - Secret-handling audit: no secret leakage to logs.
  - Adminweb guards (`ProtectedRoute`, 401 token clear) verified present.
- **Phase 2 — PARTIAL** (2026-07-11)
  - Added `@Index()` to `booking`/`payment`/`message` entities (FK + status/gateway/created_at).
  - Hand-wrote `1720000002000-AddPerfIndexes.ts` (safe `CREATE INDEX IF NOT EXISTS`). Migration not auto-generated because 5433 DB is down and 5432 is a stale schema. Apply via `npm run migration:run` once infra is up.
  - Pagination already present on main list endpoints; remaining unpaginated `find`s are internal/reference data — no change.
  - Redis caching deferred as optional follow-up.
  - `tsc --noEmit` passes for backend.
- **Phase 3 — COMPLETE** (2026-07-11)
  - Loyalty award made idempotent + retried (`awardLoyaltyWithRetry`). Migration `1720000003000-AddLoyaltyAwardIdempotency.ts` adds `last_awarded_booking_id`.
  - FCM `send()` guarded (best-effort).
  - Adminweb ErrorBoundary already present; external-call guards already present.
  - Data-fetching layer (React Query/SWR) deferred.
  - `tsc --noEmit` clean; loyalty/bookings/push/notifications tests pass (33).
- **Phase 4 — COMPLETE** (2026-07-11)
  - Auth token writes deduped into `_persistSession()` (`flutter analyze` passes).
  - Adminweb `apiClient` (`api.ts`) already consolidated; DTO validation already enforced globally. Both verified, no change.
- **Migrations APPLIED (2026-07-11)**
  - DB on 5433 came up (`desicompany_postgres` healthy). `migration:run` initially collided because the `migrations` table was empty while the schema (built earlier via `synchronize`) already contained the older migrations' effects.
  - Recorded the 5 pre-existing migrations as applied in the `migrations` table, then ran `migration:run`, which executed only the 2 new migrations:
    - `1720000002000-AddPerfIndexes` → 10 indexes created (bookings ×4, payments ×4, messages ×2).
    - `1720000003000-AddLoyaltyAwardIdempotency` → `last_awarded_booking_id` column added.
  - `migration:show` now reports all 7 migrations applied. Future `migration:run` is clean.
- **Phase 5 — PARTIAL** (2026-07-11)
  - Added `reconcileStuckPayments` unit tests (4) — all pass.
  - Webhook unit tests + E2E smoke tests already present.
  - CI wiring deferred per instruction ("only testing").
  - **All 5 phases addressed. Phases 0–4 complete; Phase 5 testing complete, CI deferred.**

> Note: This roadmap was relocated from `docs/IMPROVEMENTS.md` to `project-docs/IMPROVEMENTS.md`.
