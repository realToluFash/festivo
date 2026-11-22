import { describe, expect, it } from 'vitest';

import { linkedPath } from './linkedPath.ts';

describe('the path a link into the app opens', () => {
  it('takes what follows the scheme', () => {
    expect(linkedPath('soirely://events/e1?area=guests')).toBe('/events/e1?area=guests');
  });

  it('takes a universal link’s path and query', () => {
    expect(linkedPath('https://soirely.app/events/e1?area=people')).toBe('/events/e1?area=people');
  });

  it('opens the start for a link with no path', () => {
    expect(linkedPath('https://soirely.app')).toBe('/');
    expect(linkedPath('soirely://')).toBe('/');
  });

  it('keeps a path that is already one', () => {
    expect(linkedPath('/settings/members')).toBe('/settings/members');
  });
});
