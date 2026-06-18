# DesiCompany — Application Requirements

## Current Status

| Component | Status |
|-----------|--------|
| Requirements Doc | ✅ Complete |
| NestJS Backend (Phase 1) | ✅ Complete — tested & pushed |
| Backend Phase 2 | ✅ Complete |
| Backend Phase 3 | ✅ Complete |
| Backend Phase 4 | ✅ Complete |
| Flutter Mobile App | ✅ Implemented |
| React Admin Web | ✅ Implemented |

**Version:** 0.2.0
**Last Updated:** 2026-06-18
**GitHub:** https://github.com/mdkhalid/DesiCompany

---

## 1. Overview

**DesiCompany** is a multi-platform local service marketplace connecting:

- **Customers** seeking services (plumbing, electrical, computer repair, electronics repair, daily wage labour, etc.).
- **Service Providers** offering those services.
- **Admins** managing users, categories, KYC, bookings, commission, and platform activity.

The system prioritizes **simplicity, trust, and scalability**.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | NestJS (Node.js + TypeScript) |
| ORM | TypeORM |
| Database | PostgreSQL |
| Cache / Sessions | Redis |
| Authentication | JWT + Passport + Phone OTP |
| Real-time | Socket.io |
| File Storage | Local (dev) → S3/R2 (prod) |
| Mobile App | Flutter (Android + iOS) |
| Admin Web | React + TypeScript + TailwindCSS |
| Local Testing | Docker Compose |
| API Documentation | Swagger |

---

## 3. User Roles

### 3.1 Customer
- Register/login via phone OTP.
- Browse/search services and providers.
- View verified provider profiles, pricing, ratings.
- Book services with date/time selection.
- Track booking status.
- Chat with provider.
- Pay online (configurable Indian payment gateway) or offline/cash.
- Rate and review completed bookings.

### 3.2 Service Provider
- Register/login via phone OTP.
- Create profile with skills, experience, service areas.
- Add services with pricing models:
  - Hourly
  - Daily
  - Fixed per task
  - Material/Parts charge (added during job)
- Set availability schedule.
- Upload KYC documents after registration.
- Become visible to customers **only after KYC is approved by admin**.
- Accept/reject/reschedule bookings.
- Update job progress (accepted → on the way → working → completed).
- Add material/part charges.
- View earnings and payout status.
- Receive ratings/reviews.

### 3.3 Admin
- Secure login.
- Dashboard with metrics.
- Manage users: view, activate, suspend, remove.
- Verify/reject provider KYC documents.
- Manage service categories and subcategories.
- Configure commission:
  - Global default
  - Per category
  - Per provider override (optional)
  - Types: free, fixed amount, percentage
- Monitor bookings, disputes, payments.
- View activity logs.
- Send broadcast notifications.

---

## 4. Functional Requirements

### 4.1 Authentication
- Phone OTP login/register (mockable for local dev).
- JWT-based access tokens and refresh tokens.
- Role-based access control (RBAC).
- Token refresh and logout.

### 4.2 User Management
- Separate customer and provider profiles.
- Profile images, addresses, location.
- Provider verification status:
  - `pending_kyc`
  - `under_review`
  - `verified`
  - `rejected`
  - `suspended`

### 4.3 Service Catalog
- Hierarchical categories and subcategories.
- Each category has:
  - Name in English and Hindi
  - Icon
  - Commission configuration
- Providers can list services under categories with their own pricing.

### 4.4 Search & Discovery
- Customers see only `verified` providers.
- Search by:
  - Category
  - Location/radius
  - Availability
  - Rating
  - Price range

### 4.5 Booking Workflow
1. Customer selects service and provider.
2. Selects date/time and describes work.
3. Provider receives request.
4. Provider accepts/rejects/proposes new time.
5. Provider updates progress status.
6. Provider adds material charges if any.
7. Final amount computed (service + material + commission logic → displayed transparently).
8. Customer pays online or cash.
9. Booking marked completed.
10. Customer reviews provider.

### 4.6 Pricing
- Provider defines own rates per service type.
- Material charges added during job with description.
- Platform commission:
  - Configurable at category/global level
  - Free, fixed, or percentage
  - Commission calculated on total job value
- Provider receives: total − commission.

### 4.7 Payments
- Multiple payment methods:
  - Cash/offline
  - Online via admin-configured payment gateway (Razorpay, Stripe, etc.)
