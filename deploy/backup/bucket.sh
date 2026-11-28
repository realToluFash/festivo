#!/bin/sh
# Makes the backup bucket, or brings an existing one to this definition, and
# prints each setting back. Production and the QA stack's localstack both come
# from here. Run with credentials that may administer the bucket, never the
# backup job's.
set -eu
. /backup/lib.sh

: "${BACKUP_BUCKET:?}" "${BACKUP_REGION:?}"

if ! s3api head-bucket --bucket "$BACKUP_BUCKET" 2>/dev/null; then
  if [ "$BACKUP_REGION" = us-east-1 ]; then
    s3api create-bucket --bucket "$BACKUP_BUCKET" >/dev/null
  else
    s3api create-bucket --bucket "$BACKUP_BUCKET" \
      --create-bucket-configuration "LocationConstraint=$BACKUP_REGION" >/dev/null
  fi
fi

s3api put-public-access-block --bucket "$BACKUP_BUCKET" --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
s3api put-bucket-encryption --bucket "$BACKUP_BUCKET" --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true}]}'
s3api put-bucket-lifecycle-configuration --bucket "$BACKUP_BUCKET" \
  --lifecycle-configuration file:///backup/lifecycle.json

# Versioning is never turned on: an old version would outlive the 35 days. Once on,
# a bucket can only be suspended, which the lifecycle rule's noncurrent expiry covers.
if [ "$(s3api get-bucket-versioning --bucket "$BACKUP_BUCKET" --query Status --output text)" = Enabled ]; then
  echo "$BACKUP_BUCKET has versioning on: suspend it (put-bucket-versioning Status=Suspended)." >&2
  exit 1
fi

s3api get-public-access-block --bucket "$BACKUP_BUCKET" --output json
s3api get-bucket-encryption --bucket "$BACKUP_BUCKET" --output json
s3api get-bucket-lifecycle-configuration --bucket "$BACKUP_BUCKET" --output json
echo "$BACKUP_BUCKET is ready."
