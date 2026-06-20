# DesiCompany — Security & Feature Fix Plan

## Current Status

| Area | Status |
|------|--------|
| Security Audit | ✅ Complete |
| Gap Analysis | ✅ Complete |
| Implementation Plan | ✅ Complete |
| Phase 1: Security Fixes | ✅ Complete |
| Phase 2: Admin User Management | ✅ Complete |
| Phase 3: User Suspension System | ✅ Complete |
| Phase 4: Automatic Provider Suspension | ✅ Complete |
| Phase 5: Automatic Unsuspension | ✅ Complete |
| Phase 6: Auth & User Mgmt Gaps | ✅ Complete |
| Phase 7: Service Catalog Gaps | ✅ Complete |
| Phase 8: Admin Feature Gaps | ✅ Complete |
| Phase 9: Search & Payments Gaps | ✅ Complete |
| Phase 10: External Integrations | ✅ Complete |

**Version:** 0.1.0
**Last Updated:** 2026-06-20
**Related:** [requirements.md](./requirements.md)

---

## 1. Executive Summary

This document outlines security vulnerabilities and missing features identified during code review. The fixes are organized into 5 phases, with each phase building on the previous one.

### Critical Security Issues

| # | Issue | Severity | Location |
|---|-------|----------|----------|
| S1 | Admin registration via API | 🔴 Critical | `auth.service.ts:119-125` |
| S2 | Login role bypass | 🔴 Critical | `auth.service.ts:177-179` |
| S3 | KYC re-activation of suspended users | 🟡 Medium | `kyc.service.ts:81-85` |

### Missing Features

| # | Feature | Priority | Related Requirement |
|---|---------|----------|---------------------|
| F1 | Admin user creation from admin page | High | Section 3.3 Admin |
| F2 | User suspension with audit trail | High | Section 3.3 Admin |
| F3 | Automatic provider suspension | High | Section 4.7 Payments |
| F4 | Automatic unsuspension after payment | High | Section 4.7 Payments |
| F5 | User listing with pagination/filter | Medium | Section 3.3 Admin |

---

## 2. Security Vulnerabilities

### S1: Admin Registration via API (Critical)

**Location:** `backendapi/src/auth/auth.service.ts:119-125`

**Vulnerability:**
```typescript
// No validation on registerDto.role
const user = this.userRepository.create({
  phone: registerDto.phone,
  role: registerDto.role,  // ← Accepts 'admin' without check
  roles: [registerDto.role],
  ...
});
```

**Attack Vector:**
```json
POST /api/v1/auth/register
{
  "phone": "attacker-phone",
  "otp": "123456",
  "role": "admin"
}
```

**Impact:** Attacker gains admin access to all admin-protected endpoints.

**Fix:** Add role validation at start of `register()` method:
```typescript
if (registerDto.role === UserRole.ADMIN) {
  throw new BadRequestException('Admin registration is not allowed');
}
```

---

### S2: Login Role Bypass (Critical)

**Location:** `backendapi/src/auth/auth.service.ts:177-179`

**Vulnerability:**
```typescript
// No validation against user's roles array
if (loginDto.role && loginDto.role !== user.role) {
  user.role = loginDto.role;  // ← User can request any role
  await this.userRepository.save(user);
}
```

**Attack Vector:**
```json
POST /api/v1/auth/login
{
  "phone": "9876543210",
  "otp": "123456",
  "role": "admin"
}
```

**Impact:** Customer can log in as admin by requesting admin role.

**Fix:** Validate requested role exists in user's `roles` array:
```typescript
if (loginDto.role && loginDto.role !== user.role) {
  const userRoles = user.roles || [user.role];
  if (!userRoles.includes(loginDto.role)) {
    throw new BadRequestException('User does not have this role');
  }
  user.role = loginDto.role;
  await this.userRepository.save(user);
}
```

---

### S3: KYC Re-activation (Medium)

**Location:** `backendapi/src/kyc/kyc.service.ts:81-85`

**Vulnerability:**
```typescript
// KYC approval sets user status to ACTIVE regardless of current status
user.status = UserStatus.ACTIVE;
await this.userRepository.save(user);
```

**Impact:** Suspended provider can be re-activated by submitting and approving KYC.

