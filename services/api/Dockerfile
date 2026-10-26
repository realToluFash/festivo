# FrankenPHP: one container rather than nginx plus php-fpm. It is what Symfony
# recommends now, and a second container existing only to pass requests to the
# first is a moving part with no job here.
FROM dunglas/frankenphp:1.13.0-php8.4.26 AS base

# bcmath is a hard requirement of azjezz/psl, which every boundary in this
# service coerces through. Listed with the rest rather than as a special case,
# because a missing extension fails at composer install and the message names
# the extension without naming what wanted it.
RUN install-php-extensions \
    bcmath \
    imagick \
    pdo_pgsql \
    intl \
    opcache \
    pcntl \
    redis \
    zip

# PHP otherwise sends X-Powered-By: PHP/<patch release> on every response, and
# an exact release tells a prober which advisories apply. Set in base so the
# stacks and production cannot differ on it.
RUN echo 'expose_php = Off' > "$PHP_INI_DIR/conf.d/zz-soirely.ini"

WORKDIR /app

# --- dependencies -----------------------------------------------------------
FROM base AS vendor
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY composer.json composer.lock symfony.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction

# --- development ------------------------------------------------------------
FROM base AS dev
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
ENV APP_ENV=dev
COPY composer.json composer.lock symfony.lock ./
# WITH dev dependencies, unlike the vendor stage — the test runner lives in
# them, and a container you cannot run the tests in is a container that makes
# everyone install PHP locally after all.
RUN composer install --no-scripts --prefer-dist --no-interaction
COPY . .

# A non-root user, because a container that runs as root is one bug away from
# being a root shell on the host's bind mount.
#
# Caddy keeps its certificate authority under /data and its state under /config
# even when serving plain HTTP, so both must belong to the user or it refuses to
# start — with an error about a PKI directory that says nothing about ownership.
RUN mkdir -p /app/var /data/caddy /config/caddy \
    && chown -R 1000:1000 /app/var /data /config
USER 1000:1000

# --- autoloader -------------------------------------------------------------
# The vendor stage installs without an autoloader, so it is written here, where
# the classes it maps have arrived, and only the result reaches prod.
FROM vendor AS autoload
COPY . .
RUN composer dump-autoload --no-dev --classmap-authoritative --no-interaction

# --- production -------------------------------------------------------------
FROM base AS prod
ENV APP_ENV=prod
COPY --from=autoload /app /app
RUN php bin/console cache:warmup --no-interaction
# The daily prunes in config/crontab: run a second container from this image
# with `supercronic /app/config/crontab` as its command.
ARG TARGETARCH
ARG SUPERCRONIC_VERSION=v0.2.49
RUN case "$TARGETARCH" in \
      amd64) sum=a53ae236602c7338aba3fbaff40bda6300eae3b9fedb8261eb06cfe3724430c1 ;; \
      arm64) sum=02aa0cb229ba09050cba6638059dadb9eedc2276632ea43d6a57a2f8c1629dd5 ;; \
      *) echo "No supercronic for $TARGETARCH" >&2; exit 1 ;; \
    esac \
    && curl -fsSLo /usr/local/bin/supercronic \
      "https://github.com/aptible/supercronic/releases/download/${SUPERCRONIC_VERSION}/supercronic-linux-${TARGETARCH}" \
    && echo "${sum}  /usr/local/bin/supercronic" | sha256sum -c - \
    && chmod +x /usr/local/bin/supercronic
RUN mkdir -p /app/var /data/caddy /config/caddy \
    && chown -R 1000:1000 /app/var /data /config
USER 1000:1000
