# DesiCompany — AWS Deployment Guide

Step-by-step guide to deploy the DesiCompany stack (NestJS backend + Flutter mobile app + React admin)
to AWS, set up S3 storage and Twilio SMS, build a production `.apk`, and keep secrets out of GitHub.

> **Conventions used below**
> - Replace `desicompany-api.com` with your real domain.
> - Replace `REPLACE_WITH_64_CHAR_HEX...` with real generated values.
> - Commands are written for a terminal (bash/zsh on macOS/Linux, Git Bash on Windows).

---

## 0. Prerequisites

- An AWS account (free tier is enough to start).
- AWS CLI installed and configured: `aws configure` (needs Access Key + Secret + region).
- A domain name you control (for HTTPS + sending the APK link + Twilio sender verification).
- Node.js 22, Docker, and Flutter 3.27+ installed locally for building.
- Flutter `flutter doctor` passes (Android toolchain present for APK build).

---

## 1. Architecture overview (what we'll build on AWS)

```
                        Route 53 (your domain)
                                |
                        ACM certificate (HTTPS)
                                |
                        Application Load Balancer  :443
                                |
                +---------------+---------------+
                |                               |
        ECS Fargate (backendapi)          (optional) EC2 for admin
        - NestJS container                 React admin built to S3+CloudFront
        - Talks to RDS + ElastiCache       or served from same ALB
                |
        +-------+--------+
        |                |
   RDS PostgreSQL    ElastiCache (Redis)
        |
   S3 bucket (chat images, KYC docs, uploads)  <-- StorageService
        |
   Twilio (SMS OTP)  <-- twilio-sms.provider
```

For a first deploy you can simplify: **ECS Fargate for the backend**, **RDS + ElastiCache**, **S3 for files**, and build the **admin** to a static S3 site behind CloudFront. The **mobile app** is a downloadable `.apk` (or Play Store later).

---

## 2. Secrets safety — keep `.env` out of GitHub

This is critical. Your `backendapi/.env` contains JWT secrets, DB password, Twilio and AWS keys.
It is already in `.gitignore` (good), but never paste it into chat or commit it.

**Two rules:**
1. The `.env` file is used in `docker-compose.yml` via `env_file: .env` — it runs locally/in container only.
2. On AWS (ECS), secrets go into **AWS Secrets Manager** or **SSM Parameter Store**, NOT in the image or repo.

### 2.1 `.gitignore` is already correct
`backendapi/.gitignore` already ignores `.env`. Verify it stays ignored:

```bash
git check-ignore backendapi/.env && echo "OK: .env is ignored"
```

If it prints nothing, `.env` is NOT ignored — stop and fix `.gitignore` before committing.

### 2.2 Where the real `.env` lives
- **Local / docker-compose:** `backendapi/.env` (copy from `sample.env`).
- **AWS ECS:** store each value in Secrets Manager, then inject as env vars in the task definition.

Create secrets in AWS (example for the two most sensitive):

```bash
aws secretsmanager create-secret --name desicompany/JWT_SECRET \
  --secret-string "REPLACE_WITH_64_CHAR_HEX_STRING_0123456789abcdef0123456789abcdef"

aws secretsmanager create-secret --name desicompany/JWT_REFRESH_SECRET \
  --secret-string "REPLACE_WITH_64_CHAR_HEX_STRING_0123456789abcdef0123456789abcdef"
```

Then in the ECS task definition, map them to env vars:
```json
{ "name": "JWT_SECRET", "valueFrom": "arn:aws:secretsmanager:...:secret:desicompany/JWT_SECRET-xxxx" }
```

> Never set `AWS_SECRET_ACCESS_KEY` / `TWILIO_AUTH_TOKEN` as plaintext in the task definition. Use `valueFrom`.

---

## 3. Generate the real `.env` values

Copy the sample and fill in real values:

```bash
cd backendapi
cp sample.env .env
# edit .env with your editor
```

Generate the secrets locally (do NOT commit the output):

```bash
openssl rand -hex 32   # -> JWT_SECRET  (64 hex chars)
openssl rand -hex 32   # -> JWT_REFRESH_SECRET
openssl rand -hex 32   # -> PAYMENT_GATEWAY_ENCRYPTION_KEY (32 bytes = 64 hex)
```

