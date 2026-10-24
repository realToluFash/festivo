/** The day and the time are separate because the word between them belongs to the catalogue. */
export function formatDay(moment: string | Date, locale: string): string {
  const date = asDate(moment);

  if (date == null) return '';

  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatTimeOfDay(moment: string | Date, locale: string): string {
  const date = asDate(moment);

  if (date == null) return '';

  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** In the reader's own zone, where their calendar turns over. */
export function fallsOnLaterDay(moment: string | Date, now: Date = new Date()): boolean {
  const date = asDate(moment);

  if (date == null) return false;

  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  return date.getTime() >= tomorrow.getTime();
}

export function secondsUntil(moment: string | Date, now: Date = new Date()): number {
  const date = asDate(moment);

  if (date == null) return 0;

  return Math.max(0, Math.round((date.getTime() - now.getTime()) / 1000));
}

/** Rounded up to the minute: a lock read as 14:35 that lifts at 14:35:40 refuses whoever believes it. */
export function lockLiftsAt(retryAfterSeconds: number, now: Date = new Date()): Date | null {
  if (!Number.isFinite(retryAfterSeconds) || retryAfterSeconds <= 0) return null;

  const minute = 60_000;

  return new Date(Math.ceil((now.getTime() + retryAfterSeconds * 1000) / minute) * minute);
}

function asDate(moment: string | Date): Date | null {
  const date = typeof moment === 'string' ? new Date(moment) : moment;

  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatCountdown(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);

  return `${minutes}:${String(whole % 60).padStart(2, '0')}`;
}

const EVENT_DAY: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
};

/** In the event's own zone, never the reader's: 16:00 in Lagos is 16:00 to everyone who reads it. */
export function formatEventDate(moment: string, timeZone: string, locale: string): string {
  const date = asDate(moment);

  if (date == null) return '';

  return new Intl.DateTimeFormat(locale, { ...EVENT_DAY, timeZone }).format(date);
}

/** CLDR's interval format, which writes a date once when both ends fall on it. */
export function formatEventRange(
  startsAt: string,
  endsAt: string,
  timeZone: string,
  locale: string,
): string {
  const start = asDate(startsAt);
  const end = asDate(endsAt);

  if (start == null || end == null) return '';

  return new Intl.DateTimeFormat(locale, {
    ...EVENT_DAY,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).formatRange(start, end);
}
