#!/bin/sh
# fetch.sh <YYYY-MM-DD>: writes that night's backup, decrypted, to stdout. Takes the
# restore credentials and the key at /run/backup/identity, both from the
# production secret store for this restore only.
set -eu
set -o pipefail
. /backup/lib.sh

date="${1:?usage: fetch.sh <YYYY-MM-DD>}"
: "${BACKUP_BUCKET:?}" "${BACKUP_REGION:?}"
file="$(mktemp)"
trap 'rm -f "$file"' EXIT

s3api get-object --bucket "$BACKUP_BUCKET" --key "$date.dump.age" "$file" >/dev/null
age --decrypt --identity /run/backup/identity "$file"
