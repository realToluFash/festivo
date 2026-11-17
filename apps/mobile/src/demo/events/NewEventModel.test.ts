import { describe, expect, it } from 'vitest';

import { listStateOf } from './EventsModel.ts';
import {
  BLANK,
  DESCRIBE_TOO_LONG,
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
      cover: null,
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

  it('refuses an arrival note over 500 characters, under the venue and before the time zone', () => {
    expect(refusalsOf({ ...FILLED, note: 'a'.repeat(500) }).arrivalNote).toBeUndefined();
    expect(refusalsOf({ ...FILLED, note: 'a'.repeat(501) }).arrivalNote).toBe(
      'Shorten the arrival note to 500 characters or fewer.',
    );
    expect(firstRefused({ arrivalNote: 'x', timeZone: 'y' }, [null])).toEqual({
      field: 'arrivalNote',
    });
  });

  it('refuses a photo description over 250 characters on Create, after the hosts and before Starts', () => {
    const photo = { ...FILLED, photo: true };
    expect(checkOf({ ...photo, described: 'a'.repeat(250) }).cover).toBeNull();
    expect(checkOf({ ...photo, described: '👋🏽'.repeat(250) }).cover).toBeNull();
    const long = checkOf({ ...photo, described: 'a'.repeat(251) });
    expect(long).toMatchObject({ cover: DESCRIBE_TOO_LONG, count: 1 });
    expect(DESCRIBE_TOO_LONG).toBe('Shorten the description to 250 characters or fewer.');
    expect(checkOf({ ...FILLED, described: 'a'.repeat(251) }).cover).toBeNull();
    expect(firstRefused({}, [null], DESCRIBE_TOO_LONG)).toEqual({ cover: true });
    expect(firstRefused({ type: 'x', startsAt: 'y' }, [null], DESCRIBE_TOO_LONG)).toEqual({
      field: 'type',
    });
    expect(firstRefused({}, [null, 'z'], DESCRIBE_TOO_LONG)).toEqual({ host: 1 });
    expect(firstRefused({ startsAt: 'y' }, [null], DESCRIBE_TOO_LONG)).toEqual({ cover: true });
  });

  it('opens a chosen photo at the middle with no description, as the cover edit does', () => {
    expect(typedFor('newPhoto')).toMatchObject({ photo: true, position: 'middle', described: '' });
    expect(typedSomething({ ...BLANK, note: 'Side door' })).toBe(true);
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
