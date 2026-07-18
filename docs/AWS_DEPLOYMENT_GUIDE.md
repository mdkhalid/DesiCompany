# DesiCompany AWS Production Deployment — Step-by-Step Walkthrough

This guide walks you through deploying DesiCompany to AWS with ECS Fargate, RDS PostgreSQL, ElastiCache Redis, ALB (Load Balancer), S3 file uploads, Twilio SMS, and Razorpay payments.

Architecture:
```
Users → Route 53 → ALB (API) / CloudFront (Admin)
                     │
               ECS Fargate (2 tasks)
               │     │     │
          RDS PG  Redis  S3+CF
```

---

## Step 1: Install AWS CLI

Open terminal (Command Prompt or PowerShell as Administrator):

```bash
# Download and install from:
# https://awscli.amazonaws.com/AWSCLIV2.msi
```

After install:
```bash
aws --version
# Should show: aws-cli/2.x.x
```

---

## Step 2: Create AWS Account

1. Go to https://aws.amazon.com
2. Click "Create an AWS Account"
3. You need a credit/debit card (for identity verification — free tier won't charge)
4. Choose "Basic" support plan (free)

---

## Step 3: Create Admin IAM User

Never use root account for day-to-day.

1. Search "IAM" in AWS console → Users → Create user
2. User name: `desicompany-admin`
3. Check "Provide user access to the AWS Management Console"
4. Choose "I want to create an IAM user"
5. Set password
6. Next → Attach policies directly → check `AdministratorAccess`
7. Create user

Log out of root, log in as `desicompany-admin` using the sign-in URL shown.

Now create access keys for CLI:
1. IAM → Users → `desicompany-admin`
2. Security credentials → Create access key
3. Use case: Command Line Interface (CLI)
4. Download .csv file — SAVE THIS. You won't see the secret again.

Configure CLI:
```bash
aws configure
AWS Access Key ID: AKIAXXXXXXXXXXXXXXXX
AWS Secret Access Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Default region name: ap-south-1
Default output format: json
```

Verify:
```bash
aws sts get-caller-identity
# Should show your account ID
```

---

## Step 4: Generate All Secrets NOW

Open terminal and generate these. Save all values to a text file on your PC.

```bash
# JWT secret (64 char hex)
openssl rand -hex 32

# JWT refresh secret (64 char hex)
openssl rand -hex 32

# Payment gateway encryption key (64 char hex)
openssl rand -hex 32

# Database password (16 char hex)
openssl rand -hex 16
```

You should have 4 values. Keep them safe.

---

## Step 5: AWS Secrets Manager

This is where ALL sensitive data lives. No secrets in code or .env files.

1. AWS Console → Search "Secrets Manager" → Store a new secret
2. Secret type: Other type of secret
3. Key/value pairs: Plaintext
4. Enter this JSON (replace values in **bold** with your actual values):

```json
{
  "NODE_ENV": "production",
  "PORT": "3000",
  "API_PREFIX": "/api/v1",
  "DB_HOST": "PLACEHOLDER_WILL_UPDATE_AFTER_RDS",
  "DB_PORT": "5432",
  "DB_USERNAME": "desicompany",
  "DB_PASSWORD": "PASTE_DB_PASSWORD_FROM_STEP_4",
  "DB_NAME": "desicompany",
  "DB_SYNCHRONIZE": "false",
  "REDIS_HOST": "PLACEHOLDER_WILL_UPDATE_AFTER_REDIS",
  "REDIS_PORT": "6379",
  "JWT_SECRET": "PASTE_JWT_SECRET_FROM_STEP_4",
  "JWT_EXPIRATION_MINUTES": "1440",
  "JWT_REFRESH_SECRET": "PASTE_JWT_REFRESH_SECRET_FROM_STEP_4",
  "JWT_REFRESH_EXPIRATION": "30d",
  "PAYMENT_GATEWAY_ENCRYPTION_KEY": "PASTE_ENCRYPTION_KEY_FROM_STEP_4",
  "COMMISSION_TYPE": "percentage",
  "COMMISSION_VALUE": "10",
  "OTP_MOCK": "false",
  "TWILIO_ACCOUNT_SID": "PLACEHOLDER_WILL_UPDATE_AFTER_TWILIO",
  "TWILIO_AUTH_TOKEN": "PLACEHOLDER_WILL_UPDATE_AFTER_TWILIO",
  "TWILIO_PHONE_NUMBER": "PLACEHOLDER_WILL_UPDATE_AFTER_TWILIO",
  "STORAGE_PROVIDER": "s3",
  "S3_BUCKET": "desicompany-uploads-prod",
  "AWS_REGION": "ap-south-1",
  "S3_PUBLIC_URL": "https://desicompany-uploads-prod.s3.ap-south-1.amazonaws.com",
  "AWS_ACCESS_KEY_ID": "PLACEHOLDER_WILL_UPDATE_AFTER_IAM_S3_USER",
  "AWS_SECRET_ACCESS_KEY": "PLACEHOLDER_WILL_UPDATE_AFTER_IAM_S3_USER",
  "CORS_ALLOWED_ORIGINS": "https://admin.DOMAIN.in,https://DOMAIN.in",
  "LOG_LEVEL": "info",
  "METRICS_ENABLED": "true",
  "PAYMENT_GATEWAY": "razorpay"
}
```

5. Secret name: `desicompany/production`
6. Next → Next → Store

**Copy the Secret ARN** — it looks like:
`arn:aws:secretsmanager:ap-south-1:123456789012:secret:desicompany/production-abc123`

You'll need this for Step 11 (ECS task definition).

---

## Step 6: Buy Domain on Route 53

1. AWS Console → Route 53 → Domains → Register domain
2. Search for your desired domain (e.g., `desicompany.in`, `desicompany.com`)
3. `.in` domain costs ~₹500/year
4. Add to cart → Checkout (you'll need to provide contact info for ICANN)
5. Wait 10-30 min for domain to activate

Your domain: `________________________` (fill in)

---

## Step 7: SSL Certificates (ACM)

We need TWO certificates — one for us-east-1 (CloudFront) and one for ap-south-1 (ALB).

### Certificate 1: ap-south-1 (for Load Balancer)
1. AWS Console → Certificate Manager (ACM)
2. Region: ap-south-1 (Mumbai)
3. Request certificate → Request a public certificate
4. Domain names: `*.yourdomain.in`, `yourdomain.in`
5. Validation method: DNS validation (recommended)
6. Click "Create records in Route 53" for each domain
7. Wait for status: **Issued** (~5 min)

### Certificate 2: us-east-1 (for CloudFront admin dashboard)
1. Switch region to us-east-1 (N. Virginia) — THIS IS REQUIRED for CloudFront
2. Repeat same steps: `*.yourdomain.in`, `yourdomain.in`
3. Click "Create records in Route 53"
4. Wait for status: **Issued**

Note: CloudFront only works with certificates in us-east-1 region. This is an AWS requirement.

---

## Step 8: RDS PostgreSQL Database

1. AWS Console → RDS → Create database
2. Standard create
3. Engine: PostgreSQL, version 16
4. Templates: **Free tier**
5. DB instance identifier: `desicompany-db`
6. Master username: `desicompany`
7. Master password: **Paste DB_PASSWORD from Step 4**
8. Instance: `db.t3.micro` (free tier)
9. Storage: 20 GB gp3, uncheck "Enable storage autoscaling"
10. Connectivity:
    - Don't connect to EC2 compute resource
    - VPC: Default VPC
    - Public access: **No** (only ECS talks to it)
    - VPC security group: Create new → name `desicompany-db-sg`
    - Availability Zone: ap-south-1a
11. Database authentication: Password authentication
12. Additional configuration:
    - Initial database name: `desicompany`
    - Backup: Enable automatic backups, retention 7 days
    - Deletion protection: Disable (for now, enable later for prod)

Click "Create database". Wait ~5-10 min for "Available" status.

Copy the **Endpoint**: `________________________________`
Example: `desicompany-db.abc123xyz.ap-south-1.rds.amazonaws.com`

### Update Secrets Manager NOW:
1. Secrets Manager → `desicompany/production` → Retrieve secret value → Edit
2. Change `DB_HOST` to the RDS endpoint
3. Save

---

## Step 9: ElastiCache Redis

1. AWS Console → ElastiCache → Create cluster
2. Redis OSS
3. Cluster mode: Disabled (single node)
4. Name: `desicompany-redis`
5. Node type: `cache.t3.micro` (free tier)
6. Number of replicas: 0
7. Subnet group: Create new
8. Security group: Create new → name `desicompany-redis-sg`
9. Encryption in transit: Enable
10. Encryption at rest: Enable

Click "Create". Wait ~5-10 min.

Copy the **Primary endpoint**: `________________________________`
Example: `desicompany-redis.abc123.0001.aps1.cache.amazonaws.com`

### Update Secrets Manager NOW:
1. Secrets Manager → `desicompany/production` → Edit
2. Change `REDIS_HOST` to the ElastiCache endpoint
3. Save

---

## Step 10: S3 Bucket for File Uploads

1. AWS Console → S3 → Create bucket
2. Bucket name: `desicompany-uploads-prod`
3. Region: ap-south-1
4. Object Ownership: ACLs enabled
5. **Uncheck** "Block all public access" — uploads need to be publicly readable
6. Acknowledge the warning
7. Create bucket

Click on the bucket → Permissions → Bucket Policy → Edit:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": ["s3:GetObject"],
      "Resource": "arn:aws:s3:::desicompany-uploads-prod/*"
    }
  ]
}
```

Next: Permissions → CORS → Edit:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 3600
  }
]
```