**Fix:** Only set status to ACTIVE if currently `PENDING_KYC`:
```typescript
if (user.status === UserStatus.SUSPENDED) {
  // Log warning, don't auto-activate
  console.warn(`Provider ${user.id} is suspended, KYC approved but status not changed`);
} else {
  user.status = UserStatus.ACTIVE;
  await this.userRepository.save(user);
}
```

---

## 3. Implementation Phases

### Phase 1: Security Fixes ✅

**Goal:** Fix critical security vulnerabilities

| # | Task | File | Change |
|---|------|------|--------|
| 1.1 | Block admin registration | `auth.service.ts` | Add role validation in `register()` |
| 1.2 | Fix login role bypass | `auth.service.ts` | Validate role against user's `roles` array |
| 1.3 | Fix KYC re-activation | `kyc.service.ts` | Check user status before activation |
| 1.4 | Add to gitignore | `.gitignore` | Add `TEST_CREDENTIALS.md` |

**Files to Modify:**
- `backendapi/src/auth/auth.service.ts`
- `backendapi/src/kyc/kyc.service.ts`
- `.gitignore`

**Testing:**
- [ ] Verify admin cannot register via API
- [ ] Verify customer cannot login as admin
- [ ] Verify suspended provider not re-activated via KYC

---

### Phase 2: Admin User Management ✅

**Goal:** Allow admins to create other admin users from the admin page

#### 2.1 Backend: Admin Creation Endpoint

**New Files:**
- `backendapi/src/admin/dto/create-admin.dto.ts`

**Modified Files:**
- `backendapi/src/admin/admin.controller.ts`
- `backendapi/src/admin/admin.service.ts`
- `backendapi/src/admin/admin.module.ts`

**API Endpoints:**
```
POST /admin/users
- Body: { phone, email, firstName, lastName }
- Creates new admin user
- Sends OTP to phone for verification
- Only accessible by existing admins

GET /admin/users
- Query: ?page=1&limit=20&role=admin&status=active&search=john
- Paginated user listing with filters
- Only accessible by admins

GET /admin/users/:id
- Get user details with relations
- Only accessible by admins
```

**DTO:**
```typescript
// create-admin.dto.ts
export class CreateAdminDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;
}
```

#### 2.2 Backend: User Listing with Pagination

**Modified Files:**
- `backendapi/src/users/users.service.ts`
- `backendapi/src/users/users.controller.ts`

**Query Parameters:**
```
?page=1        - Page number (default: 1)
?limit=20      - Items per page (default: 20)
?role=admin    - Filter by role
?status=active - Filter by status
?search=john   - Search by name, phone, or email
```

**Response Format:**
```json
{
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

#### 2.3 Admin Web: User Management Page

**New/Modified Files:**
- `adminweb/src/pages/Users.tsx` (update existing)
- `adminweb/src/types/index.ts`

**Features:**
- User table with pagination
- Filter by role, status
- Search by name, phone, email
- "Create Admin" button (opens modal)
- Action buttons: View, Suspend, Activate

---

### Phase 3: User Suspension System ✅

**Goal:** Implement user suspension with audit trail

#### 3.1 Backend: Suspension Entity Updates

**Modified Files:**
- `backendapi/src/users/entities/user.entity.ts`

**New Fields:**
```typescript
@Column({ nullable: true })
suspendedAt?: Date;

@Column({ nullable: true })
suspendedBy?: string;  // Admin user ID

@Column({ nullable: true, type: 'text' })
suspensionReason?: string;
```

#### 3.2 Backend: Suspension Endpoint

**Modified Files:**
- `backendapi/src/admin/admin.controller.ts`
- `backendapi/src/admin/admin.service.ts`

**New Files:**
- `backendapi/src/admin/dto/suspend-user.dto.ts`

**API Endpoints:**
```
PATCH /admin/users/:id/suspend
- Body: { reason: "Illegal activity reported" }
- Sets user status to SUSPENDED
- Records suspendedAt, suspendedBy, suspensionReason
- Prevents suspending other admins
- Only accessible by admins

