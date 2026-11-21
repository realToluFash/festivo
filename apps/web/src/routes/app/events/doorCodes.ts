import type { DoorCodeCard, DoorCodeRole, NewDoorCode } from '@soirely/api-client';
import { formatWallClock, formatWallDay, resolvedInstant } from '@soirely/domain';
import type { TFunction } from 'i18next';

import { clockWords, dayWords, wallOf } from './staffTimes.ts';

export const CAP_MOST = 500;
export const LABEL_MOST = 60;
const HALF_HOUR = 30;

export type Ends = { kind: 'event' } | { kind: 'earlier'; day: string; time: string };

export interface MakeForm {
  role: DoorCodeRole;
  label: string;
  cap: string;
  ends: Ends;
}

export interface MakeLines {
  cap?: string;
  ends?: string;
}

/** What a code's words are written against: the event's own clock, and now by the server's. */
export interface CodeClock {
  endsAt: string;
  timeZone: string;
  locale: string;
  now: Date;
}

export const BLANK_FORM: MakeForm = {
  role: 'can_view',
  label: '',
  cap: '',
  ends: { kind: 'event' },
};

export function shownCode(code: string): string {
  return `${code.slice(0, 4)} ${code.slice(4)}`;
}

/** Each character on its own, the two groups apart, so a screen reader spells it. */
export function saidCode(code: string): string {
  return `${[...code.slice(0, 4)].join(' ')}, ${[...code.slice(4)].join(' ')}`;
}

/** A time on the event's clock, with its day whenever that is not today there. */
export function atWords(at: string, clock: CodeClock, t: TFunction): string {
  const times = { long: false, timeZone: clock.timeZone, locale: clock.locale };
  const time = clockWords(at, times);
  if (wallOf(at, clock.timeZone).date === wallOf(clock.now.getTime(), clock.timeZone).date)
    return time;

  return t('doorCodes.dayTime', { day: dayWords(at, times), time });
}

export function capLine(typed: string, t: TFunction): string | null {
  const trimmed = typed.trim();
  if (trimmed === '') return t('doorCodes.capBlank');
  const many = /^\d+$/u.test(trimmed) ? Number(trimmed) : Number.NaN;

  return many >= 1 && many <= CAP_MOST ? null : t('doorCodes.capRange');
}

export function endsInstant(ends: Ends, clock: CodeClock): number {
  if (ends.kind === 'event') return Date.parse(clock.endsAt);

  return resolvedInstant(ends.day, ends.time, clock.timeZone) ?? Number.NaN;
}

export function makeLines(form: MakeForm, clock: CodeClock, t: TFunction): MakeLines {
  const lines: MakeLines = {};
  const cap = capLine(form.cap, t);
  if (cap != null) lines.cap = cap;
  if (!(endsInstant(form.ends, clock) > clock.now.getTime())) lines.ends = t('doorCodes.past');

  return lines;
}

export function newCode(form: MakeForm, clock: CodeClock): NewDoorCode {
  const label = form.label.trim();

  return {
    role: form.role,
    jobLabel: label === '' ? null : label,
    useCap: Number(form.cap.trim()),
    expiresAt: new Date(endsInstant(form.ends, clock)).toISOString(),
  };
}

/** The days an earlier end may fall on: today to the event's last day, on its clock. */
export function endDays(clock: CodeClock): string[] {
  const last = wallOf(clock.endsAt, clock.timeZone).date;
  const days: string[] = [];
  let day = wallOf(clock.now.getTime(), clock.timeZone).date;

  while (days.length < 400) {
    days.push(day);
    if (day >= last) break;
    day = nextDay(day);
  }

  return days;
}