### Create IAM User for S3 Access:

1. IAM → Users → Create user
2. Name: `desicompany-s3-uploads`
3. Attach policies: `AmazonS3FullAccess`
4. Create user
5. Security credentials → Create access key → CLI → Download .csv

Copy the Access Key ID and Secret:
- Access Key ID: `________________________________`
- Secret Access Key: `________________________________`

### Update Secrets Manager NOW:
1. Secrets Manager → `desicompany/production` → Edit
2. Set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
3. Save

---

## Step 11: IAM Role for ECS Tasks

1. IAM → Roles → Create role
2. Trusted entity: AWS Service → Elastic Container Service → ECS Task
3. Name: `desicompany-ecs-task-role`
4. Attach these policies:
   - `AmazonS3FullAccess` (file uploads)
   - `SecretsManagerReadWrite` (read secrets)
   - `CloudWatchLogsFullAccess` (logs)
5. Create role

Copy the ARN: `arn:aws:iam::_________:role/desicompany-ecs-task-role`

---

## Step 12: Docker Build + Push to ECR

Make sure Docker Desktop is installed and running.

```bash
cd D:\MyCode\2026\Projects\DesiCompany\backendapi

# Step 12a: Create ECR repository
aws ecr create-repository --repository-name desicompany-backend --region ap-south-1

# Copy the repository URI:
# <account-id>.dkr.ecr.ap-south-1.amazonaws.com/desicompany-backend
```

