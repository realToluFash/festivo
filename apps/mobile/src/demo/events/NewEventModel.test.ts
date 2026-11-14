import { describe, expect, it } from 'vitest';

import { listStateOf } from './EventsModel.ts';
import {
  BLANK,
  FILLED,
  NEW_STATES,
  checkOf,
  firstRefused,
  isNewState,
  refusalsOf,
  typedFor,
  typedSomething,
} from './NewEventModel.ts';

describe('New event in the demo (sc-48607)', () => {
  it('opens every state from the list’s ?state=', () => {
    for (const state of NEW_STATES) {
      expect(listStateOf(state)).toBe(state);
      expect(isNewState(state)).toBe(true);
    }
    expect(isNewState('drafts')).toBe(false);
  });

  it('opens empty with Host 1 and the organisation’s zone and currency', () => {
    expect(typedFor('new')).toEqual(BLANK);
    expect(BLANK.hosts).toEqual([{ key: 0, name: '' }]);
    expect(BLANK).toMatchObject({ timeZone: 'Africa/Lagos', currency: 'NGN' });
  });

  it('sends a filled form with nothing to fix', () => {
    expect(checkOf(FILLED)).toEqual({
      refusals: {},
      hosts: [null, null],
      count: 0,
      summary: null,
    });
  });

  it('refuses four fields at once and says so', () => {
    const check = checkOf(typedFor('newRefused'));

    expect(check.refusals).toEqual({
      name: 'Give the event a name.',
      type: 'Choose what kind of event it is.',
      endsAt: 'The end is before the start. Choose a later end.',
    });
    expect(check.hosts).toEqual([null, 'Enter a name or remove this host.']);
    expect(check.summary).toBe('4 fields need fixing, so nothing was sent.');
  });

  it('lets a blank Host 1 alone through, since a draft needs no host', () => {
    expect(checkOf({ ...FILLED, hosts: [{ key: 0, name: '' }] }).count).toBe(0);
  });

  it('asks for a start, an end and a currency the form has none of', () => {
    expect(refusalsOf({ ...BLANK, name: 'Party', type: 'party', currency: '' })).toEqual({
      startsAt: 'Choose when the event starts.',
      endsAt: 'Choose when the event ends.',
      currency: 'Choose a currency.',
    });
  });

  it('refuses a name over 120 characters after trimming, and not one of 120 with spaces', () => {
    expect(refusalsOf({ ...FILLED, name: `  ${'a'.repeat(120)}  ` }).name).toBeUndefined();
    expect(refusalsOf({ ...FILLED, name: 'a'.repeat(121) }).name).toBe(
      'Shorten the name to 120 characters or fewer.',
    );
  });

  it('puts focus on Event name first, a host before the start, and a host after nothing else', () => {
    expect(firstRefused({ name: 'x', endsAt: 'y' }, [null, 'z'])).toEqual({ field: 'name' });
    expect(firstRefused({ endsAt: 'y' }, [null, 'z'])).toEqual({ host: 1 });
    expect(firstRefused({ currency: 'y' }, [null, null])).toEqual({ field: 'currency' });
    expect(firstRefused({}, [null, null])).toBeNull();
  });

  it('asks before leaving only once something is typed or chosen', () => {
    expect(typedSomething(BLANK)).toBe(false);
    expect(typedSomething({ ...BLANK, name: 'P' })).toBe(true);
    expect(typedSomething({ ...BLANK, photo: true })).toBe(true);
  });
});
