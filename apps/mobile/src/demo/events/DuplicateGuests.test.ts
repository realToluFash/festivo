import { describe, expect, it } from 'vitest';

import { peopleOn } from '../guests/GuestsModel.ts';
import {
  COPY_PLAN,
  GW,
  WEDDING_LIST,
  copyLists,
  createdLine,
  guestAnswer,
  guestCopyStart,
  guestsOn,
  guestsToCopy,
} from './DuplicateGuests.ts';

const HOST = ['events.read', 'events.create', 'events.manage', 'guests.manage'];

describe('Also copy the guest list (sc-101394)', () => {
  it('shows only with a guest on the list, Create events and guests.manage', () => {
    expect(guestsToCopy(128, HOST)).toBe(128);
    expect(guestsToCopy(0, HOST)).toBeNull();
    expect(guestsToCopy(128, ['events.read', 'events.create', 'events.manage'])).toBeNull();
    expect(guestsToCopy(128, ['events.read', 'guests.manage'])).toBeNull();
  });

  it('counts each guest once, companions not added', () => {
    expect(guestsOn('evt-wed-4', peopleOn('evt-wed-4'))).toBe(WEDDING_LIST.guests);
    expect(peopleOn('evt-wed-4')).toBe(WEDDING_LIST.people);
    expect(guestsOn('evt-draft-4', peopleOn('evt-draft-4'))).toBe(12);
  });

  it('says its count in a plural family', () => {
    expect(GW.copyGuests(1)).toBe('Also copy the guest list (1 guest)');
    expect(GW.copyGuests(1280)).toBe('Also copy the guest list (1,280 guests)');
  });

  it('is off by default, and on in the ticked states', () => {
    expect(guestCopyStart('duplicate', 128).ticked).toBe(false);
    expect(guestCopyStart(null, 128).ticked).toBe(false);
    expect(guestCopyStart('duplicateGuests', 128).ticked).toBe(true);
    expect(guestCopyStart('duplicateGuestsRefused', 128)).toMatchObject({
      ticked: true,
      refused: true,
    });
    expect(guestCopyStart('duplicateGuestsNotCreated', 128).ticked).toBe(true);
    expect(guestCopyStart('duplicateGuestsHidden', 128).manages).toBe(false);
  });

  it('leaves the lists as today unticked', () => {
    expect(copyLists(false, 128).notCopied).toEqual([
      'Hosts',
      'Guests',
      'Replies',
      'Anything that happened at the event',
    ]);
    expect(copyLists(false, 128).copied).not.toContain(GW.copiedGuests(128));
  });

  it('ticked, names the guests copied and no longer Guests as not copied', () => {
    const lists = copyLists(true, 128);
    expect(lists.copied.at(-1)).toBe('128 guests: names, contact details and companions');
    expect(lists.notCopied).not.toContain('Guests');
    expect(lists.notCopied.at(-1)).toBe(GW.notCopiedGuestList);
  });

  it('joins the count the answer gave to the app’s line, and leaves it alone unticked', () => {
    expect(createdLine(null)).toBe('Draft created. Opening it.');
    expect(createdLine(127)).toBe(
      'Draft created. Opening it. 127 guests copied. Nobody was invited or contacted.',
    );
  });

  it('is refused when the people the list brings pass the plan’s room', () => {
    expect(guestAnswer(WEDDING_LIST.people)).toBe('refused');
    expect(guestAnswer(COPY_PLAN.allowed)).toBe('created');
    expect(guestAnswer(12)).toBe('created');
  });
});
