import type { TFunction } from 'i18next';

import { WEDDING } from '../guests/GuestsSample.ts';
import type { DuplicateState } from './Duplicate.ts';

/** The wedding's list as a copy counts it (sc-3656): each guest once, and with companions, the people the plan counts. Sample, not spec. */
export const WEDDING_LIST = { guests: 128, people: 156 } as const;

export const COPY_PLAN = { plan: 'free', allowed: 100 } as const;

const figure = (count: number) => count.toLocaleString('en-GB');

/** The web's five eventDuplicate keys in English: the app's catalogues have none of them yet, and the developer adds all four locales from the web's. */
export const GW = {
  copyGuests: (count: number) =>
    `Also copy the guest list (${figure(count)} ${count === 1 ? 'guest' : 'guests'})`,
  copyGuestsHint: 'Replies are not copied, and nobody is invited or contacted.',
  copiedGuests: (count: number) =>
    count === 1
      ? `${figure(count)} guest: name, contact details and companions`
      : `${figure(count)} guests: names, contact details and companions`,
  notCopiedGuestList:
    'Replies, invitations, invitation links, check-ins, meal choices, seating, messages and history',
  guestsCopied: (count: number) =>
    `${figure(count)} ${count === 1 ? 'guest' : 'guests'} copied. Nobody was invited or contacted.`,
};

/** The box's count, or null when it is not shown: no guest left on the list, or no Create events with guests.manage. */
export function guestsToCopy(guests: number, permissions: readonly string[]): number | null {
  const allowed = permissions.includes('events.create') && permissions.includes('guests.manage');

  return allowed && guests > 0 ? guests : null;
}

export interface CopyLists {
  copied: readonly string[];
  notCopied: readonly string[];
}

const COPIED = ['Name', 'Type', 'Venue', 'Cover', 'TimeZone', 'Currency', 'Length'] as const;

/** Ticked, Guests and Replies give way to the guest list's own line, as the web's lists do; unticked, the lists are today's, in the app's own keys. */
export function copyLists(ticked: boolean, guests: number, t: TFunction): CopyLists {
  const copied = COPIED.map((key) => t(`eventDuplicate.copied${key}`));
  const hosts = t('eventDuplicate.notCopiedHosts');
  const happened = t('eventDuplicate.notCopiedHappened');

  return ticked
    ? {
        copied: [...copied, GW.copiedGuests(guests)],
        notCopied: [hosts, happened, GW.notCopiedGuestList],
      }
    : {
        copied,
        notCopied: [
          hosts,
          t('eventDuplicate.notCopiedGuests'),
          t('eventDuplicate.notCopiedReplies'),
          happened,
        ],
      };
}

/** The success line joins the copied count to the app's line, the count the answer gave rather than the box's. */
export function createdLine(copied: number | null, t: TFunction): string {
  const created = t('eventDuplicate.created');

  return copied == null ? created : `${created} ${GW.guestsCopied(copied)}`;
}

export interface GuestCopy {
  ticked: boolean;
  refused: boolean;
  copied: number | null;
  manages: boolean;
  /** The sample's owner, with billing.manage, reads the refusal; every other state is the demo's host, without it. */
  owner: boolean;
}

export function guestCopyStart(state: DuplicateState | null, guests: number): GuestCopy {
  const ticked =
    state === 'duplicateGuests' ||
    state === 'duplicateGuestsCreated' ||
    state === 'duplicateGuestsRefused' ||
    state === 'duplicateGuestsRefusedOwner' ||
    state === 'duplicateGuestsNotCreated';

  return {
    ticked,
    refused: state === 'duplicateGuestsRefused' || state === 'duplicateGuestsRefusedOwner',
    copied: state === 'duplicateGuestsCreated' ? guests : null,
    manages: state !== 'duplicateGuestsHidden',
    owner: state === 'duplicateGuestsRefusedOwner',
  };
}

/** The demo's answer to a ticked Create draft: refused when the list's people pass the plan's room, else created with every guest. */
export function guestAnswer(people: number): 'refused' | 'created' {
  return people > COPY_PLAN.allowed ? 'refused' : 'created';
}

export function guestsOn(event: string, people: number): number {
  return event === WEDDING ? WEDDING_LIST.guests : people;
}
