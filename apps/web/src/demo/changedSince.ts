import { GW } from './guestsWords.ts';

/** sc-4331's Changed since you looked: the wedding's changes behind the bell's Guest replies item (3 coming, 1 not coming, 1 changed their reply, the last at 09:31), and when the member last looked. */
export type ChangeKind = 'replied' | 'changed' | 'needs' | 'flagged' | 'question';

export interface Change {
  id: string;
  kind: ChangeKind;
  at: string;
}

export const CHANGES: readonly Change[] = [
  { id: 'lucia', kind: 'changed', at: '2026-11-03T09:31:00Z' },
  { id: 'ines', kind: 'replied', at: '2026-11-03T08:40:00Z' },
  { id: 'amaka', kind: 'replied', at: '2026-11-03T07:52:00Z' },
  { id: 'camille', kind: 'replied', at: '2026-11-02T21:05:00Z' },
  { id: 'musa', kind: 'replied', at: '2026-11-02T20:14:00Z' },
];

/** Newest first; a member who never looked counts every change. */
export function changesSince(since: string | null): Change[] {
  return CHANGES.filter((one) => since == null || one.at > since).sort((a, b) =>
    b.at.localeCompare(a.at),
  );
}

let looked: string | null = null;

/** When the event's Guest replies item was last marked read: by opening it, by Mark all read, or by the menu's row. */
export function lastLooked(): string | null {
  return looked;
}

export function markLooked(at: Date): void {
  looked = at.toISOString();
}

export function resetLooked(): void {
  looked = null;
}

const TIME = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Europe/London',
});
const DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'Europe/London',
});
const DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' });

/** The row's when, as l10n settled it (sc-4331, English copy): at a time today, on a date before; Changed for a changed reply or anything that is not a reply. */
export function changeWhen(change: Change, clock: Date): string {
  const at = new Date(change.at);
  const today = DAY.format(at) === DAY.format(clock);

  if (change.kind === 'replied')
    return today ? GW.repliedAt(TIME.format(at)) : GW.repliedDay(DATE.format(at));

  return today ? GW.changedAt(TIME.format(at)) : GW.changedDay(DATE.format(at));
}

/** A guest whose only change is not a reply shows the bell's label in the answer's place. */
export function changeLabel(kind: ChangeKind): string | null {
  if (kind === 'needs') return GW.updatedNeeds;
  if (kind === 'flagged') return GW.linkWrongPerson;
  if (kind === 'question') return GW.newQuestion;

  return null;
}
