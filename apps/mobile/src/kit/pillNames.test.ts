import { describe, expect, it } from 'vitest';

import type { Membership, PausedOrganisation } from '@soirely/api-client';
import { createInstance } from 'i18next';

import en from '../i18n/locales/en.json';
import { openerLabel, pillNames } from './pillNames.ts';

const BRAVO = {
  id: 'org-b',
  name: 'Bravo',
  role: { seededAs: 'administrator', name: null },
} as unknown as Membership;
const ALPHA = { id: 'org-a', name: 'Alpha' } as unknown as PausedOrganisation;

const t = createInstance();
await t.init({ lng: 'en', resources: { en: { translation: en } } });

describe('What the pill names (sc-83881)', () => {
  it('names the paused organisation, not the one kept for later', () => {
    expect(pillNames({ organisation: BRAVO, pausedIn: ALPHA })).toEqual({
      id: 'org-a',
      name: 'Alpha',
      role: null,
    });
  });

  it('names the paused organisation when it was the only one', () => {
    expect(pillNames({ organisation: null, pausedIn: ALPHA })?.name).toBe('Alpha');
  });

  it('names the organisation in use when nothing is paused', () => {
    expect(pillNames({ organisation: BRAVO, pausedIn: null })).toBe(BRAVO);
    expect(pillNames({ organisation: null, pausedIn: null })).toBeNull();
  });

  it('says access is paused in place of a role, and always switches', () => {
    const paused = pillNames({ organisation: null, pausedIn: ALPHA })!;

    expect(openerLabel(t.t, paused, 0, false)).toBe(
      'Organisation: Alpha, access paused. Switch organisation',
    );
    expect(openerLabel(t.t, paused, 1, true)).toBe(
      'Organisation: Alpha, access paused. Switch organisation. 1 invitation waiting',
    );
    expect(openerLabel(t.t, paused, 2, true)).toBe(
      'Organisation: Alpha, access paused. Switch organisation. 2 invitations waiting',
    );
  });

  it('keeps the role for an organisation in use', () => {
    expect(openerLabel(t.t, BRAVO, 0, true)).toBe(
      'Organisation: Bravo, your role Admin. Switch organisation',
    );
  });
});