```bash
# Step 12b: Login to ECR
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.ap-south-1.amazonaws.com
```

```bash
# Step 12c: Build Docker image
docker build -t desicompany-backend .
```

```bash
# Step 12d: Tag and push
docker tag desicompany-backend:latest <account-id>.dkr.ecr.ap-south-1.amazonaws.com/desicompany-backend:latest

docker push <account-id>.dkr.ecr.ap-south-1.amazonaws.com/desicompany-backend:latest
```

Wait for push to complete. You'll see "digest: sha256:..." at the end.

---

## Step 13: Update ECS Task Definition

You already have `backendapi/ecs-task-definition.json`. We need to update placeholders.

Open `D:\MyCode\2026\Projects\DesiCompany\backendapi\ecs-task-definition.json`

Replace these values:
- `<ACCOUNT_ID>` → Your AWS account ID (12 digits)
- `<RDS_ENDPOINT>` → The RDS endpoint from Step 8
- `<REDIS_ENDPOINT>` → The ElastiCache endpoint from Step 9
- `<S3_USER_ACCESS_KEY_ID>` → S3 IAM user access key from Step 10
- `<REDIS_ENDPOINT>.cache.amazonaws.com` in `environment` → your actual Redis endpoint

Also update the `executionRoleArn`:
```
arn:aws:iam::<ACCOUNT_ID>:role/ecsTaskExecutionRole
```

