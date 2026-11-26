import { phoneLengthProblem } from '@soirely/domain';

export type Role = 'floor' | 'station' | 'manage';
export type Via = 'copy' | 'text';
export type System =
  'live' | 'loading' | 'empty' | 'stale' | 'refreshing' | 'partFailed' | 'unreachable' | 'notFound';

export interface Staffer {
  id: number;
  name: string;
  phone: string;
  job: string;
  station: string;
  /** Minutes from Saturday 00:00, so 26:00 is 02:00 on Sunday. */
  start: number;
  end: number;
  here: boolean;
  inAt?: number;
  outAt?: number;
  walkOn?: boolean;
  addedBy?: number;
  movedFrom?: { station: string; at: number };
  coveredBy?: number;
}

export interface DoorForm {
  name: string;
  country: string;
  number: string;
  job: string | null;
  station: string | null;
  tried: boolean;
  busy: boolean;
  failed: boolean;
  refused: boolean;
}

export interface MobileForm {
  country: string;
  number: string;
  tried: boolean;
  busy: boolean;
}

export type Sheet =
  | { kind: 'door'; form: DoorForm }
  | { kind: 'cover'; target: number; chosen: number | null; tried: boolean }
  | { kind: 'noLink'; id: number }
  | { kind: 'hasLink'; id: number; via: Via; again: boolean }
  | { kind: 'mobile'; id: number; form: MobileForm };

export type Toast = { kind: 'moved'; id: number; from: string } | { kind: 'in'; id: number };

export interface WhState {
  list: Staffer[];
  role: Role;
  clock: number;
  eventEnd: number;
  ended: boolean;
  sheet: Sheet | null;
  opener: string;
  toast: Toast | null;
  system: System;
  epic36: boolean;
  failNext: boolean;
}

export const at = (h: number, m = 0): number => h * 60 + m;

