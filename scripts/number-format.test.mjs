import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const SOURCES = ['apps/web/src', 'apps/mobile/src', 'apps/mobile/app', 'packages/domain/src'];
const ALLOWED = new Set(['packages/domain/src/locales.ts', 'packages/domain/src/roomSize.ts']);

const sourceFiles = (dir) =>
  readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx|js|jsx|mjs)$/.test(entry.name))
    .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)))
    .filter((path) => !path.split('/').includes('demo'))
    .filter((path) => !/\.test\.(ts|tsx|js|jsx|mjs)$/.test(path));

const files = SOURCES.flatMap(sourceFiles);

describe('a number the product shows', () => {
  it('finds the product sources it guards', () => {
    expect(files).toContain('apps/mobile/src/components/EventPeople.tsx');
    expect(files).toContain('packages/domain/src/locales.ts');
  });

  it('is formatted through numberFormat(), which groups as the shown language does', () => {
    const offenders = files
      .filter((path) => !ALLOWED.has(path))
      .filter((path) =>
        /Intl\s*\.\s*NumberFormat\s*\(/.test(readFileSync(join(ROOT, path), 'utf8')),
      );

    expect(offenders).toEqual([]);
  });
});
