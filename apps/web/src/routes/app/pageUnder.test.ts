import { type Location } from 'react-router';
import { describe, expect, it } from 'vitest';

import { pathShown, underOf } from './pageUnder.ts';

function at(pathname: string, state: unknown = null): Location {
  return { pathname, search: '', hash: '', state, key: 'k' };
}

describe('the page under Due now', () => {
  const budget = at('/app/events/e1/budget');

  it('is the page the bell was opened on', () => {
    const due = at('/app/due/r1', { under: budget });

    expect(underOf(due)).toBe(budget);
    expect(pathShown(due)).toBe('/app/events/e1/budget');
  });

  it('is Today when the link opened the desk, after sign-in included', () => {
    const due = at('/app/due/r1', { from: '/sign-in' });

    expect(underOf(due)).toBeNull();
    expect(pathShown(due)).toBe('/app');
  });

  it('is never a page outside the desk', () => {
    expect(underOf(at('/app/due/r1', { under: at('/sign-in') }))).toBeNull();
  });

  it('leaves every other page as it is', () => {
    expect(pathShown(budget)).toBe('/app/events/e1/budget');
  });
});
