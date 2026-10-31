import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, it } from 'vitest';

/**
 * Nothing reads an API URL through `import.meta.env`.
 *
 * Anything read from there is substituted at build time by definition, so a
 * single line doing it puts the URL back inside the bundle and undoes the
 * entire mechanism — silently, because the application still works perfectly on
 * the machine it was built on.
 *
 * A source-level guard rather than a check on the built bundle: this one runs
 * in milliseconds without a build step, and it fails on the line somebody
 * wrote rather than on a minified artefact.
 */
const FORBIDDEN = /import\.meta\.env\s*\.\s*\w*(API|URL|BASE|MERCURE)\w*/i;

it('no source file reads an API or Mercure URL from the build environment', () => {
  const offenders = sources().filter(({ text }) => FORBIDDEN.test(text));

  expect(
    offenders.map((f) => f.path),
    'The API URL must come from /config.json at boot, never from import.meta.env — see src/config.ts and apps/web/README.md.',
  ).toEqual([]);
});

/**
 * And the development default is not a production host.
 *
 * A committed config.json pointing at the real API is the same failure wearing
 * a different hat: it works everywhere, including where it should not.
 */
it('the committed development config points at localhost', () => {
  const raw = readFileSync(join(import.meta.dirname, '../public/config.json'), 'utf8');
  const parsed = JSON.parse(raw) as { apiBaseUrl: string };

  expect(parsed.apiBaseUrl).toMatch(/^https?:\/\/(localhost|127\.0\.0\.1)/);
});

function sources(): Array<{ path: string; text: string }> {
  const found: Array<{ path: string; text: string }> = [];
  const root = import.meta.dirname;

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(path);
      } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.')) {
        found.push({ path: path.slice(root.length + 1), text: readFileSync(path, 'utf8') });
      }
    }
  };

  walk(root);

  return found;
}
