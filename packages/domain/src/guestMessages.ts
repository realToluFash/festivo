import { visibleLength } from './visibleText.ts';

/** A host's message to guests (sc-3942): the same limits and the same closed events on the web, in the app and in the API. */
export const SUBJECT_MAXIMUM = 150;
export const MESSAGE_MAXIMUM = 10_000;
const AFTER_END_DAYS = 30;

export type Closed = 'closedDraft' | 'closedEnded';

/** Why nothing can be sent on this event: a Draft, or more than 30 days after it finished; a paused one can, so the host can say why. */
export function closedOf(
  event: { phase: string; concludedAt: string | null; endsAt: string },
  now: Date,
): Closed | null {
  if (event.phase === 'draft') return 'closedDraft';
  if (event.phase !== 'finished') return null;

  const until = new Date(Date.parse(event.concludedAt ?? event.endsAt));

  until.setUTCDate(until.getUTCDate() + AFTER_END_DAYS);

  return now >= until ? 'closedEnded' : null;
}

/** Over a limit, counted in code points with the ends trimmed, as the API counts; text past a limit stays in the field. */
export function overLimits(
  subject: string,
  message: string,
): { subject?: 'subjectTooLong'; message?: 'messageTooLong' } {
  const over: { subject?: 'subjectTooLong'; message?: 'messageTooLong' } = {};

  if (visibleLength(subject.trim()) > SUBJECT_MAXIMUM) over.subject = 'subjectTooLong';
  if (visibleLength(message.trim()) > MESSAGE_MAXIMUM) over.message = 'messageTooLong';

  return over;
}

/** A message with no Subject is named by its first line, shortened to fit at a word. */
export function shortTitle(title: string, most = 40): string {
  if (title.length <= most) return title;

  const cut = title.slice(0, most + 1);
  const end = cut.lastIndexOf(' ');

  return `${(end > 0 ? cut.slice(0, end) : cut).replace(/[\s.,;:!?]+$/u, '')}…`;
}
