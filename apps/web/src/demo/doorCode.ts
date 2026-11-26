import { formattingLocale } from '@soirely/domain';

import { writtenTime } from './clock.ts';
import {
  type EventPlace,
  LEVEL_LINES,
  type OnEvent,
  type OrgMember,
  type PeopleStart,
} from './people.ts';
import type { DemoLink } from './settings.ts';

/** The door code at a desk (Access-A-Web, page e28): its words, the boards' sample and the states. */
export const DOOR_ORG = 'Lumen Feiras';
export const DOOR_EVENT = 'Joana & Rui’s wedding';
export const DOOR_EVENT_ID = 'evt-joana-rui-2';
export const DOOR_VENUE = 'Quinta do Torneiro, Oeiras';
export const DOOR_ADDRESS = 'soirely.com/join';
export const DOOR_ZONE = 'Europe/Lisbon';
export const EVENT_STARTS = '2026-11-14T15:00:00Z';
export const EVENT_ENDS = '2026-11-14T23:30:00Z';
export const DESK_NOW = '2026-11-07T16:00:00Z';

export const DOOR_PLACE: EventPlace = {
  country: 'PT',
  organisation: DOOR_ORG,
  initials: 'LF',
  event: DOOR_EVENT,
  eventId: DOOR_EVENT_ID,
  when: 'Live · in 7 days',
};

export const CAP_MOST = 500;
export const LABEL_MOST = 60;
export const BUSY_MS = 900;
export const HOLD_MS = 8000;
export const JOIN_MS = 1500;

export const W = {
  noneSays: 'No door code yet',
  noneLine: 'One code lets a crew in on the day. Each person gives their full name.',
  makeFirst: 'Make a door code',
  another: 'Make another door code',
  doorCode: 'Door code',
  hold: 'Show the code',
  print: 'Print',
  makeNew: 'Make a new code',
  stop: 'Stop this code',
  full: 'Full',
  stopped: 'Stopped',
  ranOut: 'Expired',
  make: 'Make',
  making: 'Making…',
  theirRole: 'Their role',
  canEdit: 'Can edit',
  noEdit:
    'A code cannot give edit access, or let anyone run the floor. Give those to a named person instead.',
  runRefused: 'A join code cannot let people run the floor.',
  runRefusedLine: 'Give Can run the floor to one person, with their own link from the roster.',
  jobLabel: 'Job label (optional)',
  howMany: 'How many people',
  howManyHelp: 'From 1 to 500.',
  capBlank: 'Enter how many people can use this code.',
  capRange: 'Use a whole number from 1 to 500.',
  ends: 'Ends',
  whenEventEnds: 'When the event ends',
  earlier: 'Earlier',
  earlierLine: 'A day and time before the event ends.',
  day: 'Day',
  time: 'Time',
  past: 'Choose a time that has not passed yet.',
  failMake: 'The door code was not made. Check your connection and try again.',
  tryAgain: 'Try again',
  made: 'Door code made.',
  newTitle: 'Make a new code?',
  newKeep: 'Keep this one',
  stopTitle: 'Stop this code?',
  stopKeep: 'Keep it',
  stopping: 'Stopping…',
  failStop: 'The code was not stopped, so it still works. Check your connection and try again.',
  stopGo: 'Stop the code',
  nobodyYet: 'Nobody has used it yet.',
  nobodyCameIn: 'Nobody came in with this code.',
  removing: 'Removing…',
  close: 'Close',
  esc: 'Esc',
  backToPeople: 'Back to People',
  shift: 'Shift (optional)',
  noShift: 'No shift',
  noShiftLine: 'Pick one to put whoever joins on it while it has a free place.',
  shiftLine:
    'Whoever joins goes on this shift while it has a free place, and is clocked in if they join from an hour before it starts.',
  noShiftToOffer: 'No shift has a place a code can fill',
  shiftFull: 'Shift full',
  shiftOver: 'Shift over',
  notPutOn: 'People who join now are not put on it.',
} as const;

/** sc-4002: a code offers the two service levels that work a place; Can run the floor is refused (422 level_not_allowed_for_code). */
export const CODE_ROLES = [
  'Can view',
  'Can check guests in',
  'Can work the floor',
  'Can work the pass',
] as const;
export type CodeRole = (typeof CODE_ROLES)[number];

export const CODE_LINES: Record<CodeRole, string> = {
  'Can view': LEVEL_LINES['Can view'],
  'Can check guests in': LEVEL_LINES['Can check guests in'],
  'Can work the floor': LEVEL_LINES['Can work the floor'],
  'Can work the pass': LEVEL_LINES['Can work the pass'],
};

