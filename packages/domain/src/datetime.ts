/**
 * A moment, in the reader's language.
 *
 * The design writes dates as "Friday, Aug 7" and times on the 24-hour clock,
 * which is the English form of a decision rather than the decision itself — so
 * these ask Intl for that shape and let each language render it. A hand-built
 * string would be English wearing four flags.
 *
 * The day and the time come back separately because the word between them
 * belongs to the catalogue: "at" in English, "à" in French, "às" in
 * Portuguese, "a las" in Spanish, and in none of them is it a space.
 */

/** "Friday, Aug 7" — the weekday included, because a date alone is harder to place. */
export function formatDay(moment: string | Date, locale: string): string {
  const date = asDate(moment);

  if (date == null) return '';

  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/** "14:35". Never 2:35 pm: the product is on the 24-hour clock everywhere. */
export function formatTimeOfDay(moment: string | Date, locale: string): string {
  const date = asDate(moment);

  if (date == null) return '';

  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** How long from now until a moment, in whole seconds, never negative. */
export function secondsUntil(moment: string | Date, now: Date = new Date()): number {
  const date = asDate(moment);

  if (date == null) return 0;

  return Math.max(0, Math.round((date.getTime() - now.getTime()) / 1000));
}

function asDate(moment: string | Date): Date | null {
  const date = typeof moment === 'string' ? new Date(moment) : moment;

  return Number.isNaN(date.getTime()) ? null : date;
}