And `taskRoleArn`:
```
arn:aws:iam::<ACCOUNT_ID>:role/desicompany-ecs-task-role
```

For SECRETS — replace each placeholder with the Secrets Manager ARN from Step 5:
```
arn:aws:secretsmanager:ap-south-1:<ACCOUNT_ID>:secret:desicompany/production-YOURSUFFIX
```

The file references individual secrets but since we're using one JSON secret, we need to use a single JSON secret reference. Here's the proper format:

```json
{
  "family": "desicompany-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::<ACCOUNT_ID>:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::<ACCOUNT_ID>:role/desicompany-ecs-task-role",
  "containerDefinitions": [
    {
      "name": "desicompany-backend",
      "image": "<ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/desicompany-backend:latest",
      "portMappings": [{ "containerPort": 3000, "protocol": "tcp" }],
      "essential": true,
      "healthCheck": {
        "command": ["CMD-SHELL", "wget -q -O- http://localhost:3000/api/v1/health/live || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      },
      "secrets": [
        {
          "name": "DB_HOST",
          "valueFrom": "arn:aws:secretsmanager:ap-south-1:<ACCOUNT_ID>:secret:desicompany/production-xxxxx:DB_HOST::"
        },
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:ap-south-1:<ACCOUNT_ID>:secret:desicompany/production-xxxxx:DB_PASSWORD::"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:ap-south-1:<ACCOUNT_ID>:secret:desicompany/production-xxxxx:JWT_SECRET::"
        },
        {
          "name": "JWT_REFRESH_SECRET",
          "valueFrom": "arn:aws:secretsmanager:ap-south-1:<ACCOUNT_ID>:secret:desicompany/production-xxxxx:JWT_REFRESH_SECRET::"
        },
        {
          "name": "PAYMENT_GATEWAY_ENCRYPTION_KEY",
          "valueFrom": "arn:aws:secretsmanager:ap-south-1:<ACCOUNT_ID>:secret:desicompany/production-xxxxx:PAYMENT_GATEWAY_ENCRYPTION_KEY::"
        },
        {
          "name": "REDIS_HOST",
          "valueFrom": "arn:aws:secretsmanager:ap-south-1:<ACCOUNT_ID>:secret:desicompany/production-xxxxx:REDIS_HOST::"
        },
        {
          "name": "AWS_ACCESS_KEY_ID",
          "valueFrom": "arn:aws:secretsmanager:ap-south-1:<ACCOUNT_ID>:secret:desicompany/production-xxxxx:AWS_ACCESS_KEY_ID::"
        },
        {
          "name": "AWS_SECRET_ACCESS_KEY",
          "valueFrom": "arn:aws:secretsmanager:ap-south-1:<ACCOUNT_ID>:secret:desicompany/production-xxxxx:AWS_SECRET_ACCESS_KEY::"
        },
        {
          "name": "TWILIO_ACCOUNT_SID",
          "valueFrom": "arn:aws:secretsmanager:ap-south-1:<ACCOUNT_ID>:secret:desicompany/production-xxxxx:TWILIO_ACCOUNT_SID::"
        },
        {
          "name": "TWILIO_AUTH_TOKEN",
          "valueFrom": "arn:aws:secretsmanager:ap-south-1:<ACCOUNT_ID>:secret:desicompany/production-xxxxx:TWILIO_AUTH_TOKEN::"
        },
        {
          "name": "TWILIO_PHONE_NUMBER",
          "valueFrom": "arn:aws:secretsmanager:ap-south-1:<ACCOUNT_ID>:secret:desicompany/production-xxxxx:TWILIO_PHONE_NUMBER::"
        }
      ],
      "environment": [
        { "name": "NODE_ENV", "value": "production" },
        { "name": "PORT", "value": "3000" },
        { "name": "API_PREFIX", "value": "/api/v1" },
        { "name": "DB_NAME", "value": "desicompany" },
        { "name": "DB_SYNCHRONIZE", "value": "false" },
        { "name": "DB_USERNAME", "value": "desicompany" },
        { "name": "DB_PORT", "value": "5432" },
        { "name": "REDIS_PORT", "value": "6379" },
        { "name": "CORS_ALLOWED_ORIGINS", "value": "https://admin.DOMAIN.in" },
        { "name": "OTP_MOCK", "value": "false" },
        { "name": "STORAGE_PROVIDER", "value": "s3" },
        { "name": "S3_BUCKET", "value": "desicompany-uploads-prod" },
        { "name": "AWS_REGION", "value": "ap-south-1" },
        { "name": "S3_PUBLIC_URL", "value": "https://desicompany-uploads-prod.s3.ap-south-1.amazonaws.com" },
        { "name": "PAYMENT_GATEWAY", "value": "razorpay" },
        { "name": "COMMISSION_TYPE", "value": "percentage" },
        { "name": "COMMISSION_VALUE", "value": "10" },
        { "name": "LOG_LEVEL", "value": "info" },
        { "name": "METRICS_ENABLED", "value": "true" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/desicompany-backend",
          "awslogs-region": "ap-south-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

---

## Step 14: Create ECS Cluster

1. AWS Console → Elastic Container Service (ECS) → Clusters → Create cluster
2. Cluster name: `desicompany-cluster`
3. Infrastructure: **AWS Fargate (serverless)**
4. Click Create

---

## Step 15: Register Task Definition

1. ECS → Task definitions → Create new task definition
2. Choose: **JSON** (scroll down)
3. Paste your updated JSON from Step 13
4. Click "Create"

---

## Step 16: Create Application Load Balancer

1. EC2 → Load Balancers → Create Load Balancer
2. Application Load Balancer
3. Name: `desicompany-alb`
4. Scheme: Internet-facing
5. IP address type: ipv4
6. VPC: Default VPC
7. Mappings: Check both ap-south-1a and ap-south-1b
8. Security group: Create new → name `desicompany-alb-sg`
   - Rule 1: HTTPS, 443, Source 0.0.0.0/0
   - Rule 2: HTTP, 80, Source 0.0.0.0/0
9. Listeners:
   - HTTP:80 → Default action: Redirect to HTTPS://#{host}:443/#{path}?#{query}, Status code: 301
   - HTTPS:443 → Default action: Forward to... → Create target group:
     - Target type: IP addresses
     - Target group name: `desicompany-tg`
     - Protocol: HTTP, Port: 3000
     - Health check path: `/api/v1/health/live`
     - Healthy threshold: 2, Unhealthy: 5, Timeout: 5, Interval: 30
   - Security policy: ELBSecurityPolicy-TLS-1-2-2017-01
   - Default SSL certificate: Select the ap-south-1 ACM certificate from Step 7

Click "Create load balancer". Note the DNS name:
`desicompany-alb-xxxxxxxx.ap-south-1.elb.amazonaws.com`

---

## Step 17: Create ECS Service

1. ECS → Clusters → `desicompany-cluster` → Services → Create
2. Compute: Launch type → Fargate
3. Task definition: `desicompany-backend` (latest revision)
4. Service name: `desicompany-service`
5. Desired tasks: 2
6. Networking:
   - VPC: Default
   - Subnets: ap-south-1a AND ap-south-1b
   - Security group: Create new → name `desicompany-ecs-sg`
     - Allow TCP port 3000 from the ALB security group
   - Public IP: Turned on
7. Load balancing:
   - Application Load Balancer
   - Select `desicompany-alb`
   - Select `desicompany-tg`
   - Health check grace period: 60 seconds

Click "Create". Wait for tasks to reach "Running" status.

Test it:
```
curl http://<ALB_DNS_NAME>/api/v1/health/live
```
Should return: `{"status":"ok"}`

---

## Step 18: DNS Records (Route 53)

1. Route 53 → Hosted zones → your domain
2. Create record:
   - Record name: `api`
   - Record type: A
   - Alias: Yes
   - Route traffic to: Alias to Application and Classic Load Balancer
   - Region: ap-south-1
   - Choose `desicompany-alb`
   - Create records

3. Also create `admin` record (we'll update later with CloudFront):
   - Record name: `admin`
   - Record type: A
   - Route traffic to: Will update after Step 21

Wait 60 seconds. Test:
```
curl https://api.YOURDOMAIN.in/api/v1/health/live
```

---

## Step 19: Run Database Migrations

You need to run migrations against the RDS database. The simplest way: run locally with RDS credentials.

```bash
cd D:\MyCode\2026\Projects\DesiCompany\backendapi

