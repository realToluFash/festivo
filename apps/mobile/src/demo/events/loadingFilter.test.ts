import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(join('src', 'demo', 'events', 'EventsList.tsx'), 'utf8');
const loading = source.slice(source.indexOf('if (loading)'), source.indexOf('<SunkTabs />'));
const filter = loading.slice(
  loading.indexOf('<FilterButton'),
  loading.indexOf('/>', loading.indexOf('<FilterButton')),
);

describe("The Events demo's loading row draws Filter as the app does (sc-78193)", () => {
  it("keeps Filter's room through FilterButton's own unseen prop, with no wrapper of its own", () => {
    expect(filter).toMatch(/^\s+unseen$/mu);
    expect(loading).not.toContain('pointerEvents="none"');
    expect(loading).not.toContain('opacity');
  });
});
