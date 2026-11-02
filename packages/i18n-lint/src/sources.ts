import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { ROOT } from './surfaces.ts';

export interface Source {
  path: string;
  text: string;
}

export function sourcesOf(roots: readonly string[]): Source[] {
  const found: Source[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        walk(path);
      } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
        found.push({ path: relative(ROOT, path), text: readFileSync(path, 'utf8') });
      }
    }
  };

  for (const root of roots) walk(join(ROOT, root));

  return found;
}
