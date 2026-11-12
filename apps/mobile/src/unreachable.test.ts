import { describe, expect, it } from 'vitest';

import { carryOn, unreachableFrom } from './unreachable.ts';

const TOKEN = '0123456789abcdef0123456789ABCDEF';

function returnFrom(kind: 'join' | 'reset') {
  const { params } = unreachableFrom({ kind, token: TOKEN });

  return carryOn(params?.link, params?.to);
}

describe('where Try again carries on to', () => {
  it('returns to the request link the screen was opened from', () => {
    expect(returnFrom('join')).toEqual({ pathname: '/join/[token]', params: { token: TOKEN } });
  });

  it('returns to the reset link the screen was opened from', () => {
    expect(returnFrom('reset')).toEqual({ pathname: '/reset-password', params: { token: TOKEN } });
  });

  it('relaunches when the screen was opened from launch', () => {
    expect(carryOn(undefined, undefined)).toBe('/');
  });

  it('relaunches when the screen remembered no link', () => {
    expect(carryOn('', 'reset')).toBe('/');
  });
});
