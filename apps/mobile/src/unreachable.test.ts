import { describe, expect, it } from 'vitest';

import { carryOn, unreachableFrom } from './unreachable.ts';

const TOKEN = '0123456789abcdef0123456789ABCDEF';

describe('where Try again carries on to', () => {
  it('returns to the request link the screen was opened from', () => {
    expect(carryOn(unreachableFrom(TOKEN).params?.link)).toEqual({
      pathname: '/join/[token]',
      params: { token: TOKEN },
    });
  });

  it('relaunches when the screen was opened from launch', () => {
    expect(carryOn(undefined)).toBe('/');
  });

  it('relaunches rather than following a link that is not a request link', () => {
    expect(carryOn('../sign-in')).toBe('/');
    expect(carryOn(`${TOKEN}${TOKEN}`)).toBe('/');
  });
});
