import type { OrganisationEvent } from '@soirely/api-client';
import type { EventPhase } from '@soirely/domain';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import { sidebarCardOf } from './eventTop.ts';
import { filterChoices, phaseCardOf } from './guestRows.ts';

const counts = {
  all: 12,
  invited: 10,
  coming: 4,
  maybe: 1,
  noReply: 3,
  held: 1,
  notComing: 1,
  notYetInvited: 2,
};

describe('the guest list filter', () => {
  it('offers Not yet invited last while anybody is', () => {
    expect(filterChoices(counts, 'all').at(-1)).toBe('notYetInvited');
  });

  it('leaves Not yet invited out once nobody is', () => {
    expect(filterChoices({ ...counts, notYetInvited: 0 }, 'all')).not.toContain('notYetInvited');
  });

  it('keeps Not yet invited while it is chosen, until another choice is picked', () => {
    const none = { ...counts, notYetInvited: 0 };

    expect(filterChoices(none, 'notYetInvited')).toContain('notYetInvited');
    expect(filterChoices(none, 'coming')).not.toContain('notYetInvited');
  });
});

const t = ((key: string) => key) as unknown as TFunction;
const BEFORE = new Date('2026-11-11T09:00:00Z');
const AFTER = new Date('2026-11-15T09:00:00Z');

const gala: OrganisationEvent = {
  id: 'evt_gala',
  organisationId: 'org_a',
  name: 'Gala',
  type: 'wedding',
  status: 'draft',
  startsAt: '2026-11-14T16:00:00Z',
  endsAt: '2026-11-14T23:00:00Z',
  venue: null,
  arrivalNote: null,
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
  permissions: ['events.manage'],
};

function cardOf(event: OrganisationEvent, phase: EventPhase, now: Date) {
  return phaseCardOf(t, event, sidebarCardOf(event, phase), phase, now);
}

describe("the Guests card's phase", () => {
  it('on a Draft, counts who is on the list, says guests wait, and offers Make live to a manager', () => {
    expect(cardOf(gala, 'draft', BEFORE)).toEqual({
      tags: [{ word: 'eventsScreen.draft', mark: 'draft' }],
      onList: true,
      line: 'eventLive.guestsBlocked',
      offersMakeLive: true,
    });
  });

  it('on a Draft, offers no Make live to somebody without events.manage', () => {
    expect(cardOf({ ...gala, permissions: ['guests.manage'] }, 'draft', BEFORE)).toMatchObject({
      line: 'eventLive.guestsBlocked',
      offersMakeLive: false,
    });
  });

  it('on a Draft past its end, says so and offers no Make live', () => {
    expect(cardOf(gala, 'draft', AFTER)).toMatchObject({
      onList: true,
      line: 'eventLive.endPassed',
      offersMakeLive: false,
    });
  });

  it('on a Paused event, keeps the invited count and says it is paused', () => {
    expect(cardOf({ ...gala, status: 'paused', phase: 'paused' }, 'paused', BEFORE)).toEqual({
      tags: [{ word: 'eventsScreen.paused', mark: 'paused' }],
      onList: false,
      line: 'guestList.pausedLine',
      offersMakeLive: false,
    });
  });

  it('on a Finished event, says it is finished', () => {
    const ended = {
      ...gala,
      status: 'ended',
      phase: 'finished',
      concludedAt: '2026-11-14T23:00:00Z',
    } as const;

    expect(cardOf(ended, 'finished', AFTER)).toEqual({
      tags: [{ word: 'eventsScreen.finished', mark: 'finished' }],
      onList: false,
      line: 'guestList.finishedLine',
      offersMakeLive: false,
    });
  });

  it('on an event called off before it began, tags it called off with the finished line', () => {
    const off = {
      ...gala,
      status: 'ended',
      phase: 'finished',
      concludedAt: '2026-11-12T09:00:00Z',
    } as const;

    expect(cardOf(off, 'finished', AFTER)).toMatchObject({
      tags: [{ word: 'eventsScreen.calledOff', mark: 'calledOff' }],
      line: 'guestList.finishedLine',
    });
  });

  it('puts nothing on the card of a Live event, or before the phase is known', () => {
    expect(cardOf({ ...gala, status: 'live', phase: 'live' }, 'live', BEFORE)).toBeNull();
    expect(phaseCardOf(t, gala, null, null, BEFORE)).toBeNull();
  });
});
