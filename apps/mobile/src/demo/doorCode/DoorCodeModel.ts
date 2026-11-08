import { formatWallDay, phoneLengthProblem } from '@soirely/domain';

import { writtenTime } from '../clock.ts';

import type {
  EventRole,
  OnEvent,
  OrgMember,
  PeopleStart,
  PeopleViewer,
  PeopleWorld,
} from '../people/PeopleSample.ts';
import { cameIn, tooShortFor, usedEnded, usedUntil, W } from './DoorCodeWords.ts';

/** The sample, access-a-spec.md §6: Lumen Feiras in Porto and Joana & Rui's wedding. It is not spec. */
export const ORGANISATION = 'Lumen Feiras';
export const EVENT = {
  id: 'evt-joana-rui',
  name: 'Joana & Rui’s wedding',
  day: '2026-11-14',
  starts: '15:00',
  ends: '23:30',
  venue: 'Quinta do Torneiro, Oeiras',
  country: 'PT',
  countryName: 'Portugal',
} as const;
export interface Moment {
  date: string;
  time: string;
}

export const NOW: Moment = { date: '2026-11-07', time: '09:41' };
export const ON_THE_DAY: Moment = { date: EVENT.day, time: '13:45' };
export const AFTER_EXPIRY: Moment = { date: EVENT.day, time: '16:00' };
export const TRY_AT = '13:32';

export const CODE_ROLES = ['Can view', 'Can check guests in', 'Can edit'] as const;
export type CodeChoice = (typeof CODE_ROLES)[number];
export type CodeRole = Exclude<CodeChoice, 'Can edit'>;
export const FIRST_CODE_ROLE: CodeRole = 'Can view';
export const CODE_CAP_MOST = 500;
export const JOB_MOST = 60;
export const JOIN_CODE_LENGTH = 8;

export type Ends = { kind: 'event' } | { kind: 'earlier'; date: string; time: string };

export interface DoorCode {
  id: string;
  code: string;
  role: CodeRole;
  job: string | null;
  cap: number;
  used: number;
  ends: Ends;
  stopped: boolean;
  endedAt: string | null;
}

export type CodeStatus = 'working' | 'full' | 'stopped' | 'expired';

export function codeStatus(code: DoorCode): CodeStatus {
  if (code.stopped) return 'stopped';
  if (code.endedAt != null) return 'expired';

  return code.used >= code.cap ? 'full' : 'working';
}

export function endMoment(ends: Ends): Moment {
  return ends.kind === 'event' ? { date: EVENT.day, time: EVENT.ends } : ends;
}

export function dayWords(date: string, locale: string): string {
  return formatWallDay(date, locale);
}

export function clockWords(time: string, locale: string): string {
  return writtenTime(time, locale);
}

/** "23:30" today, "Sat, Nov 14, 23:30" on another day (pm, 8 Nov): the day and the time from Intl, on the 24-hour clock. */
export function atWords(at: Moment, locale: string, today: string): string {
  const time = clockWords(at.time, locale);

  return at.date === today ? time : `${dayWords(at.date, locale)}, ${time}`;
}

export function endsRowLine(ends: Ends, locale: string): string {
  const { date, time } = endMoment(ends);
  const which = ends.kind === 'event' ? W.whenEventEnds : W.earlier;

  return `${which} · ${dayWords(date, locale)}, ${clockWords(time, locale)}`;
}

export function cardLine(code: DoorCode, locale: string, today: string): string {
  const end = atWords(endMoment(code.ends), locale, today);

  switch (codeStatus(code)) {
    case 'working':
      return usedUntil(code.used, code.cap, end);
    case 'full':
      return usedUntil(code.cap, code.cap, end);
    case 'stopped':
      return cameIn(code.used);
    case 'expired':
      return code.used === 0 ? cameIn(0) : usedEnded(code.used, code.cap, end);
  }
}

/** Working holds it up; any other state's one step is a new code. Under the card: both while it works, Stop while full. */
export function cardStep(status: CodeStatus): 'hold' | 'makeNew' {
  return status === 'working' ? 'hold' : 'makeNew';
}

