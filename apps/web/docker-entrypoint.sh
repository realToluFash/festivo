#!/bin/sh
# Writes the runtime configuration the bundle reads at boot, and the security
# headers nginx serves it with.
#
# Runs on every container start, before nginx serves anything, overwriting the
# development default baked into the image. This is the whole mechanism: the
# files change per deployment, the JavaScript beside them does not.
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
  "environment": "${SOIRELY_ENVIRONMENT:-unknown}",
  "google": {
    "authorizeUrl": "${SOIRELY_GOOGLE_AUTHORIZE_URL:-}",
    "clientId": "${SOIRELY_GOOGLE_CLIENT_ID:-}"
  }
}
JSON

echo "soirely: wrote $TARGET for ${SOIRELY_ENVIRONMENT:-unknown} (api ${SOIRELY_API_URL})"

# ── Security headers ─────────────────────────────────────────────────────────
#
# Generated rather than committed because connect-src has to name the API and
# Mercure origins, and those are the two things that differ per deployment.
# `connect-src 'self'` with the API on another host blocks every call the
# application makes.
#
# The scheme, host and port only: a path in a CSP source is matched as a prefix
# and would quietly narrow what the client may call.
origin_of() {
    printf '%s' "$1" | sed -n 's#^\([a-zA-Z][a-zA-Z0-9+.-]*://[^/]*\).*#\1#p'
}

CONNECT="'self' $(origin_of "$SOIRELY_API_URL")"

MERCURE_ORIGIN="$(origin_of "${SOIRELY_MERCURE_URL:-}")"
if [ -n "$MERCURE_ORIGIN" ]; then
    CONNECT="$CONNECT $MERCURE_ORIGIN"
fi


HEADERS=/etc/nginx/soirely-security-headers.conf

# Google Fonts is the one third party the page loads: the stylesheet comes from
# fonts.googleapis.com and the font files it names come from fonts.gstatic.com.
# Self-hosting the two families would remove both and is the better end state.
#
# style-src has no 'unsafe-inline'. That also governs inline style attributes,
# so a `style={{…}}` prop anywhere in apps/web stops rendering — the eslint rule
# in eslint.config.mjs is what keeps that from being discovered in production.
#
# Strict-Transport-Security is deliberately not here. TLS terminates upstream,
# so it belongs on the terminator, where the max-age commitment is visible next
# to the certificate it depends on.
cat > "$HEADERS" <<CONF
add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src ${CONNECT}; manifest-src 'self'; worker-src 'self'" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header X-Frame-Options "DENY" always;
add_header Cross-Origin-Opener-Policy "same-origin-allow-popups" always;
add_header Permissions-Policy "geolocation=(), microphone=(), payment=(), usb=()" always;
CONF

echo "soirely: wrote $HEADERS (connect-src ${CONNECT})"
