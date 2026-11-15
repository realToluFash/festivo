import { describe, expect, it } from 'vitest';

import { nameToSave } from './accountName.ts';

describe('nameToSave', () => {
  it('trims the ends and keeps the spaces inside as typed', () => {
    expect(nameToSave('  Kemi  Adé ', 'Kemi')).toEqual({ kind: 'changed', name: 'Kemi  Adé' });
  });

  it('keeps every character a name has', () => {
    expect(nameToSave("Zoë O'Brien-Núñez", 'Zoe')).toEqual({
      kind: 'changed',
      name: "Zoë O'Brien-Núñez",
    });
    expect(nameToSave('李小龍', 'Bruce')).toEqual({ kind: 'changed', name: '李小龍' });
  });

  it('is blank when only spaces are typed', () => {
    expect(nameToSave('', 'Kemi')).toEqual({ kind: 'blank' });
    expect(nameToSave('   ', 'Kemi')).toEqual({ kind: 'blank' });
  });

  it('is unchanged when only the ends differ', () => {
    expect(nameToSave(' Kemi  ', 'Kemi')).toEqual({ kind: 'unchanged' });
  });
});