PATCH /admin/users/:id/activate
- Removes suspension
- Sets user status to ACTIVE
- Only accessible by admins
```

**DTO:**
```typescript
// suspend-user.dto.ts
export class SuspendUserDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  reason: string;
}
```

#### 3.3 Backend: Suspension Validation

**Modified Files:**
- `backendapi/src/admin/admin.service.ts`

**Validation Rules:**
1. Admin cannot suspend another admin
2. Admin cannot suspend themselves
3. Suspension reason is required (minimum 10 characters)
4. Record who performed the suspension

#### 3.4 Admin Web: Suspension UI

**Modified Files:**
- `adminweb/src/pages/Users.tsx`

**Features:**
- "Suspend" button opens modal with reason input
- Confirmation dialog before suspension
- Display suspension details (who, when, why)
- "Activate" button for suspended users

---

### Phase 4: Automatic Provider Suspension ✅

**Goal:** Fix soft-block system to automatically suspend providers who don't pay commissions

#### 4.1 Backend: Create COMMISSION_OWED Transactions

**Modified Files:**
- `backendapi/src/payments/payments.service.ts`

**Change:**
In `creditProviderWallet()` method, after crediting provider wallet:
```typescript
// Create COMMISSION_OWED debit transaction
const commissionOwedTransaction = transactionRepository.create({
  wallet: providerWallet,
  type: 'debit',
  amount: booking.commissionAmount,
  reference: `booking_${booking.id}_commission`,
  description: `Commission owed for booking #${booking.id}`,
  source: TransactionSource.COMMISSION_OWED,
  balance_after: providerWallet.balance,
});
await transactionRepository.save(commissionOwedTransaction);
```

#### 4.2 Backend: Auto-Trigger Soft-Block Check

**Modified Files:**
- `backendapi/src/payments/soft-block.service.ts`

**New Methods:**
```typescript
// Check and block providers after commission creation
async checkAndBlockAfterPayment(providerId: string): Promise<void>

// Check if provider should be blocked
async shouldSoftBlock(walletId: string): Promise<boolean>

// Unblock provider
async unblockProvider(providerId: string): Promise<void>
```

**Integration Point:**
After `creditProviderWallet()` completes, trigger soft-block check:
```typescript
await this.softBlockService.checkAndBlockAfterPayment(provider.userId);
```

#### 4.3 Backend: Soft-Block Enforcement

**Modified Files:**
- `backendapi/src/bookings/bookings.service.ts`

**Change:**
Before accepting a booking, check if provider is soft-blocked:
```typescript
if (provider.isSoftBlocked) {
  throw new BadRequestException(
    'Provider is temporarily suspended due to outstanding commissions'
  );
}
```

#### 4.4 Backend: Admin Unblock Endpoint

**Modified Files:**
- `backendapi/src/admin/admin.controller.ts`
- `backendapi/src/admin/admin.service.ts`

**API Endpoints:**
```
PATCH /admin/providers/:id/unblock
- Removes soft-block from provider
- Only accessible by admins
```

---

### Phase 5: Automatic Unsuspension ✅

**Goal:** Automatically unblock providers after commission is paid

#### 5.1 Backend: Settlement Integration

**Modified Files:**
- `backendapi/src/payments/ledger.service.ts`

**Change:**
After successful settlement, check if all commissions are paid:
```typescript
async settleWallet(walletId: string): Promise<void> {
  // ... existing settlement logic ...

  // Check if all commissions are now settled
  const outstanding = await this.getOutstandingCommissions(walletId);
  if (outstanding <= 0) {
    // Trigger unblock check
    await this.softBlockService.checkAndUnblockProvider(walletId);
  }
}
```

#### 5.2 Backend: Unblocking Logic

**Modified Files:**
- `backendapi/src/payments/soft-block.service.ts`

**New Method:**
```typescript
async checkAndUnblockProvider(walletId: string): Promise<void> {
  const wallet = await this.walletRepository.findOne({
    where: { id: walletId },
    relations: { user: true },
  });

  if (!wallet || !wallet.user) return;

  const outstanding = await this.getOutstandingCommissions(walletId);
  if (outstanding <= 0) {
    // Find provider and unblock
    const provider = await this.providerRepository.findOne({
      where: { user: { id: wallet.user.id } },
    });

    if (provider && provider.isSoftBlocked) {
      provider.isSoftBlocked = false;
      await this.providerRepository.save(provider);
      console.log(`Provider ${wallet.user.id} auto-unblocked`);
    }
  }
}
```

#### 5.3 Backend: Scheduled Check (Optional)

**Modified Files:**
- `backendapi/src/payments/soft-block.service.ts`

**New Method:**
```typescript
// Periodic check for all blocked providers
async checkAndUnblockAllProviders(): Promise<void> {
  const blockedProviders = await this.providerRepository.find({
    where: { isSoftBlocked: true },
    relations: { user: true },
  });

  for (const provider of blockedProviders) {
    const wallet = await this.walletRepository.findOne({
      where: { user: { id: provider.user.id } },
    });

    if (wallet) {
      await this.checkAndUnblockProvider(wallet.id);
    }
  }
}
```

**Trigger Points:**
1. After each successful settlement
2. Admin can manually trigger via endpoint
3. Optional: Scheduled job (every hour)

---

## 4. API Reference

### Admin User Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/admin/users` | Create admin user |
| `GET` | `/admin/users` | List users (paginated) |
| `GET` | `/admin/users/:id` | Get user details |
| `PATCH` | `/admin/users/:id/suspend` | Suspend user |
| `PATCH` | `/admin/users/:id/activate` | Activate user |