# Set environment to point to RDS
set DB_HOST=<your-rds-endpoint>
set DB_PORT=5432
set DB_USERNAME=desicompany
set DB_PASSWORD=<your-db-password>
set DB_NAME=desicompany

npm run migration:run
```

If you get a connection error, the RDS security group might be blocking your IP. Temporarily:
1. RDS → `desicompany-db` → Modify → Public accessibility: Yes
2. Security group → Add inbound rule: PostgreSQL (5432) from My IP
3. Run migrations, then revert public access to No

Seed data:
```bash
npm run seed
```

This creates the test users:
- Admin: 9999999999
- Customer: 9876543210
- Provider: 9876543211
- OTP: 123456

---

## Step 20: Set Up Twilio (Real SMS OTP)

1. Go to https://www.twilio.com/ → Sign up (free trial gives you $15 credit)
2. Verify your email and phone number
3. Dashboard → Copy: Account SID, Auth Token
4. Buy a phone number:
   - Phone Numbers → Manage → Buy a number
   - Search: India (+91)
   - Buy any number (mobile capability)
   - Cost: ~₹100/month

### Update Secrets Manager:
1. Secrets Manager → `desicompany/production` → Edit
2. Set the real values:
   - `TWILIO_ACCOUNT_SID`: Paste Account SID
   - `TWILIO_AUTH_TOKEN`: Paste Auth Token
   - `TWILIO_PHONE_NUMBER`: Paste your purchased number (+91XXXXXXXXXX)
3. Save

### Restart ECS tasks to pick up new secrets:
- ECS → `desicompany-cluster` → Services → `desicompany-service` → Update service
- Check "Force new deployment" → Update
- Tasks will restart with new secrets

---

## Step 21: Deploy Admin Dashboard

```bash
cd D:\MyCode\2026\Projects\DesiCompany\adminweb

