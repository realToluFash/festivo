import { describe, expect, it } from 'vitest';

import { staffLangOf, staffQuery, staffTabWords } from './staffTabs.ts';

describe('the Staff tabs in the demo (sc-99786)', () => {
  it('reads the product’s own tab words in each language', () => {
    expect(staffTabWords('en').tabs).toEqual([
      'Roster',
      'Jobs and shifts',
      'Stations',
      'Hours worked',
    ]);
    expect(staffTabWords('fr').tabs).toEqual([
      'Liste du personnel',
      'Fonctions et services',
      'Postes',
      'Heures travaillées',
    ]);
    expect(staffTabWords('fr').title).toBe('Équipe');
  });

  it('keeps the language when a tab opens another page', () => {
    expect(staffLangOf('fr-FR')).toBe('fr');
    expect(staffLangOf('de-DE')).toBeNull();
    expect(staffLangOf(null)).toBeNull();
    expect(staffQuery('fr')).toBe('?locale=fr-FR');
    expect(staffQuery('en')).toBe('');
  });
});