### Provider Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `PATCH` | `/admin/providers/:id/unblock` | Unblock soft-blocked provider |
| `PATCH` | `/admin/check-soft-blocks` | Trigger soft-block check |

---

## 5. Database Changes

### User Entity Updates

```typescript
// New columns in users table
suspendedAt: timestamp (nullable)
suspendedBy: varchar (nullable)  // Admin user ID
suspensionReason: text (nullable)
```

### Migration Script

```sql
ALTER TABLE users ADD COLUMN suspended_at TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN suspended_by VARCHAR NULL;
ALTER TABLE users ADD COLUMN suspension_reason TEXT NULL;
```

---

## 6. Testing Checklist

### Security Fixes (Phase 1)
- [ ] Admin cannot register via `/auth/register`
- [ ] Customer cannot login as admin
- [ ] Suspended provider not re-activated via KYC approval
- [ ] `TEST_CREDENTIALS.md` not tracked by git

### Admin User Management (Phase 2)
- [ ] Admin can create new admin user
- [ ] Non-admin cannot access admin endpoints
- [ ] User listing with pagination works
- [ ] User filtering by role/status works
- [ ] User search works

### User Suspension (Phase 3)
- [ ] Admin can suspend user with reason
- [ ] Admin cannot suspend other admins
- [ ] Suspension audit trail recorded
- [ ] Suspended user cannot login
- [ ] Admin can activate suspended user

### Automatic Suspension (Phase 4)
- [ ] COMMISSION_OWED transaction created on payment
- [ ] Soft-block check triggered after payment
- [ ] Provider blocked when threshold exceeded
- [ ] Blocked provider cannot accept new bookings

### Automatic Unsuspension (Phase 5)
- [ ] Provider unblocked after commission settled
- [ ] Unblocking logged in console
- [ ] Manual unblock via admin endpoint works

---

## 6. Testing Checklist

### Security Fixes (Phase 1)
- [x] Admin cannot register via `/auth/register`
- [x] Customer cannot login as admin
- [x] Suspended provider not re-activated via KYC approval
- [x] `TEST_CREDENTIALS.md` not tracked by git

### Admin User Management (Phase 2)
- [x] Admin can create new admin user
- [x] Non-admin cannot access admin endpoints
- [x] User listing with pagination works
- [x] User filtering by role/status works
- [x] User search works

### User Suspension (Phase 3)
- [x] Admin can suspend user with reason
- [x] Admin cannot suspend other admins
- [x] Suspension audit trail recorded
- [x] Suspended user cannot login
- [x] Admin can activate suspended user

### Automatic Suspension (Phase 4)
- [x] COMMISSION_OWED transaction created on payment
- [x] Soft-block check triggered after payment
- [x] Provider blocked when threshold exceeded
- [x] Blocked provider cannot accept new bookings

### Automatic Unsuspension (Phase 5)
- [x] Provider unblocked after commission settled
- [x] Unblocking logged in console
- [x] Manual unblock via admin endpoint works

---

## 10. Requirement Gap Fixes (Phases 6–10)

### Phase 6 — Auth & User Management ✅ COMPLETED

| Gap | Task | Files |
|-----|------|-------|
| G1 | Logout endpoint with refresh token revocation | `auth.controller.ts`, `auth.service.ts`, `auth.module.ts`, `revoked-token.entity.ts` |
| G2 | User removal (soft-delete) via `DELETE /admin/users/:id` | `admin.controller.ts`, `admin.service.ts`, `user.entity.ts` |

