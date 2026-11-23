#!/usr/bin/env bash
# Checks deploy/.env and deploy/secrets before a deploy, one line per check, and
# exits non-zero if any failed. deploy.sh runs it first; it changes nothing.
set -uo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
env_file="${DEPLOY_ENV_FILE:-$here/.env}"
secrets_dir="${DEPLOY_SECRETS_DIR:-$here/secrets}"
failed=0

ok() { printf 'ok    %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1"; failed=1; }

# Keys left empty on purpose: unset means off, or no limit.
optional=" EXPO_ACCESS_TOKEN TEAM_SEAT_LIMIT MINIMUM_APP_VERSION_IOS MINIMUM_APP_VERSION_ANDROID SOIRELY_SCHEME CORS_EXPO_WEB_ORIGIN "

# Values generated per environment, which must never come from the repository.
secrets="APP_SECRET MERCURE_PUBLISHER_KEY MERCURE_SUBSCRIBER_KEY JWT_PASSPHRASE TWO_FACTOR_KEY
POSTGRES_PASSWORD REDIS_PASSWORD MAIL_WEBHOOK_SECRET STORAGE_SECRET SMS_AUTH_TOKEN
WHATSAPP_ACCESS_TOKEN WHATSAPP_WEBHOOK_VERIFY_TOKEN WHATSAPP_APP_SECRET VAPID_PRIVATE_KEY
OAUTH_GOOGLE_WEB_CLIENT_SECRET OAUTH_APPLE_WEB_PRIVATE_KEY ASSISTANT_API_KEY"

keys_of() { sed -nE 's/^([A-Z0-9_]+)=.*/\1/p' "$1"; }

value_of() {
  local line
  line="$(grep -E "^$1=" "$env_file" | tail -n 1)"
  line="${line#*=}"
  case "$line" in
    \"*\") line="${line#\"}"; line="${line%\"}" ;;
    \'*\') line="${line#\'}"; line="${line%\'}" ;;
    *) line="$(printf '%s' "$line" | sed -E 's/[[:space:]]+#.*$//; s/[[:space:]]+$//')" ;;
  esac
  printf '%s' "$line"
}

if [ ! -f "$env_file" ]; then
  fail "deploy/.env exists (copy deploy/env.example)"
  exit 1
fi
mode="$(stat -c %a "$env_file")"
[ "$mode" = 600 ] && ok "deploy/.env is readable by its owner only" || fail "deploy/.env is mode $mode, not 600"

missing=0
for key in $(keys_of "$here/env.example"); do
  if ! grep -qE "^$key=" "$env_file"; then
    fail "$key is set"; missing=1
  elif [ -z "$(value_of "$key")" ] && [[ "$optional" != *" $key "* ]]; then
    fail "$key is not empty"; missing=1
  fi
done
[ "$missing" = 0 ] && ok "every variable in env.example is set"

# No variable that nothing reads (sc-1612), MERCURE_JWT_SECRET among them.
for key in $(keys_of "$env_file"); do
  grep -qE "^$key=" "$here/env.example" || fail "$key is not in env.example: nothing reads it, so remove it"
done

if [ "$(git -C "$here" rev-parse --is-shallow-repository)" = true ]; then
  fail "the checkout has its whole history, to check secrets against (git fetch --unshallow)"
else
  leaked=0
  for key in $secrets; do
    value="$(value_of "$key")"
    [ -z "$value" ] && continue
    if [ -n "$(git -C "$here" log --all -S"$value" --format=%h -1)" ]; then
      fail "$key appears in the repository's history: generate a fresh one"; leaked=1
    fi
  done
  [ "$leaked" = 0 ] && ok "no secret appears in the repository's history"
fi

[ "$(value_of MERCURE_PUBLISHER_KEY)" != "$(value_of MERCURE_SUBSCRIBER_KEY)" ] \
  && ok "the Mercure publisher and subscriber keys differ" \
  || fail "MERCURE_PUBLISHER_KEY and MERCURE_SUBSCRIBER_KEY are the same value"

bytes="$(printf '%s' "$(value_of TWO_FACTOR_KEY)" | base64 -d 2>/dev/null | wc -c)"
[ "$bytes" = 32 ] && ok "TWO_FACTOR_KEY is 32 bytes, base64" || fail "TWO_FACTOR_KEY decodes to $bytes bytes, not 32"

[[ "$(value_of DATABASE_URL)" == *":$(value_of POSTGRES_PASSWORD)@"* ]] \
  && ok "DATABASE_URL carries POSTGRES_PASSWORD" \
  || fail "DATABASE_URL does not carry POSTGRES_PASSWORD"

# Prints the first and last address of an IPv4 range as integers, or nothing.
ipv4_span() {
  local ip="${1%%/*}" bits=32 a b c d
  [[ "$1" == */* ]] && bits="${1#*/}"
  [[ "$bits" =~ ^[0-9]+$ ]] && (( bits <= 32 )) || return
  [[ "$ip" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)\.([0-9]+)$ ]] || return
  a="${BASH_REMATCH[1]}" b="${BASH_REMATCH[2]}" c="${BASH_REMATCH[3]}" d="${BASH_REMATCH[4]}"
  local size=$(( 1 << (32 - bits) )) n=$(( (a << 24) + (b << 16) + (c << 8) + d ))
  printf '%s %s' $(( n / size * size )) $(( n / size * size + size - 1 ))
}

private_ranges=()
IFS=, read -ra ranges <<<"$(value_of MAIL_WEBHOOK_ALLOWED_RANGES)"
for range in "${ranges[@]}"; do
  range="${range//[[:space:]]/}"
  read -r first last <<<"$(ipv4_span "$range")"
  [ -z "$first" ] && continue
  for blocked in 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 127.0.0.0/8; do
    read -r bfirst blast <<<"$(ipv4_span "$blocked")"
    if (( first <= blast && last >= bfirst )); then private_ranges+=("$range"); break; fi
  done
done
[ "${#private_ranges[@]}" = 0 ] \
  && ok "MAIL_WEBHOOK_ALLOWED_RANGES holds no private range" \
  || fail "MAIL_WEBHOOK_ALLOWED_RANGES holds a private range (${private_ranges[*]}): set the provider's published ranges"

private="$secrets_dir/jwt/private.pem"
public="$secrets_dir/jwt/public.pem"
if [ ! -f "$private" ] || [ ! -f "$public" ]; then
  fail "the session key pair is in deploy/secrets/jwt (private.pem, public.pem)"
elif ! derived="$(openssl pkey -in "$private" -passin "pass:$(value_of JWT_PASSPHRASE)" -pubout 2>/dev/null)"; then
  fail "JWT_PASSPHRASE opens deploy/secrets/jwt/private.pem"
elif [ "$derived" != "$(openssl pkey -pubin -in "$public" 2>/dev/null)" ]; then
  fail "deploy/secrets/jwt/public.pem belongs to private.pem"
else
  ok "the session key pair opens with JWT_PASSPHRASE and matches"
fi

exit "$failed"
