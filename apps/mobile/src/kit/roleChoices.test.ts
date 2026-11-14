import type { OrganisationRole } from '@soirely/api-client';
import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';
import es from '../i18n/locales/es.json';
import fr from '../i18n/locales/fr.json';
import pt from '../i18n/locales/pt.json';

import { roleLines, roleMeans } from './roleChoices.ts';

const OFFERED: Pick<OrganisationRole, 'id' | 'seededAs' | 'name'>[] = [
  { id: 'role_owner', seededAs: 'owner', name: null },
  { id: 'role_administrator', seededAs: 'administrator', name: null },
  { id: 'role_member', seededAs: 'member', name: null },
];

const CONFIRM = {
  en: 'Asks you to confirm it’s you.',
  es: 'Le pedirá que confirme que es usted.',
  fr: 'Vous devrez confirmer que c’est bien vous.',
  pt: 'Pede-lhe que confirme que é você.',
};

async function ownerLine(lng: keyof typeof CONFIRM): Promise<string> {
  const i18n = createInstance();
  await i18n.init({
    lng,
    resources: { [lng]: { translation: { en, es, fr, pt }[lng] } },
    interpolation: { escapeValue: false },
  });

  return roleMeans('role_owner', { lines: roleLines(i18n.t.bind(i18n), OFFERED) });
}

describe('the Owner row on the role screen (sc-37693)', () => {
  it.each(Object.entries(CONFIRM) as [keyof typeof CONFIRM, string][])(
    'says in %s that it asks you to confirm it is you, once and nothing about a password',
    async (lng, sentence) => {
      const line = await ownerLine(lng);

      expect(line.split(sentence)).toHaveLength(2);
      expect(line).not.toMatch(/password/iu);
      if (lng !== 'en') expect(line).not.toMatch(/Asks|confirm it/u);
    },
  );
});

describe('a role row’s line', () => {
  it('adds the owned line after what the role means, and only on that role', () => {
    const lines = { a: 'Means a.', b: 'Means b.' };

    expect(roleMeans('a', { lines, owned: { role: 'a', line: 'And more.' } })).toBe(
      'Means a. And more.',
    );
    expect(roleMeans('b', { lines, owned: { role: 'a', line: 'And more.' } })).toBe('Means b.');
  });

  it('shows why a role is not offered in place of what it means', () => {
    expect(
      roleMeans('a', { lines: { a: 'Means a.' }, off: { roles: ['a'], line: 'Not here.' } }),
    ).toBe('Not here.');
  });
});
