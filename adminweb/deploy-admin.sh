#!/usr/bin/env bash
# Deploy DesiCompany admin dashboard (React) to AWS S3 + CloudFront.
#
# Prerequisites:
#   - AWS CLI configured (aws configure)
#   - Node/npm available
#   - adminweb/.env created with VITE_API_BASE=https://api.desicompany-api.com/api/v1
#   - A Route 53 hosted zone for your domain
#
# What it does:
#   1. Builds the admin (Vite, reads VITE_API_BASE from .env)
#   2. Creates an S3 bucket for static hosting (private) + CloudFront OAC
#   3. Syncs dist/ to S3 and invalidates the CloudFront cache
#   4. Prints the CloudFront URL to wire into Route 53 (admin.desicompany-api.com)
#
# Usage:
#   bash deploy-admin.sh

set -euo pipefail

REGION="${AWS_REGION:-ap-south-1}"
DOMAIN="${ADMIN_DOMAIN:-admin.desicompany-api.com}"
BUCKET="${ADMIN_BUCKET:-desicompany-admin}"
DISTRO_COMMENT="desicompany-admin-${DOMAIN}"

cd "$(dirname "$0")"

echo "==> Installing dependencies"
npm install

echo "==> Building admin (VITE_API_BASE from adminweb/.env)"
npm run build

echo "==> Ensuring S3 bucket: ${BUCKET}"
if ! aws s3api head-bucket --bucket "${BUCKET}" 2>/dev/null; then
  aws s3api create-bucket \
    --bucket "${BUCKET}" \
    --region "${REGION}" \
    ${REGION:+--create-bucket-configuration LocationConstraint="${REGION}"}
fi

# Block all public access — we serve via CloudFront OAC, not public S3.
aws s3api put-public-access-block \
  --bucket "${BUCKET}" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

echo "==> Uploading build to S3"
aws s3 sync dist/ "s3://${BUCKET}/" --delete

echo "==> Creating CloudFront Origin Access Control (OAC)"
OAC_ID=$(aws cloudfront create-origin-access-control \
  --origin-access-control-config "CallerReference=desicompany-${BUCKET}-$(date +%s),Name=desicompany-oac,OriginAccessControlConfig={Description:desicompany,SigningProtocols=[sigv4],Origins:[s3],OriginAccessControlConfig={}}" \
  --query 'OriginAccessControl.Id' --output text 2>/dev/null || echo "")

if [ -z "${OAC_ID}" ]; then
  echo "OAC may already exist — continuing. Set OAC_ID manually if distribution creation fails."
fi

echo "==> Creating CloudFront distribution"
DIST_ID=$(aws cloudfront create-distribution \
  --distribution-config "{
    Comment: \"${DISTRO_COMMENT}\",
    Enabled: true,
    Origins: { Quantity: 1, Items: [ {
      Id: \"s3-${BUCKET}\",
      DomainName: \"${BUCKET}.s3.${REGION}.amazonaws.com\",
      OriginAccessControlId: \"${OAC_ID}\",
      S3OriginConfig: { OriginAccessIdentity: \"\" }
    } ] },
    DefaultCacheBehavior: {
      TargetOriginId: \"s3-${BUCKET}\",
      ViewerProtocolPolicy: \"redirect-to-https\",
      AllowedMethods: [ \"GET\", \"HEAD\", \"OPTIONS\" ],
      CachedMethods: [ \"GET\", \"HEAD\" ],
      Compress: true,
      ForwardedValues: { QueryString: false, Cookies: { Forward: \"none\" } }
    },
    CustomErrorResponses: {
      Quantity: 1,
      Items: [ { ErrorCode: 404, ResponseCode: 200, ResponsePagePath: \"/index.html\", ErrorCachingMinTTL: 300 } ]
    },
    Aliases: { Quantity: 1, Items: [ \"${DOMAIN}\" ] },
    ViewerCertificate: { CloudFrontDefaultCertificate: true }
  }" \
  --query 'Distribution.Id' --output text)

DIST_DOMAIN=$(aws cloudfront get-distribution --id "${DIST_ID}" \
  --query 'Distribution.DomainName' --output text)

echo "==> CloudFront distribution created: ${DIST_ID}"
echo "==> CloudFront domain (use for Route 53 alias): ${DIST_DOMAIN}"
echo "==> Point ${DOMAIN} (A alias / CNAME) at ${DIST_DOMAIN}"

echo "==> Tip: after DNS propagates, create an ACM cert for ${DOMAIN} and attach"
echo "    a custom SSL cert to the distribution for https://${DOMAIN}"

# Invalidate cache on future deploys:
# aws cloudfront create-invalidation --distribution-id "${DIST_ID}" --paths "/*"
