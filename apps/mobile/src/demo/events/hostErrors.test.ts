import { describe, expect, it } from 'vitest';

import { hostErrorWords } from './hostErrors.ts';

describe('hostErrorWords', () => {
  it('shows a repeat as it is typed and a blank one only once tried', () => {
    const names = ['Funmi Adeyemi', '', ' funmi adeyemi '];

    expect(hostErrorWords(names, false)).toEqual([null, null, 'Funmi Adeyemi is already a host.']);
    expect(hostErrorWords(names, true)).toEqual([
      null,
      'Enter a name or remove this host.',
      'Funmi Adeyemi is already a host.',
    ]);
  });

  it('shows an overlong name at once', () => {
    expect(hostErrorWords(['x'.repeat(61)], false)).toEqual([
      'A host’s name can be at most 60 characters. This one has 61.',
    ]);
  });
});
