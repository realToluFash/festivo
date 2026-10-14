# Routines, by the name of the thing they do.
#
# Adopted from the reference project at ~/bindhq-webapp-main, which runs its
# whole workflow this way. `just` with no arguments lists everything.
#
# A recipe here delegates to the npm script where one exists, rather than
# repeating the command. That is deliberate: CI calls the npm scripts, so a
# routine cannot be correct in one place and stale in the other. Where no npm
# script exists — the docker lifecycle, psql, the build cache — the recipe is
# the definition.
#
# Install: brew install just

set export

COMPOSE := "docker compose"
API     := "docker compose exec -T api"
CONSOLE := "docker compose exec -T api php bin/console"

# List every recipe.
default:
    @just --list --unsorted

# ── Getting started ──────────────────────────────────────────────────────────

# Everything a fresh clone needs: .env, dependencies, containers, databases.
setup:
    npm run setup

# ── The containers ───────────────────────────────────────────────────────────

# Start everything and wait until each service can answer, not merely exist.
up:
    {{COMPOSE}} up -d --wait

# Stop everything. Volumes survive, so the databases do.
down:
    {{COMPOSE}} down

# Stop everything and delete the volumes. The databases do not survive.
down-hard:
    {{COMPOSE}} down -v

ps:
    {{COMPOSE}} ps

logs service="api":
    {{COMPOSE}} logs -f --tail 100 {{service}}

# A change under services/api/src is bind-mounted and needs none of this. A
# Dockerfile, extension or php.ini change does.
#
# Rebuild the API image and restart it.
rebuild-api:
    {{COMPOSE}} build api
    {{COMPOSE}} up -d api

# A shell in the API container.
shell:
    {{COMPOSE}} exec api sh

# A psql prompt on the development database.
psql:
    {{COMPOSE}} exec postgres psql -U soirely -d soirely

# ── Databases ────────────────────────────────────────────────────────────────

# Bring the development database up to the current migrations.
migrate-database-dev:
    {{CONSOLE}} doctrine:migrations:migrate --no-interaction --allow-no-migration

# Dropping is the point. Migrating an existing test database leaves behind
# anything a since-deleted migration created, and the suite then passes against
# a schema no fresh environment will ever have.
#
# Drop, recreate and migrate the test database.
prepare-database-test:
    npm run test:db

# Read this before generating a migration: a diff cannot tell a rename from a
# drop and a create, and emits the destructive pair.
#
# Show what a migration would contain, without writing one.
diff-database:
    {{CONSOLE}} doctrine:migrations:diff --no-interaction

# Generate an empty migration to write by hand.
new-migration:
    {{CONSOLE}} make:migration --no-interaction

# Does the mapping agree with the schema the migrations produced?
validate-database:
    {{CONSOLE}} doctrine:schema:validate

# ── Tests ────────────────────────────────────────────────────────────────────

# Every suite in the repository.
test:
    npm test

# The API suite. Pass a filter: `just test-api RequestLocale`
test-api filter="":
    #!/usr/bin/env sh
    if [ -n "{{filter}}" ]; then
        {{COMPOSE}} exec -T api sh -c "APP_ENV=test vendor/bin/phpunit --filter {{filter}}"
    else
        npm run test:api
    fi

test-packages:
    npm run test:packages

test-scripts:
    npm run test:scripts

# ── Checks ───────────────────────────────────────────────────────────────────

# Everything CI runs, in the order that fails fastest.
check: lint static-analysis guard typecheck test

# Formatting and the linters, across every language in the repository.
lint:
    npm run lint:js
    npm run lint:css
    npm run format:check
    npm run lint:actions
    npm run lint:php
    npm run lint:api

# Types, inference and reachability across services/api.
static-analysis:
    npm run analyse:api

# The check that catches a scope reaching into another scope, which no test
# will. See docs/architecture/scopes.md and services/api/mago.toml.
#
# Architectural boundaries: which namespace may depend on which.
guard:
    npm run guard:api

typecheck:
    npm run typecheck

# Rewrite every file to the house style.
format:
    npm run format

# The gate after moving or renaming a class: php-cs-fixer and a green suite can
# both pass while the container cannot compile, because autowiring is where a
# wrong class name surfaces.
#
# Lint the container, the YAML config and composer.json.
lint-container:
    {{CONSOLE}} lint:container
    {{CONSOLE}} lint:yaml config --parse-tags
    {{API}} composer validate --strict --no-check-publish

# ── Dependencies ─────────────────────────────────────────────────────────────

composer *args:
    node scripts/php-tool.mjs composer {{args}}

console *args:
    {{CONSOLE}} {{args}}

# ── Housekeeping ─────────────────────────────────────────────────────────────

# The cache grows without bound across rebuilds — it has reached 233 GB on this
# machine and taken the daemon down with it. Volumes are untouched, so no
# database is lost.
#
# Delete the BuildKit build cache.
prune-build-cache:
    docker builder prune -af