/** A shift's job carries a level (sc-3908); a code may name it only at a level it may give. */
export type JobLevel = CodeRole | 'Can run the floor';

export interface DoorShift {
  id: string;
  job: string;
  level: JobLevel;
  starts: string;
  ends: string;
  places: number;
  taken: number;
}

export type ShiftStatus = 'open' | 'full' | 'over';

export type Ends = { kind: 'event' } | { kind: 'earlier'; day: string; time: string };
export type CodeState = 'working' | 'full' | 'stopped' | 'ranOut';

export interface DoorCode {
  code: string;
  role: CodeRole;
  label: string | null;
  cap: number;
  used: number;
  ends: Ends;
  state: CodeState;
  endedAt: string | null;
  shift: string | null;
}

/** The reader's region refines the English screen's dates, never replaces them (formattingLocale): en-US reads "Sat, Nov 14", and en-GB or any other region "Sat 14 Nov". */
export const readerLocale = () => formattingLocale('en', navigator.language);
const DAYS = new Map<string, Intl.DateTimeFormat>();
const dayFormat = (locale: string): Intl.DateTimeFormat => {
  const made =
    DAYS.get(locale) ??
    new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: DOOR_ZONE,
    });
  DAYS.set(locale, made);

  return made;
};
const ISO_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: DOOR_ZONE });
const ISO_TIME = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: DOOR_ZONE,
});

export const dayOf = (at: string | Date) => dayFormat(readerLocale()).format(new Date(at));
export const clockOf = (at: string | Date) => writtenTime(at, readerLocale(), DOOR_ZONE);
const isoDayOf = (at: string | Date) => ISO_DAY.format(new Date(at));
const isoTimeOf = (at: string | Date) => ISO_TIME.format(new Date(at));

export function dayLabel(day: string): string {
  return dayOf(`${day}T12:00:00Z`);
}

/** Lisbon keeps UTC in November, so a wall time there is the instant. */
function instantOf(day: string, time: string): number {
  return Date.parse(`${day}T${time}:00Z`);
}

export function atWords(at: string, now = DESK_NOW): string {
  return isoDayOf(at) === isoDayOf(now) ? clockOf(at) : `${dayOf(at)}, ${clockOf(at)}`;
}

export function untilWords(ends: Ends, now = DESK_NOW): string {
  return ends.kind === 'event'
    ? atWords(EVENT_ENDS, now)
    : atWords(new Date(instantOf(ends.day, ends.time)).toISOString(), now);
}

export function endsWords(ends: Ends): string {
  return ends.kind === 'event'
    ? `${W.whenEventEnds} · ${eventEndWords()}`
    : `${W.earlier} · ${dayLabel(ends.day)}, ${clockOf(ends.time)}`;
}

export function eventEndWords(): string {
  return `${dayOf(EVENT_ENDS)}, ${clockOf(EVENT_ENDS)}`;
}

/** The days an earlier end may fall on: today to the event's own day, never after it. */
export function endDays(now = DESK_NOW): string[] {
  const days: string[] = [];
  const last = isoDayOf(EVENT_ENDS);
  for (let at = Date.parse(`${isoDayOf(now)}T12:00:00Z`); ; at += 86_400_000) {
    const day = isoDayOf(new Date(at));
    days.push(day);
    if (day >= last) return days;
  }
}

export function endTimes(day: string): string[] {
  const times = Array.from({ length: 48 }, (_, half) => {
    const hours = String(Math.floor(half / 2)).padStart(2, '0');

    return `${hours}:${half % 2 === 0 ? '00' : '30'}`;
  });

  return day === isoDayOf(EVENT_ENDS) ? times.filter((t) => t < isoTimeOf(EVENT_ENDS)) : times;
}

export const EARLIER_START: Ends = { kind: 'earlier', day: isoDayOf(EVENT_ENDS), time: '18:00' };

export function capLine(typed: string): string | null {
  const trimmed = typed.trim();
  if (trimmed === '') return W.capBlank;
  const many = /^\d+$/u.test(trimmed) ? Number(trimmed) : Number.NaN;

  return many >= 1 && many <= CAP_MOST ? null : W.capRange;
}

export function endsLine(ends: Ends, now = DESK_NOW): string | null {
  return ends.kind === 'earlier' && instantOf(ends.day, ends.time) <= Date.parse(now)
    ? W.past
    : null;
}

