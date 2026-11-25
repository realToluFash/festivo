import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(join('src', 'components', 'GuestExport.tsx'), 'utf8');
const hook = source.slice(source.indexOf('function useExport('), source.indexOf('const body ='));

describe('Export in the app abandons a press when its dialog goes (sc-3784)', () => {
  it('starts a new round when the dialog closes', () => {
    expect(hook).toMatch(
      /useEffect\(\(\) => \{\s+if \(!live\) round\.current \+= 1;\s+\}, \[live\]\);/u,
    );
  });

  it('starts a new round when the dialog unmounts', () => {
    expect(hook).toMatch(
      /useEffect\(\s+\(\) => \(\) => \{\s+round\.current \+= 1;\s+\},\s+\[\],\s+\);/u,
    );
  });

  it('abandons a press once its round has passed', () => {
    expect(hook).toContain('const mine = ++round.current;');
    expect(hook).toContain('abandoned: () => round.current !== mine,');
  });

  it('is fed whether the dialog is open', () => {
    expect(source).toContain('useExport(props, open);');
  });
});