export function underCard(status: CodeStatus): readonly ('makeNew' | 'stop')[] {
  if (status === 'working') return ['makeNew', 'stop'];

  return status === 'full' ? ['stop'] : [];
}

const POOL = ['Q7KM 4XP2', 'H3WD 9RN6', 'M4TB 7KQ8', 'R8VN 2CJ5', 'T6PZ 3WL9', 'K2FX 8MD4'];

export function nextCode(had: readonly string[]): string {
  return POOL.find((code) => !had.includes(code)) ?? `Z${String(had.length).padStart(3, '0')} 9QX4`;
}

export interface CodeForm {
  role: CodeRole;
  job: string;
  cap: string;
  ends: Ends;
}

export interface FormProblems {
  cap: string | null;
  ends: string | null;
}

export const NO_PROBLEMS: FormProblems = { cap: null, ends: null };

export function capProblem(typed: string): string | null {
  const text = typed.trim();
  if (text === '') return W.capBlank;
  const whole = /^\d+$/u.test(text) ? Number(text) : Number.NaN;

  return whole >= 1 && whole <= CODE_CAP_MOST ? null : W.capRange;
}

function stamp({ date, time }: { date: string; time: string }): string {
  return `${date}T${time}`;
}

export function endsProblem(ends: Ends, now: { date: string; time: string } = NOW): string | null {
  return ends.kind === 'earlier' && stamp(ends) <= stamp(now) ? W.past : null;
}

/** An end later than the event's is never offered: a pick past it stops at the event's end. */
export function earlierEnds(date: string, time: string): Ends {
  return stamp({ date, time }) >= stamp(endMoment({ kind: 'event' }))
    ? { kind: 'event' }
    : { kind: 'earlier', date, time };
}

export function formProblems(form: CodeForm, now = NOW): FormProblems {
  return { cap: capProblem(form.cap), ends: endsProblem(form.ends, now) };
}

export function firstProblem(problems: FormProblems): 'cap' | 'ends' | null {
  if (problems.cap != null) return 'cap';

  return problems.ends == null ? null : 'ends';
}

export function madeCode(form: CodeForm, had: readonly string[]): DoorCode {
  const code = nextCode(had);
  const job = form.job.trim();

  return {
    id: `code-${code.replace(' ', '').toLowerCase()}`,
    code,
    role: form.role,
    job: job === '' ? null : job,
    cap: Number(form.cap.trim()),
    used: 0,
    ends: form.ends,
    stopped: false,
    endedAt: null,
  };
}

export function renewed(old: DoorCode, had: readonly string[]): DoorCode {
  return madeCode(
    { role: old.role, job: old.job ?? '', cap: String(old.cap), ends: old.ends },
    had,
  );
}

/** A stopped or ended code is made again on the form, its role, job and cap kept, its end the event's. */
export function formFrom(old: DoorCode | null): CodeForm {
  return old == null
    ? { role: FIRST_CODE_ROLE, job: '', cap: '', ends: { kind: 'event' } }
    : { role: old.role, job: old.job ?? '', cap: String(old.cap), ends: { kind: 'event' } };
}

export function plainCode(typed: string): string {
  return typed.toUpperCase().replace(/[\s-]/gu, '');
}

export function joinCodeProblem(typed: string): string | null {
  const plain = plainCode(typed);
  if (plain === '') return W.codeBlank;

  return /^[A-Z0-9]+$/u.test(plain) && plain.length === JOIN_CODE_LENGTH ? null : W.codeShort;
}

export interface Redeemable {
  code: string;
  role: CodeRole;
  job: string | null;
}

export const BAR: Redeemable = {
  code: 'Q7KM 4XP2',
  role: 'Can check guests in',
  job: 'Bar and drinks',
};
export const CLOAKROOM: Redeemable = { code: 'M4TB 7KQ8', role: 'Can view', job: 'Cloakroom' };
const REDEEMABLE: readonly Redeemable[] = [BAR, CLOAKROOM];