- **Admin-configurable gateway** (no server restart needed):
  - Admin can add/edit/remove gateways from dashboard
  - Enable/disable gateways at runtime
  - Store gateway credentials securely in DB
  - Select default gateway for the platform
  - Env variable as fallback if no DB config exists
- Strategy pattern for gateway abstraction:
  - `PaymentGateway` interface with pluggable implementations
  - `RazorpayGateway`, `StripeGateway`, etc.
  - Selected via admin config, not hardcoded
- Wallet support for refunds/credits.
- Transaction ledger.

### 4.8 Notifications
- Push notifications via Firebase Cloud Messaging.
- SMS via pluggable provider.
- In-app notifications.

### 4.9 Reviews & Ratings
- Customer rates provider after booking completion.
- Provider can view ratings.
- Admin can moderate reviews.

### 4.10 Chat
- Real-time messaging between customer and provider via Socket.io.

---

## 5. Non-Functional Requirements

- **Scalability**: Modular monolith design, ready to split into microservices.
- **Security**: Password hashing, JWT, RBAC, input validation, rate limiting.
- **Performance**: Database indexing, Redis caching, pagination.
- **Reliability**: Proper error handling, logging, transactional operations.
- **API Design**: RESTful, versioned (`/api/v1/...`), consistent response format.
- **Testability**: Local Docker setup with seeded data.
- **i18n**: English + Hindi from MVP.

---

## 6. Local Development Environment

Docker Compose will provide:
- PostgreSQL database
- Redis cache
- Backend API server

Flutter app and React admin will connect to local backend.

### Run Backend Locally
```bash
cd backendapi
cp .env.example .env
# Edit .env values if needed
docker-compose up -d
npm run migration:run
npm run seed
npm run start:dev
```

---

## 7. Implementation Phases

### Phase 1 — Foundation ✅ COMPLETED
- [x] Project scaffolding (NestJS)
- [x] Docker Compose setup (PostgreSQL + Redis)
- [x] Database design and entities (15 entities)
- [x] Authentication (Phone OTP + JWT + Passport)
- [x] User management (CRUD, status)
- [x] KYC document upload (provider verification)
- [x] Admin user management (activate/suspend/remove)
- [x] Service categories (EN/HI)
- [x] Commission engine (free/fixed/percentage)
- [x] Seed data (admin, customer, provider, 5 categories)
- [x] Swagger API docs at `/api`

### Phase 2 — Core Business Logic ✅ COMPLETED
- [x] Provider services and pricing (hourly/daily/fixed)
- [x] Booking workflow (request → accept → on the way → working → completed)
- [x] Booking charges (material/parts added during job)
- [x] Search/discovery (by category, location, rating, availability)

### Phase 3 — Payments & Commission ✅ COMPLETED
- [x] Payment gateway config table (`payment_gateway_configs`)
  - `type` (razorpay/stripe/cash)
  - `name` (display name)
  - `credentials` (encrypted JSON via AES-256-GCM)
  - `isActive` (enabled/disabled)
  - `isDefault` (primary gateway)
- [x] Admin gateway management (add/edit/remove/enable/disable)
- [x] Strategy pattern gateway abstraction (`PaymentGateway` interface)
- [x] Razorpay gateway implementation
- [x] Stripe gateway implementation
- [x] Cash/offline payment flow
- [x] Webhook handling (Razorpay + Stripe signature verification, idempotency)
- [x] Payment order creation (`POST /payments/create-order`)
- [x] Payment status polling (`GET /payments/:id/status`)
- [x] Wallet system (auto-create, balance, transactions)
- [x] Provider payout wallet (auto-credited on payment success)
- [x] Commission calculation and deduction
- [x] Transaction ledger (booking payout, commission owed, settlement, admin adjust)
- [x] Commission settlement (FIFO via `LedgerService`)
- [x] Provider soft-block on excessive outstanding commissions
- [x] Admin-configurable soft-block threshold
- [x] Admin initiated refunds (wallet credit + gateway refund)
- [x] Encrypted credential storage (AES-256-GCM with env key)

### Phase 4 — Engagement ✅ COMPLETED
- [x] Real-time chat (Socket.io via `ChatGateway`)
  - Join booking room (`join`)
  - Send message (`send_message`)
  - Mark as read (`mark_read`)
  - Message history on join