# Build the React app
npm run build
```

### Create S3 bucket for admin:
1. S3 → Create bucket → `desicompany-admin-prod`
2. Region: ap-south-1
3. **CHECK** "Block all public access" — CloudFront will serve it privately
4. Create bucket

Upload:
```bash
aws s3 sync dist/ s3://desicompany-admin-prod/ --delete
```

### Create CloudFront distribution:
1. CloudFront → Create distribution
2. Origin domain: Select `desicompany-admin-prod.s3.ap-south-1.amazonaws.com`
3. Origin access: Origin access control settings (OAC) — recommended
   - Create new OAC → Create
4. Viewer protocol policy: Redirect HTTP to HTTPS
5. Alternate domain name (CNAME): `admin.YOURDOMAIN.in`
6. Custom SSL certificate: Select the us-east-1 certificate from Step 7
7. Default root object: `index.html`
8. Error pages → Create custom error response:
   - Error code: 403 → Response page: /index.html, HTTP code: 200
   - Error code: 404 → Response page: /index.html, HTTP code: 200
9. Create distribution

Wait ~5-10 min for CloudFront to deploy.

Update S3 bucket policy to allow CloudFront OAC:
1. S3 → `desicompany-admin-prod` → Permissions → Bucket Policy
2. Use the policy CloudFront provides (it's shown on the distribution page after OAC creation)

### Update Route 53 `admin` record:
1. Route 53 → `admin.YOURDOMAIN.in` → Edit
2. Type: A, Alias: Yes
3. Route to: Alias to CloudFront distribution
4. Select your CloudFront distribution
5. Save

Test: Open `https://admin.YOURDOMAIN.in`

---

## Step 22: Set Up Razorpay Payments

### Get Test Keys:
1. Go to https://dashboard.razorpay.com/ → Sign up
2. Settings → API Keys → Generate test keys
3. You'll get: Key ID (`rzp_test_xxx`), Key Secret

