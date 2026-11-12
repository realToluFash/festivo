import { describe, expect, it } from 'vitest';

import { firstName } from './firstName.ts';

describe('firstName', () => {
  it('takes the name up to its first space', () => {
    expect(firstName('Maximiliana Fernández-Castellanos de la Vega')).toBe('Maximiliana');
  });

  it('takes a name with no space whole', () => {
    expect(firstName('Oluwatobilobaoluwadamilareadebayoakinola')).toBe(
      'Oluwatobilobaoluwadamilareadebayoakinola',
    );
  });
});
