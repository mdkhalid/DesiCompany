# DesiCompany — Backend API

Local service marketplace connecting customers with service providers (plumbing, electrical, repairs, daily wage labour, etc.).

## Tech Stack

- **Framework:** NestJS 11 (TypeScript)
- **ORM:** TypeORM + PostgreSQL
- **Cache:** Redis
- **Auth:** JWT + Phone OTP
- **API Docs:** Swagger (at `/api`)

## Project Setup

```bash
# Prerequisites: Node.js 20+, Docker Desktop

# Start PostgreSQL + Redis
docker-compose up -d

# Install dependencies
npm install

# Build
npm run build

# Seed sample data
npm run seed

# Start dev server (http://localhost:3000)
npm run start:dev
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | JWT signing secret |
| `PAYMENT_GATEWAY_ENCRYPTION_KEY` | 64-char hex key (32 bytes) for encrypting gateway credentials |
| `API_PREFIX` | API prefix (default: `/api/v1`) |

## Phase 3 — Payments & Commission

### Payment Gateway Architecture

- **Strategy Pattern:** Pluggable `PaymentGateway` interface with `RazorpayGateway`, `StripeGateway`, and `CashGateway`
- **Admin Configurable:** Gateways are added/managed via admin dashboard — no server restart needed
- **Encrypted Credentials:** Gateway API keys are encrypted with AES-256-GCM and stored in the database
- **Factory:** `PaymentGatewayFactory.getDefault()` returns the active default gateway; `getByType()` returns a specific one

### Payment Flow

1. **Create Order:** `POST /payments/create-order` — creates a gateway order for a completed booking (uses the default gateway from admin config)
2. **Get Status:** `GET /payments/:id/status` — polls gateway for payment status, auto-updates on success/failure
3. **Cash Flow:**
   - `POST /payments/pay-cash` — records a cash payment intent
   - `POST /payments/mark-cash-received` — provider confirms cash received, credits provider wallet
4. **Webhooks:**
   - `POST /webhooks/razorpay` — Razorpay webhook handler with HMAC-SHA256 signature verification
   - `POST /webhooks/stripe` — Stripe webhook handler with timestamp + HMAC verification
   - Idempotency via `webhook_events` table

### Wallet & Ledger

- Auto-created for each user on first access
- Provider wallets are credited on payment success
- `LedgerService.settleOutstandingCommissions()` — FIFO commission settlement from provider wallets
- `SoftBlockService` — auto-blocks providers whose outstanding commissions exceed `2x` the average (configurable threshold)

### Admin Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /admin/payment-gateways` | List all gateways (credentials masked) |
| `POST /admin/payment-gateways` | Add a new gateway (encrypts credentials) |
| `PATCH /admin/payment-gateways/:id` | Update gateway config |
| `PATCH /admin/payment-gateways/:id/default` | Set as default gateway |
| `DELETE /admin/payment-gateways/:id` | Remove gateway (not if it's default) |
| `POST /admin/refunds` | Initiate a refund (gateway + wallet credit) |
| `GET /admin/soft-block-config` | View soft-block threshold config |
| `PATCH /admin/soft-block-config` | Update soft-block config |
| `PATCH /admin/check-soft-blocks` | Run soft-block check manually |

### Payment Gateway Config Data Model

| Column | Type | Description |
|--------|------|-------------|
| `type` | enum | `razorpay`, `stripe`, `cash` |
| `displayName` | string | Human-readable name |
| `encryptedCredentials` | text | AES-256-GCM encrypted JSON |
| `iv` | text | Encryption IV |
| `authTag` | text | GCM authentication tag |
| `isActive` | boolean | Gateway enabled |
| `isDefault` | boolean | Primary gateway |

## API Endpoints

### Authentication
- `POST /auth/send-otp` — Send OTP
- `POST /auth/verify-otp` — Verify OTP & get JWT

### Users
- `GET /users/:id` — Get user profile
- `PATCH /users/:id` — Update profile

### Services
- `GET /services/categories` — List categories
- `GET /services/providers` — Search providers
- `GET /services/:providerId` — Provider services

### Bookings
- `POST /bookings` — Create booking
- `PATCH /bookings/:id/status` — Update status
- `PATCH /bookings/:id/reschedule` — Reschedule
- `POST /bookings/charges` — Add material charge
- `DELETE /bookings/charges/:id` — Remove charge

### Payments
- `POST /payments/create-order` — Create payment order
- `GET /payments/:id/status` — Get payment status
- `POST /payments/pay-cash` — Record cash payment
- `POST /payments/mark-cash-received` — Confirm cash received

### Wallet
- `GET /wallet` — Get wallet balance
- `GET /wallet/transactions` — List transactions

### Webhooks
- `POST /webhooks/razorpay` — Razorpay webhook
- `POST /webhooks/stripe` — Stripe webhook

### Admin
- `GET /admin/dashboard` — Dashboard metrics
- `GET /admin/payment-gateways` — List gateways
- `POST /admin/payment-gateways` — Add gateway
- `PATCH /admin/payment-gateways/:id` — Update gateway
- `PATCH /admin/payment-gateways/:id/default` — Set default
- `DELETE /admin/payment-gateways/:id` — Remove gateway
- `POST /admin/refunds` — Issue refund
- `GET /admin/soft-block-config` — View soft-block config
- `PATCH /admin/soft-block-config` — Update soft-block config
- `PATCH /admin/check-soft-blocks` — Run soft-block check

## Running Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Seed Data

| User | Phone | Role |
|------|-------|------|
| Admin | 9999999999 | admin |
| Rahul Sharma | 9876543210 | customer |
| Amit Kumar | 9876543211 | provider |

**Mock OTP:** `123456` (all users in dev)
