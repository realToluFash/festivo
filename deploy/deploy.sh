#!/usr/bin/env bash
# deploy/deploy.sh <sha>: deploys that commit of main to this server.
#
# The pre-flight first, then the images, then the migrations against the new
# image while the old API still serves, and only then the new containers.
set -euo pipefail

sha="${1:?usage: deploy/deploy.sh <sha of a commit on origin/main>}"
here="$(cd "$(dirname "$0")" && pwd)"
cd "$here/.."

git fetch --quiet origin
sha="$(git rev-parse --verify "$sha^{commit}")"
if ! git merge-base --is-ancestor "$sha" origin/main; then
  echo "$sha is not on origin/main; only merged main is deployed." >&2
  exit 1
fi
git -c advice.detachedHead=false checkout --quiet --detach "$sha"

"$here/preflight.sh"

export DEPLOY_SHA="$sha"
compose=(docker compose --project-directory "$here" --env-file "$here/.env" -f "$here/compose.yaml")

"${compose[@]}" build api web
"${compose[@]}" up -d --wait postgres redis mercure
"${compose[@]}" run --rm --no-deps api \
  php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration
"${compose[@]}" up -d --wait --remove-orphans

echo "Deployed $sha ($(git log -1 --format=%s "$sha"))."
