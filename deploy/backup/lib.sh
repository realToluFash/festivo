# Shared by the backup container's scripts. POSIX sh: the image's shell is busybox.

# One JSON line at critical on stderr, the shape the API's own log lines take, so
# the deploy path's log shipper alerts on it like any other (deploy/README.md).
critical() {
  message="$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g')"
  printf '{"message":"%s","context":{"date":"%s"},"level":500,"level_name":"CRITICAL","channel":"backup","datetime":"%s","extra":{}}\n' \
    "$message" "${2:-}" "$(date -u +%Y-%m-%dT%H:%M:%S+00:00)" >&2
}

s3api() {
  if [ -n "${BACKUP_ENDPOINT:-}" ]; then
    aws --endpoint-url "$BACKUP_ENDPOINT" --region "$BACKUP_REGION" s3api "$@"
  else
    aws --region "$BACKUP_REGION" s3api "$@"
  fi
}

# Every backup in the bucket, "<key> <size>" one per line, oldest first. Listing
# needs no read of any backup, so the writer's credentials can do it.
backups() {
  s3api list-objects-v2 --bucket "$BACKUP_BUCKET" \
    --query 'Contents[].[Key,Size]' --output text | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}\.dump\.age' | sort
}
