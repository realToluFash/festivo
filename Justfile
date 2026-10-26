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
# The notification worker answers once the database is migrated.
up:
    {{COMPOSE}} up -d
    services="$(node scripts/stack-services.mjs)" && {{COMPOSE}} up -d --wait --no-recreate $services

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
    {{COMPOSE}} build api notification-worker
    {{COMPOSE}} up -d api notification-worker

# A shell in the API container.
shell:
    {{COMPOSE}} exec api sh

# Gitignored, so each environment signs with its own. Safe to re-run: it skips
# an existing pair rather than replacing it, which would invalidate every token
# already issued.
#
# Generate the JWT signing keypair.
keypair:
    {{CONSOLE}} lexik:jwt:generate-keypair --skip-if-exists

# A psql prompt on the development database.
psql:
    {{COMPOSE}} exec postgres psql -U soirely -d soirely

# ── Databases ────────────────────────────────────────────────────────────────

# Bring the development database up to the current migrations.
migrate-database-dev:
    {{CONSOLE}} doctrine:migrations:migrate --no-interaction --allow-no-migration

# An unreleased migration edited in place leaves this database stale, and
# silently: Doctrine records which version ran, not what it contained, so
# migrate-database-dev reports nothing to do while the schema is wrong. This is
# the way out, and it is destructive — the development database is dropped.
# The notification worker is stopped first: Postgres refuses to drop a database
# it is connected to.
#
# Drop, recreate and migrate the development database.
reset-database-dev:
    services="$(node scripts/stack-services.mjs --after-migrations)" && {{COMPOSE}} stop $services
    {{CONSOLE}} doctrine:database:drop --if-exists --force
    {{CONSOLE}} doctrine:database:create
    {{CONSOLE}} doctrine:migrations:migrate --no-interaction --allow-no-migration
    services="$(node scripts/stack-services.mjs --after-migrations)" && {{COMPOSE}} up -d --wait --force-recreate $services

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
# Print the SQL the mapping implies, writing nothing.
diff-database:
    {{CONSOLE}} doctrine:schema:update --dump-sql

# Generate a migration from the mapping. It WRITES a file — read it, rewrite the
# SQL into a nowdoc, and check it is not a drop-and-create standing in for a
# rename. See the writing-migrations skill.
new-migration:
    {{CONSOLE}} doctrine:migrations:diff --no-interaction

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

# ── QA ───────────────────────────────────────────────────────────────────────
#
# The surfaces a QA pass drives, each with the one command that starts it. See
# .claude/skills/soirely-qa-tester for what a pass does with them.
#
# These run against THIS checkout's stack. An agent in QA mode works in its own
# stack instead — `just qa-env setup --tester N` makes tester N's, at ../soirely-qa,
# ../soirely-qa2 or ../soirely-qa3 — so that no two share a database, a port or a simulator.

# Developer N's own stack, at ../soirely-devN: `just dev-env setup --developer N` (2 to 4).
# The other roles' the same way: `just dev-env setup --role lead` (ops, l10n).
dev-env *args:
    node scripts/dev-env.mjs {{args}}

# The roles this machine runs, from ~/.config/soirely/agents.json (docs/agents).
# `just agents setup` once, then `just agents up`; `just agents down [--now]` before switching off.
agents *args:
    python3 tools/queue/sq agents {{args}}

# A tester's own QA stack: `just qa-env setup --tester N`, then work from its worktree.
qa-env *args:
    node scripts/qa-env.mjs {{args}}

# A throwaway account, registered through the API. `just qa-account --json` for JSON.
qa-account *args:
    node scripts/qa-account.mjs {{args}}

# The app in Expo Go on a phone on this network, at the latest main. Leave it running.
# Run it from a detached checkout such as ../soirely-ops; `just phone 192.168.1.20` picks the address.
phone *args:
    node scripts/phone.mjs {{args}}

# The app in Expo Go on a booted simulator, for Maestro to drive. Leave it running.
qa-ios device="iPhone 17 Pro":
    #!/usr/bin/env sh
    xcrun simctl boot "{{device}}" 2>/dev/null || true
    open -a Simulator
    npm run ios --workspace @soirely/mobile

# One Maestro flow: `just qa-mobile sign-in EMAIL=a@b.test PASSWORD=x`
qa-mobile flow *vars:
    #!/usr/bin/env sh
    set -e
    command -v maestro >/dev/null || { echo "maestro is not on PATH. brew install --cask temurin@21, then https://maestro.dev"; exit 1; }
    java -version >/dev/null 2>&1 || { echo "Maestro needs a Java runtime: brew install --cask temurin@21"; exit 1; }
    passed=""
    for pair in {{vars}}; do passed="$passed -e $pair"; done
    # Maestro will not write a screenshot outside its own run folder, so the
    # run folder is the place the evidence is collected from.
    rm -rf .qa/{{flow}}
    mkdir -p .qa/{{flow}}
    status=0
    # The bundler's address first, so a flow can name it and a caller can still
    # override it. The QA stack's bundler is on another port.
    maestro test --debug-output .qa/{{flow}} -e METRO_URL=exp://127.0.0.1:8081 -e MAILPIT_URL=http://localhost:8025 $passed apps/mobile/.maestro/{{flow}}.yaml || status=$?
    # Collected to the top of the folder, because a report attaches these and
    # the run folder buries them six levels down.
    # -mindepth 2, because find's -path matches across slashes: excluding
    # ".qa/<flow>/*.png" excluded every nested one as well, which is how the
    # first version of this line quietly collected nothing.
    find .qa/{{flow}} -mindepth 2 -name '*.png' -exec cp {} .qa/{{flow}}/ \;
    echo ""
    echo "Evidence in .qa/{{flow}}:"
    ls .qa/{{flow}}/*.png 2>/dev/null || echo "  (no screenshots)"
    exit $status

# Its own profile, so nothing touches the browser you read your email in.
#
# Chrome with a debugging port, for a browser driver to attach to.
qa-chrome:
    open -na "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir=/tmp/soirely-qa-chrome --no-first-run --no-default-browser-check http://localhost:5173
