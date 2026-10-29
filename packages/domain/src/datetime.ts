/** The day and the time are separate because the word between them belongs to the catalogue. */
export function formatDay(moment: string | Date, locale: string): string {
  const date = asDate(moment);

  if (date == null) return '';

  return formatsFor(locale).day.format(date);
}

export function formatTimeOfDay(moment: string | Date, locale: string): string {
  const date = asDate(moment);

  if (date == null) return '';

  return formatsFor(locale).time.format(date);
}

const formats = new Map<string, { day: Intl.DateTimeFormat; time: Intl.DateTimeFormat }>();

/** Made once a locale, since a list asks for every row on every render. */
function formatsFor(locale: string): { day: Intl.DateTimeFormat; time: Intl.DateTimeFormat } {
  const made = formats.get(locale) ?? {
    day: new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'short', day: 'numeric' }),
    time: new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false }),
  };
  formats.set(locale, made);

  return made;
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

const EVENT_DAY_WITHOUT_YEAR: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
};

const EVENT_DAY: Intl.DateTimeFormatOptions = { ...EVENT_DAY_WITHOUT_YEAR, year: 'numeric' };

const EVENT_CLOCK: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
};

/** A wall-clock day, `2027-03-28`, as the event's page writes it. */
export function formatWallDay(date: string, locale: string): string {
  const day = asDate(`${date}T00:00Z`);

  if (day == null) return '';

  return new Intl.DateTimeFormat(locale, { ...EVENT_DAY_WITHOUT_YEAR, timeZone: 'UTC' }).format(
    day,
  );
}

/** A wall-clock time, `02:30` or `2027-03-28T03:30`, as the event's page writes it. */
export function formatWallClock(time: string, locale: string): string {
  const moment = asDate(`${time.includes('T') ? time : `1970-01-01T${time}`}Z`);

  if (moment == null) return '';

  return new Intl.DateTimeFormat(locale, { ...EVENT_CLOCK, timeZone: 'UTC' }).format(moment);
}

/** In the event's own zone, never the reader's: 16:00 in Lagos is 16:00 to everyone who reads it. */
export function formatEventDate(moment: string, timeZone: string, locale: string): string {
  const date = asDate(moment);

  if (date == null) return '';

  return new Intl.DateTimeFormat(locale, { ...EVENT_DAY, timeZone }).format(date);
}

export function formatEventMoment(moment: string, timeZone: string, locale: string): string {
  const date = asDate(moment);

  if (date == null) return '';

  return new Intl.DateTimeFormat(locale, {
    ...EVENT_DAY_WITHOUT_YEAR,
    ...EVENT_CLOCK,
    timeZone,
  }).format(date);
}

/** A moment with its weekday, date, year and clock, as the board draws an event's start and end. */
export function formatEventDayAndClock(
  moment: string | Date,
  timeZone: string,
  locale: string,
): string {
  const date = asDate(moment);

  if (date == null) return '';

  return new Intl.DateTimeFormat(locale, { ...EVENT_DAY, ...EVENT_CLOCK, timeZone }).format(date);
}

/** Whole hours and the minutes left, each in the reader's words; a client joins the two through its catalogue. */
export function durationWords(
  minutes: number,
  locale: string,
): { hours: string | null; minutes: string | null } {
  const unit = (amount: number, name: 'hour' | 'minute'): string =>
    new Intl.NumberFormat(locale, { style: 'unit', unit: name, unitDisplay: 'long' }).format(
      amount,
    );
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return {
    hours: hours > 0 || rest === 0 ? unit(hours, 'hour') : null,
    minutes: rest > 0 ? unit(rest, 'minute') : null,
  };
}

/** Not `formatRange`, which Hermes does not have: the app's event page crashed on it. */
export function formatEventRange(
  startsAt: string,
  endsAt: string,
  timeZone: string,
  locale: string,
): string {
  const start = asDate(startsAt);
  const end = asDate(endsAt);

  if (start == null || end == null) return '';

  const day = new Intl.DateTimeFormat(locale, { ...EVENT_DAY, timeZone });
  const clock = new Intl.DateTimeFormat(locale, { ...EVENT_CLOCK, timeZone });
  const sameDay = day.format(start) === day.format(end);

  return `${formatEventDayAndClock(start, timeZone, locale)} – ${
    sameDay ? clock.format(end) : formatEventDayAndClock(end, timeZone, locale)
  }`;
}

/** An Events Home card's date, "Saturday, Nov 14", in the event's zone (sc-3594). */
export function formatEventWeekday(moment: string, timeZone: string, locale: string): string {
  const date = asDate(moment);

  if (date == null) return '';

  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone,
  }).format(date);
}

/** "Sep 30", for a day close enough that the year goes without saying. */
export function formatEventShortDay(moment: string, timeZone: string, locale: string): string {
  const date = asDate(moment);

  if (date == null) return '';

  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone }).format(date);
}

export function formatEventClock(moment: string, timeZone: string, locale: string): string {
  const date = asDate(moment);

  if (date == null) return '';

  return new Intl.DateTimeFormat(locale, { ...EVENT_CLOCK, timeZone }).format(date);
}
