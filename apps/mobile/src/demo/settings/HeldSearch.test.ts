import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = (file: string) => readFileSync(join(import.meta.dirname, file), 'utf8');

describe('sc-82858: the paused page has no Search', () => {
  const home = source('SettingsHome.tsx');
  const frame = source('Frame.tsx');

  it('turns Search off only while paused', () => {
    expect(home).toContain("const search = held !== 'paused';");
  });

  it('drops the sidebar row on its side and the button upright', () => {
    expect(home).toContain('<Landscape column={null} search={search}>');
    expect(home).toContain('<PortraitTop at="Settings" search={search} />');
  });

  it('passes the flag to the sidebar and keeps the bell alone upright', () => {
    expect(frame).toMatch(/demoShell\([^\n]*\n\s*search,/u);
    expect(frame).toMatch(
      /search \? \(\s*<SearchAndBell[^)]*\/>\s*\) : \(\s*<Bell tell=\{shell\.tell\} \/>/u,
    );
  });
});