/** 24-hour; the build takes {time} from Intl. */
export function time(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const EVENT = 'Adébáyọ̀ at 60';
export const DOORS = 'Doors 19:00';
export const COUNTRY = 'NG';
export const LEAD = { id: 5, station: 'Section A · T1–T6' };
export const FLOOR_LEAD = 1;
export const WALK_ON = 'Oluwafunmilayo Adébáyọ̀-Bankole';
export const WALK_ON_ID = 90;
export const WALK_ON_PHONE = '+234 803 555 0144';

/** Every job on the event (sc-3908), those with no shift tonight too (pm, 31 Oct). On the sample, Door has none. */
export const JOBS: readonly string[] = [
  'Bar',
  'Door',
  'Floor lead',
  'Front of house',
  'Kitchen',
  'MC',
  'Runner',
  'Security',
  'Sound',
  'Waiter',
];

export const STATIONS: readonly string[] = [
  'Door',
  'Section A · T1–T6',
  'Section B · T7–T12',
  'Section C · T13–T18',
  'Pass',
  'Bar',
  'Kitchen',
  'Stage',
  'Floor lead',
];

const one = (
  id: number,
  name: string,
  phone: string,
  job: string,
  station: string,
  start: number,
  end: number,
  inAt?: number,
): Staffer => ({
  id,
  name,
  phone,
  job,
  station,
  start,
  end,
  here: inAt != null,
  ...(inAt == null ? {} : { inAt }),
});

function sample(): Staffer[] {
  return [
    one(1, 'Dayo Okafor', '+234 803 555 0101', 'Floor lead', 'Floor lead', at(14), at(26), at(14)),
    one(
      2,
      'Bisi Adeyemi',
      '+234 803 555 0102',
      'Front of house',
      'Door',
      at(16),
      at(23),
      at(15, 55),
    ),
    one(3, 'Chidi Okoro', '+234 802 555 0177', 'Kitchen', 'Kitchen', at(13), at(24), at(13, 5)),
    one(4, 'Tope Bello', '+234 805 555 0190', 'Waiter', 'Section B · T7–T12', at(17), at(25)),
    one(5, 'Grace Okon', '+234 806 555 0203', 'Waiter', LEAD.station, at(17), at(25), at(16, 50)),
    one(6, 'Yusuf Bello', '+234 807 555 0204', 'Waiter', 'Section C · T13–T18', at(17), at(25)),
    one(7, 'Amina Yusuf', '+234 808 555 0205', 'Runner', 'Pass', at(18), at(25)),
    one(8, 'Kelechi Nnamdi', '+234 809 555 0206', 'Runner', 'Pass', at(18), at(25), at(17, 40)),
    one(9, 'Funmi Alabi', '+234 810 555 0207', 'Bar', 'Bar', at(17), at(26), at(16, 58)),
    one(10, 'Ibrahim Musa', '+234 811 555 0208', 'Bar', 'Bar', at(19), at(26)),
    one(11, 'Joy Okoro', '+234 812 555 0209', 'Waiter', LEAD.station, at(17), at(25)),
    one(12, 'Samuel Okafor', '+234 813 555 0210', 'Security', 'Door', at(16), at(26), at(15, 50)),
    one(13, 'Tunde Adebayo', '+234 814 555 0211', 'MC', 'Stage', at(18), at(23), at(17, 30)),
    one(14, 'Peter Eze', '+234 815 555 0212', 'Sound', 'Stage', at(15), at(24), at(14, 45)),
    one(15, 'Ngozi Eze', '', 'Waiter', 'Section C · T13–T18', at(18), at(25)),
  ];
}

export const STATE_NAMES = [
  'populated',
  'clocked_in',
  'covered',
  'cover',
  'cover_selected',
  'cover_none_selected',
  'cover_nobody_here',
  'cover_nobody_to_move',
  'not_here_empty',
  'here_empty',
  'station_lead',
  'row_add_mobile_manage',
  'row_add_mobile_walk_on_lead',
  'row_add_mobile_station_lead',
  'row_number_added',
  'door_blank',
  'door_number',
  'door_job_shift_end',
  'door_job_no_shift_event_end',
  'door_job_no_shift_24h',
  'door_mobile_too_short',
  'door_mobile_too_long',
  'door_failed',
  'door_copied',
  'door_texted',
  'door_no_link_add_mobile',
  'door_station_lead',
  'door_station_lead_no_link',
  'add_mobile',
  'add_mobile_blank',
  'add_mobile_too_short',
  'add_mobile_copied',
  'add_mobile_texted',
  'didnt_clock_in',
  'event_ended',
  'door_refused_event_ended',
  'loading',
  'empty',
  'refreshing',
  'stale',
  'part_failed',
  'unreachable',
  'not_found',
] as const;

export type WhStateName = (typeof STATE_NAMES)[number];

export function whStateOf(raw: string | undefined): WhStateName {
  return (STATE_NAMES as readonly string[]).includes(raw ?? '')
    ? (raw as WhStateName)
    : 'populated';
}

export function blankDoor(): DoorForm {
  return {
    name: '',
    country: COUNTRY,
    number: '',
    job: null,
    station: null,
    tried: false,
    busy: false,
    failed: false,
    refused: false,
  };
}

export function blankMobile(): MobileForm {
  return { country: COUNTRY, number: '', tried: false, busy: false };
}

const SYSTEM: Partial<Record<WhStateName, System>> = {
  loading: 'loading',
  empty: 'empty',
  refreshing: 'refreshing',
  stale: 'stale',
  part_failed: 'partFailed',
  unreachable: 'unreachable',
  not_found: 'notFound',
};

const ROLE: Partial<Record<WhStateName, Role>> = {
  station_lead: 'station',
  door_station_lead: 'station',
  door_station_lead_no_link: 'station',
  row_add_mobile_station_lead: 'station',
  row_add_mobile_manage: 'manage',
};

export function seed(k: WhStateName): WhState {
  const list = sample();
  const person = (id: number) => list.find((p) => p.id === id) as Staffer;
  const role = ROLE[k] ?? 'floor';
  const s: WhState = {
    list,
    role,
    clock: at(18, 5),
    eventEnd: at(26),
    ended: false,
    sheet: null,
    opener: 'door',
    toast: null,
    system: SYSTEM[k] ?? 'live',
    epic36: k === 'door_texted' || k === 'add_mobile_texted',
    failNext: k === 'door_failed',
  };
  const walkOn = (phone: string): Staffer => ({
    id: WALK_ON_ID,
    name: WALK_ON,
    phone,
    job: 'Waiter',
    station: role === 'station' ? LEAD.station : 'Section B · T7–T12',
    start: s.clock,
    end: at(25),
    here: false,
    walkOn: true,
    addedBy: role === 'station' ? LEAD.id : FLOOR_LEAD,
  });
  const door = (o: Partial<DoorForm>): Sheet => ({ kind: 'door', form: { ...blankDoor(), ...o } });
  const filled = { name: WALK_ON, job: 'Waiter', station: 'Section B · T7–T12' };

  switch (k) {
    case 'covered':
      person(5).station = 'Section B · T7–T12';
      person(5).movedFrom = { station: LEAD.station, at: at(18, 4) };
      person(4).coveredBy = 5;
      s.toast = { kind: 'moved', id: 5, from: LEAD.station };
      break;
    case 'clocked_in':
      person(7).here = true;
      person(7).inAt = at(18, 6);
      s.toast = { kind: 'in', id: 7 };
      break;
    case 'cover':
    case 'cover_selected':
    case 'cover_none_selected':
      s.sheet = {
        kind: 'cover',
        target: 4,
        chosen: k === 'cover_selected' ? 5 : null,
        tried: k === 'cover_none_selected',
      };
      s.opener = 'cover|4';
      break;
    case 'cover_nobody_here':
      list.forEach((p) => {
        p.here = false;
      });
      s.sheet = { kind: 'cover', target: 4, chosen: null, tried: false };
      s.opener = 'cover|4';
      break;
    case 'cover_nobody_to_move':
      list.forEach((p) => {
        p.here = p.id === LEAD.id;
      });
      s.sheet = { kind: 'cover', target: 11, chosen: null, tried: false };
      s.opener = 'cover|11';
      break;
    case 'not_here_empty':
      list.forEach((p) => {
        if (!p.here && p.start <= s.clock + 15) {
          p.here = true;
          p.inAt = Math.min(p.start, s.clock) - 5;
        }
      });
      break;
    case 'here_empty':
      list.forEach((p) => {
        p.here = false;
      });
      break;
    case 'row_add_mobile_walk_on_lead':
    case 'row_add_mobile_station_lead':
      list.push(walkOn(''));
      break;
    case 'row_number_added':
      list.push(walkOn(WALK_ON_PHONE));
      break;
    case 'door_blank':
      s.sheet = door({ tried: true });
      break;
    case 'door_number':
      s.sheet = door({ ...filled, number: '803 555 0144' });
      break;
    case 'door_job_shift_end':
      s.sheet = door(filled);
      break;
    case 'door_job_no_shift_event_end':
      s.sheet = door({ name: WALK_ON, job: 'Door', station: 'Door' });
      break;
    case 'door_job_no_shift_24h':
      s.eventEnd = at(50);
      s.sheet = door({ name: WALK_ON, job: 'Door', station: 'Door' });
      break;
    case 'door_mobile_too_short':
      s.sheet = door({ ...filled, number: '803 555 01', tried: true });
      break;
    case 'door_mobile_too_long':
      s.sheet = door({ ...filled, number: '803 555 0144 99999', tried: true });
      break;
    case 'door_failed':
      s.sheet = door({ ...filled, tried: true, failed: true });
      s.failNext = false;
      break;
    case 'door_station_lead':
      s.sheet = door({ name: WALK_ON, job: 'Waiter' });
      break;
    case 'door_no_link_add_mobile':
    case 'door_station_lead_no_link':
      list.push(walkOn(''));
      s.sheet = { kind: 'noLink', id: WALK_ON_ID };
      break;
    case 'door_copied':
    case 'door_texted':
    case 'add_mobile_copied':
    case 'add_mobile_texted':
      list.push(walkOn(WALK_ON_PHONE));
      s.sheet = {
        kind: 'hasLink',
        id: WALK_ON_ID,
        via: k.endsWith('texted') ? 'text' : 'copy',
        again: false,
      };
      break;
    case 'add_mobile':
    case 'add_mobile_blank':
    case 'add_mobile_too_short':
      list.push(walkOn(''));
      s.sheet = {
        kind: 'mobile',
        id: WALK_ON_ID,
        form: {
          ...blankMobile(),
          number: k === 'add_mobile_too_short' ? '803 555 01' : '',
          tried: k !== 'add_mobile',
        },
      };
      break;
    case 'didnt_clock_in':
      s.clock = at(25, 10);
      for (const [id, out] of [
        [2, at(23, 5)],
        [3, at(24, 5)],
        [5, at(25, 3)],
        [8, at(25, 4)],
        [13, at(23)],
        [14, at(24, 2)],
      ] as const)
        person(id).outAt = out;
      person(7).here = true;
      person(7).inAt = at(18, 12);
      person(7).outAt = at(25, 2);
      person(10).here = true;
      person(10).inAt = at(18, 58);
      break;
    case 'event_ended':
      s.ended = true;
      break;
    case 'door_refused_event_ended':
      s.ended = true;
      s.sheet = door({ ...filled, number: '803 555 0144', tried: true, refused: true });
      break;
    default:
      break;
  }

  return s;
}

export const byId = (s: WhState, id: number): Staffer | undefined =>
  s.list.find((p) => p.id === id);

const hereNow = (s: WhState, p: Staffer): boolean =>
  p.here && !(p.outAt != null && p.outAt <= s.clock);

export const allHere = (s: WhState): Staffer[] => s.list.filter((p) => hereNow(s, p));

export const onStation = (s: WhState, station: string): Staffer[] =>
  allHere(s).filter((p) => p.station === station);

const scope = (s: WhState): Staffer[] =>
  s.role === 'station' ? s.list.filter((p) => p.station === LEAD.station) : s.list;

const viewer = (s: WhState): number =>
  s.role === 'station' ? LEAD.id : s.role === 'floor' ? FLOOR_LEAD : 0;

export interface NotHereRow {
  p: Staffer;
  coveredBy: string | null;
  nobody: boolean;
  canCover: boolean;
  canAddMobile: boolean;
}

export function notHere(s: WhState): NotHereRow[] {
  return scope(s)
    .filter((p) => !p.here && p.start <= s.clock + 15 && p.end > s.clock)
    .sort((a, b) => a.start - b.start || a.name.localeCompare(b.name))
    .map((p) => {
      const cover =
        p.coveredBy == null
          ? undefined
          : allHere(s).find((q) => q.id === p.coveredBy && q.station === p.station);
      return {
        p,
        coveredBy: cover?.name ?? null,
        nobody: cover == null && onStation(s, p.station).length === 0,
        canCover: s.role !== 'station',
        canAddMobile: canAddMobile(s, p),
      };
    });
}

/** staff.manage on any row; the lead who added a walk-on on that walk-on's row only (pm, 31 Oct). */
export function canAddMobile(s: WhState, p: Staffer): boolean {
  if (p.phone !== '') return false;
  return s.role === 'manage' || (p.walkOn === true && p.addedBy === viewer(s));
}

export function here(s: WhState): Staffer[] {
  return scope(s)
    .filter((p) => hereNow(s, p))
    .sort((a, b) => (b.inAt ?? 0) - (a.inAt ?? 0));
}

export function didntClockIn(s: WhState): Staffer[] {
  return scope(s)
    .filter((p) => !p.here && p.end <= s.clock)
    .sort((a, b) => a.start - b.start || a.name.localeCompare(b.name));
}

export function stationsTonight(s: WhState): { station: string; people: string[] }[] {
  return STATIONS.map((station) => ({
    station,
    people: onStation(s, station).map((p) => p.name),
  }));
}

export function andList(names: readonly string[]): string {
  if (names.length < 2) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export const dueBy = (s: WhState): string => time(s.clock + 15);

export type JobEnd = { kind: 'shift' | 'event' | 'day'; end: number };

/** The walk-on's end (pm, 31 Oct): the latest end among that job's shifts in the next 24 hours; with none, the event's end, or 24 hours from now if that is sooner. */
export function jobEnd(s: WhState, job: string): JobEnd {
  let end: number | null = null;
  for (const p of s.list)
    if (p.job === job && p.end > s.clock && p.end <= s.clock + 1440 && (end == null || p.end > end))
      end = p.end;
  if (end != null) return { kind: 'shift', end };
  return s.eventEnd <= s.clock + 1440
    ? { kind: 'event', end: s.eventEnd }
    : { kind: 'day', end: s.clock + 1440 };
}

export function jobLine(job: string, e: JobEnd): string {
  if (e.kind === 'shift')
    return `${job} shifts end at ${time(e.end)}. Theirs runs from now until then.`;
  if (e.kind === 'event')
    return `${job} has no shift tonight. Theirs runs from now until the event ends at ${time(e.end)}.`;
  return `${job} has no shift tonight. Theirs runs for 24 hours, until ${time(e.end)} tomorrow.`;
}

export const W = {
  title: 'Who’s here',
  door: 'Someone’s at the door',
  live: (t: string) => `Live · updated ${t}`,
  stale: (t: string) => `Not live · last updated ${t}. Reconnecting.`,
  refreshing: 'Refreshing…',
  notHere: (n: number) => `Not here yet (${n})`,
  notHereEmpty: (t: string) => `Everyone due by ${t} has clocked in.`,
  here: (n: number) => `Here (${n})`,
  hereEmpty: 'Nobody has clocked in yet.',
  didnt: (n: number) => `Didn’t clock in (${n})`,
  hoursWorked: 'Hours worked',
  stations: 'Stations tonight',
  nobodyOn: (st: string) => `Nobody on ${st}`,
  nobodyHereOn: (st: string) => `Nobody here on ${st}`,
  coveredBy: (n: string) => `Covered by ${n}`,
  cover: (st: string) => `Cover ${st}`,
  call: 'Call',
  noNumber: 'No number',
  addMobile: 'Add a mobile number',
  shift: (p: Staffer) => `Shift ${time(p.start)} – ${time(p.end)}`,
  clockedInAt: (t: string) => `Clocked in at ${t}`,
  movedFrom: (st: string, t: string) => `Moved from ${st} at ${t}`,
  partFailed: 'The list of who is here did not load. Check your connection and try again.',
  tryAgain: 'Try again',
  loading: 'Loading the staff…',
  unreachableTitle: 'Cannot reach Soirely',
  unreachable:
    'You are still signed in. Soirely is not answering, so nothing can load yet. Check your connection, then try again.',
  notFound: 'This event is not available',
  backToEvents: 'Back to Events',
  empty: 'Nobody on the staff yet',
  name: 'Name',
  nameBlank: 'Enter their name.',
  mobile: 'Mobile',
  optional: 'Optional',
  country: 'Country',
  job: 'Job',
  jobBlank: 'Choose their job.',
  where: 'Where do you need them?',
  whereBlank: 'Choose where you need them.',
  failed: (n: string) => `Nothing was changed. ${n} was not added. Try again.`,
  refused: 'The event has ended, so nobody can be added.',
  close: 'Close',
  done: 'Done',
  added: (n: string) => `${n} added to the roster.`,
  noLink: (n: string) => `${n} has no link. Add a mobile number to send one.`,
  hasLink: (n: string) => `${n} has a link`,
  copied: (num: string) =>
    `Their link is copied. Send it to them however you can. They sign in with one code sent to ${num}.`,
  copyAgain: 'Copy the link again',
  copiedAgain: 'Link copied.',
  texted: (num: string) => `Link texted to ${num}. They sign in with one code sent to that number.`,
  forOnly: (n: string) => `For ${n} only. They sign in with one code sent to this number.`,
  mobileBlank: 'Enter their mobile number.',
  coverLine: (p: Staffer) => `${p.name} · ${p.job} · ${W.shift(p)}`,
  onStation: (st: string) => `On ${st}`,
  leaves: (st: string) => `Leaves ${st} with nobody here`,
  choose: (st: string) => `Choose who covers ${st}.`,
  moveTo: (st: string, n: string | null) => (n == null ? `Move to ${st}` : `Move ${n} to ${st}`),
  nobodyClockedIn: 'Nobody has clocked in yet.',
  allOnIt: (st: string) => `Everyone here is already on ${st}.`,
};

export function tooShort(country: string): string {
  return `That number looks too short for ${country}. Check it and try again.`;
}

export function tooLong(country: string): string {
  return `That number looks too long for ${country}. Check it and try again.`;
}

export function numberProblem(
  number: string,
  country: string,
  countryName: string,
  required: boolean,
): string | null {
  switch (phoneLengthProblem(number, country)) {
    case 'blank':
    case 'noCountry':
      return required ? W.mobileBlank : null;
    case 'tooShort':
      return tooShort(countryName);
    case 'tooLong':
      return tooLong(countryName);
    case null:
      return null;
  }
}

export interface DoorProblems {
  name: string | null;
  number: string | null;
  job: string | null;
  station: string | null;
}

export function doorProblems(s: WhState, f: DoorForm, countryName: string): DoorProblems {
  return {
    name: f.name.trim() === '' ? W.nameBlank : null,
    number: numberProblem(f.number, f.country, countryName, false),
    job: f.job == null ? W.jobBlank : null,
    station: s.role !== 'station' && f.station == null ? W.whereBlank : null,
  };
}

export type DoorField = keyof DoorProblems;

export function firstProblem(p: DoorProblems): DoorField | null {
  return (['name', 'number', 'job', 'station'] as const).find((k) => p[k] != null) ?? null;
}

export function doorLabel(s: WhState, f: DoorForm): string {
  if (f.busy) return 'Adding…';
  if (f.number.trim() === '') return 'Add';
  return s.epic36 ? 'Add and text the link' : 'Add and copy the link';
}

export function shown(dial: string, number: string): string {
  const d = number.replace(/\D/g, '').replace(/^0/, '');
  return `${dial} ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`.trim();
}

export function openDoor(s: WhState): WhState {
  return { ...s, sheet: { kind: 'door', form: blankDoor() }, opener: 'door' };
}

export function openCover(s: WhState, target: number): WhState {
  return {
    ...s,
    sheet: { kind: 'cover', target, chosen: null, tried: false },
    opener: `cover|${target}`,
  };
}

export function openMobile(s: WhState, id: number, fromRow: boolean): WhState {
  return {
    ...s,
    sheet: { kind: 'mobile', id, form: blankMobile() },
    opener: fromRow ? `mobile|${id}` : s.opener,
  };
}

export function closeSheet(s: WhState): WhState {
  const m = /^mobile\|(\d+)$/.exec(s.opener);
  const person = m == null ? undefined : byId(s, Number(m[1]));
  const opener = person != null && person.phone !== '' ? `call|${person.id}` : s.opener;
  return { ...s, sheet: null, opener };
}

export function setDoor(s: WhState, patch: Partial<DoorForm>): WhState {
  if (s.sheet?.kind !== 'door') return s;
  return { ...s, sheet: { kind: 'door', form: { ...s.sheet.form, ...patch } } };
}

export function setMobile(s: WhState, patch: Partial<MobileForm>): WhState {
  if (s.sheet?.kind !== 'mobile') return s;
  return { ...s, sheet: { ...s.sheet, form: { ...s.sheet.form, ...patch } } };
}

/** What Add answers once its wait is over: refused once the event has ended (409 event_concluded), failed once, or added. */
export function doorAnswer(s: WhState, dial: string): WhState {
  if (s.sheet?.kind !== 'door') return s;
  const f = s.sheet.form;
  if (s.ended) return setDoor(s, { busy: false, failed: false, refused: true });
  if (s.failNext) return { ...setDoor(s, { busy: false, failed: true }), failNext: false };
  const id = Math.max(...s.list.map((p) => p.id)) + 1;
  const phone = f.number.trim() === '' ? '' : shown(dial, f.number);
  const job = f.job ?? '';
  const station = s.role === 'station' ? LEAD.station : (f.station ?? '');
  const p: Staffer = {
    id,
    name: f.name.trim(),
    phone,
    job,
    station,
    start: s.clock,
    end: jobEnd(s, job).end,
    here: false,
    walkOn: true,
    addedBy: viewer(s),
  };
  return {
    ...s,
    list: [...s.list, p],
    sheet:
      phone === ''
        ? { kind: 'noLink', id }
        : { kind: 'hasLink', id, via: s.epic36 ? 'text' : 'copy', again: false },
  };
}

export function mobileAnswer(s: WhState, dial: string): WhState {
  if (s.sheet?.kind !== 'mobile') return s;
  const { id, form } = s.sheet;
  const phone = shown(dial, form.number);
  return {
    ...s,
    list: s.list.map((p) => (p.id === id ? { ...p, phone } : p)),
    sheet: { kind: 'hasLink', id, via: s.epic36 ? 'text' : 'copy', again: false },
  };
}

export function coverCandidates(s: WhState, station: string): Staffer[] {
  return allHere(s)
    .filter((p) => p.station !== station)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function choose(s: WhState, id: number): WhState {
  if (s.sheet?.kind !== 'cover') return s;
  return { ...s, sheet: { ...s.sheet, chosen: id, tried: false } };
}

export function moveChosen(s: WhState): WhState {
  if (s.sheet?.kind !== 'cover') return s;
  const { target, chosen } = s.sheet;
  const t = byId(s, target);
  const mover = chosen == null ? undefined : byId(s, chosen);
  if (t == null) return s;
  if (mover == null) return { ...s, sheet: { ...s.sheet, tried: true } };
  const from = mover.station;
  return {
    ...s,
    list: s.list.map((q) =>
      q.id === mover.id
        ? { ...q, station: t.station, movedFrom: { station: from, at: s.clock } }
        : q.id === t.id
          ? { ...q, coveredBy: mover.id }
          : q,
    ),
    sheet: null,
    toast: { kind: 'moved', id: mover.id, from },
  };
}

export function toastWords(s: WhState): string {
  const o = s.toast;
  if (o == null) return '';
  const p = byId(s, o.id);
  if (p == null) return '';
  if (o.kind === 'in') return `${p.name} clocked in at ${time(p.inAt ?? s.clock)}.`;
  const left = onStation(s, o.from).map((q) => q.name);
  const rest =
    left.length === 0
      ? `${W.nobodyOn(o.from)}.`
      : `${andList(left)} ${left.length > 1 ? 'are' : 'is'} on ${o.from}.`;
  return `${p.name} is on ${p.station}. ${rest}`;
}

/** Someone's at the door is left out once the event has ended, but stays beside the refused sheet until Close. */
export function showsDoor(s: WhState): boolean {
  if (
    s.system !== 'live' &&
    s.system !== 'empty' &&
    s.system !== 'refreshing' &&
    s.system !== 'stale' &&
    s.system !== 'partFailed'
  )
    return false;
  return !s.ended || (s.sheet?.kind === 'door' && s.sheet.form.refused);
}

export function clockIn(s: WhState): WhState {
  const next = notHere(s)[0]?.p;
  if (next == null) return s;
  return {
    ...s,
    list: s.list.map((p) => (p.id === next.id ? { ...p, here: true, inAt: s.clock } : p)),
    toast: { kind: 'in', id: next.id },
  };
}
