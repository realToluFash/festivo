#!/usr/bin/env bash
# deploy/restore.sh <YYYY-MM-DD> <identity file>: restores production's database
# from the backup taken that night, and only then lets the API serve again.
#
# The restore credentials are read from RESTORE_KEY and RESTORE_SECRET and the
# identity file is the backup key, both taken from the production secret store
# for this restore and never left on the server. Nothing is restored anywhere
# but the environment the backup was taken from (deploy/README.md, Backups).
set -euo pipefail

date="${1:?usage: deploy/restore.sh <YYYY-MM-DD> <identity file>}"
identity="$(realpath "${2:?usage: deploy/restore.sh <YYYY-MM-DD> <identity file>}")"
: "${RESTORE_KEY:?the restore credentials, from the production secret store}" "${RESTORE_SECRET:?}"
[[ "$date" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { echo "$date is not a YYYY-MM-DD date." >&2; exit 1; }

here="$(cd "$(dirname "$0")" && pwd)"
root="$here/.."

# A rehearsal on the QA stack names that stack's compose project and files here
# (deploy/README.md, Rehearsed); a production restore leaves them alone.
if [ -n "${RESTORE_COMPOSE_FILE:-}" ]; then
  compose=(docker compose -p "${RESTORE_PROJECT:?}" -f "$RESTORE_COMPOSE_FILE")
  network="$RESTORE_PROJECT"_default
  backup_env=(--env "BACKUP_BUCKET=${BACKUP_BUCKET:?}" --env "BACKUP_REGION=${BACKUP_REGION:?}" --env "BACKUP_ENDPOINT=${BACKUP_ENDPOINT:-}")
  image="${RESTORE_IMAGE:?the backup image, built from deploy/backup}"
else
  export DEPLOY_SHA="$(git -C "$root" rev-parse HEAD)"
  compose=(docker compose --project-directory "$here" --env-file "$here/.env" -f "$here/compose.yaml")
  network=soirely_default
  backup_env=(--env-file "$here/backup.env")
  image="soirely-backup:$DEPLOY_SHA"
fi

serving=(proxy api notification-worker scheduler backup)
present=()
for service in "${serving[@]}"; do
  "${compose[@]}" config --services | grep -qx "$service" && present+=("$service")
done

started="$(date +%s)"
encrypted="$(mktemp)"
trap 'rm -f "$encrypted"' EXIT

# Passed by name, so the values never reach a command line that ps can read.
export AWS_ACCESS_KEY_ID="$RESTORE_KEY" AWS_SECRET_ACCESS_KEY="$RESTORE_SECRET"
fetch=(docker run --rm --network "$network" "${backup_env[@]}"
  --env AWS_ACCESS_KEY_ID --env AWS_SECRET_ACCESS_KEY "$image")
open=(docker run --rm -i --network none --volume "$identity:/run/backup/identity:ro" "$image")

echo "Fetching the backup of $date and checking it opens, before anything closes."
"${fetch[@]}" /backup/fetch.sh "$date" >"$encrypted"
"${open[@]}" sh -c 'age --decrypt --identity /run/backup/identity | pg_restore --list >/dev/null' <"$encrypted"

trap 'rm -f "$encrypted"; echo "The restore of $date stopped part way. The API stays closed: ${present[*]} are stopped." >&2' ERR

echo "Closing ${present[*]}."
"${compose[@]}" stop "${present[@]}"

echo "Replacing the database with the backup of $date."
"${compose[@]}" exec -T postgres sh -c \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres \
     -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\" WITH (FORCE)" \
     -c "CREATE DATABASE \"$POSTGRES_DB\" OWNER \"$POSTGRES_USER\""'
"${open[@]}" age --decrypt --identity /run/backup/identity <"$encrypted" \
  | "${compose[@]}" exec -T postgres sh -c \
    'pg_restore --exit-on-error --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

# Every prune and erasure the scheduler runs, read from the crontab in the image that
# is about to serve, so a new one is never missed and none it lacks is asked for: what
# was removed or erased after the backup was taken goes again.
steps='php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration
test -f config/crontab
for command in $(grep -oE "app:(prune|erase)-[a-z-]+" config/crontab | sort -u); do
  echo "Running $command." && php bin/console "$command" --no-interaction
done'
echo "Migrating the restored database to this commit's schema, then pruning and erasing it."
"${compose[@]}" run --rm --no-deps api sh -ec "$steps"

# Replaying the record of erasures belongs here, before the API serves. It arrives
# with sc-30193's erasure (sc-30204, 'Stories not yet merged').

echo "Opening ${present[*]}."
"${compose[@]}" up -d --wait "${present[@]}"
trap - ERR
rm -f "$encrypted"
echo "Restored the backup of $date in $(( $(date +%s) - started )) s."
