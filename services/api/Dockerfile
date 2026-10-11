# FrankenPHP: one container rather than nginx plus php-fpm. It is what Symfony
# recommends now, and a second container existing only to pass requests to the
# first is a moving part with no job here.
FROM dunglas/frankenphp:1-php8.4 AS base

RUN install-php-extensions \
    pdo_pgsql \
    intl \
    opcache \
    redis \
    zip

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

# --- production -------------------------------------------------------------
FROM base AS prod
ENV APP_ENV=prod
COPY --from=vendor /app/vendor ./vendor
COPY . .
RUN php bin/console cache:warmup --no-interaction || true
RUN mkdir -p /app/var /data/caddy /config/caddy \
    && chown -R 1000:1000 /app/var /data /config
USER 1000:1000
