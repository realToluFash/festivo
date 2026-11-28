#!/bin/sh
# fetch.sh <YYYY-MM-DD>: writes that night's backup, still encrypted, to stdout.
# Run with the restore credentials, which alone may read a backup.
set -eu
. /backup/lib.sh

date="${1:?usage: fetch.sh <YYYY-MM-DD>}"
: "${BACKUP_BUCKET:?}" "${BACKUP_REGION:?}"
file="$(mktemp)"
trap 'rm -f "$file"' EXIT

s3api get-object --bucket "$BACKUP_BUCKET" --key "$date.dump.age" "$file" >/dev/null
cat "$file"
