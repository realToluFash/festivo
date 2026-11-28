import type { DoorCodeCard, DoorCodeRole, DoorCodeStatus, NewDoorCode } from '@soirely/api-client';
import { formatEventClock, formatWallClock, formatWallDay, resolvedInstant } from '@soirely/domain';
import type { TFunction } from 'i18next';

export const CAP_MOST = 500;
export const LABEL_MOST = 60;

/** Can edit is listed so it can be shown dimmed with why; a code never gives it. */
export const CODE_CHOICES = [
  'can_view',
  'can_check_in',
  'can_work_floor',
  'can_work_pass',
  'can_edit',
] as const;
export type CodeChoice = (typeof CODE_CHOICES)[number];

export type Ends = { kind: 'event' } | { kind: 'earlier'; date: string; time: string };

export interface MakeForm {
  role: DoorCodeRole;
  label: string;
  cap: string;
  ends: Ends;
}

export interface MakeLines {
  cap: string | null;
  ends: string | null;
}

export const NO_LINES: MakeLines = { cap: null, ends: null };

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

export function saidCode(code: string): string {
  return `${[...code.slice(0, 4)].join(' ')}, ${[...code.slice(4)].join(' ')}`;
}

export function wallOf(moment: string | number, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(moment));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((one) => one.type === type)?.value ?? '';

  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
  };
}

function dayWords(moment: string | number, clock: CodeClock): string {
  return formatWallDay(wallOf(moment, clock.timeZone).date, clock.locale);
}

function clockWords(moment: string | number, clock: CodeClock): string {
  return formatEventClock(new Date(moment).toISOString(), clock.timeZone, clock.locale);
}

export function atWords(at: string, clock: CodeClock, t: TFunction): string {
  const time = clockWords(at, clock);
  if (wallOf(at, clock.timeZone).date === wallOf(clock.now.getTime(), clock.timeZone).date)
    return time;

  return t('doorCodes.dayTime', { day: dayWords(at, clock), time });
}

export function capLine(typed: string, t: TFunction): string | null {
  const trimmed = typed.trim();
  if (trimmed === '') return t('doorCodes.capBlank');
  const many = /^\d+$/u.test(trimmed) ? Number(trimmed) : Number.NaN;

  return many >= 1 && many <= CAP_MOST ? null : t('doorCodes.capRange');
}

export function endsInstant(ends: Ends, clock: CodeClock): number {
  if (ends.kind === 'event') return Date.parse(clock.endsAt);

  return resolvedInstant(ends.date, ends.time, clock.timeZone) ?? Number.NaN;
}

export function makeLines(form: MakeForm, clock: CodeClock, t: TFunction): MakeLines {
  return {
    cap: capLine(form.cap, t),
    ends: endsInstant(form.ends, clock) > clock.now.getTime() ? null : t('doorCodes.past'),
  };
}

export function firstLine(lines: MakeLines): 'cap' | 'ends' | null {
  if (lines.cap != null) return 'cap';

  return lines.ends == null ? null : 'ends';
}

export function newCode(form: MakeForm, clock: CodeClock, replaces: string | null): NewDoorCode {
  const label = form.label.trim();

  return {
    role: form.role,
    jobLabel: label === '' ? null : label,
    useCap: Number(form.cap.trim()),
    expiresAt: new Date(endsInstant(form.ends, clock)).toISOString(),
    ...(replaces == null ? {} : { replaces }),
  };
}

/** An end at or past the event's is never offered: a pick past it is "When the event ends". */
export function earlierEnds(date: string, time: string, clock: CodeClock): Ends {
  return endsInstant({ kind: 'earlier', date, time }, clock) >= Date.parse(clock.endsAt)
    ? { kind: 'event' }
    : { kind: 'earlier', date, time };
}

export function earlierStart(clock: CodeClock): { kind: 'earlier'; date: string; time: string } {
  const wall = wallOf(Date.parse(clock.endsAt) - 30 * 60 * 1000, clock.timeZone);
  const [hours = '00', minutes = '00'] = wall.time.split(':');

  return {
    kind: 'earlier',
    date: wall.date,
    time: `${hours}:${Number(minutes) < 30 ? '00' : '30'}`,
  };
}

/** A stopped or expired code is made again with its role, label and number kept, its end the event's (pm, 7 Nov). */
export function formFrom(code: DoorCodeCard): MakeForm {
  return {
    role: code.role,
    label: code.jobLabel ?? '',
    cap: String(code.useCap),
    ends: { kind: 'event' },
  };
}

/** The same role, label, cap and end as the code it replaces; an end that has passed goes to the event's. */
export function renewal(code: DoorCodeCard, clock: CodeClock): NewDoorCode {
  return {
    role: code.role,
    jobLabel: code.jobLabel,
    useCap: code.useCap,
    expiresAt: Date.parse(code.expiresAt) > clock.now.getTime() ? code.expiresAt : clock.endsAt,
    replaces: code.id,
  };
}

export function heldLine(code: Pick<DoorCodeCard, 'role' | 'jobLabel'>, t: TFunction): string {
  return [t(`eventPeople.role.${code.role}`), code.jobLabel]
    .filter((part) => part != null && part !== '')
    .join(' · ');
}

export function roleLine(code: Pick<DoorCodeCard, 'role' | 'jobLabel'>, t: TFunction): string {
  return [t('doorCodes.doorCode'), heldLine(code, t)].join(' · ');
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
    case 'full':
    case 'working':
      return t('doorCodes.count', {
        used: code.used,
        cap: code.useCap,
        until: atWords(code.expiresAt, clock, t),
      });
  }
}

export function eventEndWords(clock: CodeClock): string {
  return `${dayWords(clock.endsAt, clock)}, ${clockWords(clock.endsAt, clock)}`;
}

export function endsWords(ends: Ends, clock: CodeClock, t: TFunction): string {
  if (ends.kind === 'event') return t('doorCodes.endsEvent', { at: eventEndWords(clock) });

  return t('doorCodes.endsEarlier', {
    at: t('doorCodes.dayTime', {
      day: formatWallDay(ends.date, clock.locale),
      time: formatWallClock(ends.time, clock.locale),
    }),
  });
}

/** Working shows it; any other state's one step is a new code. Under the card: both while it works, Stop while full. */
export function cardStep(status: DoorCodeStatus): 'show' | 'makeNew' {
  return status === 'working' ? 'show' : 'makeNew';
}

export function underCard(status: DoorCodeStatus): readonly ('makeNew' | 'stop')[] {
  if (status === 'working') return ['makeNew', 'stop'];

  return status === 'full' ? ['stop'] : [];
}

/** A working or full code still lets people in, so a new one asks first; a stopped or expired one opens Make. */
export function makeNewAsks(status: DoorCodeStatus): boolean {
  return status === 'working' || status === 'full';
}

/** The API lists newest first; People keeps them in the order they were made. */
export function inMadeOrder(codes: readonly DoorCodeCard[]): DoorCodeCard[] {
  return [...codes].reverse();
}