/** Wrong, expired and stopped get one answer, as a code that never existed (sc-72). */
export function redeemed(typed: string): Redeemable | null {
  return REDEEMABLE.find((one) => plainCode(one.code) === plainCode(typed)) ?? null;
}

export const TRIES_A_MINUTE = 10;

export function eventLine(code: Redeemable, locale: string): string {
  return [dayWords(EVENT.day, locale), ORGANISATION, code.role, code.job]
    .filter((part) => part != null)
    .join(' · ');
}

export function nameProblem(name: string): string | null {
  return name.trim() === '' ? W.nameBlank : null;
}

export function numberProblem(number: string): string | null {
  switch (phoneLengthProblem(number, EVENT.country)) {
    case 'blank':
    case 'noCountry':
      return W.numberBlank;
    case 'tooShort':
      return tooShortFor(EVENT.countryName);
    case 'tooLong':
      return `That number looks too long for ${EVENT.countryName}. Check it and try again.`;
    case null:
      return null;
  }
}

const LUMEN = 'lumenfeiras.example';

export const INES: PeopleViewer = { id: `ines@${LUMEN}`, role: 'Owner' };

function member(id: string, name: string, initials: string, tone: number, role: OrgMember['role']) {
  return { id: `${id}@${LUMEN}`, name, initials, tone, role, active: true };
}

export function doorMembers(): OrgMember[] {
  return [
    member('ines', 'Inês Carvalho', 'IC', 0, 'Owner'),
    member('julien', 'Julien Moreau', 'JM', 4, 'Admin'),
    member('duarte', 'Duarte Sousa', 'DS', 1, 'Member'),
    member('rita', 'Rita Marques', 'RM', 3, 'Member'),
  ];
}

export function doorWorld(): PeopleWorld {
  return { organisation: ORGANISATION, event: EVENT.name, members: doorMembers() };
}

function onEventAs(one: OrgMember, role: EventRole): OnEvent {
  return { ...one, role, outside: false, label: null };
}

function outside(
  id: string,
  name: string,
  initials: string,
  tone: number,
  role: EventRole,
  label: string,
): OnEvent {
  return { id, name, initials, tone, role, outside: true, label };
}

/** Who came in by each code, as many as its card counts (pm, 7 Nov); Hugo Faria joins while Q7KM 4XP2 is held up. */
const CREW: readonly (readonly [string, string, string])[] = [
  ['Beatriz Santos', 'BS', '13:31'],
  ['João Pereira', 'JP', '13:34'],
  ['Miguel Costa', 'MC', '13:34'],
  ['Sofia Nunes', 'SN', '13:35'],
  ['Tiago Lopes', 'TL', '13:35'],
  ['Amara Diallo', 'AD', '13:36'],
  ['Bruno Teixeira', 'BT', '13:36'],
  ['Carla Mendes', 'CM', '13:37'],
  ['Diogo Alves', 'DA', '13:37'],
  ['Filipa Rocha', 'FR', '13:38'],
  ['Lucía Romero', 'LR', '13:38'],
  ['Mei Lin', 'ML', '13:39'],
  ['Nuno Correia', 'NC', '13:40'],
  ['Yusuf Demir', 'YD', '13:41'],
];

const CLOAK_CREW: readonly (readonly [string, string, string])[] = [
  ['Leila Haddad', 'LH', '14:02'],
  ['Pedro Gomes', 'PG', '14:03'],
  ['Rosa Lima', 'RL', '14:05'],
  ['Hana Sato', 'HS', '14:06'],
  ['Kwabena Asante', 'KA', '14:08'],
];

export const JOAO_ID = 'p-joao-pereira';

function joinerBy(by: Redeemable) {
  return ([name, initials, at]: readonly [string, string, string], index: number): OnEvent => ({
    ...outside(`p-${slug(name)}`, name, initials, index % 5, by.role, by.job ?? ''),
    byCode: { code: by.code, date: EVENT.day, time: at },
  });
}

function slug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z]+/gu, '-');
}