export interface MakeForm {
  role: CodeRole;
  label: string;
  cap: string;
  ends: Ends;
  shift: string | null;
  /** The level No shift gives back: the one chosen before a shift was picked. */
  before: CodeRole;
}

export interface MakeLines {
  cap?: string;
  ends?: string;
}

export function makeLines(form: MakeForm, now = DESK_NOW): MakeLines {
  const lines: MakeLines = {};
  const cap = capLine(form.cap);
  const ends = endsLine(form.ends, now);
  if (cap != null) lines.cap = cap;
  if (ends != null) lines.ends = ends;

  return lines;
}

export const BLANK_FORM: MakeForm = {
  role: 'Can view',
  label: '',
  cap: '',
  ends: { kind: 'event' },
  shift: null,
  before: 'Can view',
};

export function jobHelp(label: string): string {
  return `What they’re there for, shown beside their name. It grants nothing. ${Array.from(label).length} of ${LABEL_MOST}.`;
}

export function normalCode(typed: string): string {
  return typed.replace(/[\s-]/gu, '').toUpperCase();
}

export function shownCode(code: string): string {
  return `${code.slice(0, 4)} ${code.slice(4)}`;
}

export function saidCode(code: string): string {
  return `${[...code.slice(0, 4)].join(' ')}, ${[...code.slice(4)].join(' ')}`;
}

export const doorCodeSaid = (code: string) => `Door code ${saidCode(code)}`;
export const qrSaid = (code: string) => `QR code for the door code ${saidCode(code)}`;

/** The sample's codes in the order a planner makes them: the first, the new one, a second crew's. */
export const SAMPLE_CODES = [
  'Q7KM4XP2',
  'H3WD9RN6',
  'M4TB7KQ8',
  'T6PJ2VXC',
  'K9RD4MWE',
  'B2XQ7HNA',
  'F5GZ8YRT',
];

export function nextCode(taken: readonly string[]): string {
  return SAMPLE_CODES.find((code) => !taken.includes(code)) ?? 'W3NC6KPD';
}

export function roleLine(code: DoorCode): string {
  return [W.doorCode, code.role, code.label]
    .filter((part) => part != null && part !== '')
    .join(' · ');
}

export function heldLine(code: DoorCode): string {
  return [code.role, code.label].filter((part) => part != null && part !== '').join(' · ');
}

export function countLine(code: DoorCode, now = DESK_NOW): string {
  switch (code.state) {
    case 'stopped':
      if (code.used === 0) return W.nobodyCameIn;

      return code.used === 1
        ? '1 person came in with this code. They keep their access.'
        : `${code.used} people came in with this code. They keep their access.`;
    case 'ranOut':
      if (code.used === 0) return W.nobodyCameIn;

      return `${code.used} of ${code.cap} used · ended at ${code.endedAt == null ? '' : atWords(`${isoDayOf(now)}T${code.endedAt}:00Z`, now)}`;
    default:
      return `${code.used} of ${code.cap} used · until ${untilWords(code.ends, now)}`;
  }
}

function keepLine(used: number): string {
  if (used === 0) return ` ${W.nobodyYet}`;

  return used === 1
    ? ' 1 person is already in and keeps their access.'
    : ` ${used} people are already in and keep their access.`;
}

export function newLine(code: DoorCode): string {
  return `${shownCode(code.code)} stops working.${keepLine(code.used)}`;
}

export function stopLine(code: DoorCode): string {
  return `Nobody new can use it.${keepLine(code.used)}`;
}

export const inWithLine = (door: { code: string; at: string }) =>
  `Joined with the door code ${shownCode(door.code)} at ${clockOf(door.at)}.`;

export function printLine(code: DoorCode): string {
  return `Scan it with your phone’s camera, or open ${DOOR_ADDRESS} and enter the code. It works until ${untilWords(code.ends)}.`;
}

export const printWhen = () =>
  `${dayOf(EVENT_STARTS)} · ${clockOf(EVENT_STARTS)} to ${clockOf(EVENT_ENDS)} · ${DOOR_VENUE}`;

export function madeCode(form: MakeForm, code: string): DoorCode {
  return {
    code,
    role: form.role,
    label: form.label.trim() === '' ? null : form.label.trim(),
    cap: Number(form.cap.trim()),
    used: 0,
    ends: form.ends,
    state: 'working',
    endedAt: null,
    shift: form.shift,
  };
}

