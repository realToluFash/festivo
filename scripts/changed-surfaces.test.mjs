import { describe, expect, it } from 'vitest';

import { allSurfaces, changedSurfaces } from './changed-surfaces.mjs';

/**
 * The only real logic in CI, asserted against realistic change sets.
 *
 * The failure this guards is the quiet one: a pattern that matches nothing
 * means a surface stops being checked, and the pull request still goes green.
 * Nothing else in the system would say so.
 */
describe('a single-surface change runs that surface and no other', () => {
  it('an API source file', () => {
    expect(changedSurfaces(['services/api/src/Controller/HealthController.php'])).toEqual({
      everything: false,
      api: true,
      web: false,
      mobile: false,
      packages: false,
      locales: false,
    });
  });

  it('a web screen also runs localisation, because a screen can introduce a literal', () => {
    const surfaces = changedSurfaces(['apps/web/src/routes/public/Home.tsx']);

    expect(surfaces.web).toBe(true);
    expect(surfaces.locales).toBe(true);
    expect(surfaces.api).toBe(false);
    expect(surfaces.everything).toBe(false);
  });

  it('a mobile screen, the same', () => {
    const surfaces = changedSurfaces(['apps/mobile/app/index.tsx']);

    expect(surfaces.mobile).toBe(true);
    expect(surfaces.locales).toBe(true);
    expect(surfaces.web).toBe(false);
  });

  it('a shared package', () => {
    const surfaces = changedSurfaces(['packages/domain/src/guestName.ts']);

    expect(surfaces.packages).toBe(true);
    expect(surfaces.everything).toBe(false);
  });

  it.each([
    ['the agent gateway', 'tools/agent-gateway/src/gateway.ts'],
    ['a pair the gateway replays', 'services/api/tests/Fixtures/AgentGateway/text.json'],
    [
      'a saved wall clock the form names',
      'services/api/tests/Fixtures/LocalTime/wall-clock-times.json',
    ],
    ['the regions the domain reads', 'services/api/src/Domain/Organisation/Regions.php'],
  ])('%s runs the packages', (_name, path) => {
    expect(changedSurfaces([path]).packages).toBe(true);
  });
});

describe('a catalogue runs localisation wherever it lives', () => {
  it.each([
    ['a client catalogue', 'apps/web/src/i18n/locales/fr.json'],
    ['a server catalogue', 'services/api/translations/errors.fr.json'],
  ])('%s', (_name, path) => {
    expect(changedSurfaces([path]).locales).toBe(true);
  });
});

describe('shared root configuration runs everything', () => {
  it.each([
    ['the lockfile, because a resolution change breaks untouched surfaces', 'package-lock.json'],
    ['the eslint config', 'eslint.config.mjs'],
    ['the compose stack', 'compose.yaml'],
    ['a script', 'scripts/test-db.mjs'],
    ['the workflow itself', '.github/workflows/pull-request.yml'],
  ])('%s', (_name, path) => {
    expect(changedSurfaces([path]).everything).toBe(true);
  });

  /** It is also a catalogue declaration, so it is both. */
  it('locales.json runs everything and localisation', () => {
    const surfaces = changedSurfaces(['locales.json']);

    expect(surfaces.everything).toBe(true);
    expect(surfaces.locales).toBe(true);
  });
});

describe('what does not run', () => {
  it('a documentation change runs no surface', () => {
    expect(Object.values(changedSurfaces(['docs/architecture/billing.md']))).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  /**
   * A path merely CONTAINING a surface name is not that surface. `^` anchors
   * exist for this, and without a test they are the kind of thing a later edit
   * drops.
   */
  it('a path that merely mentions a surface does not trigger it', () => {
    const surfaces = changedSurfaces(['docs/apps/web-notes.md']);

    expect(surfaces.web).toBe(false);
    expect(surfaces.locales).toBe(false);
  });

  it('ignores blank lines, which git output ends with', () => {
    expect(changedSurfaces(['services/api/src/X.php', '', '  ']).api).toBe(true);
  });
});

describe('a change set touching several surfaces runs all of them', () => {
  it('an API change and a web change', () => {
    const surfaces = changedSurfaces([
      'services/api/src/Controller/AssistantController.php',
      'apps/web/src/api.ts',
    ]);

    expect(surfaces.api).toBe(true);
    expect(surfaces.web).toBe(true);
    expect(surfaces.mobile).toBe(false);
  });
});

/** No usable base to diff against must mean everything, never nothing. */
it('falls back to every surface when there is no base commit', () => {
  expect(Object.values(allSurfaces()).every(Boolean)).toBe(true);
});
