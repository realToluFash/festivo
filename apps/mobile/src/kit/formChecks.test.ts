import { describe, expect, it } from 'vitest';

import { checkAll } from './formChecks.ts';

const blank = (field: string, value: string) =>
  value.trim() === '' ? `${field} is missing` : null;

describe('a form checked on the press', () => {
  it('names every failing field at once, and the first in screen order is the one focused', () => {
    expect(
      checkAll(['name', 'email', 'password'], blank, { name: '', email: 'a@b.co', password: ' ' }),
    ).toEqual({
      errors: { name: 'name is missing', password: 'password is missing' },
      first: 'name',
    });
  });

  it('lets a form with nothing failing be sent', () => {
    expect(checkAll(['email'], blank, { email: 'a@b.co' })).toEqual({ errors: {}, first: null });
  });
});