export function renewed(code: DoorCode, fresh: string): DoorCode {
  return { ...code, code: fresh, used: 0, state: 'working', endedAt: null };
}

/** Making a new code starts from the old one's role, label and cap; an end that has passed goes back to the event's, and its shift stays only while a code may still name it (sc-234). */
export function formFrom(
  code: DoorCode,
  shifts: readonly DoorShift[] = [],
  now = DESK_NOW,
): MakeForm {
  const form: MakeForm = {
    role: code.role,
    label: code.label ?? '',
    cap: String(code.cap),
    ends: endsLine(code.ends, now) == null ? code.ends : { kind: 'event' },
    shift: null,
    before: code.role,
  };
  const named = namedShift(code, shifts);

  return named != null && nameable(named, now) ? withShift(form, named) : form;
}

const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: DOOR_ZONE });

/** A shift past midnight reads its start day; no date anywhere. */
export const shiftLine = (shift: DoorShift) =>
  `${shift.job} · ${WEEKDAY.format(new Date(shift.starts))} ${clockOf(shift.starts)} to ${clockOf(shift.ends)}`;

export const placesLine = (shift: DoorShift) =>
  `${shift.places - shift.taken} of ${shift.places} ${shift.places === 1 ? 'place' : 'places'} free`;

export const pickedLine = (shift: DoorShift) => `${shiftLine(shift)} · ${placesLine(shift)}`;

export const lockLine = (shift: DoorShift) =>
  `Set by the ${shift.job} shift. Pick No shift to choose another.`;

export function shiftStatus(shift: DoorShift, now = DESK_NOW): ShiftStatus {
  if (Date.parse(shift.ends) <= Date.parse(now)) return 'over';

  return shift.taken >= shift.places ? 'full' : 'open';
}

export const codeMayGive = (level: JobLevel): level is CodeRole =>
  CODE_ROLES.some((role) => role === level);

const nameable = (shift: DoorShift, now: string) =>
  shiftStatus(shift, now) === 'open' && codeMayGive(shift.level);

/** The shifts a code may name: a free place, before its scheduled end, at a level a code may give; by scheduled start. */
export function offeredShifts(shifts: readonly DoorShift[], now = DESK_NOW): DoorShift[] {
  return shifts
    .filter((shift) => nameable(shift, now))
    .sort((one, other) => Date.parse(one.starts) - Date.parse(other.starts));
}

/** A shift sets the level to its job's; No shift gives back the level chosen before it. */
export function withShift(form: MakeForm, shift: DoorShift | null): MakeForm {
  if (shift == null) return form.shift == null ? form : { ...form, shift: null, role: form.before };
  if (!codeMayGive(shift.level)) return form;

  return {
    ...form,
    shift: shift.id,
    role: shift.level,
    before: form.shift == null ? form.role : form.before,
  };
}

/** A deleted shift is no shift: the card names none and Make a new code is sc-72's. */
export function namedShift(code: DoorCode, shifts: readonly DoorShift[]): DoorShift | null {
  return code.shift == null ? null : (shifts.find((shift) => shift.id === code.shift) ?? null);
}

/** On a code naming a shift, the Ask's Make a new code opens the form; otherwise it makes the code at once. */
export const newOpensForm = (code: DoorCode, shifts: readonly DoorShift[]) =>
  namedShift(code, shifts) != null;

const SATURDAY = '2026-11-14';
const SUNDAY = '2026-11-15';
const on = (day: string, time: string) => `${day}T${time}:00Z`;

/** The wedding's shifts, its jobs and levels as the Staff page's (sc-3908). Floor lead runs the floor, so no code names it. */
export const DOOR_SHIFTS: readonly DoorShift[] = [
  {
    id: 'lead',
    job: 'Floor lead',
    level: 'Can run the floor',
    starts: on(SATURDAY, '15:00'),
    ends: on(SUNDAY, '00:00'),
    places: 1,
    taken: 0,
  },
  {
    id: 'cook',
    job: 'Cook',
    level: 'Can work the pass',
    starts: on(SATURDAY, '13:00'),
    ends: on(SATURDAY, '22:00'),
    places: 3,
    taken: 1,
  },
  {
    id: 'door',
    job: 'Door',
    level: 'Can check guests in',
    starts: on(SATURDAY, '14:30'),
    ends: on(SATURDAY, '19:00'),
    places: 2,
    taken: 1,
  },
  {
    id: 'bar',
    job: 'Bar',
    level: 'Can view',
    starts: on(SATURDAY, '16:00'),
    ends: on(SUNDAY, '01:00'),
    places: 2,
    taken: 1,
  },
  {
    id: 'runner',
    job: 'Runner',
    level: 'Can work the floor',
    starts: on(SATURDAY, '17:00'),
    ends: on(SUNDAY, '00:00'),
    places: 2,
    taken: 2,
  },
  {
    id: 'waiter',
    job: 'Waiter',
    level: 'Can work the floor',
    starts: on(SATURDAY, '18:00'),
    ends: on(SUNDAY, '01:00'),
    places: 8,
    taken: 5,
  },
];

