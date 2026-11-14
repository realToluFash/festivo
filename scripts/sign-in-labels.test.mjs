import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { CATALOGUES, flatten, LOCALES } from './locale-status.mjs';

const catalogue = (name, locale) =>
  flatten(JSON.parse(readFileSync(CATALOGUES[name].replace('{locale}', locale), 'utf8')));

const english = catalogue('emails', 'en');

describe('an email that sends people to a sign-in link', () => {
  describe.each(LOCALES)('in %s', (locale) => {
    const line = catalogue('emails', locale)['twoFactor.on.notYou'];
    const label = catalogue('web', locale)['twoFactor.lostBoth'];

    it('names the label the web and the app show', () => {
      expect(catalogue('mobile', locale)['twoFactor.lostBoth']).toBe(label);
    });

    it.skipIf(locale !== 'en' && line === english['twoFactor.on.notYou'])(
      'quotes that label word for word',
      () => {
        expect(line).toContain(label);
      },
    );
  });
});
