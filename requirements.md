# DesiCompany — Application Requirements

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
  - Online via configured Indian payment gateway (e.g., Razorpay)
- Wallet support for refunds/credits.
- Transaction ledger.
- Configurable gateway via environment settings.

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

### Phase 1 — Foundation (Backend First)
- Project scaffolding
- Docker Compose setup
- Database design and entities
- Authentication (OTP + JWT)
- User management
- KYC document upload
- Admin user management

### Phase 2 — Core Business Logic
- Service categories
- Provider services and pricing
- Booking workflow
- Search/discovery

### Phase 3 — Payments & Commission
- Wallet
- Payment gateway integration
- Commission engine
- Transaction ledger

### Phase 4 — Engagement
- Real-time chat
- Reviews and ratings
- Notifications

### Phase 5 — Admin Web & Mobile UI
- Admin dashboard
- Customer mobile app
- Provider mobile app
- Polish, testing, deployment prep

---

## 8. Notes for Implementation

- KYC documents must be approved before the provider is visible to customers.
- Payment gateway should be configurable via environment variables to switch providers.
- Commission engine should be flexible and not hardcoded.
- Mock OTP for local development; real SMS gateway for production.
