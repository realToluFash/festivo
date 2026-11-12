import { describe, expect, it } from 'vitest';

import {
  DUPLICATE_WORDS as D,
  PAST_CEILING,
  bringsOf,
  copiedOf,
  duplicateStart,
  duplicateStateOf,
  notCopiedOf,
  refusalOf,
} from './duplicate.ts';
import {
  EVENTS_PAGES,
  EVENT_STATES,
  EVENT_WORDS as W,
  eventStateOf,
  sampleEvent,
  stateFits,
} from './events.ts';
import { peopleOn, sampleGuests } from './guests.ts';

const WEDDING = 'evt-wed-4';

describe('Duplicate, also copying the guest list (sc-3656)', () => {
  it('counts the guests on the list, each once and without companions', () => {
    expect(bringsOf(WEDDING)).toEqual({
      guests: sampleGuests(WEDDING).length,
      people: peopleOn(WEDDING),
    });
    expect(bringsOf(WEDDING)?.guests).toBeLessThan(peopleOn(WEDDING));
  });

  it('has no checkbox on an original with no guests, or for a reader without guests.manage', () => {
    expect(bringsOf('evt-off')).toBeNull();
    expect(duplicateStart('duplicateNoGuests', 'evt-off').brings).toBeNull();
    expect(duplicateStart('duplicateViewer', WEDDING).brings).toBeNull();
  });

  it('starts unticked, and each state opens as drawn', () => {
    expect(duplicateStart(null, WEDDING)).toMatchObject({ ticked: false, phase: 'form' });
    expect(duplicateStart('duplicateTicked', WEDDING)).toMatchObject({ ticked: true });
    expect(duplicateStart('duplicateOne', WEDDING).brings?.guests).toBe(1);
    expect(duplicateStart('duplicateCreating', WEDDING).phase).toBe('creating');
    expect(duplicateStart('duplicateCreated', WEDDING).phase).toBe('created');
    expect(duplicateStart('duplicateNotCreated', WEDDING).phase).toBe('failed');
    expect(duplicateStart('duplicateOverLimit', WEDDING)).toMatchObject({
      refuse: 'plan',
      billing: true,
    });
    expect(duplicateStart('duplicateOverLimitAsk', WEDDING)).toMatchObject({
      refuse: 'plan',
      billing: false,
    });
    expect(duplicateStart('duplicateCeiling', WEDDING)).toMatchObject({
      refuse: 'ceiling',
      brings: PAST_CEILING,
    });
  });

  it('moves Guests and Replies out of Not copied once ticked, keeping Hosts and what happened', () => {
    expect(copiedOf(W.copiedItems, false, 118)).toEqual(W.copiedItems);
    expect(copiedOf(W.copiedItems, true, 118).at(-1)).toBe(
      '118 guests: names, contact details and companions',
    );
    expect(notCopiedOf(W.notCopiedItems, false)).toEqual(W.notCopiedItems);
    expect(notCopiedOf(W.notCopiedItems, true)).toEqual([
      'Hosts',
      D.notCopiedLine,
      'Anything that happened at the event',
    ]);
  });

  it('takes the singular for one guest', () => {
    expect(D.label(1)).toBe('Also copy the guest list (1 guest)');
    expect(D.copiedLine(1)).toBe('1 guest: name, contact details and companions');
    expect(D.success(1)).toBe('1 guest copied. Nobody was invited or contacted.');
    expect(D.label(1180)).toBe('Also copy the guest list (1,180 guests)');
  });

  it('refuses over the plan with its plan, and over the ceiling naming none', () => {
    expect(refusalOf('plan', 142)).toEqual({
      title: 'Your plan allows 100 people per event',
      what: 'Not created. The guest list would bring 142 people, and your plan has room for 100 in a new event.',
      figure: '142 people · companions count as people · Free plan',
      plan: true,
    });
    expect(refusalOf('ceiling', 10_214)).toEqual({
      title: 'An event can have up to 10,000 people',
      what: 'Not created. The guest list would bring 10,214 people, more than the 10,000 an event can hold.',
      figure: '10,214 people · companions count as people',
      plan: false,
    });
  });

  it('lists every state on the demo’s home, each on an event that offers Duplicate', () => {
    const links = EVENTS_PAGES.flatMap((group) => group.states.map((state) => state.to));
    const states = Object.keys(EVENT_STATES).filter((state) => duplicateStateOf(state) != null);

    expect(states).toHaveLength(11);
    for (const state of states) {
      const named = eventStateOf(state);
      const event = named == null ? undefined : sampleEvent(EVENT_STATES[named]);

      expect(named != null && event != null && stateFits(named, event)).toBe(true);
      expect(links).toContain(`/demo/events/${event?.id ?? ''}?state=${state}`);
    }
  });
});