function nextDay(day: string): string {
  const at = new Date(`${day}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() + 1);

  return at.toISOString().slice(0, 10);
}

/** Every half hour; on the event's last day only those before it ends, since a code ending then is "When the event ends". */
export function endTimes(day: string, clock: CodeClock): string[] {
  const end = wallOf(clock.endsAt, clock.timeZone);
  const times = Array.from({ length: (24 * 60) / HALF_HOUR }, (_, half) => {
    const hours = String(Math.floor(half / 2)).padStart(2, '0');

    return `${hours}:${half % 2 === 0 ? '00' : '30'}`;
  });

  return day === end.date ? times.filter((time) => time < end.time) : times;
}

export function earlierStart(clock: CodeClock): Ends {
  const days = endDays(clock);
  const day = days.at(-1) ?? wallOf(clock.endsAt, clock.timeZone).date;
  const times = endTimes(day, clock);

  return { kind: 'earlier', day, time: times.at(-1) ?? '00:00' };
}

/** A stopped or expired code's Make a new code starts from its role, label and cap; its end comes back only while it is still ahead and on the half-hour list. */
export function formFrom(code: DoorCodeCard, clock: CodeClock): MakeForm {
  const at = Date.parse(code.expiresAt);
  const wall = wallOf(at, clock.timeZone);
  const kept =
    at > clock.now.getTime() &&
    endDays(clock).includes(wall.date) &&
    endTimes(wall.date, clock).includes(wall.time);

  return {
    role: code.role,
    label: code.jobLabel ?? '',
    cap: String(code.useCap),
    ends: kept ? { kind: 'earlier', day: wall.date, time: wall.time } : { kind: 'event' },
  };
}

/** The same role, label, cap and end as the code it replaces; an end that has passed goes to the event's. */
export function renewal(code: DoorCodeCard, clock: CodeClock): NewDoorCode {
  const at = Date.parse(code.expiresAt);

  return {
    role: code.role,
    jobLabel: code.jobLabel,
    useCap: code.useCap,
    expiresAt: at > clock.now.getTime() ? code.expiresAt : clock.endsAt,
  };
}

export function roleLine(code: DoorCodeCard, t: TFunction): string {
  return [t('doorCodes.doorCode'), heldLine(code, t)].join(' · ');
}

export function heldLine(code: DoorCodeCard, t: TFunction): string {
  return [t(`eventPeople.role.${code.role}`), code.jobLabel]
    .filter((part) => part != null && part !== '')
    .join(' · ');
}

export function countLine(code: DoorCodeCard, clock: CodeClock, t: TFunction): string {
  switch (code.status) {
    case 'stopped':
      return t('doorCodes.cameIn', { count: code.used });
    case 'expired':
      return code.used === 0
        ? t('doorCodes.cameIn', { count: 0 })
        : t('doorCodes.countEnded', {
            used: code.used,
            cap: code.useCap,
            at: atWords(code.expiresAt, clock, t),
          });
    default:
      return t('doorCodes.count', {
        used: code.used,
        cap: code.useCap,
        until: atWords(code.expiresAt, clock, t),
      });
  }
}

export function endsWords(ends: Ends, clock: CodeClock, t: TFunction): string {
  const times = { long: false, timeZone: clock.timeZone, locale: clock.locale };
  if (ends.kind === 'event') return t('doorCodes.endsEvent', { at: eventEndWords(clock) });
  const at = endsInstant(ends, clock);

  return t('doorCodes.endsEarlier', {
    at: Number.isNaN(at)
      ? ''
      : t('doorCodes.dayTime', { day: dayWords(at, times), time: clockWords(at, times) }),
  });
}

export function eventEndWords(clock: CodeClock): string {
  const times = { long: false, timeZone: clock.timeZone, locale: clock.locale };

  return `${dayWords(clock.endsAt, times)}, ${clockWords(clock.endsAt, times)}`;
}

export function dayLabel(day: string, clock: CodeClock): string {
  return formatWallDay(day, clock.locale);
}

export function clockLabel(time: string, clock: CodeClock): string {
  return formatWallClock(time, clock.locale);
}
