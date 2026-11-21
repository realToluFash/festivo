import type { Guest, GuestChange, GuestChangeKind } from '@soirely/api-client';
import {
  type Person,
  REPLY_KEY,
  formatEventClock,
  matches,
  peopleOf,
  replyDate,
  shownReply,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

/** The menu's choice that is not a reply (sc-4331), and the route param its last look travels in. */
export const CHANGED = 'changed';
export const GUESTS_SINCE = 'since';

/** The menu is wider while Changed since you looked leads it, so its French and Portuguese names fit. */
export function filterMenuWidth(apart: boolean): number {
  return apart ? 300 : 230;
}

const LABEL_KEY: Partial<Record<GuestChangeKind, string>> = {
  needs: 'guestList.changed.needs',
  flagged: 'guestList.changed.flagged',
  question: 'guestList.changed.question',
};

export function changeWhen(
  t: TFunction,
  change: GuestChange,
  timeZone: string,
  locale: string,
  now: Date,
): string {
  const day = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  });
  const today = day.format(new Date(change.at)) === day.format(now);
  const replied = change.kind === 'replied';

  if (today)
    return t(replied ? 'guestList.changed.repliedAt' : 'guestList.changed.changedAt', {
      time: formatEventClock(change.at, timeZone, locale),
    });

  return t(replied ? 'guestList.changed.repliedOn' : 'guestList.changed.changedOn', {
    date: replyDate(change.at, timeZone, locale),
  });
}

export function changeLine(
  t: TFunction,
  change: GuestChange,
  person: Person,
  timeZone: string,
  locale: string,
  now: Date,
): string {
  const label = LABEL_KEY[change.kind];

  return t('guestList.changed.line', {
    answer: t(label ?? REPLY_KEY[shownReply(person.guest)]),
    when: changeWhen(t, change, timeZone, locale, now),
  });
}

export interface ChangedRow {
  person: Person;
  change: GuestChange;
}

/** One row per guest the changes name and the list still holds, in the changes' order, narrowed by the search. */
export function changedRows(
  guests: readonly Guest[],
  changes: readonly GuestChange[],
  typed: string,
): ChangedRow[] {
  const people = peopleOf(guests);

  return changes.flatMap((change): ChangedRow[] => {
    const person = people.find((one) => one.companion == null && one.guest.id === change.guestId);

    return person == null || !matches(person, typed) ? [] : [{ person, change }];
  });
}
