import { describe, expect, it } from 'vitest';

import {
  REFUSED_STATES,
  invitedOf,
  NAMED_DELETE_STATES,
  refusalOf,
  refusalWords,
  refusedStartOf,
  usableManage,
} from './deleteRefusal.ts';
import { CLOCKS, EVENT_STATES, type SampleEvent, clockOf, sampleEvent } from './events.ts';
import { invitedOn } from './guests.ts';

const WEDDING = 'Adaeze & Tunde’s wedding';

function event(id: string): SampleEvent {
  const found = sampleEvent(id);
  if (found == null) throw new Error(`The sample has ${id}.`);

  return found;
}

describe('a delete refused while a guest is Invited (sc-14445)', () => {
  const wedding = event('evt-wed-4');

  it('says to call it off before the start and to end it from the start', () => {
    expect(refusalOf(wedding, CLOCKS.rest, 1, true)).toEqual({ verb: 'callOff', canChange: true });
    expect(refusalOf(wedding, CLOCKS.now, 1, true)).toEqual({ verb: 'endNow', canChange: true });
    expect(refusalOf(wedding, new Date(wedding.startsAt), 1, true)?.verb).toBe('endNow');
    expect(refusalOf(wedding, new Date(Date.parse(wedding.startsAt) - 1000), 1, true)?.verb).toBe(
      'callOff',
    );
  });

  it('refuses a Paused event as a Live one, and keeps who is reading', () => {
    expect(refusalOf(event('evt-party-2'), CLOCKS.rest, 1, false)).toEqual({
      verb: 'callOff',
      canChange: false,
    });
  });

  it('never refuses a Draft, a Finished event, a called-off one, or one with nobody Invited', () => {
    const calledOff: SampleEvent = {
      ...wedding,
      status: 'ended',
      concludedAt: CLOCKS.rest.toISOString(),
    };

    expect(refusalOf(event('evt-draft-4'), CLOCKS.rest, 12, true)).toBeNull();
    expect(refusalOf(wedding, CLOCKS.finished, 1, true)).toBeNull();
    expect(refusalOf(calledOff, CLOCKS.rest, 1, true)).toBeNull();
    expect(refusalOf(wedding, CLOCKS.rest, 0, true)).toBeNull();
  });

  it('counts the wedding’s Invited guests, and none on the Draft', () => {
    expect(invitedOn('evt-wed-4')).toBeGreaterThan(0);
    expect(invitedOn('evt-party-2')).toBeGreaterThan(0);
    expect(invitedOn('evt-draft-4')).toBe(0);
  });
});

describe('the refusal’s words', () => {
  it('names the page’s button before the start and from it', () => {
    expect(refusalWords({ verb: 'callOff', canChange: true }, WEDDING, 'Ire Events')).toEqual({
      title: `Call off ${WEDDING} first?`,
      line: 'Guests have been invited to this event, or staff briefed for it, so it can be deleted only once it is finished. Calling it off is how they hear it will not go ahead.',
      who: null,
      verb: 'Call off',
    });
    expect(refusalWords({ verb: 'endNow', canChange: true }, WEDDING, 'Ire Events')).toEqual({
      title: `End ${WEDDING} first?`,
      line: 'Guests have been invited to this event, or staff briefed for it, so it can be deleted only once it is finished. End it first: it will then be over for everybody.',
      who: null,
      verb: 'End now',
    });
  });

  it('says who can, and offers no verb, without Events at Change', () => {
    const callOff = refusalWords({ verb: 'callOff', canChange: false }, WEDDING, 'Ire Events');
    const end = refusalWords({ verb: 'endNow', canChange: false }, WEDDING, 'Ire Events');

    expect(callOff.title).toBe(`Call off ${WEDDING} first?`);
    expect(callOff.who).toBe('Ask someone who can change Events in Ire Events to call it off.');
    expect(callOff.verb).toBeNull();
    expect(end.title).toBe(`End ${WEDDING} first?`);
    expect(end.who).toBe('Ask someone who can change Events in Ire Events to end it.');
    expect(end.verb).toBeNull();
  });
});

