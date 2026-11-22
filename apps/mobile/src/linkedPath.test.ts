import { describe, expect, it } from 'vitest';

import { linkedPath } from './linkedPath.ts';

describe('the path a link into the app opens', () => {
  it('takes what follows the scheme', () => {
    expect(linkedPath('soirely://events/e1?area=guests')).toBe('/events/e1?area=guests');
  });

  it('takes a universal link’s path and query', () => {
    expect(linkedPath('https://soirely.app/events/e1?area=people')).toBe('/events/e1?area=people');
  });

  it('takes what follows an Expo Go link’s /--/, not its host', () => {
    expect(linkedPath('exp://127.0.0.1:38081/--/events/e1?area=guests')).toBe(
      '/events/e1?area=guests',
    );
    expect(linkedPath('exps://u.expo.dev/abc/--/events/e1')).toBe('/events/e1');
  });

  it('keeps a scheme link with an empty host', () => {
    expect(linkedPath('soirely:///events/e1')).toBe('/events/e1');
  });

  it('opens the start for a link with no path', () => {
    expect(linkedPath('exp://127.0.0.1:38081')).toBe('/');
    expect(linkedPath('https://soirely.app')).toBe('/');
    expect(linkedPath('soirely://')).toBe('/');
  });

  it('keeps a path that is already one', () => {
    expect(linkedPath('/settings/members')).toBe('/settings/members');
  });
});
