import { describe, expect, it } from 'vitest';

import { areaBack, areaOf, editPartOf, eventHref, guestsHref } from './eventNav.ts';

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

describe('editPartOf', () => {
  it("reads the part a link's at= opens, starts being Dates (sc-48600)", () => {
    expect(editPartOf('starts')).toBe('dates');
    expect(editPartOf('venue')).toBe('venue');
    expect(editPartOf('hosts')).toBe('hosts');
    expect(editPartOf('name')).toBe('name');
    expect(editPartOf('type')).toBe('type');
    expect(editPartOf('currency')).toBe('currency');
  });

  it('opens nothing for no part, or one the app does not know', () => {
    expect(editPartOf(undefined)).toBeUndefined();
    expect(editPartOf('cover')).toBeUndefined();
    expect(editPartOf('toString')).toBeUndefined();
  });
});

describe('guestsHref', () => {
  it("opens an event's Guests on the choice a figure counts (sc-3786)", () => {
    expect(guestsHref('evt 1', 'noReply')).toBe('/events/evt%201?area=guests&filter=noReply');
  });
});
