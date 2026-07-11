# DesiCompany — Known Issues

Last updated: 2026-06-30

---

## 1. Backend: multer vulnerability (BLOCKED)

| Severity | Package | Version | Type |
|----------|---------|---------|------|
| High | multer | 2.1.1 | Transient (via @nestjs/*) |

- **CVE-1**: GHSA-72gw-mp4g-v24j — DoS via deeply nested field names
- **CVE-2**: GHSA-3p4h-7m6x-2hcm — DoS via incomplete cleanup of aborted uploads
- **Fix**: Requires `npm audit fix --force` which downgrades NestJS to v7
- **Status**: **BLOCKED** — breaking change, wait for NestJS to update multer peer dep

---

## 2. Backend: 261 ESLint errors (mostly unsafe `any`)

| Category | Count | Auto-fixable? |
|----------|-------|---------------|
| `no-unsafe-*` (assignment, member access, call, return) | ~150 | ❌ Manual |
| `no-unused-vars` | ~50 | ⚠️ Partial |
| `require-await` | ~15 | ❌ Manual |
| `no-unsafe-enum-comparison` | ~15 | ❌ Manual |
| `no-misused-promises` | ~5 | ❌ Manual |

**Impact**: Compiles and tests pass. These are strict TypeScript-ESLint checks.

---

## 3. Backend: DB_PASSWORD mismatch

- `.env` contains new strong DB password
- PostgreSQL is still using the old password
- **Impact**: Backend fails to connect to PostgreSQL on restart
- **Fix**: Run `scripts/update-db-password.sql` in PostgreSQL

---

## 4. Backend: PAYMENT_GATEWAY_ENCRYPTION_KEY rotated

- Encryption key changed in `.env`
- Existing encrypted payment gateway credentials are now undecryptable
- **Fix**: Re-enter gateway credentials via admin panel after key rotation

---

## 5. Flutter: 10 outdated direct dependencies

| Package | Current | Latest | Major? |
|---------|---------|--------|--------|
| `flutter_riverpod` | 2.6.1 | 3.3.2 | Yes |
| `firebase_messaging` | 15.2.10 | 16.4.1 | Yes |
| `firebase_core` | 3.15.2 | 4.11.0 | Yes |
| `flutter_local_notifications` | 18.0.1 | 22.0.1 | Yes |
| `flutter_secure_storage` | 9.2.4 | 10.3.1 | Yes |
| `connectivity_plus` | 6.1.5 | 7.2.0 | Yes |
| `permission_handler` | 11.4.0 | 12.0.3 | Yes |
| `socket_io_client` | 2.0.3+1 | 3.1.6 | Yes |
| `intl` | 0.20.2 | 0.20.3 | No |
| `geolocator` | 14.0.2 | 14.0.3 | No |

**Discontinued transitive deps**: `js`, `build_resolvers`, `build_runner_core`

**Fix**: `flutter pub upgrade --major-versions` (may need code migration)

---

## 6. Admin Web: ESLint warnings (42)

| Category | Count |
|----------|-------|
| `@typescript-eslint/no-explicit-any` | 25 |
| `@typescript-eslint/no-unused-vars` | 13 |
| `react-hooks/exhaustive-deps` | 2 |
| `react-refresh/only-export-components` | 2 |

ESLint config added at `eslint.config.js`. Run: `npm run lint`

---

## 7. Admin Web: future flag warnings (cosmetic)

React Router v6 flags in test output:
- `v7_startTransition` not enabled
- `v7_relativeSplatPath` not enabled

**Impact**: None — tests pass. Migrate when upgrading to React Router v7.

---

## ✅ Fixed This Session (2026-06-30)

| Issue | Fix |
|-------|-----|
| Backend unused imports | `eslint --fix` removed ~49 unused imports |
| Backend `catch (error)` → `catch {}` | 3 instances where `error` was unused |
| DB_PASSWORD SQL script | Created `scripts/update-db-password.sql` |
| Admin web ESLint | Added config, deps, and `npm run lint` script |
| `ISSUES.md` git tracking | Added to `.gitignore` |

---

## Summary

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | multer vulnerability | High | ❌ Blocked |
| 2 | Backend ESLint (261 errors) | Low | ⚠️ Needs manual typing |
| 3 | DB_PASSWORD mismatch | High | ⚠️ Run SQL script |
| 4 | Encryption key rotated | Medium | ⚠️ Re-enter creds |
| 5 | Flutter outdated deps | Medium | ⚠️ Review before upgrade |
| 6 | Admin web ESLint (42 warnings) | Low | ⚠️ Cleanup available |
| 7 | React Router flags | Info | ☑️ Future |
