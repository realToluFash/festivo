import type { OrganisationEvent } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { eventTop, sidebarCardOf } from './eventTop.ts';

const gala: OrganisationEvent = {
  id: 'evt_gala',
  organisationId: 'org_a',
  name: 'Gala',
  type: 'wedding',
  status: 'draft',
  startsAt: '2026-11-14T16:00',
  endsAt: '2026-11-14T23:00',
  venue: null,
  timeZone: 'Europe/London',
  dayCount: 1,
  currency: 'GBP',
  cover: null,
  hosts: ['Funmi Adeyemi'],
  madeLiveAt: null,
  pausedAt: null,
  phase: 'draft',
  concludedAt: null,
  createdAt: '2026-10-01T09:00:00Z',
  permissions: [],
};

describe("an event's page top", () => {
  it("is the event's while it loads, as once it has loaded", () => {
    expect(eventTop('tabletLandscape', 'overview', 'loading').inEvent).toBe(true);
    expect(eventTop('tabletLandscape', 'overview', 'loaded').inEvent).toBe(true);
  });

  it("is not the event's on a failed or missing event", () => {
    expect(eventTop('tabletLandscape', 'overview', 'failed').inEvent).toBe(false);
    expect(eventTop('tabletPortrait', 'budget', 'notFound').inEvent).toBe(false);
  });

  it('upright, draws ‹ Events in the frame and leaves every title to the body', () => {
    expect(eventTop('tabletPortrait', 'overview', 'loading')).toEqual({
      inEvent: true,
      cardNamed: true,
      areaTitled: false,
      frameBack: 'events',
    });
    expect(eventTop('tabletPortrait', 'budget', 'loaded')).toEqual({
      inEvent: true,
      cardNamed: false,
      areaTitled: true,
      frameBack: 'events',
    });
  });

  it("on its side, opens Overview on the event's card with no title and no second ‹", () => {
    expect(eventTop('tabletLandscape', 'overview', 'loading')).toEqual({
      inEvent: true,
      cardNamed: true,
      areaTitled: false,
      frameBack: null,
    });
    expect(eventTop('tabletLandscape', 'overview', 'loaded').cardNamed).toBe(true);
    expect(eventTop('tabletLandscape', 'overview', 'failed').cardNamed).toBe(false);
    expect(eventTop('tabletLandscape', 'overview', 'notFound').cardNamed).toBe(false);
  });

  it("on its side, keeps the body's back and the frame's title on every other area", () => {
    expect(eventTop('tabletLandscape', 'budget', 'loaded')).toEqual({
      inEvent: true,
      cardNamed: false,
      areaTitled: false,
      frameBack: null,
    });
  });

  it("on a phone, names Overview by its card and goes back by the area's ‹", () => {
    expect(eventTop('phone', 'overview', 'loaded').cardNamed).toBe(true);
    expect(eventTop('phone', 'people', 'loaded')).toMatchObject({
      cardNamed: false,
      areaTitled: false,
      frameBack: 'area',
    });
  });
});

describe("the iPad sidebar's card", () => {
  it('is sunk until the event and its phase are read', () => {
    expect(sidebarCardOf(null, null)).toBeNull();
    expect(sidebarCardOf(gala, null)).toBeNull();
  });

  it('carries the event once it loads', () => {
    expect(sidebarCardOf(gala, 'live')).toMatchObject({
      id: 'evt_gala',
      name: 'Gala',
      phase: 'live',
    });
  });
});
