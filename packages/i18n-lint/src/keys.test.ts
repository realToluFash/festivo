import { describe, expect, it } from 'vitest';

import { keysOf, load } from './catalogues.ts';
import { findKeys, resolves } from './keys.ts';
import { sourcesOf } from './sources.ts';
import { SURFACES } from './surfaces.ts';

describe.each(SURFACES.filter((s) => s.sources.length > 0).map((s) => [s.name, s] as const))(
  '%s',
  (_name, surface) => {
    it('asks only for keys its catalogue has', () => {
      const keys = keysOf(load(surface, 'en'));
      const unknown = sourcesOf(surface.sources).flatMap(({ path, text }) =>
        findKeys(path, text)
          .filter((use) => !resolves(keys, use.key))
          .map((use) => `${path}:${use.line} ${use.key}`),
      );

      expect(unknown, 'no such key in en — it renders as its own key path in every locale').toEqual(
        [],
      );
    });
  },
);

describe('the key finder', () => {
  const scan = (source: string) => findKeys('fixture.tsx', source).map((use) => use.key);

  it('finds t() and i18n.t()', () => {
    expect(scan("t('a.b'); i18n.t('c.d');")).toEqual(['a.b', 'c.d']);
  });

  it('finds both keys a ternary picks between, nested ones too', () => {
    expect(scan("t(failed ? 'a.b' : (retry ? 'c.d' : 'e.f'));")).toEqual(['a.b', 'c.d', 'e.f']);
  });

  it('passes a key built at run time, which it cannot know', () => {
    expect(scan('t(`roles.${name}`); t(key);')).toEqual([]);
  });
});

describe('a key resolves', () => {
  const catalogue = { error: { network: 'x' }, guests: { count_one: 'x', count_other: 'x' } };

  it.each(['error.network', 'guests.count'])('%s', (key) => {
    expect(resolves(catalogue, key)).toBe(true);
  });

  it.each(['error', 'error.retry', 'guests.coun', 'guests.count_', 'err'])('not %s', (key) => {
    expect(resolves(catalogue, key)).toBe(false);
  });
});
