# Production Readiness Checklist

> Generated: 2026-06-24
> Use this checklist before deploying to production.

---

## 🔴 Must Fix

### 1. JWT secrets — generate real values

**File:** `backendapi/.env`

```
JWT_SECRET=desicompany-dev-jwt-secret
JWT_REFRESH_SECRET=desicompany-dev-refresh-secret
```

**Fix:** Generate 64-char hex secrets:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Set both `JWT_SECRET` and `JWT_REFRESH_SECRET` with unique values. **Do not commit the real secrets** — use env vars on the server or a vault.

---

### 2. Disable mock OTP and configure SMS

**File:** `backendapi/.env`

```
OTP_MOCK=true
OTP_MOCK_CODE=123456
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
```

**Fix:**
- Set `OTP_MOCK=false`
- Configure a real SMS provider (Twilio credentials are empty)
- Remove or rotate `OTP_MOCK_CODE`

---

### 3. Replace TypeORM synchronize with migrations

**File:** `backendapi/src/config/database.config.ts`

```typescript
synchronize: process.env.NODE_ENV === 'development',
```

**Risk:** If `NODE_ENV` is unset or misconfigured in production, TypeORM can alter or drop tables.

**Fix:**
- Set `synchronize: false` in production
- Generate and run proper migrations:

```bash
npx typeorm migration:generate src/database/migrations/InitialSchema
npm run build
npx typeorm migration:run
```

- The `database.config.ts` already has a `migrations` path configured, so migration support is ready.

---

### 4. Set real payment gateway encryption key

**File:** `backendapi/.env`

```
PAYMENT_GATEWAY_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
```

**Fix:** Generate a 64-char hex key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### 5. Use a strong database password

**File:** `backendapi/.env`

```
DB_PASSWORD=123456
```

**Fix:** Use a strong password (16+ chars, mixed case + symbols). Must match the `POSTGRES_PASSWORD` env passed to Docker.

---

### 6. Set production CORS origins

**File:** `backendapi/.env`

```
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

**Fix:** Set to your actual production domain(s):

```
CORS_ALLOWED_ORIGINS=https://admin.yourdomain.com
```

---

### 7. Add backend service to docker-compose

**File:** `backendapi/docker-compose.yml`

Only Postgres and Redis are defined — the NestJS app runs outside Docker. For production, add the backend service:

```yaml
backend:
  build: .
  container_name: desicompany_backend
  restart: always
  ports:
    - "3000:3000"
  environment:
    NODE_ENV: production
    DB_HOST: postgres
    REDIS_HOST: redis
  env_file:
    - .env
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
```

**Or** use a separate deployment (ECS, K8s, etc.) — but the app needs to be managed as a service with restart policies and health checks.

---

### 8. Serve admin web in production

**Dev:** Vite proxy forwards `/api` to `localhost:3000`. This doesn't exist in production.

**Fix — option A:** Build admin web and serve from NestJS:

```bash
cd adminweb && npm run build
```

Then in `backendapi/src/main.ts`, add static serving for the built files.

**Fix — option B:** Use a reverse proxy (nginx/Caddy) to serve the built admin web and proxy `/api/*` to the NestJS backend.

---

## 🟡 Should Fix

### 9. Add a global exception filter

**File:** New file: `backendapi/src/common/filters/http-exception.filter.ts`

Unhandled errors return a raw `500 Internal server error`. Add a filter that sanitizes error messages in production (no stack traces, no internal details):

```typescript
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      statusCode: status,
      message: status === 500 ? 'Internal server error' : exception['message'],
    });
  }
}
```

---

### 10. Health check endpoint

**Status:** Already exists — `GET /health` returns `{ status: "ok", database: "connected" }`.

Make sure monitoring tools are pointed at this endpoint.

---

### 11. Swagger in production

**File:** `backendapi/src/main.ts`

```typescript
if (process.env.NODE_ENV !== 'production') {
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
}
```

Swagger is already gated by env, which is adequate. Optionally add basic auth for extra safety.

---

### 12. Run tests and check coverage

```bash
cd backendapi && npm run test:cov
```

Tests exist (`admin-payment-gateways.service.spec.ts`, `admin-refunds.service.spec.ts`, `chat.gateway.spec.ts`, etc.). Ensure they all pass before deploying.

---

### 13. Update Node.js version

**File:** `backendapi/Dockerfile`

```
FROM node:18-alpine
```

Node 18 goes EOL in October 2025. Upgrade to Node 22 LTS for longer support.

---

### 14. Remove deprecated docker-compose `version` key

**File:** `backendapi/docker-compose.yml`

```yaml
version: '3.9'   # ← remove this line
```

Compose ignores it but logs a warning on every run.

---

### 15. Version bump

**File:** `backendapi/package.json`

```json
"version": "0.1.0"
```

Set to `1.0.0` (or appropriate pre-release tag like `1.0.0-beta.1`) before going live.

---

## ✅ Already Done

| Item | Status |
|------|--------|
| Security: admin registration blocked | Fixed |
| Security: login role escalation blocked | Fixed |
| Security: KYC re-activation of suspended users | Fixed |
| Helmet security headers (CSP, HSTS, X-Frame-Options) | Configured |
| Rate limiting (30/min default, 5/min for OTP) | Configured |
| Input validation (whitelist + transform) | Configured |
| CORS config (env-based, ready for prod values) | Configured |
| Docker Postgres + Redis | Running |
| Health check endpoint | Exists at `GET /health` |
| Admin user seed script | Works |