const shiftOf = (id: string): DoorShift => {
  const found = DOOR_SHIFTS.find((shift) => shift.id === id);
  if (found == null) throw new Error(`No sample shift ${id}`);

  return found;
};

export const WAITER_SHIFT = shiftOf('waiter');
export const DOOR_SHIFT = shiftOf('door');
/** The night itself, after the Door shift's 19:00 end and before the code's. */
export const NIGHT_NOW = on(SATURDAY, '20:00');

type Who = readonly [name: string, initials: string, tone?: number];

const BAR_CREW: readonly Who[] = [
  ['Beatriz Santos', 'BS', 0],
  ['Miguel Costa', 'MC', 1],
  ['Sofia Nunes', 'SN', 2],
  ['Tiago Lopes', 'TL', 3],
  ['Carla Mendes', 'CM'],
  ['Diogo Ferreira', 'DF'],
  ['Filipa Rocha', 'FR'],
  ['Gonçalo Pires', 'GP'],
  ['Leonor Alves', 'LA'],
  ['Rafael Gomes', 'RG'],
  ['Marta Ribeiro', 'MR'],
  ['Nuno Teixeira', 'NT'],
  ['Catarina Lima', 'CL'],
  ['João Pereira', 'JP', 4],
  ['Hugo Faria', 'HF', 2],
  ['Tomás Vaz', 'TV'],
  ['Helena Vieira', 'HV'],
  ['Bruno Cardoso', 'BC'],
  ['Sara Moreira', 'SM'],
  ['André Neves', 'AN'],
  ['Mariana Pinto', 'MP'],
  ['Ricardo Fonseca', 'RF'],
  ['Vasco Correia', 'VC'],
  ['Luísa Batista', 'LB'],
  ['Gabriel Sá', 'GS'],
  ['Daniela Coelho', 'DC'],
  ['Hélder Antunes', 'HA'],
  ['Patrícia Freitas', 'PF'],
  ['Simão Reis', 'SR'],
  ['Clara Duarte', 'CD'],
];

const CLOAK_CREW: readonly Who[] = [
  ['Lara Monteiro', 'LM'],
  ['Paulo Esteves', 'PE'],
  ['Vera Castro', 'VC'],
];

export const BAR: DoorCode = {
  code: 'Q7KM4XP2',
  role: 'Can check guests in',
  label: 'Bar and drinks',
  cap: 30,
  used: 14,
  ends: { kind: 'event' },
  state: 'working',
  endedAt: null,
  shift: null,
};

export const CLOAKROOM: DoorCode = {
  code: 'M4TB7KQ8',
  role: 'Can view',
  label: 'Cloakroom',
  cap: 5,
  used: 3,
  ends: { kind: 'event' },
  state: 'working',
  endedAt: null,
  shift: null,
};

/** A code naming the Waiter shift (sc-234). */
export const WAITERS: DoorCode = {
  code: 'T6PJ2VXC',
  role: 'Can work the floor',
  label: 'Waiting staff',
  cap: 30,
  used: 5,
  ends: { kind: 'event' },
  state: 'working',
  endedAt: null,
  shift: WAITER_SHIFT.id,
};

const idOf = (name: string) =>
  `${name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/gu, '.')}@example.com`;

/** Who came in by a code, in the order they did: one a minute from 13:21, so João at 13:34. */
function crewOf(code: DoorCode, crew: readonly Who[], from: number, count: number): OnEvent[] {
  return crew.slice(from, from + count).map(([name, initials, tone], index) => {
    const minute = 21 + from + index;

    return {
      id: idOf(name),
      name,
      initials,
      tone: tone ?? (from + index) % 5,
      role: code.role,
      outside: true,
      label: code.label,
      door: {
        code: code.code,
        at: `${13 + Math.floor(minute / 60)}:${String(minute % 60).padStart(2, '0')}`,
      },
    };
  });
}

