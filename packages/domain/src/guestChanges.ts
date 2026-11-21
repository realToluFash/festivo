import { formatEventClock } from './datetime.ts';
import { type Translate } from './eventWords.ts';
import { shownReply } from './guestForm.ts';
import { REPLY_KEY, replyDate } from './guestRows.ts';
import { type Person, type ViewRow, matches, peopleOf } from './guestView.ts';

/** What Changed since you looked lists (sc-4331), read as the API sends it. */
export interface GuestListChange {
  guestId: string;
  kind: 'replied' | 'changed' | 'needs' | 'flagged';
  at: string;
}

const LABEL_KEY: Partial<Record<GuestListChange['kind'], string>> = {
  needs: 'guestList.changed.needs',
  flagged: 'guestList.changed.flagged',
};

/** "Replied at 09:31" today in the event's zone, "Changed Nov 2" before; anything that is not a first reply is Changed. */
export function changeWhen(
  t: Translate,
  change: GuestListChange,
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

/** The answer in the list's own words, or the bell's label for a change that is not a reply. */
export function changeAnswer(t: Translate, change: GuestListChange, person: Person): string {
  const label = LABEL_KEY[change.kind];

  return t(label ?? REPLY_KEY[shownReply(person.guest)]);
}

export interface ChangedRow extends ViewRow {
  change: GuestListChange;
}

/** One row per guest the changes name and the list still holds, in the changes' order, narrowed by the search. */
export function changedRows(
  guests: Parameters<typeof peopleOf>[0],
  changes: readonly GuestListChange[],
  q: string,
): ChangedRow[] {
  const people = peopleOf(guests);

  return changes.flatMap((change): ChangedRow[] => {
    const person = people.find((one) => one.companion == null && one.guest.id === change.guestId);

    return person == null || !matches(person, q) ? [] : [{ person, indent: false, change }];
  });
}
