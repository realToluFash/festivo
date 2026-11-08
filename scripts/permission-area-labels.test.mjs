import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { CATALOGUES, flatten } from './locale-status.mjs';

const areas = [
  ...readFileSync(
    new URL('../services/api/src/Enum/PermissionArea.php', import.meta.url),
    'utf8',
  ).matchAll(/^\s*case \w+ = '([a-z_]+)';/gm),
].map(([, area]) => area);

const english = flatten(
  JSON.parse(readFileSync(CATALOGUES.mobile.replace('{locale}', 'en'), 'utf8')),
);

describe("the app's role grid", () => {
  it('reads the areas the API declares', () => {
    expect(areas).toContain('people');
  });

  it.each(areas)('names and explains the %s area', (area) => {
    expect(english).toHaveProperty([`rolesScreen.area.${area}`]);
    expect(english).toHaveProperty([`rolesScreen.means.${area}`]);
  });
});
