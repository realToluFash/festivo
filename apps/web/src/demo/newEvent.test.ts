import { describe, expect, it } from 'vitest';

import {
  BLANK,
  FILLED,
  NEW_EVENT_STATES,
  checkOf,
  firstRefused,
  hostWords,
  newEventStateOf,
  typedFor,
  typedSomething,
} from './newEvent.ts';

describe('New event’s model at a desk (sc-48607)', () => {
  it('opens empty with no state, and every state it names is one it knows', () => {
    expect(newEventStateOf(null)).toBeNull();
    expect(newEventStateOf('nonsense')).toBeNull();
    for (const one of NEW_EVENT_STATES) expect(newEventStateOf(one)).toBe(one);
    expect(typedFor(null)).toEqual(BLANK);
  });

  it('refuses four fields at once and starts the focus on Event name', () => {
    const check = checkOf(typedFor('refused'));

    expect(check.count).toBe(4);
    expect(check.refusals.name).toBe('Give the event a name.');
    expect(check.refusals.type).toBe('Choose what kind of event it is.');
    expect(check.refusals.endsAt).toBeDefined();
    expect(check.hosts).toEqual([null, 'Enter a name or remove this host.']);
    expect(firstRefused(check.refusals, check.hosts)).toEqual({ field: 'name' });
  });

  it('lets a blank Host 1 alone through, as a draft needs no host', () => {
    expect(hostWords([''], true)).toEqual([null]);
    expect(checkOf({ ...FILLED, hosts: [''] }).count).toBe(0);
  });

  it('focuses a host before Starts, and after Event name and Type', () => {
    expect(firstRefused({ endsAt: 'x' }, [null, 'y'])).toEqual({ host: 1 });
    expect(firstRefused({ type: 'x' }, [null, 'y'])).toEqual({ field: 'type' });
  });

  it('takes a server refusal under its own field', () => {
    expect(checkOf(FILLED, { timeZone: 'Choose a time zone.' }).count).toBe(1);
  });

  it('asks before leaving only once something was typed', () => {
    expect(typedSomething(BLANK)).toBe(false);
    expect(typedSomething({ ...BLANK, name: 'A' })).toBe(true);
  });
});
