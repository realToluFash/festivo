import { formattingLocale } from '@soirely/domain';

import { writtenTime } from './clock.ts';
import type { EventPlace, OnEvent, OrgMember, PeopleStart } from './people.ts';
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
  organisation: DOOR_ORG,
  initials: 'LF',
  event: DOOR_EVENT,
  when: 'Live · in 7 days',
};

export const CAP_MOST = 500;
export const LABEL_MOST = 60;
export const BUSY_MS = 900;
export const HOLD_MS = 8000;
export const JOIN_MS = 1500;

export const W = {
  noneSays: 'No door code yet',
  noneLine: 'One code lets a crew in on the day. Each person gives their name and number.',
  makeFirst: 'Make a door code',
  another: 'Make another door code',
  doorCode: 'Door code',
  hold: 'Hold it up',
  print: 'Print',
  makeNew: 'Make a new code',
  stop: 'Stop this code',
  full: 'Full',
  stopped: 'Stopped',
  ranOut: 'Ran out',
  make: 'Make',
  making: 'Making…',
  theirRole: 'Their role',
  canEdit: 'Can edit',
  noEdit: 'A code can’t give edit access. Give that to a named person instead.',
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
  past: 'Choose a time that hasn’t passed yet.',
  failMake: 'We couldn’t make the code. Check your connection and try again.',
  made: 'Door code made.',
  newTitle: 'Make a new code?',
  newKeep: 'Keep this one',
  stopTitle: 'Stop this code?',
  stopKeep: 'Keep it',
  stopping: 'Stopping…',
  failStop: 'We couldn’t stop the code, so it still works. Check your connection and try again.',
  removing: 'Removing…',
  close: 'Close',
  esc: 'Esc',
  backToPeople: 'Back to People',
} as const;

export const CODE_ROLES = ['Can view', 'Can check guests in'] as const;
export type CodeRole = (typeof CODE_ROLES)[number];

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
}

/** The reader's region refines the English screen's dates, never replaces them (formattingLocale): en-GB reads "Sat 14 Nov", pt-PT stays "Sat, Nov 14". */
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

export function untilWords(ends: Ends): string {
  return ends.kind === 'event'
    ? `${clockOf(EVENT_ENDS)} on ${dayOf(EVENT_ENDS)}`
    : `${clockOf(ends.time)} on ${dayLabel(ends.day)}`;
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

export const joinCodeSaid = (code: string) => `Join code ${saidCode(code)}`;
export const qrSaid = (code: string) => `QR code for the join code ${saidCode(code)}`;

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

export function countLine(code: DoorCode): string {
  switch (code.state) {
    case 'stopped':
      return code.used === 1
        ? '1 person came in with it. They keep their access.'
        : `${code.used} people came in with it. They keep their access.`;
    case 'ranOut':
      return `${code.used} of ${code.cap} used · ended at ${code.endedAt == null ? '' : clockOf(code.endedAt)}`;
    default:
      return `${code.used} of ${code.cap} used · until ${untilWords(code.ends)}`;
  }
}

function keepLine(used: number): string {
  if (used === 0) return '';

  return used === 1
    ? ' The 1 person already in keeps their access.'
    : ` The ${used} people already in keep their access.`;
}

export function newLine(code: DoorCode): string {
  return `${shownCode(code.code)} stops working.${keepLine(code.used)}`;
}

export function stopLine(code: DoorCode): string {
  return `Nobody new can use it.${keepLine(code.used)}`;
}

export const inWithLine = (door: { code: string; at: string }) =>
  `In with the door code ${shownCode(door.code)} at ${clockOf(door.at)}.`;

export function printLine(code: DoorCode): string {
  return `Scan it with your phone’s camera, or open ${DOOR_ADDRESS} and type the code. It works until ${untilWords(code.ends)}.`;
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
  };
}

export function renewed(code: DoorCode, fresh: string): DoorCode {
  return { ...code, code: fresh, used: 0, state: 'working', endedAt: null };
}

/** Making a new code for a stopped or run-out one starts from its role, label and cap; an end that has passed goes back to the event's. */
export function formFrom(code: DoorCode, now = DESK_NOW): MakeForm {
  return {
    role: code.role,
    label: code.label ?? '',
    cap: String(code.cap),
    ends: endsLine(code.ends, now) == null ? code.ends : { kind: 'event' },
  };
}

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
  'code-ran-out',
  'code-made',
  'code-keyboard',
  'code-person',
  'code-remove',
  'code-removing',
  'code-removed',
] as const;
export const MAKE_STATES = [
  'open',
  'blank',
  'malformed',
  'ends',
  'past',
  'making',
  'failed',
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
  menu: boolean;
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
  role: 'Can check guests in',
  label: 'Bar and drinks',
  cap: '30',
  ends: { kind: 'event' },
};

function makeStart(state: MakeState): MakeStart {
  const start: MakeStart = {
    form: BLANK_FORM,
    checked: false,
    phase: 'open',
    failsOnce: false,
    menu: false,
    into: null,
    focus: 'first',
  };

  switch (state) {
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
  const state = isDoor(params.state) ? params.state : null;
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
  };
  const none = { ...start, codes: [], onEvent: [...NAMED] };

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
    case 'code-ran-out':
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
      people('state=code-ran-out', 'Ran out'),
      people('state=code-made', 'Made, with the toast'),
      people('state=code-keyboard', 'From the keyboard'),
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
    ],
  },
  {
    name: 'Hold it up, the whole window',
    states: [
      people('hold=open', 'Hold it up'),
      people('hold=counted', 'Someone joins'),
      people('hold=new-ask', 'Make a new code?'),
      people('hold=new', 'The new code'),
      people('hold=stop-ask', 'Stop this code?'),
      people('hold=stopping', 'Stopping'),
      people('hold=stop-failed', 'Stopping failed'),
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