export function joiner(code: DoorCode): OnEvent[] {
  return crewOf(code, BAR_CREW, code.used, 1);
}

const NAMED: OnEvent[] = [
  {
    id: 'duarte@lumenfeiras.example',
    name: 'Duarte Sousa',
    initials: 'DS',
    tone: 1,
    role: 'Lead',
    outside: false,
    label: null,
  },
  {
    id: 'rita@lumenfeiras.example',
    name: 'Rita Marques',
    initials: 'RM',
    tone: 3,
    role: 'Can edit',
    outside: false,
    label: null,
  },
  {
    id: 'teresa@quintadotorneiro.example',
    name: 'Teresa Matos',
    initials: 'TM',
    tone: 2,
    role: 'Can view',
    outside: true,
    label: 'The venue’s coordinator',
  },
  {
    id: 'kemi.okafor@example.com',
    name: 'Kemi Okafor',
    initials: 'KO',
    tone: 3,
    role: 'Can check guests in',
    outside: true,
    label: 'Bar and drinks',
  },
];

export const INES = {
  id: 'ines@lumenfeiras.example',
  name: 'Inês Carvalho',
  initials: 'IC',
  role: 'Owner',
} as const;

export function doorMembers(): OrgMember[] {
  return [
    { id: INES.id, name: INES.name, initials: 'IC', tone: 0, role: 'Owner', active: true },
    {
      id: 'julien@lumenfeiras.example',
      name: 'Julien Moreau',
      initials: 'JM',
      tone: 4,
      role: 'Admin',
      active: true,
    },
    {
      id: 'duarte@lumenfeiras.example',
      name: 'Duarte Sousa',
      initials: 'DS',
      tone: 1,
      role: 'Member',
      active: true,
    },
    {
      id: 'rita@lumenfeiras.example',
      name: 'Rita Marques',
      initials: 'RM',
      tone: 3,
      role: 'Member',
      active: true,
    },
  ];
}

export const JOAO = idOf('João Pereira');

export const DOOR_STATES = [
  'code-none',
  'code',
  'code-two',
  'code-full',
  'code-stopped',
  'code-expired',
  'code-made',
  'code-keyboard',
  'code-person',
  'code-remove',
  'code-removing',
  'code-removed',
  'code-shift',
  'code-shift-full',
  'code-shift-over',
  'new_code_shift_kept',
] as const;
export const MAKE_STATES = [
  'open',
  'blank',
  'malformed',
  'ends',
  'past',
  'making',
  'failed',
  'refused',
  'shift',
  'shift-list',
  'shift-none',
] as const;
export const HOLD_STATES = [
  'open',
  'counted',
  'new-ask',
  'new',
  'stop-ask',
  'stopping',
  'stop-failed',
] as const;

export type DoorState = (typeof DOOR_STATES)[number];
export type MakeState = (typeof MAKE_STATES)[number];
export type HoldState = (typeof HOLD_STATES)[number];

/** `held` is a deep-linked wait, long enough to look at; `busy` the demo's own. */
export type AskPhase = 'ask' | 'busy' | 'held' | 'failed';

export interface MakeStart {
  form: MakeForm;
  checked: boolean;
  phase: 'open' | 'busy' | 'held' | 'failed';
  failsOnce: boolean;
  /** The API's 422 level_not_allowed_for_code, from a stale form or a direct call: the client never offers the level. */
  refused: boolean;
  menu: boolean;
  shiftMenu: boolean;
  into: number | null;
  focus: 'first' | 'cap' | 'time';
}

export interface DoorAsk {
  kind: 'new' | 'stop';
  index: number;
  phase: AskPhase;
  held: boolean;
  failsOnce: boolean;
}

export interface DoorStart {
  codes: DoorCode[];
  make: MakeStart | null;
  held: number | null;
  ask: DoorAsk | null;
  joins: boolean;
  keyboard: boolean;
  person: string | null;
  remove: 'ask' | 'held' | null;
  toast: string | null;
  print: boolean;
  onEvent: OnEvent[];
  shifts: readonly DoorShift[];
  now: string;
}

export interface DoorParams {
  state: string | null;
  code: string | null;
  hold: string | null;
  print: string | null;
}

const isDoor = (name: string | null): name is DoorState => DOOR_STATES.some((one) => one === name);
const isMake = (name: string | null): name is MakeState => MAKE_STATES.some((one) => one === name);
const isHold = (name: string | null): name is HoldState => HOLD_STATES.some((one) => one === name);