> Note: `RAZORPAY_KEY_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `TWILIO_*`, and the AWS keys come from those providers' dashboards (steps 4 and 5).

---

## 4. AWS S3 storage setup

The backend uses `StorageService`. Set `STORAGE_PROVIDER=s3` to activate `S3StorageProvider`
(the code reads `S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
and optionally `S3_PUBLIC_URL`/`CDN_URL`).

### 4.1 Create the bucket
```bash
aws s3api create-bucket \
  --bucket desicompany-uploads \
  --region ap-south-1 \
  --create-bucket-configuration LocationConstraint=ap-south-1
```

Enable public read for uploaded files (the provider sets `ACL: public-read` on uploads),
OR better: keep the bucket private and serve via CloudFront OAC. For a simple start, allow public objects:

```bash
aws s3api put-public-access-block \
  --bucket desicompany-uploads \
  --public-access-block-configuration BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false
```

### 4.2 Create an IAM user for the backend (least privilege)
Create a user + access key that ONLY has S3 access to this bucket:

```bash
aws iam create-user --user-name desicompany-s3
aws iam put-user-policy --user-name desicompany-s3 --policy-name s3-readwrite --policy-document '{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow",
      "Action": ["s3:PutObject","s3:GetObject","s3:DeleteObject","s3:ListBucket"],
      "Resource": ["arn:aws:s3:::desicompany-uploads",
                   "arn:aws:s3:::desicompany-uploads/*"] }
  ]
}'
aws iam create-access-key --user-name desicompany-s3
```

Save the returned `AccessKeyId` and `SecretAccessKey` — put them in `.env` as
`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`.

### 4.3 Add S3 vars to `.env`
Append these to `backendapi/.env` (the `sample.env` is MISSING them — add manually):

```env
# File storage (S3)
STORAGE_PROVIDER=s3
S3_BUCKET=desicompany-uploads
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
S3_PUBLIC_URL=https://desicompany-uploads.s3.ap-south-1.amazonaws.com
# CDN_URL=https://d1234.cloudfront.net   # optional, if using CloudFront
```

> In ECS, set these as env vars from Secrets Manager / SSM instead of a file.

---

## 5. Twilio SMS (OTP) setup

The backend uses `src/sms/twilio-sms.provider.ts` and reads `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`. If unset, SMS is only logged (dev mode).

### 5.1 Create Twilio account
1. Sign up at twilio.com, create a project.
2. Buy a phone number with SMS capability.
3. From the console, copy:
   - Account SID
   - Auth Token
   - The phone number in E.164 format, e.g. `+919876543210`

### 5.2 Add Twilio vars to `.env`
Append to `backendapi/.env`:

```env
# Twilio (SMS OTP)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+919876543210
```

### 5.3 Turn OFF mock OTP in production
In `sample.env` OTP mock is `true`. For real SMS, set in `.env`:

```env
OTP_MOCK=false
# OTP_MOCK_CODE=123456   # remove or comment out for production
```

> Keep `OTP_MOCK=true` + `OTP_MOCK_CODE=123456` ONLY for local testing. In production, real OTPs are
> generated and sent via Twilio. (Note: the OTP generator currently uses `Math.random()` — consider
> hardening it, but it works for sending real codes.)

---

## 6. Backend on AWS (ECS Fargate + RDS + ElastiCache)

### 6.1 Database — RDS PostgreSQL
```bash
aws rds create-db-instance \
  --db-instance-identifier desicompany-db \
  --db-instance-class db.t3.micro \
  --engine postgres --engine-version 16 \
  --allocated-storage 20 \
  --master-username desicompany \
  --master-user-password "CHANGE_ME_STRONG" \
  --region ap-south-1
```

Add to `.env` / ECS env:
```env
DB_HOST=<rds-endpoint>.rds.amazonaws.com
DB_PORT=5432
DB_USERNAME=desicompany
DB_PASSWORD=CHANGE_ME_STRONG
DB_NAME=desicompany
DB_SYNCHRONIZE=false
```

### 6.2 Redis — ElastiCache
```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id desicompany-redis \
  --engine redis --cache-node-type cache.t3.micro \
  --num-cache-nodes 1 --region ap-south-1
```

