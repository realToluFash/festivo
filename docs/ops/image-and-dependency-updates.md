# Image and dependency updates

The runbook for any change that moves a base image tag (`services/api/Dockerfile`,
`apps/web`, `compose.yaml`) or a locked dependency (`composer.lock`, `package-lock.json`,
`services/api/docker/weasyprint/requirements.txt`).

## Before the pull request

1. Bump one thing per pull request, to a pinned version, never `latest` or a floating range.
2. Read the changelog between the two versions for breaking changes and security fixes.
3. Run `npm audit` and `node scripts/php-tool.mjs composer audit`, and list what the bump
   fixes or leaves open in the pull request.

## When the update moves the kitchen sheet's PDF tools

The kitchen sheet's PDF (sc-3911, sc-5821) is drawn by WeasyPrint from PyPI, checked by
veraPDF in the dev stage, and set in a font copied from the app.

- **WeasyPrint or one of its dependencies** (an advisory in pillow or fonttools, say): set
  the version in `services/api/docker/weasyprint/requirements.in` and regenerate the lock on
  trixie's Python 3.13, the one the image installs into. Another Python drops the cp313
  wheels `--only-binary :all:` needs. From that directory:

  ```sh
  docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD":/w -w /w \
    python:3.13-slim-trixie sh -c 'pip install -q --user pip==25.2 pip-tools==7.5.2 \
    && /tmp/.local/bin/pip-compile --quiet --generate-hashes --strip-extras \
       --no-emit-index-url requirements.in'
  ```

  To move one dependency without the rest, add `--upgrade-package <name>`.

- **veraPDF**: `VERAPDF_VERSION` in the dev stage of `services/api/Dockerfile`, and the
  sha256 beside it, which is the installer zip's:
  `curl -fsSL https://software.verapdf.org/releases/<major.minor>/verapdf-greenfield-<version>-installer.zip | sha256sum`.
- **Instrument Sans**: `services/api/docker/fonts/instrument-sans/` is a copy of
  `apps/mobile/assets/fonts/instrument-sans/`, because the API's build context is
  `services/api`. A font update on the app lands in both in the same pull request;
  `diff -r` on the two directories prints nothing when they agree.

Then build the dev stage (`docker compose build api`): it fails on a broken WeasyPrint,
font or veraPDF install. Once sc-3911's `KitchenSheetTest` is in, run it too, since it is
what shows the sheet still passes PDF/UA-1.

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

   The first prints how many events would change and writes nothing:

   ```text
   Would recompute the UTC times of N events.
   ```

   The second writes. Locally that is
   `just console app:recompute-event-times`, with or without `--dry-run`. Only events not
   yet over are touched, and running it twice changes nothing the second time.

3. Record the count it prints (`Recomputed the UTC times of N events.`), with the
   environment, the old and new tzdata versions and the commit, in the pull request or the
   deploy report.
