import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { schemes, withScheme } from '../theme/tokens.ts';

const mesh = readFileSync(join('src', 'components', 'EventMesh.tsx'), 'utf8');

function partyBase(): string {
  const at = mesh.indexOf('  party: {');
  if (at < 0) throw new Error('No party mesh in EventMesh.tsx.');

  return mesh.slice(at, mesh.indexOf('\n  },\n', at));
}

describe('a party event’s mesh', () => {
  it('is drawn on the party cover, not the scheme’s accent', () => {
    expect(partyBase()).toContain('base: tokens.coverParty,');
    expect(partyBase()).not.toContain('colorAccent');
  });

  it.each(Object.keys(schemes).filter((name) => name !== 'violet'))(
    'stays Violet under the %s scheme',
    (name) => {
      const scheme = withScheme(name);

      expect(scheme.coverParty).toBe(withScheme('violet').colorAccent);
      expect(scheme.coverParty).not.toBe(scheme.colorAccent);
    },
  );
});
