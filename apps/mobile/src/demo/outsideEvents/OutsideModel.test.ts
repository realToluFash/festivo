import { describe, expect, it } from 'vitest';

import { areasFor } from '../doorCode/RedeemModel.ts';
import {
  afterRequest,
  choose,
  E1,
  E2,
  E3,
  E4,
  inOrder,
  landingOf,
  listsEvents,
  NOW,
  OUTSIDE_STATES,
  outsideOf,
  rowLabel,
  rowLine,
  underWay,
  wayBack,
} from './OutsideModel.ts';

const ids = (events: readonly { id: string }[]) => events.map((event) => event.id);

describe('the order', () => {
  it('puts the event under way first and keeps the API’s order for the rest', () => {
    expect(ids(inOrder([E2, E3, E1], NOW))).toEqual(ids([E1, E2, E3]));
  });

  it('keeps a tie on the start in the API’s order', () => {
    expect(ids(inOrder([E3, E4], NOW))).toEqual(ids([E3, E4]));
    expect(ids(inOrder([E4, E3], NOW))).toEqual(ids([E4, E3]));
  });

  it('never sorts what is not under way', () => {
    expect(ids(inOrder([E3, E2], NOW))).toEqual(ids([E3, E2]));
  });
});

describe('under way', () => {
  it('compares instants, from the start up to but not at the end', () => {
    expect(underWay(E1, NOW)).toBe(true);
    expect(underWay(E1, new Date(E1.startsAt))).toBe(true);
    expect(underWay(E1, new Date(E1.endsAt))).toBe(false);
    expect(underWay(E2, NOW)).toBe(false);
  });

  it('reads the offset: 19:30 in Paris is under way at 18:45 UTC', () => {
    expect(underWay(E4, new Date('2026-11-21T18:45:00Z'))).toBe(true);
    expect(underWay(E4, new Date('2026-11-21T18:15:00Z'))).toBe(false);
  });
});

describe('the row', () => {
  it('writes the day and the start in the event’s own zone', () => {
    expect(rowLine(E3, 'en')).toBe(
      'Les Salons de la Bastide Réceptions et Événements · Sat, Nov 21 · 19:30',
    );
    expect(rowLine(E2, 'en')).toBe('Lumen Feiras · Sat, Nov 14 · 15:00');
  });

  it('says its marks after the line', () => {
    expect(rowLabel(E2, 'en', { underWay: false, here: true })).toBe(
      'Joana & Rui’s wedding. Lumen Feiras · Sat, Nov 14 · 15:00. You’re here',
    );
    expect(rowLabel(E1, 'en', { underWay: true, here: false })).toMatch(/· 08:30\. Under way$/u);
  });
});

describe('the states', () => {
  it('shows no group with one event and no organisation', () => {
    expect(listsEvents(outsideOf('one'))).toBe(false);
    expect(listsEvents(outsideOf('two'))).toBe(true);
  });

  it('opens another event, only closes on the one you are in, and refuses a grant gone', () => {
    const gone = outsideOf('gone');

    expect(choose(gone, E2)).toEqual({ kind: 'close' });
    expect(choose(gone, E3)).toEqual({ kind: 'open', event: E3 });
    expect(choose(gone, E4)).toEqual({ kind: 'notFound', event: E4 });
    expect(ids(afterRequest(gone).events)).toEqual(ids([E1, E2, E3]));
  });

  it('lists only the member’s organisations inside with one grant', () => {
    expect(listsEvents(outsideOf('inside-member-one'))).toBe(false);
    expect(outsideOf('inside-member-one').places.length).toBeGreaterThan(0);
    expect(listsEvents(outsideOf('switcher-outside-one-org'))).toBe(false);
  });

  it('has a state for each board', () => {
    expect(OUTSIDE_STATES).toHaveLength(11);
  });
});

describe('the way back from a gone event', () => {
  it('lands where sc-71 lands an account', () => {
    expect(landingOf([E1, E2, E3, E4], NOW)?.id).toBe(E1.id);
    expect(landingOf([E3, E4], NOW)?.id).toBe(E3.id);
    expect(landingOf([], NOW)).toBeNull();
  });

  it('goes back to the event it came from while that grant is live', () => {
    expect(wayBack(outsideOf('gone'), E4.id, E2.id, NOW)).toEqual({ kind: 'event', event: E2 });
  });

  it('names the landing pick when the event it came from is gone too', () => {
    const both = outsideOf('gone-both');

    expect(choose(both, E4)).toEqual({ kind: 'notFound', event: E4 });
    expect(wayBack(both, E4.id, E2.id, NOW)).toEqual({ kind: 'event', event: E1 });
    expect(ids(afterRequest(both).events)).toEqual(ids([E1, E3]));
  });

  it('reads Continue with no live grant left', () => {
    expect(wayBack(outsideOf('gone-last'), E4.id, E2.id, NOW)).toEqual({ kind: 'continue' });
  });

  it('keeps a member’s Back to Events', () => {
    const member = outsideOf('inside-member-gone');

    expect(choose(member, E3)).toEqual({ kind: 'notFound', event: E3 });
    expect(wayBack(member, E3.id, E2.id, NOW)).toEqual({ kind: 'events' });
  });
});

describe('the levels', () => {
  it('gives Can edit every area of the member sidebar but Budget', () => {
    expect(areasFor('Can edit')).toEqual([
      'overview',
      'guests',
      'menu',
      'seating',
      'messages',
      'schedule',
      'staff',
      'people',
      'reports',
    ]);
  });
});
