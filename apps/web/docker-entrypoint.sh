#!/bin/sh
# Writes the runtime configuration the bundle reads at boot.
#
# Runs on every container start, before nginx serves anything, overwriting the
# development default baked into the image. This is the whole mechanism: the
# file changes per deployment, the JavaScript beside it does not.
#
# Fails loudly on a missing API URL rather than writing a default. A default
# here is a browser quietly talking to the wrong host, which looks exactly like
# an outage and is far harder to find than a container that refused to start.
set -eu

: "${SOIRELY_API_URL:?SOIRELY_API_URL is required — the browser has no other way to find the API}"

TARGET=/usr/share/nginx/html/config.json

cat > "$TARGET" <<JSON
{
  "apiBaseUrl": "${SOIRELY_API_URL}",
  "mercureUrl": "${SOIRELY_MERCURE_URL:-}",
  "environment": "${SOIRELY_ENVIRONMENT:-unknown}"
}
JSON

echo "soirely: wrote $TARGET for ${SOIRELY_ENVIRONMENT:-unknown} (api ${SOIRELY_API_URL})"
