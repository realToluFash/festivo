#!/bin/sh
# 06:00 UTC: tonight's backup is in the bucket, or a critical line says it is not.
set -eu
. /backup/lib.sh

: "${BACKUP_BUCKET:?}" "${BACKUP_REGION:?}"
date="$(date -u +%F)"
if ! listed="$(backups)"; then
  critical "No database backup could be found for $date by 06:00 UTC: the bucket could not be listed" "$date"
  exit 1
fi
if ! printf '%s\n' "$listed" | grep -q "^$date\.dump\.age[[:space:]]"; then
  critical "No database backup for $date is in the bucket by 06:00 UTC" "$date"
  exit 1
fi
echo "The backup of $date is in the bucket."
