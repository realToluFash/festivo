# Image and dependency updates

The runbook for any change that moves a base image tag (`services/api/Dockerfile`,
`apps/web`, `compose.yaml`) or a locked dependency (`composer.lock`, `package-lock.json`).

## Before the pull request

1. Bump one thing per pull request, to a pinned version, never `latest` or a floating range.
2. Read the changelog between the two versions for breaking changes and security fixes.
3. Run `npm audit` and `node scripts/php-tool.mjs composer audit`, and list what the bump
   fixes or leaves open in the pull request.

## When the update bumps PHP's tzdata

PHP carries its own copy of the time-zone database, compiled into `ext/date`. Every event's
`starts_at_utc` and `ends_at_utc` were derived from it on save (`docs/architecture/database.md`),
so a new tzdata leaves the UTC times of upcoming events wrong wherever a zone's rules changed.

1. Compare the version on both sides of the update, in the api container:

   ```sh
   php -r 'echo timezone_version_get(), PHP_EOL;'
   ```

   A PHP image bump usually moves it. Composer and npm updates never do.

2. If it changed, once the new image is running in an environment, run in that
   environment's api container:

   ```sh
   bin/console app:recompute-event-times --dry-run
   bin/console app:recompute-event-times
   ```

   The first prints how many events would change (`Would recompute the UTC times of N
events.`) and writes nothing; the second writes. Locally that is
   `just console app:recompute-event-times`, with or without `--dry-run`. Only events not
   yet over are touched, and running it twice changes nothing the second time.

3. Record the count it prints (`Recomputed the UTC times of N events.`), with the
   environment, the old and new tzdata versions and the commit, in the pull request or the
   deploy report.
