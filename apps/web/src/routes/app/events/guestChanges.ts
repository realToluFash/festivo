import type { Guest, GuestChange, GuestChangeKind } from '@soirely/api-client';
import {
  type Person,
  REPLY_KEY,
  type ViewRow,
  formatEventClock,
  matches,
  peopleOf,
  replyDate,
  shownReply,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

const LABEL_KEY: Partial<Record<GuestChangeKind, string>> = {
  needs: 'guestList.changed.needs',
  flagged: 'guestList.changed.flagged',
  question: 'guestList.changed.question',
};

/** "Replied at 09:31" today in the event's zone, "Changed Nov 2" before; anything that is not a first reply is Changed. */
export function changeWhen(
  t: TFunction,
  change: GuestChange,
  timeZone: string,
  locale: string,
  now: Date,
): string {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone });
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

/** The answer in the list's own words, or the bell's label for a change that is not a reply. */
export function changeAnswer(t: TFunction, change: GuestChange, person: Person): string {
  const label = LABEL_KEY[change.kind];

  return t(label ?? REPLY_KEY[shownReply(person.guest)]);
}

export interface ChangedRow extends ViewRow {
  change: GuestChange;
}

/** One row per guest the changes name and the list still holds, in the changes' order, narrowed by the search. */
export function changedRows(
  guests: readonly Guest[],
  changes: readonly GuestChange[],
  q: string,
): ChangedRow[] {
  const people = peopleOf(guests);

  return changes.flatMap((change): ChangedRow[] => {
    const person = people.find((one) => one.companion == null && one.guest.id === change.guestId);

    return person == null || !matches(person, q) ? [] : [{ person, indent: false, change }];
  });
}
