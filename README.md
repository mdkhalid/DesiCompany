# DesiCompany

A **local service marketplace** that connects customers with service providers — plumbing, electrical, repairs, daily-wage labour, and more. Built as three apps sharing one backend:

| App | Tech | Runs on |
|-----|------|---------|
| **Mobile app** | Flutter | Android / iOS / Web |
| **Backend API** | NestJS 11 + PostgreSQL + Redis | Server / localhost |
| **Admin dashboard** | React 18 + Vite + Tailwind | Web browser |

---

## Table of Contents
1. [Quick Start (5 minutes)](#quick-start-5-minutes)
2. [Log In / Test Accounts](#log-in--test-accounts)
3. [Features by Role](#features-by-role)
   - [Customer](#customer)
   - [Provider](#provider)
   - [Admin](#admin)
4. [Configuration](#configuration)
5. [Common Commands](#common-commands)
6. [Troubleshooting](#troubleshooting)
7. [Further Docs](#further-docs)

---

## Quick Start (5 minutes)

### Prerequisites
- **Node.js 20+** and **Docker Desktop** (for backend)
- **Flutter 3.27+** (for mobile app)
- An Android device/emulator **or** Chrome

### 1. Start the backend
```bash
cd backendapi
cp .env.example .env          # then fill in secrets (see Configuration)
docker-compose up -d          # PostgreSQL + Redis
npm install
npm run seed                  # creates test users + sample data
npm run start:dev             # http://localhost:3000  (Swagger at /api)
```

### 2. Start the admin dashboard
```bash
cd adminweb
npm install
cp .env.example .env
npm run dev                   # http://localhost:5173
```

### 3. Run the mobile app
```bash
cd frontendapp
flutter pub get
flutter run                   # auto-detects device
# Android emulator:  uses http://10.0.2.2:3000 automatically
# Physical device:   flutter run --dart-define=API_BASE_URL=http://<YOUR_LAN_IP>:3000/api/v1
```

That's it — all three apps are now running and talking to each other.

---

## Log In / Test Accounts

Authentication is **phone number + OTP**. In development, `OTP_MOCK=true` makes every OTP code **`123456`**.

| Role | Phone | Password (OTP) | Where to log in |
|------|-------|----------------|-----------------|
| **Admin** | `9999999999` | `123456` | Admin dashboard (`/login`) — *mobile app does NOT allow admin login* |
| **Customer** | `9876543210` | `123456` | Mobile app |
| **Provider** | `9876543211` | `123456` | Mobile app |

**New users:** Enter any phone → receive OTP → choose **Customer** or **Provider** role on the role-selection screen. (Admins cannot self-register; they are created from the admin panel.)

---

## Features by Role

### Customer
Log in on the mobile app. The bottom navigation has 4 tabs:

| Tab | What you can do |
|-----|-----------------|
| **Home** | Browse service categories, search providers, view provider profiles, post a job request, buy a membership |
| **Requests** | Track your job requests, review incoming quotes from providers, accept a quote to create a booking, open the job-detail screen |
| **Chat** | Message your provider (booking chat or direct message), view conversation list |
| **Account** | Edit profile, view bookings history, wallet & transactions, notifications, write reviews, open support tickets, raise disputes/grievances, switch language (EN/HI) |

**Typical flow:** Post a job → receive quotes → accept one → booking is created → chat with provider → pay (Razorpay/Stripe/Cash) → leave a review.

### Provider
Log in on the mobile app. The bottom navigation has 4 tabs:

| Tab | What you can do |
|-----|-----------------|
| **Requests** | View booking requests targeted to you, accept/decline, manage active jobs |
| **Open Jobs** | Browse the open job marketplace, submit quotes with line items, view your submitted quotes |
| **Chat** | Message customers |
| **Account** | KYC upload, services & charges, schedule & busy slots, reviews about you, customer feedback, wallet & payouts, subscriptions, portfolio, raise grievances |

**Typical flow:** Complete KYC → set services & charges → browse open jobs → submit quotes → on acceptance, start the booking → add material charges → mark complete → receive payment in wallet.

> A user can hold **both** customer and provider roles and switch between them via **Account → switch role**.

### Admin
Log in at the admin dashboard (`http://localhost:5173/login`) with the admin phone. **Only the `admin` role can access it.** Sidebar pages:

| Page | Purpose |
|------|---------|
| **Dashboard** | Platform metrics overview |
| **Users** | Manage customers & providers, ban/activate, create admins |
| **KYC Verification** | Review & approve/reject provider KYC documents |
| **Categories** | Manage service categories |
| **Bookings** | View & monitor all bookings |
| **Payment Gateways** | Add/configure Razorpay/Stripe/Cash gateways (credentials AES-256 encrypted) |
| **Fees & Revenue** | Configure platform fees |
| **Commissions** | Set commission rates + soft-block thresholds |
| **Refunds** | Issue refunds (gateway or wallet credit) |
| **Reviews** | Moderate reviews |
| **Customer Feedback** | Review feedback submissions |
| **Advertisements** | Manage in-app ads |
| **Grievances** | Handle escalation/grievance tickets |
| **Error Logs** | Inspect captured backend errors |
| **Observability** | Health/metrics dashboards |
| **Settings** | Global platform settings |

The mobile app *also* exposes a read-only admin home for quick checks, but day-to-day admin work happens in the web dashboard.

---

## Configuration

### Backend (`backendapi/.env`)
Copy `.env.example` and set at minimum:

| Variable | Notes |
|----------|-------|
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | 64-char hex strings (required, app won't boot without them) |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | Or use `DATABASE_URL` |
| `REDIS_HOST`, `REDIS_PORT` | Or `REDIS_URL` |
| `OTP_MOCK=true` + `OTP_MOCK_CODE=123456` | Dev only — **disable in production** |
| `PAYMENT_GATEWAY_ENCRYPTION_KEY` | 64-char hex (32 bytes) — required for gateway credentials |
| `CORS_ALLOWED_ORIGINS` | e.g. `http://localhost:5173` |

Generate secrets quickly:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Admin (`adminweb/.env`)
- `VITE_API_BASE=/api/v1` (dev proxies `/api/*` to `http://localhost:3000`)

### Mobile (`flutter run --dart-define`)
- `API_BASE_URL` — only needed for physical-device or release builds.

---

## Common Commands

### Backend (`cd backendapi`)
```bash
npm run start:dev              # dev server with watch mode
npm run build && npm run start:prod
npm run seed                   # load sample data
npm run migration:generate -- -n Name   # generate migration
npm run migration:run          # apply migrations
npm run test                   # unit tests
npm run test:e2e               # e2e tests
npm run lint                   # ESLint --fix
```

### Mobile (`cd frontendapp`)
```bash
flutter run                    # run on detected device
flutter run -d chrome          # web
flutter run -d android         # android
flutter analyze                # lint
flutter test                   # tests
flutter build apk --release --dart-define=API_BASE_URL=https://api.example.com/api/v1
```

### Admin (`cd adminweb`)
```bash
npm run dev                    # dev server :5173
npm run build                  # production build (served by backend in prod)
npm run test                   # vitest
npm run lint
```

---

## Troubleshooting

**Mobile app can't reach backend on a real device**
- Phone and computer must be on the same Wi-Fi.
- Use your computer's LAN IP (`ipconfig` on Windows), not `localhost`.
- Allow inbound port 3000 in your firewall.

**"Missing required environment variables" on backend start**
- `JWT_SECRET` and `JWT_REFRESH_SECRET` must be set in `backendapi/.env`.

**Admin login fails / redirects to `/login`**
- Only users with role `admin` can access the dashboard. Use the seeded admin phone `9999999999`.

**iOS build**
- Requires macOS + Xcode. The `ios/` folder may need regenerating: `flutter create --platforms=ios .`

**Database port mismatch**
- `.env.example` uses `DB_PORT=5433`; `docker-compose` exposes `5432`. Keep them consistent.

---

## Further Docs
- `docs/MOBILE_SETUP.md` — detailed Android/iOS device setup
- `docs/FIREBASE_SETUP.md` — push-notification configuration
- `docs/AWS_DEPLOYMENT_GUIDE.md` — production deployment
- `backendapi/README.md` — payments, wallet & commission internals
- Backend Swagger UI — `http://localhost:3000/api` (dev only)
- `AGENTS.md` — architecture & conventions for contributors