### Configure in Admin Panel:
1. Open your app or admin dashboard
2. Login as admin (9999999999 / OTP: 123456 — but wait, Twilio isn't connected yet)
3. Actually — for first login, temporarily set `OTP_MOCK=true` in Secrets Manager
4. Restart ECS tasks
5. Login as admin
6. Go to Gateways → Add Gateway → Razorpay
7. Paste Key ID and Key Secret
8. Set as Default → Activate

**These keys are encrypted with AES-256-GCM using the PAYMENT_GATEWAY_ENCRYPTION_KEY from Step 4.**

### For Live Payments:
1. Complete KYC on Razorpay dashboard
2. Generate live keys
3. Update in admin panel → Gateway settings

---

## Step 23: Security Hardening

### RDS Security Group:
1. VPC → Security Groups → `desicompany-db-sg`
2. Inbound rules: Only PostgreSQL (5432) from ECS security group
3. REMOVE any "My IP" rule you added for migrations

### ElastiCache Security Group:
1. VPC → Security Groups → `desicompany-redis-sg`
2. Inbound rules: Only Redis (6379) from ECS security group

### ECS Security Group:
1. VPC → Security Groups → `desicompany-ecs-sg`
2. Inbound rules: Only port 3000 from ALB security group

### ALB Security Group:
1. VPC → Security Groups → `desicompany-alb-sg`
2. Inbound: HTTPS 443 from 0.0.0.0/0, HTTP 80 from 0.0.0.0/0

### Enable WAF (optional, ~$5/mo extra):
1. WAF → Web ACLs → Create
2. Add managed rules: AWS-AWSManagedRulesCommonRuleSet (blocks SQL injection, XSS)
3. Associate with ALB

---

## Step 24: Build Flutter App for Production

```bash
cd D:\MyCode\2026\Projects\DesiCompany\frontendapp

# Clean first
flutter clean
flutter pub get

# Android App Bundle (for Google Play Store)
flutter build appbundle --release --dart-define=API_BASE_URL=https://api.YOURDOMAIN.in/api/v1

# OR Android APK (for direct install)
flutter build apk --release --dart-define=API_BASE_URL=https://api.YOURDOMAIN.in/api/v1

# Output at: build\app\outputs\bundle\release\app-release.aab
# OR: build\app\outputs\flutter-apk\app-release.apk
```

---

## Step 25: Final Verification Checklist

- [ ] `https://api.YOURDOMAIN.in/api/v1/health/live` returns `{"status":"ok"}`
- [ ] ECS has 2 tasks Running
- [ ] Admin dashboard loads at `https://admin.YOURDOMAIN.in`
- [ ] Login works (OTP arrives via Twilio SMS)
- [ ] Customer can post a job
- [ ] Provider can see open jobs
- [ ] Chat works (WebSocket connects to `wss://api.YOURDOMAIN.in/chat`)
- [ ] Upload image in chat → appears on S3
- [ ] Razorpay configured in admin → payment test works
- [ ] App built with production URL, installed on phone, works

---

## Monthly Cost (~$50 USD)

| Service | Spec | Monthly |
|---------|------|---------|
| ECS Fargate | 2x 0.5 vCPU, 1GB | ~$25 |
| RDS | t3.micro (free 12mo) | $0 → $15 |
| ElastiCache | t3.micro (free 12mo) | $0 → $12 |
| ALB | 1 ALB | ~$20 |
| S3 + CloudFront | Low traffic | ~$5 |
| Route 53 | 1 hosted zone | ~$0.50 |
| Secrets Manager | 1 secret | ~$0.50 |
| WAF (optional) | 1 web ACL | ~$5 |

---

## What's NOT Covered (Future)

- AWS ECR lifecycle policies (auto-delete old images)
- CI/CD pipeline (GitHub Actions → auto build + deploy)
- CloudWatch alarms (CPU/memory alerts)
- Auto-scaling policies (scale based on request count)
- S3 lifecycle policies (expire old uploads)
- Database automated snapshots beyond 7 days
- Multi-AZ database (for production — costs double)
