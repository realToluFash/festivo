#!/bin/sh
# Takes tonight's backup: the whole database, encrypted here to BACKUP_RECIPIENT,
# then written once to the bucket. Never overwrites a backup already there.
set -eu
set -o pipefail
. /backup/lib.sh

: "${BACKUP_BUCKET:?}" "${BACKUP_REGION:?}" "${BACKUP_RECIPIENT:?}" "${PGHOST:?}" "${PGDATABASE:?}"
date="$(date -u +%F)"
key="$date.dump.age"
file="$(mktemp)"
trap 'rm -f "$file"' EXIT

failed() {
  critical "The database backup of $date failed: $1" "$date"
  exit 1
}

pg_dump --format=custom --compress=6 | age --encrypt --recipient "$BACKUP_RECIPIENT" --output "$file" \
  || failed "pg_dump or age exited non-zero"
size="$(stat -c %s "$file")"
[ "$size" -gt 0 ] || failed "the encrypted dump is empty"

previous="$(backups | awk -v key="$key" '$1 < key' | tail -n 1)" || failed "the bucket could not be listed"

s3api put-object --bucket "$BACKUP_BUCKET" --key "$key" --body "$file" --if-none-match '*' >/dev/null \
  || failed "the upload of $key was refused"

if [ -n "$previous" ]; then
  previous_key="${previous%%[[:space:]]*}"
  previous_size="${previous##*[[:space:]]}"
  if [ $((size * 2)) -lt "$previous_size" ]; then
    critical "The database backup of $date is $size bytes, less than half of the previous one ($previous_key, $previous_size bytes)" "$date"
  fi
fi

echo "Backed up $PGDATABASE to $key ($size bytes)."