describe('the page for a reader at Read', () => {
  it('shows neither Pause, Call off nor End now, and keeps Duplicate and Delete', () => {
    expect(usableManage(['duplicate', 'pause', 'callOff', 'delete'], false)).toEqual([
      'duplicate',
      'delete',
    ]);
    expect(usableManage(['duplicate', 'pause', 'endNow', 'delete'], false)).toEqual([
      'duplicate',
      'delete',
    ]);
    expect(usableManage(['duplicate', 'pause', 'endNow', 'delete'], true)).toEqual([
      'duplicate',
      'pause',
      'endNow',
      'delete',
    ]);
  });
});

describe('the demo’s states', () => {
  it('opens each on its reader, before or from the start, on the matching clock', () => {
    expect(REFUSED_STATES.map((state) => refusedStartOf(state))).toEqual([
      { canChange: true, started: false, race: false },
      { canChange: true, started: true, race: false },
      { canChange: false, started: false, race: false },
      { canChange: false, started: true, race: false },
      { canChange: true, started: false, race: true },
      { canChange: false, started: false, race: true },
      { canChange: true, started: false, race: false },
    ]);
    for (const state of REFUSED_STATES)
      expect(clockOf(state), state).toBe(
        refusedStartOf(state)?.started === true ? CLOCKS.now : CLOCKS.rest,
      );
    expect(refusedStartOf('delete')).toBeNull();
    expect(refusedStartOf(null)).toBeNull();
  });

  it('refuses as the dialog opens, except in the race, which refuses once Delete is pressed', () => {
    const opens = (state: (typeof REFUSED_STATES)[number], pressed: boolean) => {
      const start = refusedStartOf(state);
      const id = EVENT_STATES[state];

      return refusalOf(
        event(id),
        clockOf(state),
        invitedOf(state, start, invitedOn(id), pressed),
        start?.canChange ?? true,
      );
    };

    expect(opens('deleteRefused', false)).toEqual({ verb: 'callOff', canChange: true });
    expect(opens('deleteRefusedStarted', false)).toEqual({ verb: 'endNow', canChange: true });
    expect(opens('deleteRefusedRead', false)).toEqual({ verb: 'callOff', canChange: false });
    expect(opens('deleteRefusedStartedRead', false)).toEqual({ verb: 'endNow', canChange: false });
    expect(opens('deleteRace', false)).toBeNull();
    expect(opens('deleteRace', true)).toEqual({ verb: 'callOff', canChange: true });
    expect(opens('deleteRaceRead', false)).toBeNull();
    expect(opens('deleteRaceRead', true)).toEqual({ verb: 'callOff', canChange: false });
    expect(opens('deleteRefusedPaused', false)).toEqual({ verb: 'callOff', canChange: true });
  });

  it('opens the Paused refusal on the Paused party, and the rest on the wedding', () => {
    expect(event(EVENT_STATES.deleteRefusedPaused).status).toBe('paused');
    for (const state of REFUSED_STATES.filter((one) => one !== 'deleteRefusedPaused'))
      expect(EVENT_STATES[state], state).toBe('evt-wed-4');
  });

  it('leaves sc-3592’s delete states deleting by name, as they were drawn', () => {
    for (const state of NAMED_DELETE_STATES)
      expect(invitedOf(state, refusedStartOf(state), invitedOn('evt-wed-4'), true), state).toBe(0);
  });

  it('refuses on the plain page and in the other states, as the product will', () => {
    for (const state of [null, 'muted'] as const) {
      expect(
        invitedOf(state, refusedStartOf(state), invitedOn('evt-wed-4'), false),
        String(state),
      ).toBe(invitedOn('evt-wed-4'));
      expect(
        refusalOf(
          event('evt-wed-4'),
          CLOCKS.rest,
          invitedOf(state, null, invitedOn('evt-wed-4'), false),
          true,
        ),
      ).not.toBeNull();
    }
  });
});
