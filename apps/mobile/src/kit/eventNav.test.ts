import { describe, expect, it } from 'vitest';

import { areaBack, areaOf, eventHref } from './eventNav.ts';

describe('areaOf', () => {
  it('reads an area the event has', () => {
    expect(areaOf('seating')).toBe('seating');
  });

  it('opens on Overview with no area or one the event does not have', () => {
    expect(areaOf(undefined)).toBe('overview');
    expect(areaOf('check-in')).toBe('overview');
  });
});

describe('areaBack', () => {
  it('goes back to Overview from any other area', () => {
    expect(areaBack('reports')).toBe('overview');
    expect(areaBack('guests')).toBe('overview');
  });

  it('leaves the event from Overview', () => {
    expect(areaBack('overview')).toBe('leave');
  });
});

describe('eventHref', () => {
  it('says when the event was opened from Happening now', () => {
    expect(eventHref('a b')).toBe('/events/a%20b');
    expect(eventHref('e1', true)).toBe('/events/e1?now=1');
  });
});