- [x] Reviews and ratings (after booking completion)
  - Create review (`POST /reviews`)
  - View by provider (`GET /reviews/provider/:id`)
  - View by customer (`GET /reviews/customer/:id`)
  - View by booking (`GET /reviews/booking/:id`)
  - Auto-updates provider average rating
- [x] In-app notifications (REST API)
  - List notifications (`GET /notifications`)
  - Unread count (`GET /notifications/unread-count`)
  - Mark as read (`PATCH /notifications/:id/read`)
  - Mark all as read (`PATCH /notifications/read-all`)

### Phase 5 — Mobile & Web UI ✅ COMPLETED
- [x] Flutter mobile app (Customer + Provider)
- [x] React admin dashboard (TailwindCSS)
- [ ] Polish, testing, deployment prep

### Phase 6 — Location-Based Provider Discovery ✅ COMPLETED
- [x] GPS location capture (Flutter)
  - `geolocator` + `permission_handler` packages
  - Location permission request flow
  - Save GPS coordinates to profile via `PATCH /users/profile`
- [x] Backend location support
  - `latitude`/`longitude` fields in `UpdateProfileDto`
  - `users.service.ts` saves coordinates for both customer and provider
  - Seed data with real Delhi/Mumbai coordinates
  - `serviceRadiusKm` column on Provider entity (default 10km)
- [x] Nearby provider discovery
  - Customer home uses `GET /services/search` with lat/lng/radius
  - Radius filter chips (2km / 5km / 10km / 25km / All)
  - Distance displayed on provider cards ("2.3 km away")
  - Haversine distance calculation
  - Nearest-first sorting
- [x] Provider detail enhancements
  - Distance badge ("2.3 km from you")
  - Estimated travel time
  - "Get Directions" button (opens Google Maps)
  - "Ask a Question" button (pre-booking chat)
- [x] Pre-booking direct chat
  - `DirectMessage` entity (customer ↔ provider without booking)
  - Socket events: `start_direct_chat`, `send_direct_message`, `join_direct_chat`
  - Flutter chat screen supports `direct` mode
- [x] Live location sharing
  - `share_location` / `customer_share_location` socket events
  - `provider_location` / `customer_location` broadcast events
  - Real-time location during active bookings

### Phase 7 — Reviews & Private Provider Feedback 🔄 IN PROGRESS
- [x] Customer → Provider public reviews (existing)
  - Customer rates provider after completed booking
  - Affects provider `averageRating` and `totalReviews`
  - Visible to customer, provider, and admin
- [x] Admin mobile reviews screen (existing)
- [x] Private provider feedback plan approved
- [ ] **Provider → Customer private feedback** (this phase)
  - `CustomerFeedback` entity: provider-only feedback about customer
  - Fields: booking, provider, customer, rating, comment, tags
  - Tags: `paid_on_time`, `cancelled_last_minute`, `no_show`, `rude_behavior`, `good_customer`, `changed_location`
  - Visible only to provider + admin
  - **Does NOT affect public customer rating**
  - API endpoints:
    - `POST /feedbacks/customer` — provider submits feedback
    - `GET /feedbacks/customer/provider/me` — provider lists own feedback
    - `GET /admin/customer-feedbacks` — admin views all
- [ ] Flutter provider app: "Add Private Feedback" on completed bookings
- [ ] Flutter admin app: "Customer Feedback" section

### Why Private Feedback?
- Provider has a voice about risky/difficult customers.
- Avoids misuse of public customer ratings.
- Admin uses private feedback for abuse/fraud detection.
- Public customer reputation is **not** implemented initially (can be added later).

---

## 8. Notes for Implementation

- KYC documents must be approved before the provider is visible to customers.
- Payment gateway should be configurable via environment variables to switch providers.
- Commission engine should be flexible and not hardcoded.
- Mock OTP for local development; real SMS gateway for production.

---

## 9. Backend Setup (Local Development)

```bash
# Prerequisites: Node.js 20+, Docker Desktop running

cd backendapi

# Start PostgreSQL + Redis
docker-compose up -d

# Install dependencies
npm install

# Build
npm run build

# Seed sample data (admin, customer, provider, categories)
npm run seed

# Start dev server (http://localhost:3000)
npm run start:dev

# Swagger docs at http://localhost:3000/api
```

### Seed Data
| User | Phone | Role |
|------|-------|------|
| Admin | 9999999999 | admin |
| Rahul Sharma | 9876543210 | customer |
| Amit Kumar | 9876543211 | provider |

**Mock OTP Code:** `123456` (for all users in dev)