const TYPED: MakeForm = {
  ...BLANK_FORM,
  role: 'Can check guests in',
  label: 'Bar and drinks',
  cap: '30',
};

export const MAKE_FRESH: MakeStart = {
  form: BLANK_FORM,
  checked: false,
  phase: 'open',
  failsOnce: false,
  refused: false,
  menu: false,
  shiftMenu: false,
  into: null,
  focus: 'first',
};

/** Nothing a code can fill: every place taken, and Floor lead never offered. */
const NO_ROOM = DOOR_SHIFTS.map((shift) => ({ ...shift, taken: shift.places }));

function makeStart(state: MakeState): MakeStart {
  const start = MAKE_FRESH;

  switch (state) {
    case 'shift':
      return {
        ...start,
        form: withShift({ ...BLANK_FORM, label: 'Waiting staff', cap: '30' }, WAITER_SHIFT),
      };
    case 'shift-list':
      return { ...start, shiftMenu: true };
    case 'refused':
      return { ...start, form: { ...TYPED, role: 'Can work the floor' }, refused: true };
    case 'blank':
      return { ...start, checked: true, focus: 'cap' };
    case 'malformed':
      return { ...start, form: { ...TYPED, cap: '3000' }, checked: true, focus: 'cap' };
    case 'ends':
      return { ...start, form: { ...TYPED, ends: EARLIER_START }, focus: 'time' };
    case 'past':
      return {
        ...start,
        form: { ...TYPED, ends: { kind: 'earlier', day: isoDayOf(DESK_NOW), time: '09:00' } },
        checked: true,
        focus: 'time',
      };
    case 'making':
      return { ...start, form: TYPED, phase: 'held' };
    case 'failed':
      return { ...start, form: TYPED, phase: 'failed', failsOnce: false };
    default:
      return start;
  }
}

const OF_STATE: Record<CodeState, Partial<DoorCode>> = {
  working: {},
  full: { state: 'full', used: 30 },
  stopped: { state: 'stopped' },
  ranOut: {
    state: 'ranOut',
    ends: { kind: 'earlier', day: isoDayOf(DESK_NOW), time: '15:00' },
    endedAt: '15:00',
  },
};

function codeIn(state: CodeState): DoorCode {
  return { ...BAR, ...OF_STATE[state] };
}

export function doorStartOf(params: DoorParams): DoorStart | null {
  const make = isMake(params.code) ? params.code : null;
  const hold = isHold(params.hold) ? params.hold : null;
  const named = params.state === 'code-ran-out' ? 'code-expired' : params.state;
  const state = isDoor(named) ? named : null;
  const print = params.print === '1';
  if (state == null && make == null && hold == null && !print) return null;

  const barCrew = [...NAMED, ...crewOf(BAR, BAR_CREW, 0, BAR.used)];
  const start: DoorStart = {
    codes: [BAR],
    make: null,
    held: null,
    ask: null,
    joins: false,
    keyboard: false,
    person: null,
    remove: null,
    toast: null,
    print,
    onEvent: barCrew,
    shifts: DOOR_SHIFTS,
    now: DESK_NOW,
  };
  const none = { ...start, codes: [], onEvent: [...NAMED] };
  const waiters = {
    ...start,
    codes: [WAITERS],
    onEvent: [...NAMED, ...crewOf(WAITERS, BAR_CREW, 0, WAITERS.used)],
  };

  if (make === 'shift-none') return { ...none, make: makeStart(make), shifts: NO_ROOM };
  if (make != null) return { ...none, make: makeStart(make) };
  if (hold != null) {
    const ask = (kind: DoorAsk['kind'], phase: AskPhase, failsOnce = false): DoorAsk => ({
      kind,
      index: 0,
      phase,
      held: true,
      failsOnce,
    });
    const held = { ...start, held: 0 };
    switch (hold) {
      case 'counted':
        return { ...held, joins: true };
      case 'new-ask':
        return { ...held, ask: ask('new', 'ask') };
      case 'new':
        return { ...held, codes: [renewed(BAR, 'H3WD9RN6')] };
      case 'stop-ask':
        return { ...held, ask: ask('stop', 'ask') };
      case 'stopping':
        return { ...held, ask: ask('stop', 'held') };
      case 'stop-failed':
        return { ...held, ask: ask('stop', 'failed') };
      default:
        return held;
    }
  }

  switch (state) {
    case 'code-none':
      return none;
    case 'code-two':
      return {
        ...start,
        codes: [BAR, CLOAKROOM],
        onEvent: [...barCrew, ...crewOf(CLOAKROOM, CLOAK_CREW, 0, CLOAKROOM.used)],
      };
    case 'code-full':
      return {
        ...start,
        codes: [codeIn('full')],
        onEvent: [...NAMED, ...crewOf(BAR, BAR_CREW, 0, 30)],
      };
    case 'code-stopped':
      return { ...start, codes: [codeIn('stopped')] };
    case 'code-expired':
      return { ...start, codes: [codeIn('ranOut')] };
    case 'code-made':
      return { ...none, codes: [{ ...BAR, used: 0 }], toast: W.made };
    case 'code-keyboard':
      return { ...start, keyboard: true };
    case 'code-person':
      return { ...start, person: JOAO };
    case 'code-remove':
      return { ...start, person: JOAO, remove: 'ask' };
    case 'code-removing':
      return { ...start, person: JOAO, remove: 'held' };
    case 'code-shift':
      return waiters;
    case 'code-shift-full':
      return {
        ...waiters,
        shifts: DOOR_SHIFTS.map((shift) =>
          shift.id === WAITER_SHIFT.id ? { ...shift, taken: shift.places } : shift,
        ),
      };
    case 'code-shift-over':
      return { ...start, codes: [{ ...BAR, shift: DOOR_SHIFT.id }], now: NIGHT_NOW };
    case 'new_code_shift_kept':
      return {
        ...waiters,
        make: { ...MAKE_FRESH, form: formFrom(WAITERS, DOOR_SHIFTS), into: 0 },
      };
    case 'code-removed':
      return {
        ...start,
        toast: 'João Pereira is off this event.',
        onEvent: barCrew.filter((one) => one.id !== JOAO),
      };
    default:
      return start;
  }
}