```env
REDIS_HOST=<redis-endpoint>.cache.amazonaws.com
REDIS_PORT=6379
```

### 6.3 Build & push the backend image
The repo already has `Dockerfile` (multi-stage, runs `node dist/main.js`).

```bash
cd backendapi
aws ecr create-repository --repository-name desicompany-backend
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <accountId>.dkr.ecr.ap-south-1.amazonaws.com

docker build -t desicompany-backend .
docker tag desicompany-backend:latest <accountId>.dkr.ecr.ap-south-1.amazonaws.com/desicompany-backend:latest
docker push <accountId>.dkr.ecr.ap-south-1.amazonaws.com/desicompany-backend:latest
```

### 6.4 Run on ECS Fargate
- Create an ECS cluster (`desicompany-cluster`).
- Create a Task Definition `desicompany-backend`:
  - Container image = the ECR URI above.
  - Port 3000.
  - Env vars = all values from `.env`, sensitive ones via Secrets Manager `valueFrom`.
  - Health check: `wget -q http://localhost:3000/api/v1/health/live`.
- Create a Load Balancer (ALB) + target group → ECS service.

### 6.5 HTTPS (ACM + Route 53)
1. Request a public cert in ACM for `api.desicompany-api.com` (validate via Route 53).
2. Point `api.desicompany-api.com` → ALB.
3. Set `CORS_ALLOWED_ORIGINS=https://admin.desicompany-api.com` in env.

### 6.6 Run migrations & seed on first deploy
```bash
# From a temporary task or locally against RDS:
cd backendapi
export $(grep -v '^#' .env | xargs)   # only on trusted machine
npm run migration:run
npm run seed
```

> `NODE_ENV=production` auto-runs migrations (`migrationsRun:true`). The seed creates the
> admin (9999999999), customer (9876543210), provider (9876543211).

---

## 7. Admin dashboard (React → S3 + CloudFront)

`adminweb/.env.example` only has `VITE_API_BASE=/api/v1`. For production point it at the ALB:

Create `adminweb/.env`:
```env
VITE_API_BASE=https://api.desicompany-api.com/api/v1
# Leave empty so no real admin number ships in the bundle (recommended for prod).
# Set only in trusted env when you want a hint on the login screen.
VITE_ADMIN_PHONE_HINT=
```

Build and deploy:
```bash
cd adminweb
npm install
npm run build          # outputs dist/
aws s3 sync dist/ s3://desicompany-admin/ --delete
```

Serve via CloudFront (HTTPS) in front of `desicompany-admin` bucket, domain `admin.desicompany-api.com`.

> Vite proxies `/api/*` to localhost only in dev. In production the app calls `VITE_API_BASE`
> directly, so the ALB origin must allow CORS from `admin.desicompany-api.com`.

---

## 8. Build the Flutter Android APK

The app reads the API base URL at build time via `--dart-define=API_BASE_URL=...`.
For a physical device you MUST point it at your public ALB URL.

### 8.1 Build release APK
```bash
cd frontendapp
flutter pub get
flutter build apk --release \
  --dart-define=API_BASE_URL=https://api.desicompany-api.com/api/v1
```

Output: `frontendapp/build/app/outputs/flutter-apk/app-release.apk`

> The `ApiService` throws in release if `API_BASE_URL` is missing, so this flag is required.
> WebSocket URLs are derived from the same base (http→ws, https→wss), so no extra flag needed.

### 8.2 Test on a physical Android device
1. Transfer `app-release.apk` to the phone (USB, or host it on the S3 bucket / a simple link).
2. On the phone, open the file and allow "Install from unknown sources".
3. Sign in with seed credentials (OTP mock must be off in prod, so use the real Twilio OTP):
   - Admin: `9999999999`
   - Customer: `9876543210`
   - Provider: `9876543211`

### 8.3 (Optional) Google Play release
For Play Store you need an app bundle instead:
```bash
flutter build appbundle --release \
  --dart-define=API_BASE_URL=https://api.desicompany-api.com/api/v1
```
Output: `build/app/outputs/bundle/release/app-release.aab`

---

## 9. Full `.env` reference (backend)