export const HUGO: OnEvent = {
  ...outside('p-hugo-faria', 'Hugo Faria', 'HF', 2, BAR.role, BAR.job ?? ''),
  byCode: { code: BAR.code, date: EVENT.day, time: '13:42' },
};

export function named(): OnEvent[] {
  const [, , duarte, rita] = doorMembers();
  if (duarte == null || rita == null) throw new Error('Duarte and Rita are in the sample.');

  return [
    onEventAs(duarte, 'Lead'),
    onEventAs(rita, 'Can edit'),
    outside('p-teresa-matos', 'Teresa Matos', 'TM', 2, 'Can view', 'The venue’s coordinator'),
    outside('p-kemi-okafor', 'Kemi Okafor', 'KO', 3, 'Can check guests in', 'Bar and drinks'),
  ];
}

export function crew(): OnEvent[] {
  return CREW.map(joinerBy(BAR));
}

export function cloakroomCrew(count: number): OnEvent[] {
  return CLOAK_CREW.slice(0, count).map(joinerBy(CLOAKROOM));
}

export function everyone(): OnEvent[] {
  return [...named(), ...crew()];
}

export const PEOPLE_DOOR_STATES = [
  'code-none',
  'code',
  'code-two',
  'code-full',
  'code-stopped',
  'code-expired',
  'code-made',
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
export type PeopleDoorState = (typeof PEOPLE_DOOR_STATES)[number];
export type MakeState = (typeof MAKE_STATES)[number];
export type HoldState = (typeof HOLD_STATES)[number];

export const BAR_CODE: DoorCode = {
  id: 'code-q7km4xp2',
  code: BAR.code,
  role: BAR.role,
  job: BAR.job,
  cap: 30,
  used: 14,
  ends: { kind: 'event' },
  stopped: false,
  endedAt: null,
};
const CLOAK_CODE: DoorCode = {
  id: 'code-m4tb7kq8',
  code: CLOAKROOM.code,
  role: CLOAKROOM.role,
  job: CLOAKROOM.job,
  cap: 5,
  used: 3,
  ends: { kind: 'event' },
  stopped: false,
  endedAt: null,
};

export interface MakeStart {
  form: CodeForm;
  problems: FormProblems;
  endsDraft: Ends | null;
  sending: 'idle' | 'held';
  failed: boolean;
}

export interface HoldStart {
  codeId: string;
  ask: 'new' | 'stop' | null;
  stopping: boolean;
  failed: boolean;
  joins: boolean;
}

export interface DoorStart {
  people: PeopleStart;
  codes: DoorCode[];
  had: string[];
  now: Moment;
  make: MakeStart | null;
  hold: HoldStart | null;
}

function people(onEvent: OnEvent[], more: Partial<PeopleStart> = {}): PeopleStart {
  return {
    viewer: INES,
    load: 'loaded',
    onEvent,
    roleFails: false,
    world: doorWorld(),
    ...more,
  };
}

function start(
  codes: DoorCode[],
  more: Partial<PeopleStart> = {},
  list = everyone(),
  now = ON_THE_DAY,
): DoorStart {
  return {
    people: people(list, more),
    codes,
    had: codes.map((one) => one.code),
    now,
    make: null,
    hold: null,
  };
}

function stateStart(state: PeopleDoorState): DoorStart {
  switch (state) {
    case 'code-none':
      return start([], {}, named(), NOW);
    case 'code':
      return start([BAR_CODE]);
    case 'code-two':
      return start([BAR_CODE, CLOAK_CODE], {}, [...everyone(), ...cloakroomCrew(CLOAK_CODE.used)]);
    case 'code-full':
      return start([{ ...CLOAK_CODE, used: CLOAK_CODE.cap }], {}, [
        ...named(),
        ...cloakroomCrew(CLOAK_CODE.cap),
      ]);
    case 'code-stopped':
      return start([{ ...BAR_CODE, stopped: true }]);
    case 'code-expired':
      return start(
        [
          {
            ...BAR_CODE,
            ends: { kind: 'earlier', date: EVENT.day, time: EVENT.starts },
            endedAt: EVENT.starts,
          },
        ],
        {},
        everyone(),
        AFTER_EXPIRY,
      );
    case 'code-made':
      return start([{ ...BAR_CODE, used: 0 }], { toast: W.made }, named(), NOW);
    case 'code-person':
      return start([BAR_CODE], { opened: { id: JOAO_ID, removing: null } });
    case 'code-remove':
      return start([BAR_CODE], { opened: { id: JOAO_ID, removing: 'ask' } });
    case 'code-removing':
      return start([BAR_CODE], { opened: { id: JOAO_ID, removing: 'sending' } });
    case 'code-removed':
      return start(
        [BAR_CODE],
        { toast: 'João Pereira is off this event.' },
        everyone().filter((one) => one.id !== JOAO_ID),
      );
  }
}

const TYPED: CodeForm = {
  role: FIRST_CODE_ROLE,
  job: 'Bar and drinks',
  cap: '30',
  ends: { kind: 'event' },
};

function makeStart(state: MakeState): MakeStart {
  const plain: MakeStart = {
    form: formFrom(null),
    problems: NO_PROBLEMS,
    endsDraft: null,
    sending: 'idle',
    failed: false,
  };

  switch (state) {
    case 'open':
      return plain;
    case 'blank':
      return { ...plain, problems: { cap: W.capBlank, ends: null } };
    case 'malformed':
      return {
        ...plain,
        form: { ...plain.form, job: 'Bar and drinks', cap: '3000' },
        problems: { cap: W.capRange, ends: null },
      };
    case 'ends':
      return { ...plain, endsDraft: { kind: 'earlier', date: EVENT.day, time: '18:00' } };
    case 'past': {
      const form: CodeForm = { ...TYPED, ends: { kind: 'earlier', date: NOW.date, time: '09:00' } };

      return { ...plain, form, problems: formProblems(form) };
    }
    case 'making':
      return { ...plain, form: TYPED, sending: 'held' };
    case 'failed':
      return { ...plain, form: TYPED, failed: true };
  }
}

function holdStart(state: HoldState): DoorStart {
  const shown = start([BAR_CODE]);
  const hold: HoldStart = {
    codeId: BAR_CODE.id,
    ask: null,
    stopping: false,
    failed: false,
    joins: false,
  };

  switch (state) {
    case 'open':
      return { ...shown, hold };
    case 'counted':
      return { ...shown, hold: { ...hold, joins: true } };
    case 'new-ask':
      return { ...shown, hold: { ...hold, ask: 'new' } };
    case 'new': {
      const made = renewed(BAR_CODE, [BAR_CODE.code]);

      return {
        ...shown,
        codes: [made],
        had: [BAR_CODE.code, made.code],
        hold: { ...hold, codeId: made.id },
      };
    }
    case 'stop-ask':
      return { ...shown, hold: { ...hold, ask: 'stop' } };
    case 'stopping':
      return { ...shown, hold: { ...hold, ask: 'stop', stopping: true } };
    case 'stop-failed':
      return { ...shown, hold: { ...hold, ask: 'stop', failed: true } };
  }
}

function oneOf<T extends string>(list: readonly T[], name: string | undefined): T | null {
  return list.find((one) => one === name) ?? null;
}

const OLD_NAMES: Record<string, PeopleDoorState> = { 'code-ran-out': 'code-expired' };

/** `?code=` opens Make on People with no code yet; `?show=` (once `?hold=`) shows the working code; `?state=code…` is People with its codes. */
export function doorStartOf(
  state: string | undefined,
  code: string | undefined,
  show: string | undefined,
): DoorStart | null {
  const making = oneOf(MAKE_STATES, code);
  if (making != null) return { ...stateStart('code-none'), make: makeStart(making) };
  const holding = oneOf(HOLD_STATES, show);
  if (holding != null) return holdStart(holding);
  const shown = oneOf(PEOPLE_DOOR_STATES, OLD_NAMES[state ?? ''] ?? state);

  return shown == null ? null : stateStart(shown);
}