export function doorPeopleStart(door: DoorStart): PeopleStart {
  return {
    viewer: { ...INES },
    onEvent: door.onEvent,
    roleFails: false,
    load: 'loaded',
    place: DOOR_PLACE,
    members: doorMembers(),
  };
}

const people = (query: string, name: string): DemoLink => ({ to: `/demo/people?${query}`, name });

export const DOOR_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'People with the door code',
    states: [
      people('state=code-none', 'No code yet'),
      people('state=code', 'The code working'),
      people('state=code-two', 'Two codes'),
      people('state=code-full', 'Full'),
      people('state=code-stopped', 'Stopped'),
      people('state=code-expired', 'Expired'),
      people('state=code-made', 'Made, with the toast'),
      people('state=code-keyboard', 'From the keyboard'),
      people('state=code-shift', 'The code names a shift (sc-234)'),
      people('state=code-shift-full', 'Its shift full (sc-234)'),
      people('state=code-shift-over', 'Its shift over, on the night (sc-234)'),
      people('state=loading', 'Loading'),
      people('state=failed', 'Failed'),
      people('state=readOnly', 'Read only'),
    ],
  },
  {
    name: 'Making a code, a 540 dialog',
    states: [
      people('code=open', 'A new door code'),
      people('code=blank', 'Make, left blank'),
      people('code=malformed', 'Make, with 3000'),
      people('code=ends', 'Ends, earlier'),
      people('code=past', 'An end that has passed'),
      people('code=making', 'Making'),
      people('code=failed', 'Making failed'),
      people('code=refused', 'Refused: a code can’t run the floor (sc-4002)'),
      people('code=shift-list', 'Shift (optional), the list open (sc-234)'),
      people('code=shift', 'A shift picked: Their role set by it (sc-234)'),
      people('code=shift-none', 'No shift a code can fill (sc-234)'),
      people('state=new_code_shift_kept', 'Make a new code, the Waiter shift kept (sc-234)'),
    ],
  },
  {
    name: 'Show the code, the whole window',
    states: [
      people('show=open', 'Show the code'),
      people('show=counted', 'Someone joins'),
      people('show=new-ask', 'Make a new code?'),
      people('show=new', 'The new code'),
      people('show=stop-ask', 'Stop this code?'),
      people('show=stopping', 'Stopping'),
      people('show=stop-failed', 'Stopping failed'),
    ],
  },
  {
    name: 'Who came in, and taking one back',
    states: [
      people('state=code-person', 'João’s dialog'),
      people('state=code-remove', 'Remove João?'),
      people('state=code-removing', 'Removing'),
      people('state=code-removed', 'Removed'),
      people('print=1', 'Print, a Letter page'),
    ],
  },
];