This is the complete set of variables the code actually reads. The shipped `sample.env`
is MISSING the S3/Twilio/storage lines — use this table as the source of truth.

| Variable | Required | Example / Notes |
|---|---|---|
| `DB_HOST` | yes | RDS endpoint |
| `DB_PORT` | yes | `5432` |
| `DB_USERNAME` | yes | |
| `DB_PASSWORD` | yes | strong random |
| `DB_NAME` | yes | `desicompany` |
| `DB_SYNCHRONIZE` | no | `false` in prod |
| `DB_POOL_MAX` / `DB_IDLE_TIMEOUT` / `DB_CONNECTION_TIMEOUT` | no | tuning |
| `JWT_SECRET` | yes | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | yes | `openssl rand -hex 32` |
| `JWT_EXPIRATION_MINUTES` | no | default 15 |
| `REDIS_HOST` | yes | ElastiCache endpoint |
| `REDIS_PORT` | yes | `6379` |
| `REDIS_URL` | no | alternative to host/port |
| `CORS_ALLOWED_ORIGINS` | yes | comma-separated, e.g. `https://admin.desicompany-api.com` |
| `OTP_MOCK` | yes | `false` in prod |
| `OTP_MOCK_CODE` | dev only | `123456` |
| `PAYMENT_GATEWAY_ENCRYPTION_KEY` | yes | `openssl rand -hex 32` (32 bytes) |
| `RAZORPAY_KEY_ID` | if razorpay | `rzp_live_...` |
| `RAZORPAY_KEY_SECRET` | if razorpay | |
| `STRIPE_SECRET_KEY` | if stripe | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | if stripe | |
| `PAYMENT_GATEWAY` | no | default gateway type |
| `STORAGE_PROVIDER` | yes (prod) | `s3` |
| `S3_BUCKET` | if s3 | `desicompany-uploads` |
| `AWS_REGION` | if s3 | `ap-south-1` |
| `AWS_ACCESS_KEY_ID` | if s3 | from IAM user |
| `AWS_SECRET_ACCESS_KEY` | if s3 | from IAM user |
| `S3_PUBLIC_URL` | no | bucket URL or CloudFront |
| `CDN_URL` | no | CloudFront URL |
| `TWILIO_ACCOUNT_SID` | if SMS | `AC...` |
| `TWILIO_AUTH_TOKEN` | if SMS | |
| `TWILIO_PHONE_NUMBER` | if SMS | `+9198...` |
| `FIREBASE_CREDENTIALS_PATH` | no | admin SDK JSON path for push |
| `SENTRY_DSN` | no | error monitoring |
| `NODE_ENV` | yes | `production` |
| `PORT` | no | `3000` |
| `API_PREFIX` | no | `/api/v1` |

---

## 10. Deploy checklist

- [ ] `.env` is git-ignored and never committed.
- [ ] Real JWT/refresh/encryption keys generated with `openssl rand -hex 32`.
- [ ] S3 bucket created + IAM user with least-privilege S3 policy.
- [ ] `STORAGE_PROVIDER=s3` + AWS keys set; upload a test image, confirm URL works.
- [ ] Twilio SID/token/number set; `OTP_MOCK=false`; test a real OTP SMS.
- [ ] RDS + ElastiCache running; backend task connects; `/health/live` green.
- [ ] ACM cert + Route 53; ALB on 443; CORS allows admin origin.
- [ ] Migrations run; seed loaded (admin/customer/provider exist).
- [ ] Admin built + deployed to S3/CloudFront with `VITE_API_BASE` pointing at ALB.
- [ ] APK built with `--dart-define=API_BASE_URL=https://api.desicompany-api.com/api/v1`.
- [ ] Installed APK on phone; logged in with seed number; real OTP received.

---

## 11. Quick local-to-prod sanity test (mobile)

1. Open the APK, enter `9999999999` (admin).
2. Tap "Send OTP" → you should receive a real SMS via Twilio.
3. Enter the code → you land on the admin/role picker.
4. Post a job as customer, accept as provider, send a chat image → confirm the image
   is served from the S3 URL (`S3_PUBLIC_URL`), not localhost.
5. Check `GET /users/:id` is locked down (see code-quality review) before public launch.
