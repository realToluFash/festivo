import { describe, expect, it } from 'vitest';

import { invitedOn } from '../guests/GuestsModel.ts';
import {
  AT_READ,
  REFUSED_STATES,
  invitedOf,
  NAMED_DELETE_STATES,
  refusalOf,
  refusalWords,
  refusedStartOf,
  usableManage,
} from './DeleteRefusal.ts';
import { CLOCKS, type SampleEvent, sampleEvent } from './EventsSample.ts';

const before = new Date(CLOCKS.reader);
const during = new Date(CLOCKS.happening);
const after = new Date(CLOCKS.finished);
const WEDDING = 'Adaeze & Tunde’s wedding';

function event(id: string): SampleEvent {
  const found = sampleEvent(id);
  if (found == null) throw new Error(`The sample has ${id}.`);

  return found;
}

describe('a delete refused while a guest is Invited (sc-14445)', () => {
  const wedding = event('evt-wed-4');

  it('says to call it off before the start and to end it from the start', () => {
    expect(refusalOf(wedding, before, 142, true)).toEqual({ verb: 'callOff', canChange: true });
    expect(refusalOf(wedding, during, 142, true)).toEqual({ verb: 'endNow', canChange: true });
    expect(refusalOf(wedding, new Date(wedding.startsAt), 1, true)?.verb).toBe('endNow');
    expect(refusalOf(wedding, new Date(Date.parse(wedding.startsAt) - 1000), 1, true)?.verb).toBe(
      'callOff',
    );
  });

  it('refuses a Paused event as a Live one, and keeps who is reading', () => {
    expect(refusalOf(event('evt-party-2'), before, 45, false)).toEqual({
      verb: 'callOff',
      canChange: false,
    });
  });

  it('never refuses a Draft, a Finished event, a called-off one, or one with nobody Invited', () => {
    const calledOff: SampleEvent = { ...wedding, status: 'ended', concludedAt: CLOCKS.reader };

    expect(refusalOf(event('evt-draft-4'), before, 12, true)).toBeNull();
    expect(refusalOf(wedding, after, 142, true)).toBeNull();
    expect(refusalOf(calledOff, before, 142, true)).toBeNull();
    expect(refusalOf(wedding, before, 0, true)).toBeNull();
  });

  it('counts the Invited on the wedding and the Paused party, and none on the Draft', () => {
    expect(invitedOn('evt-wed-4')).toBe(142);
    expect(invitedOn('evt-party-2')).toBe(45);
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
  it('opens each on its reader, before or from the start', () => {
    expect(REFUSED_STATES.map((state) => refusedStartOf(state))).toEqual([
      { canChange: true, started: false, race: false },
      { canChange: true, started: true, race: false },
      { canChange: false, started: false, race: false },
      { canChange: false, started: true, race: false },
      { canChange: true, started: false, race: true },
      { canChange: false, started: false, race: true },
      { canChange: true, started: false, race: false },
    ]);
    expect(refusedStartOf('delete')).toBeNull();
    expect(refusedStartOf(null)).toBeNull();
  });

  it('refuses as the dialog opens, except in the race, which refuses once Delete is pressed', () => {
    const opens = (state: string, pressed: boolean, id = 'evt-wed-4') => {
      const start = refusedStartOf(state);

      return refusalOf(
        event(id),
        before,
        invitedOf(state, start, invitedOn(id), pressed),
        start?.canChange ?? true,
      );
    };

    expect(opens('deleteRefused', false)).toEqual({ verb: 'callOff', canChange: true });
    expect(opens('deleteRefusedRead', false)).toEqual({ verb: 'callOff', canChange: false });
    expect(opens('deleteRace', false)).toBeNull();
    expect(opens('deleteRace', true)).toEqual({ verb: 'callOff', canChange: true });
    expect(opens('deleteRaceRead', false)).toBeNull();
    expect(opens('deleteRaceRead', true)).toEqual({ verb: 'callOff', canChange: false });
    expect(opens('deleteRefusedPaused', false, 'evt-party-2')).toEqual({
      verb: 'callOff',
      canChange: true,
    });
  });

  it('gives the race at Read the words a reader at Read opens on: who can, and no verb', () => {
    const start = refusedStartOf('deleteRaceRead');
    const refusal = refusalOf(
      event('evt-wed-4'),
      before,
      invitedOf('deleteRaceRead', start, 142, true),
      false,
    );

    expect(refusal == null ? null : refusalWords(refusal, WEDDING, 'Ire Events')).toEqual({
      title: `Call off ${WEDDING} first?`,
      line: 'Guests have been invited to this event, or staff briefed for it, so it can be deleted only once it is finished. Calling it off is how they hear it will not go ahead.',
      who: 'Ask someone who can change Events in Ire Events to call it off.',
      verb: null,
    });
  });

  it('names the reader at Read as the board does', () => {
    expect(AT_READ).toMatchObject({ name: 'Ana Souza', initials: 'AS', role: 'Coordinator' });
  });

  it('leaves sc-3592’s delete states deleting by name, as they were drawn', () => {
    for (const state of NAMED_DELETE_STATES)
      expect(invitedOf(state, refusedStartOf(state), 142, true), state).toBe(0);
  });

  it('refuses on the plain page and in the other states, as the product will', () => {
    for (const state of [null, 'muted']) {
      expect(invitedOf(state, refusedStartOf(state), 142, false), String(state)).toBe(142);
      expect(
        refusalOf(event('evt-wed-4'), before, invitedOf(state, null, 142, false), true),
      ).not.toBeNull();
    }
  });
});
