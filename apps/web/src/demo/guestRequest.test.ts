import { describe, expect, it } from 'vitest';

import { DATA_CONTROL_PAGES } from './dataControlPages.ts';
import {
  CHANGED,
  COVERED,
  REQUEST_STATES,
  THEIR_STATES,
  answerOf,
  coveredLine,
  coversLine,
  erasedIn,
  erasedLine,
  findFault,
  finds,
  readyLine,
  theirStart,
  theirViewerKey,
} from './guestRequest.ts';
import { sampleGuests } from './guests.ts';

const LOCALE = 'en-US';
const LAGOS = 'Africa/Lagos';

describe('A guest’s request and Their data (sc-30193)', () => {
  it('checks what was typed before it looks: blank, then an address or a number with its code', () => {
    expect(findFault('  ')).toBe('Enter their email address or mobile number.');
    expect(findFault('emeka nwosu')).toBe(
      'Enter an email address, or a mobile number with its country code.',
    );
    expect(findFault('07700 900231')).toBe(
      'Enter an email address, or a mobile number with its country code.',
    );
    expect(findFault('emeka.nwosu@nhs.net')).toBeNull();
    expect(findFault('+44 7700 900231')).toBeNull();
  });

  it('finds Dr Emeka Nwosu by his address or his number, and nobody else', () => {
    expect(finds('Emeka.Nwosu@nhs.net ')).toBe(true);
    expect(finds('+44 7700 900231')).toBe(true);
    expect(finds('nobody@example.com')).toBe(false);
    expect(answerOf('')).toBe('blank');
    expect(answerOf('emeka nwosu')).toBe('invalid');
    expect(answerOf('nobody@example.com')).toBe('none');
    expect(answerOf('emeka.nwosu@nhs.net')).toBe('found');
  });

  it('counts every record of theirs, and says what ties each to them', () => {
    expect(coversLine(COVERED)).toBe(
      'A request covers every record of theirs in Ire Events: 4 records, on 3 events.',
    );
    expect(coversLine(CHANGED)).toBe(
      'A request covers every record of theirs in Ire Events: 5 records, on 4 events.',
    );
    expect(COVERED.map((one) => [one.name, coveredLine(one, LOCALE)])).toEqual([
      ['Dr Emeka Nwosu', 'Adaeze & Tunde’s wedding · Thursday, Nov 5'],
      ['Adanna Nwosu', 'Companion of Dr Emeka Nwosu'],
      ['Dr Emeka Nwosu', 'Ireti at 40 · Friday, Nov 13 · Same email address'],
      ['Emeka Nwosu', 'Bola’s 60th · Saturday, Aug 8 · Same mobile number'],
    ]);
    expect(COVERED.filter((one) => one.deletedEvent).map((one) => one.event)).toEqual([
      'Bola’s 60th',
    ]);
    expect(coveredLine(CHANGED[4] ?? COVERED[0]!, LOCALE)).toBe(
      'Kemi’s baby shower · Saturday, Oct 24 · Same email address',
    );
  });

  it('says how long their export lasts, and when they were erased', () => {
    expect(readyLine(LOCALE, LAGOS)).toBe(
      'Their export is ready. It downloads once, until Tuesday, Oct 20 at 10:20 WAT, and only for you.',
    );
    expect(erasedLine(LOCALE, LAGOS)).toBe(
      'Erased on Monday, Oct 19 at 10:12 WAT. Their reply, seat and place in the counts stay.',
    );
  });

  it('opens each state of Their data, a member and an admin drawn as Ana and Julien', () => {
    expect(theirStart('covered')).toEqual({ phase: 'actions', changed: false, asking: false });
    expect(theirStart('set_changed_erase')).toEqual({
      phase: 'actions',
      changed: true,
      asking: true,
    });
    expect(theirStart('link_used').phase).toBe('linkUsed');
    expect(theirViewerKey('member', null)).toBe('ana');
    expect(theirViewerKey('other_admin', null)).toBe('julien');
    expect(theirViewerKey('covered', 'julien')).toBe('julien');
  });

  it('erases what names or reaches them, and keeps their reply', () => {
    const list = sampleGuests('evt-wed-4');
    const after = erasedIn(list, 'emeka').find((one) => one.id === 'emeka');
    const before = list.find((one) => one.id === 'emeka');

    expect(after).toMatchObject({ name: 'Erased guest', email: null, phone: null });
    expect(after?.reply).toBe(before?.reply);
    expect(after?.companions.map((one) => one.name)).toEqual([null]);
  });

  it('links every state from the demo’s home', () => {
    const linked = DATA_CONTROL_PAGES.flatMap((one) => one.states.map((state) => state.to));

    for (const state of REQUEST_STATES)
      expect(linked).toContain(`/demo/settings/data-and-control/guest-request?state=${state}`);
    for (const state of THEIR_STATES)
      expect(linked).toContain(`/demo/guests?state=guest&data=${state}`);
  });
});
