import { writtenTime } from '../clock.ts';
import { W, say } from './GuestsWords.ts';

/** sc-4331's Changed since you looked: the wedding's changes behind the bell's Guest replies item (3 coming, 1 not coming, 1 changed their reply, the last at 09:31), as the web demo has them, and when the member last looked. */
export type ChangeKind = 'replied' | 'changed' | 'needs' | 'flagged' | 'question';

export interface Change {
  key: string;
  kind: ChangeKind;
  at: string;
}

export const CHANGES: readonly Change[] = [
  { key: 'lucia', kind: 'changed', at: '2026-11-03T09:31:00Z' },
  { key: 'ines', kind: 'replied', at: '2026-11-03T08:40:00Z' },
  { key: 'amaka', kind: 'replied', at: '2026-11-03T07:52:00Z' },
  { key: 'camille', kind: 'replied', at: '2026-11-02T21:05:00Z' },
  { key: 'musa', kind: 'replied', at: '2026-11-02T20:14:00Z' },
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

const ZONE = 'Europe/London';

/** The row's when, as l10n settled it (sc-4331, English copy): at a time today, on a date before; Changed for a changed reply or anything that is not a reply. */
export function changeWhen(change: Change, now: Date, locale: string): string {
  const at = new Date(change.at);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE });
  const today = day.format(at) === day.format(now);
  const time = writtenTime(at, locale, ZONE);
  const date = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    timeZone: ZONE,
  }).format(at);

  if (change.kind === 'replied') return today ? say.repliedAt(time) : say.repliedDay(date);

  return today ? say.changedAt(time) : say.changedDay(date);
}

/** A guest whose only change is not a reply shows the bell's label in the answer's place. */
export function changeLabel(kind: ChangeKind): string | null {
  if (kind === 'needs') return W.updatedNeeds;
  if (kind === 'flagged') return W.linkWrongPerson;
  if (kind === 'question') return W.newQuestion;

  return null;
}