### Phase 7 — Service Catalog ✅ COMPLETED

| Gap | Task | Files |
|-----|------|-------|
| G3 | Subcategories (hierarchical categories) | `service-category.entity.ts`, `services.service.ts`, `services.controller.ts` |
| G4 | Per-provider commission override CRUD | `admin.controller.ts`, `admin.service.ts` |

### Phase 8 — Admin Features ✅ COMPLETED

| Gap | Task | Files |
|-----|------|-------|
| G5 | Dispute system (entity, CRUD, resolve) | `disputes/` module (entity, service, controller, DTOs) |
| G6 | Activity logs (auto-logged admin actions) | `activity-logs/` module (entity, service, controller) |
| G7 | Broadcast notifications (`POST /admin/notifications/broadcast`) | `notifications.service.ts`, `admin.controller.ts` |
| G12 | Admin review moderation (`DELETE /admin/reviews/:id`) | `reviews.service.ts`, `admin.controller.ts` |

### Phase 9 — Search & Payments ✅ COMPLETED

| Gap | Task | Files |
|-----|------|-------|
| G8 | Price range search (`minPrice`, `maxPrice` filters) | `search-providers.dto.ts`, `services.service.ts` |
| G9 | Env variable fallback for payment gateway | `payment-gateway.factory.ts` |

### Phase 10 — External Integrations ✅ COMPLETED

| Gap | Task | Files |
|-----|------|-------|
| G10 | Push notifications (FCM abstraction + Firebase provider) | `push-notifications/` module, `user.entity.ts` (fcmToken) |
| G11 | SMS provider (Twilio abstraction + mock fallback) | `sms/` module, `auth.service.ts` (integrated) |

### New Entities Added
- `RevokedToken` — stores revoked refresh tokens for logout
- `Dispute` — booking dispute with status workflow (OPEN → IN_REVIEW → RESOLVED/DISMISSED)
- `ActivityLog` — audit trail for admin actions

### New Columns Added
- `User.deletedAt` — soft-delete timestamp
- `User.fcmToken` — Firebase Cloud Messaging token
- `ServiceCategory.parentId` — self-referencing FK for subcategories

### New Endpoints Added
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/logout` | Revoke refresh token |
| `DELETE` | `/admin/users/:id` | Soft-delete user |
| `GET` | `/services/categories/:id/subcategories` | List subcategories |
| `POST` | `/admin/commissions` | Create commission config |
| `PATCH` | `/admin/commissions/:id` | Update commission config |
| `DELETE` | `/admin/commissions/:id` | Delete commission config |
| `POST` | `/disputes` | Raise a booking dispute |
| `GET` | `/disputes` | List all disputes (admin) |
| `GET` | `/disputes/:id` | Get dispute details |
| `PATCH` | `/disputes/:id/resolve` | Resolve/dismiss dispute (admin) |
| `GET` | `/admin/activity-logs` | List activity logs |
| `GET` | `/admin/activity-logs/:entityType/:entityId` | Logs for specific entity |
| `POST` | `/admin/notifications/broadcast` | Broadcast notification |
| `DELETE` | `/admin/reviews/:id` | Delete review (admin) |

---

## 7. Rollback Plan

If any phase causes issues:

1. **Phase 1:** Remove role validation checks
2. **Phase 2:** Remove new admin endpoints
3. **Phase 3:** Remove suspension fields from user entity
4. **Phase 4:** Remove COMMISSION_OWED transaction creation
5. **Phase 5:** Remove auto-unblock logic

All changes are additive and can be reverted without data loss.

---

## 8. Dependencies

| Phase | Depends On | Required For |
|-------|------------|--------------|
| Phase 1 | None | All other phases |
| Phase 2 | Phase 1 | Phase 3 |
| Phase 3 | Phase 2 | Phase 4, 5 |
| Phase 4 | Phase 3 | Phase 5 |
| Phase 5 | Phase 4 | None |

---

## 9. Notes

- Admin creation is **only** via admin page, not via registration
- Suspension requires a reason (minimum 10 characters)
- Admin cannot suspend other admins (safety measure)
- Automatic suspension triggers after each payment
- Automatic unsuspension triggers after commission settlement
- All suspension changes are audit-logged
