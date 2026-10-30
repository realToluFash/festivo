import { EVENT_TYPES } from '@soirely/domain';
import i18next from 'i18next';
import { describe, expect, it } from 'vitest';

import '../../../i18n/index.ts';
import { typeChoices, typeLabel } from './eventTypes.ts';

describe('the label of a type (sc-3588)', () => {
  it.each(['en', 'es', 'fr', 'pt'])('names all fourteen in %s', (locale) => {
    const t = i18next.getFixedT(locale);
    const labels = EVENT_TYPES.map((type) => typeLabel(type, t));

    expect(labels.filter((label) => label === '' || label.startsWith('eventTypes.'))).toEqual([]);
    expect(new Set(labels).size).toBe(14);
  });

  it('offers the placeholder only while no type is chosen', () => {
    const t = i18next.getFixedT('en');

    expect(typeChoices('', t)[0]).toEqual({ value: '', label: 'Choose what kind of event' });
    expect(typeChoices('memorial', t).map(({ value }) => value)).toEqual([...EVENT_TYPES]);
  });
});
