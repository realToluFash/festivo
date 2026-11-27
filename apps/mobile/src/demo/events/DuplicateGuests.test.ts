import { limitRefusalOf } from '@soirely/domain';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import { peopleOn } from '../guests/GuestsModel.ts';
import {
  COPY_CEILING,
  COPY_PLAN,
  GW,
  WEDDING_LIST,
  copyLists,
  copyProblem,
  createdLine,
  guestAnswer,
  guestCopyStart,
  guestsOn,
  guestsToCopy,
} from './DuplicateGuests.ts';

const HOST = ['events.read', 'events.create', 'events.manage', 'guests.manage'];
const t = ((key: string) => key) as unknown as TFunction;

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

  it('refuses the demo’s host without billing.manage, and only the owner state holds it', () => {
    expect(guestCopyStart('duplicateGuestsRefused', 128).owner).toBe(false);
    expect(guestCopyStart('duplicateGuestsRefusedOwner', 128)).toMatchObject({
      ticked: true,
      refused: true,
      owner: true,
    });
  });

  it('leaves the lists as today unticked', () => {
    expect(copyLists(false, 128, t).notCopied).toEqual([
      'eventDuplicate.notCopiedHosts',
      'eventDuplicate.notCopiedGuests',
      'eventDuplicate.notCopiedReplies',
      'eventDuplicate.notCopiedHappened',
    ]);
    expect(copyLists(false, 128, t).copied).toEqual([
      'eventDuplicate.copiedName',
      'eventDuplicate.copiedType',
      'eventDuplicate.copiedVenue',
      'eventDuplicate.copiedCover',
      'eventDuplicate.copiedTimeZone',
      'eventDuplicate.copiedCurrency',
      'eventDuplicate.copiedLength',
    ]);
  });

  it('ticked, names the guests copied and no longer Guests as not copied', () => {
    const lists = copyLists(true, 128, t);
    expect(lists.copied.at(-1)).toBe('128 guests: names, contact details and companions');
    expect(lists.notCopied).not.toContain('eventDuplicate.notCopiedGuests');
    expect(lists.notCopied.at(-1)).toBe(GW.notCopiedGuestList);
  });

  it('joins the count the answer gave to the app’s line, and leaves it alone unticked', () => {
    expect(createdLine(null, t)).toBe('eventDuplicate.created');
    expect(createdLine(127, t)).toBe(
      'eventDuplicate.created 127 guests copied. Nobody was invited or contacted.',
    );
  });

  it('is refused when the people the list brings pass the plan’s room', () => {
    expect(guestAnswer(WEDDING_LIST.people)).toBe('refused');
    expect(guestAnswer(COPY_PLAN.allowed)).toBe('created');
    expect(guestAnswer(12)).toBe('created');
  });

  it('refuses an owner over the ceiling with the untick line and no plan line', () => {
    const start = guestCopyStart('duplicateGuestsRefusedCeiling', 128);
    expect(start).toMatchObject({ ticked: true, refused: true, owner: true, over: 'ceiling' });

    const refusal = limitRefusalOf(
      copyProblem(start.over, WEDDING_LIST.people),
      'copy',
      t,
      'en-GB',
    );
    expect(refusal).toMatchObject({
      title: 'limitReached.title.ceiling',
      line: 'limitReached.copy.overCeiling',
      planLimit: false,
      untick: 'limitReached.copy.untick',
    });
    expect(copyProblem('ceiling', WEDDING_LIST.people).problem).toMatchObject({
      ceiling: COPY_CEILING.ceiling,
      adding: COPY_CEILING.adding,
    });
  });

  it('refuses over the plan with the plan line held for billing.manage', () => {
    expect(guestCopyStart('duplicateGuestsRefusedOwner', 128).over).toBe('plan');
    const refusal = limitRefusalOf(copyProblem('plan', WEDDING_LIST.people), 'copy', t, 'en-GB');
    expect(refusal).toMatchObject({ title: 'limitReached.title.people', planLimit: true });
  });
});
