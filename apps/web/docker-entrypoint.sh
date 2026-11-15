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

# A quote or backslash left raw ends the JSON string early, and the web then
# refuses to start with nothing in this log saying why.
json_string() {
    if [ "$(printf '%s' "$2" | tr -d '[:cntrl:]')" != "$2" ]; then
        echo "soirely: $1 contains a control character" >&2
        exit 1
    fi
    printf '"%s"' "$(printf '%s' "$2" | sed 's/[\\"]/\\&/g')"
}

API_URL="$(json_string SOIRELY_API_URL "$SOIRELY_API_URL")"
MERCURE_URL="$(json_string SOIRELY_MERCURE_URL "${SOIRELY_MERCURE_URL:-}")"
ENVIRONMENT="$(json_string SOIRELY_ENVIRONMENT "${SOIRELY_ENVIRONMENT:-unknown}")"
GOOGLE_AUTHORIZE_URL="$(json_string SOIRELY_GOOGLE_AUTHORIZE_URL "${SOIRELY_GOOGLE_AUTHORIZE_URL:-}")"
GOOGLE_CLIENT_ID="$(json_string SOIRELY_GOOGLE_CLIENT_ID "${SOIRELY_GOOGLE_CLIENT_ID:-}")"
APPLE_AUTHORIZE_URL="$(json_string SOIRELY_APPLE_AUTHORIZE_URL "${SOIRELY_APPLE_AUTHORIZE_URL:-}")"
APPLE_CLIENT_ID="$(json_string SOIRELY_APPLE_CLIENT_ID "${SOIRELY_APPLE_CLIENT_ID:-}")"
SCHEME="$(json_string SOIRELY_SCHEME "${SOIRELY_SCHEME:-}")"
SUPPORT_ADDRESS="$(json_string SOIRELY_SUPPORT_EMAIL "${SOIRELY_SUPPORT_EMAIL:-support@soirely.com}")"

ROOT="${SOIRELY_WEB_ROOT:-/usr/share/nginx/html}"
TARGET="$ROOT/config.json"

cat > "$TARGET" <<JSON
{
  "apiBaseUrl": ${API_URL},
  "mercureUrl": ${MERCURE_URL},
  "environment": ${ENVIRONMENT},
  "google": {
    "authorizeUrl": ${GOOGLE_AUTHORIZE_URL},
    "clientId": ${GOOGLE_CLIENT_ID}
  },
  "apple": {
    "authorizeUrl": ${APPLE_AUTHORIZE_URL},
    "clientId": ${APPLE_CLIENT_ID}
  },
  "scheme": ${SCHEME},
  "supportAddress": ${SUPPORT_ADDRESS}
}
JSON

echo "soirely: wrote $TARGET for ${SOIRELY_ENVIRONMENT:-unknown} (api ${SOIRELY_API_URL})"

# ── Android App Links ────────────────────────────────────────────────────────
#
# Sign in with Apple on Android comes back to the app by an https link on this
# host, and Android opens it in the app only if this file names the app and its
# release signing certificate. Written only when a fingerprint is configured, so
# a deployment without one serves a 404 here, never a file that verifies nothing.
WELL_KNOWN="$ROOT/.well-known"
if [ -n "${SOIRELY_ANDROID_CERT_SHA256:-}" ]; then
    mkdir -p "$WELL_KNOWN"
    FINGERPRINTS="$(printf '%s' "$SOIRELY_ANDROID_CERT_SHA256" | sed 's/[[:space:]]//g')"
    FINGERPRINTS="$(json_string SOIRELY_ANDROID_CERT_SHA256 "$FINGERPRINTS")"
    FINGERPRINTS="$(printf '%s' "$FINGERPRINTS" | sed 's/,/","/g')"
    PACKAGE="$(json_string SOIRELY_ANDROID_PACKAGE "${SOIRELY_ANDROID_PACKAGE:-com.soirely.app}")"
    cat > "$WELL_KNOWN/assetlinks.json" <<JSON
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": ${PACKAGE},
      "sha256_cert_fingerprints": [${FINGERPRINTS}]
    }
  }
]
JSON
    echo "soirely: wrote $WELL_KNOWN/assetlinks.json for ${SOIRELY_ANDROID_PACKAGE:-com.soirely.app}"
fi

# ── Security headers ─────────────────────────────────────────────────────────
#
# Generated rather than committed because the sources name the API, Mercure and
# object store origins, and those differ per deployment.
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

# Uploaded images (event covers, avatars) are sent to and served from the
# object store's public origin, which is never 'self': the browser PUTs to it
# and loads images from it.
IMG="'self' data: blob:"
STORAGE_ORIGIN="$(origin_of "${SOIRELY_STORAGE_URL:-}")"
if [ -n "$STORAGE_ORIGIN" ]; then
    CONNECT="$CONNECT $STORAGE_ORIGIN"
    IMG="$IMG $STORAGE_ORIGIN"
fi

HEADERS="${SOIRELY_HEADERS_FILE:-/etc/nginx/soirely-security-headers.conf}"

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
add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src ${IMG}; connect-src ${CONNECT}; manifest-src 'self'; worker-src 'self'" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy \$soirely_referrer_policy always;
add_header X-Robots-Tag \$soirely_robots always;
add_header X-Frame-Options "DENY" always;
add_header Cross-Origin-Opener-Policy "same-origin-allow-popups" always;
add_header Permissions-Policy "geolocation=(), microphone=(), payment=(), usb=()" always;
CONF

echo "soirely: wrote $HEADERS (connect-src ${CONNECT}; img-src ${IMG})"
