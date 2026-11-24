#!/usr/bin/env bash
# Checks deploy/.env and deploy/secrets before a deploy, one line per check, and
# exits non-zero if any failed. deploy.sh runs it first; it changes nothing.
set -uo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
env_file="${DEPLOY_ENV_FILE:-$here/.env}"
backup_env_file="${BACKUP_ENV_FILE:-$here/backup.env}"
secrets_dir="${DEPLOY_SECRETS_DIR:-$here/secrets}"
failed=0

ok() { printf 'ok    %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1"; failed=1; }

# Keys left empty on purpose: unset means off, or no limit.
optional=" EXPO_ACCESS_TOKEN TEAM_SEAT_LIMIT MINIMUM_APP_VERSION_IOS MINIMUM_APP_VERSION_ANDROID SOIRELY_SCHEME CORS_EXPO_WEB_ORIGIN RP_HOST SOIRELY_ANDROID_CERT_SHA256 SOIRELY_APPLE_APP_ID "

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

# Prints a number's lowest $2 bits.
to_bits() {
  local i out=""
  for (( i = $2 - 1; i >= 0; i-- )); do out+=$(( ($1 >> i) & 1 )); done
  printf '%s' "$out"
}

# Prints an IPv4 or IPv6 address as its 32 or 128 bits, or nothing.
bits_of() {
  local ip="$1" out="" part head tail fill i v4 h=() t=() groups=()
  if [[ "$ip" =~ ^([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$ ]]; then
    for part in "${BASH_REMATCH[@]:1}"; do
      (( 10#$part <= 255 )) || return
      out+="$(to_bits $(( 10#$part )) 8)"
    done
    printf '%s' "$out"
    return
  fi
  [[ "$ip" == *:* && "$ip" != *::*::* ]] || return
  if [[ "$ip" =~ ^(.*:)([0-9]+\.[0-9.]+)$ ]]; then
    head="${BASH_REMATCH[1]}"
    v4="$(bits_of "${BASH_REMATCH[2]}")"
    [ -n "$v4" ] || return
    ip="$head$(printf '%x:%x' $(( 2#${v4:0:16} )) $(( 2#${v4:16} )))"
  fi
  [[ "$ip" == :* && "$ip" != ::* ]] && return
  [[ "$ip" == *: && "$ip" != *:: ]] && return
  if [[ "$ip" == *::* ]]; then
    head="${ip%%::*}" tail="${ip#*::}"
    [ -n "$head" ] && IFS=: read -ra h <<<"$head"
    [ -n "$tail" ] && IFS=: read -ra t <<<"$tail"
    fill=$(( 8 - ${#h[@]} - ${#t[@]} ))
    (( fill >= 1 )) || return
  else
    IFS=: read -ra h <<<"$ip"
    fill=0
    (( ${#h[@]} == 8 )) || return
  fi
  groups=("${h[@]}")
  for (( i = 0; i < fill; i++ )); do groups+=(0); done
  groups+=("${t[@]}")
  for part in "${groups[@]}"; do
    [[ "$part" =~ ^[0-9a-fA-F]{1,4}$ ]] || return
    out+="$(to_bits $(( 16#$part )) 16)"
  done
  printf '%s' "$out"
}

# Not globally reachable, from IANA's special-purpose registries (RFC 6890, RFC 8190);
# IPv6 must also lie in global unicast, 2000::/3 (RFC 4291).
ipv4_unreachable="0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12 192.0.0.0/24
192.0.2.0/24 192.168.0.0/16 198.18.0.0/15 198.51.100.0/24 203.0.113.0/24 224.0.0.0/4 240.0.0.0/4"
ipv6_unreachable="2001::/23 2001:db8::/32 2002::/16 3fff::/20"

# Succeeds when the item is an address or range, every address of which an internet caller can come from.
reachable_range() {
  local bits len=32 blocked block prefix list="$ipv4_unreachable"
  bits="$(bits_of "${1%%/*}")"
  [ -n "$bits" ] || return 1
  (( ${#bits} == 128 )) && len=128 list="$ipv6_unreachable"
  if [[ "$1" == */* ]]; then
    [[ "${1#*/}" =~ ^[0-9]{1,3}$ ]] && (( 10#${1#*/} <= len )) || return 1
    len=$(( 10#${1#*/} ))
  fi
  (( ${#bits} == 128 )) && { (( len >= 3 )) && [ "${bits:0:3}" = 001 ] || return 1; }
  for blocked in $list; do
    block="$(bits_of "${blocked%/*}")" prefix="${blocked#*/}"
    (( len < prefix )) && prefix=$len
    [ "${bits:0:prefix}" = "${block:0:prefix}" ] && return 1
  done
  return 0
}

items=0 refused=()
IFS=, read -ra ranges <<<"$(value_of MAIL_WEBHOOK_ALLOWED_RANGES)"
for range in "${ranges[@]}"; do
  range="${range#"${range%%[![:space:]]*}"}"
  range="${range%"${range##*[![:space:]]}"}"
  [ -z "$range" ] && continue
  items=$(( items + 1 ))
  reachable_range "$range" || refused+=("$range")
done
if [ "$items" = 0 ]; then
  fail "MAIL_WEBHOOK_ALLOWED_RANGES holds no range: set the provider's published ranges"
elif [ "${#refused[@]}" != 0 ]; then
  fail "MAIL_WEBHOOK_ALLOWED_RANGES holds ${refused[*]}: not an address or range, or not one an internet caller comes from, so the API would refuse every webhook; set the provider's published ranges"
else
  ok "MAIL_WEBHOOK_ALLOWED_RANGES holds only ranges an internet caller comes from"
fi

# The backup container's own file: the bucket's write-only credentials, and the
# public half of the backup key (sc-30204).
api_env_file="$env_file"
env_file="$backup_env_file"
if [ ! -f "$env_file" ]; then
  fail "deploy/backup.env exists (copy deploy/backup.env.example)"
else
  mode="$(stat -c %a "$env_file")"
  [ "$mode" = 600 ] && ok "deploy/backup.env is readable by its owner only" || fail "deploy/backup.env is mode $mode, not 600"
  missing=0
  for key in $(keys_of "$here/backup.env.example"); do
    if ! grep -qE "^$key=" "$env_file"; then
      fail "$key is set in backup.env"; missing=1
    elif [ -z "$(value_of "$key")" ] && [ "$key" != BACKUP_ENDPOINT ]; then
      fail "$key is not empty in backup.env"; missing=1
    fi
  done
  [ "$missing" = 0 ] && ok "every variable in backup.env.example is set"
  for key in $(keys_of "$env_file"); do
    grep -qE "^$key=" "$here/backup.env.example" || fail "$key is not in backup.env.example: nothing reads it, so remove it"
  done
  [[ "$(value_of BACKUP_RECIPIENT)" == age1* ]] \
    && ok "BACKUP_RECIPIENT is an age public key" \
    || fail "BACKUP_RECIPIENT is not an age public key (age1…): the identity never goes on the server"
  secret="$(value_of AWS_SECRET_ACCESS_KEY)"
  if [ -n "$secret" ] && [ "$(git -C "$here" rev-parse --is-shallow-repository)" != true ] \
    && [ -n "$(git -C "$here" log --all -S"$secret" --format=%h -1)" ]; then
    fail "the backup job's AWS_SECRET_ACCESS_KEY appears in the repository's history: generate a fresh one"
  fi
fi
env_file="$api_env_file"

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
