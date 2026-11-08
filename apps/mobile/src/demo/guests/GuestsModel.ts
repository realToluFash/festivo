import { emailProblem, phoneLengthProblem } from '@soirely/domain';

import { folded } from '../events/EventsModel.ts';
import {
  ARRIVALS,
  CLOCKS,
  COLLEAGUE,
  COUNTS,
  DRAFT_COUNTS,
  DRAFT_GUESTS,
  FIRST_ROWS,
  FROM_CONTACTS_ADDED,
  GUESTS,
  PAUSED_COUNTS,
  PAUSED_GUESTS,
  PLAN,
  READER,
  TODAY,
  WALK_IN,
  type Companion,
  type GuestLanguage,
  type SampleGuest,
  WEDDING,
  replyByOf,
} from './GuestsSample.ts';
import { REPLY_WORD, type ReplyKind, W, say } from './GuestsWords.ts';

export const LIST_STATES = [
  'first',
  'inUse',
  'filterOpen',
  'filtered',
  'search',
  'searchNone',
  'filterNone',
  'loading',
  'failed',
  'offline',
  'viewer',
  'draft',
  'paused',
  'onTheDay',
  'secondDay',
  'staffBefore',
  'staffDayBefore',
  'staffDoorOpen',
  'contactsAdded',
] as const;

export const GUEST_STATES = [
  'guest',
  'guestComing',
  'recorded',
  'notYetInvited',
  'guestViewer',
  'guestLoading',
  'notFound',
  'repliesClosed',
  'reopened',
  'saved',
  'linkCopied',
  'replaceAsk',
  'replaced',
  'notReplaced',
  'markAsInvited',
  'markRefused',
  'marked',
  'markNotSaved',
  'languageNotSet',
  'languageSet',
  'languageGuestChose',
] as const;

export const EDIT_STATES = [
  'edit',
  'editErrors',
  'editDuplicate',
  'editCompanions',
  'editMax',
  'editSeated',
  'editDiscard',
  'edit412',
  'editNotSaved',
  'editOffline',
  'languageEdit',
] as const;

export const RECORD_STATES = [
  'record',
  'recordRefused',
  'recordComing',
  'recordReplace',
  'recordNotSaved',
] as const;

export const ADD_STATES = [
  'add',
  'addRefused',
  'addDuplicate',
  'added',
  'addNotAdded',
  'addOffline',
  'picker',
  'androidPick',
  'androidNone',
  'androidRefused',
  'languageAdd',
] as const;

export const REVIEW_STATES = [
  'review',
  'reviewPressed',
  'chooseNumber',
  'roomLeft',
  'overLimit',
  'overLimitAsk',
  'ownerAsked',
  'limitRefused',
  'adding',
  'contactsFailed',
  'contactsOffline',
  'contactsDiscard',
  'allRemoved',
  'over250',
] as const;

/** The plan-limit states (sc-7579, sc-3930), drawn on Ireti at 40 as if Ire Events were on Free. */
export const PLAN_STATES = [
  'roomLeft',
  'overLimit',
  'overLimitAsk',
  'ownerAsked',
  'limitRefused',
] as const;
/** Past the limit: before pressing, refused, and for someone who can't change the plan. */
export const OVER_LIMIT_STATES = [
  'overLimit',
  'overLimitAsk',
  'ownerAsked',
  'limitRefused',
] as const;
/** Someone who can't change the plan: Ask an owner in the plan line's place. */
export const ASK_OWNER_STATES = ['overLimitAsk', 'ownerAsked'] as const;

export const OVERVIEW_STATES = [
  'overview',
  'overviewLoading',
  'overviewFailed',
  'overviewNone',
  'overviewViewer',
] as const;

export const GUESTS_STATES = [
  ...LIST_STATES,
  ...GUEST_STATES,
  ...EDIT_STATES,
  ...RECORD_STATES,
  ...ADD_STATES,
  ...REVIEW_STATES,
  ...OVERVIEW_STATES,
] as const;

export type GuestsState = (typeof GUESTS_STATES)[number];
export type ListState = (typeof LIST_STATES)[number];
export type OverviewState = (typeof OVERVIEW_STATES)[number];
export type EditState = (typeof EDIT_STATES)[number];
export type RecordState = (typeof RECORD_STATES)[number];
export type AddState = (typeof ADD_STATES)[number];
export type ReviewState = (typeof REVIEW_STATES)[number];

export const DOOR_STATES = [
  'door',
  'doorSearch',
  'doorArrived',
  'doorUndone',
  'doorNoMatch',
  'walkIn',
  'walkInBlank',
  'walkInDuplicate',
  'walkInAdded',
  'notRecorded',
  'beforeOpen',
  'ended',
  'doorEmpty',
] as const;

export type DoorState = (typeof DOOR_STATES)[number];

function one<T extends string>(states: readonly T[], value: string | null | undefined): T | null {
  return states.find((state) => state === value) ?? null;
}

export const guestsStateOf = (value: string | undefined) => one(GUESTS_STATES, value);
export const doorStateOf = (value: string | undefined) => one(DOOR_STATES, value);

export function isIn<T extends string>(states: readonly T[], state: string | null): state is T {
  return state != null && (states as readonly string[]).includes(state);
}

export type Role = 'owner' | 'viewer' | 'staff';

export function roleOf(state: GuestsState | null): Role {
  if (state === 'viewer' || state === 'guestViewer' || state === 'overviewViewer') return 'viewer';
  if (state === 'staffBefore' || state === 'staffDayBefore' || state === 'staffDoorOpen')
    return 'staff';
  return 'owner';
}

/** The states that open on an event's own sample, and that event: the one table they all read. */
const OWN_SAMPLE = { draft: 'evt-draft-4', paused: 'evt-party-2' } as const;
type OwnState = keyof typeof OWN_SAMPLE;

function ownStateOf(event: string): OwnState | null {
  return (Object.keys(OWN_SAMPLE) as OwnState[]).find((key) => OWN_SAMPLE[key] === event) ?? null;
}

export function eventOf(state: GuestsState | null): string {
  if (state === 'draft' || state === 'paused') return OWN_SAMPLE[state];
  if (isIn(PLAN_STATES, state)) return PLAN.ireti;
  return WEDDING;
}

export function clockOf(state: GuestsState | DoorState | null): Date {
  switch (state) {
    case 'onTheDay':
      return new Date(CLOCKS.onTheDay);
    case 'secondDay':
      return new Date(CLOCKS.secondDay);
    case 'staffDayBefore':
      return new Date(CLOCKS.staffEarly);
    case 'staffDoorOpen':
      return new Date(CLOCKS.staffOpen);
    case 'beforeOpen':
      return new Date(CLOCKS.beforeOpen);
    case 'ended':
      return new Date(CLOCKS.ended);
    default:
      return new Date(state != null && isIn(DOOR_STATES, state) ? CLOCKS.onTheDay : CLOCKS.reader);
  }
}

/** Edit's companions as saved: each field keeps its own companion's reply, seat and meal; a new one comes as its guest does (sc-3773). */
export function companionsAfterEdit(
  names: readonly string[],
  seats: readonly (Companion | null)[],
  guestKind: SampleGuest['kind'],
): Companion[] {
  return names.map((name, at) => ({
    ...seats[at],
    name,
    kind: seats[at]?.kind ?? (guestKind === 'coming' ? 'coming' : 'held'),
  }));
}

export function dayWords(day: string, locale: string, weekday = false): string {
  return new Intl.DateTimeFormat(locale, {
    ...(weekday ? { weekday: 'short' } : {}),
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00Z`));
}

export interface Counts {
  list: number;
  notyet: number;
  invited: number;
  coming: number;
  maybe: number;
  noreply: number;
  held: number;
  notcoming: number;
  /** Everyone without an answer of their own: the guests with no reply and the companions held behind them. */
  havent: number;
  walkin: number;
}

type Tally = Record<ReplyKind | 'walkin', number> & { behind: number };

function tally(guests: readonly SampleGuest[]): Tally {
  const out: Tally = {
    coming: 0,
    maybe: 0,
    notcoming: 0,
    held: 0,
    noreply: 0,
    notyet: 0,
    walkin: 0,
    behind: 0,
  };
  for (const g of guests) {
    out[g.kind] += 1;
    for (const c of g.companions) {
      out[c.kind] += 1;
      if (c.kind === 'held' && g.kind === 'noreply') out.behind += 1;
    }
  }
  return out;
}

const BASE = tally(GUESTS);

export function countsOf(guests: readonly SampleGuest[], added = 0): Counts {
  const now = tally(guests);
  const moved = (kind: ReplyKind) => COUNTS[kind] + now[kind] - BASE[kind];
  const notyet = moved('notyet') + added;
  const invited =
    moved('coming') + moved('maybe') + moved('noreply') + moved('held') + moved('notcoming');

  return {
    list: invited + notyet + now.walkin,
    notyet,
    invited,
    walkin: now.walkin,
    coming: moved('coming'),
    maybe: moved('maybe'),
    noreply: moved('noreply'),
    held: moved('held'),
    notcoming: moved('notcoming'),
    havent: moved('noreply') + COUNTS.heldBehindNoReply + now.behind - BASE.behind,
  };
}

export function countsFrom(guests: readonly SampleGuest[]): Counts {
  const t = tally(guests);
  const invited = t.coming + t.maybe + t.noreply + t.held + t.notcoming;
  return { ...t, list: invited + t.notyet + t.walkin, invited, havent: t.noreply + t.behind };
}

export type FilterKey = 'all' | 'invited' | ReplyKind | 'walkin';

export const FILTERS: readonly FilterKey[] = [
  'all',
  'invited',
  'coming',
  'maybe',
  'noreply',
  'held',
  'notcoming',
  'notyet',
];

export function filtersFor(counts: Counts): FilterKey[] {
  return counts.walkin > 0
    ? FILTERS.flatMap((key) => (key === 'coming' ? [key, 'walkin'] : [key]))
    : [...FILTERS];
}

export function filterWord(key: FilterKey): string {
  if (key === 'all') return 'All';
  if (key === 'invited') return W.invited;
  return REPLY_WORD[key];
}

export function filterCount(key: FilterKey, counts: Counts): number {
  return key === 'all' ? counts.list : counts[key];
}

export const GROUPS = ['coming', 'maybe', 'noreply', 'notcoming', 'notyet'] as const;
export type GroupKey = (typeof GROUPS)[number];

const SHOW_ALL_WORDS: Record<GroupKey, string> = {
  coming: 'coming',
  maybe: 'not sure yet',
  noreply: 'with no reply',
  notcoming: 'not coming',
  notyet: 'not yet invited',
};

export function showAllWords(group: GroupKey, count: number): string {
  return say.showAll(count, SHOW_ALL_WORDS[group]);
}

export interface Person {
  key: string;
  guest: string;
  name: string;
  kind: SampleGuest['kind'];
  line: string;
  companion: boolean;
}

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function invitedWords(g: SampleGuest, locale: string): string {
  if (g.invited == null) return REPLY_WORD.notyet;
  const when = dayWords(g.invited.day, locale);
  return g.invited.how == null
    ? `Invited by ${g.invited.by}, ${when}`
    : say.invitedBy(g.invited.by, g.invited.how, when);
}

export function joined(parts: readonly (string | null | undefined)[]): string {
  return parts.filter((part): part is string => part != null && part !== '').join(' · ');
}

/** A reply as its word and what follows it; sc-3780: Not sure yet is asked to decide by the Reply by date. */
export function replyParts(
  g: SampleGuest,
  locale: string,
  replyBy: string | null,
  short = false,
): { word: string; detail: string | null } {
  const word = REPLY_WORD[g.kind];
  if (g.kind === 'walkin') return { word, detail: say.arrivedTime(g.arrived ?? '') };
  if (g.recorded != null && g.kind !== 'noreply' && g.kind !== 'notyet')
    return {
      word,
      detail: say.recordedBy(READER, g.recorded.how, dayWords(g.recorded.day, locale)),
    };
  if (g.kind === 'noreply')
    return { word, detail: short ? null : lowerFirst(invitedWords(g, locale)) };
  if (g.kind === 'notyet') return { word, detail: null };
  if (g.kind === 'maybe' && replyBy != null)
    return { word, detail: say.askedBy(dayWords(replyBy, locale)) };
  return { word, detail: g.when == null ? null : say.repliedOn(dayWords(g.when, locale)) };
}

export function replyLine(
  g: SampleGuest,
  locale: string,
  replyBy: string | null,
  short = false,
): string {
  const { word, detail } = replyParts(g, locale, replyBy, short);
  return joined([word, detail]);
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function rowLine(
  g: SampleGuest,
  locale: string,
  filter: FilterKey,
  replyBy: string | null,
): string {
  if (filter === 'noreply' && g.kind === 'noreply') return capital(invitedWords(g, locale));
  const short = g.kind === 'noreply' || g.kind === 'notyet';
  const count = g.companions.length;
  return joined([replyLine(g, locale, replyBy, short), count > 0 ? say.companions(count) : null]);
}

function hostRow(
  g: SampleGuest,
  locale: string,
  filter: FilterKey,
  replyBy: string | null,
): Person {
  return {
    key: g.key,
    guest: g.key,
    name: g.name,
    kind: g.kind,
    line: rowLine(g, locale, filter, replyBy),
    companion: false,
  };
}

function companionRow(g: SampleGuest, c: Companion, index: number): Person {
  return {
    key: `${g.key}.${index}`,
    guest: g.key,
    name: c.name,
    kind: c.kind,
    line: c.kind === 'held' ? W.heldLine : REPLY_WORD[c.kind],
    companion: true,
  };
}

/** sc-3773 (ux, 8 Nov): a companion whose reply differs from their guest's is a row of their own in their own reply. */
function ownRow(g: SampleGuest, c: Companion, index: number): Person {
  const unnamed = c.name.startsWith(say.guestOf(g.name));
  return {
    ...companionRow(g, c, index),
    line: c.kind === 'held' || unnamed ? companionRow(g, c, index).line : say.guestOf(g.name),
    companion: false,
  };
}

function shares(g: SampleGuest, c: Companion): boolean {
  return c.kind === g.kind || c.kind === 'held';
}

function inFilter(kind: SampleGuest['kind'], filter: FilterKey): boolean {
  if (filter === 'all') return true;
  if (filter === 'invited') return kind !== 'notyet' && kind !== 'walkin';
  return kind === filter;
}

/** sc-3772: the name, email address or mobile number, typed anywhere in it; a number by its digits. */
export function matchesGuest(
  name: string,
  g: SampleGuest | null,
  typed: string,
  contacts = true,
): boolean {
  const words = folded(typed.trim());
  if (words === '') return true;
  if (folded(name).includes(words)) return true;
  if (g == null || !contacts) return false;
  if (g.email != null && folded(g.email).includes(words)) return true;
  const digits = typed.replace(/\D/gu, '');
  return digits.length >= 3 && g.phone != null && g.phone.replace(/\D/gu, '').includes(digits);
}

export function rowsOf(
  guests: readonly SampleGuest[],
  filter: FilterKey,
  typed: string,
  locale: string,
  replyBy: string | null,
  contacts = true,
): Person[] {
  const out: Person[] = [];
  for (const g of guests) {
    const hostMatch = inFilter(g.kind, filter) && matchesGuest(g.name, g, typed, contacts);
    if (hostMatch) out.push(hostRow(g, locale, filter, replyBy));
    g.companions.forEach((c, index) => {
      if (!inFilter(c.kind, filter) || !(hostMatch || matchesGuest(c.name, null, typed))) return;
      out.push(hostMatch && shares(g, c) ? companionRow(g, c, index) : ownRow(g, c, index));
    });
  }
  return out;
}

export function groupRows(
  guests: readonly SampleGuest[],
  group: GroupKey,
  locale: string,
  replyBy: string | null,
  all = false,
): Person[] {
  const first = FIRST_ROWS[group];
  const original = new Map(GUESTS.map((g) => [g.key, g.kind]));
  const out: Person[] = [];
  for (const g of guests) {
    const shown =
      g.kind === group && (all || first.includes(g.key) || original.get(g.key) !== g.kind);
    if (shown) out.push(hostRow(g, locale, 'all', replyBy));
    g.companions.forEach((c, index) => {
      if (shown && shares(g, c)) out.push(companionRow(g, c, index));
      else if (c.kind === group && !shares(g, c)) out.push(ownRow(g, c, index));
    });
  }
  return out;
}

export type CardTag = 'draft' | 'paused' | 'now' | 'live' | 'finished';

export interface GuestsCardWords {
  tags: readonly { word: string; mark?: CardTag }[];
  says: string;
  count: { arrived: number; expected: number } | null;
  line: string | null;
  step: 'addGuest' | 'write' | 'makeLive' | 'openCheckIn' | null;
}

export function cardWords(
  state: GuestsState | null,
  role: Role,
  counts: Counts,
  empty: boolean,
  locale: string,
  replyBy: string | null,
): GuestsCardWords {
  const says = say.says(counts.coming, counts.invited);
  const havent = [
    say.havent(counts.havent, counts.noreply, counts.havent - counts.noreply),
    replyBy == null ? null : say.closesTomorrow(dayWords(replyBy, locale, true)),
  ]
    .filter((part) => part != null)
    .join(' ');
  const owner = role === 'owner';

  if (empty) return { tags: [], says: W.firstTitle, count: null, line: null, step: 'addGuest' };
  switch (state) {
    case 'draft':
      return {
        tags: [{ word: 'Draft', mark: 'draft' }],
        says: say.onList(DRAFT_COUNTS.list),
        count: null,
        line: W.draftLine,
        step: 'makeLive',
      };
    case 'paused':
      return {
        tags: [{ word: 'Paused', mark: 'paused' }],
        says: say.says(PAUSED_COUNTS.coming, PAUSED_COUNTS.invited),
        count: null,
        line: W.pausedLine,
        step: null,
      };
    case 'onTheDay':
      return {
        tags: [{ word: 'Happening now', mark: 'now' }, { word: 'Day 1 of 3' }],
        says,
        count: ARRIVALS.onTheDay,
        line: say.dayOpened(says),
        step: 'openCheckIn',
      };
    case 'secondDay':
      return {
        tags: [{ word: 'Happening now', mark: 'now' }, { word: 'Day 2 of 3' }],
        says,
        count: ARRIVALS.secondDay,
        line: say.allDay(says),
        step: 'openCheckIn',
      };
    case 'staffDayBefore':
      return {
        tags: [{ word: 'Live', mark: 'live' }, { word: 'Today, 18:00' }],
        says: say.opensAt('16:00'),
        count: null,
        line: `${says}.`,
        step: 'openCheckIn',
      };
    case 'staffDoorOpen':
      return {
        tags: [{ word: 'Live', mark: 'live' }, { word: 'Today, 18:00' }],
        says,
        count: ARRIVALS.staffOpen,
        line: say.dayOpened(says),
        step: 'openCheckIn',
      };
    default:
      return { tags: [], says, count: null, line: havent, step: owner ? 'write' : null };
  }
}

export function nameProblem(name: string): string | null {
  if (name.trim() === '') return W.nameBlank;
  return [...name.trim()].length > 200 ? W.nameLong : null;
}

export function emailCheck(typed: string): string | null {
  return typed.trim() !== '' && emailProblem(typed.trim()) === 'shape' ? W.emailShape : null;
}

export function countryName(code: string, locale = 'en'): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function phoneCheck(typed: string, country: string): string | null {
  const problem = phoneLengthProblem(typed, country);
  if (problem === 'tooShort') return say.tooShort(countryName(country));
  if (problem === 'tooLong') return say.tooLong(countryName(country));
  return null;
}

/** A guest typed on Add guest: Not yet invited, with the Language the host chose (sc-3790). */
export function addedGuest(
  key: string,
  typed: {
    name: string;
    email: string;
    phone: string | null;
    language: GuestLanguage | null;
    companions: readonly string[];
  },
): SampleGuest {
  return {
    key,
    name: typed.name.trim(),
    kind: 'notyet',
    when: null,
    email: typed.email.trim() === '' ? null : typed.email.trim(),
    phone: typed.phone,
    language: typed.language,
    companions: typed.companions
      .filter((c) => c.trim() !== '')
      .map((c) => ({ name: c.trim(), kind: 'notyet' })),
    invited: null,
  };
}

export function sameNameAs(
  guests: readonly SampleGuest[],
  name: string,
  self: string | null,
): SampleGuest | null {
  const typed = folded(name.trim());
  return guests.find((g) => g.key !== self && folded(g.name) === typed) ?? null;
}

export type Answer = 'coming' | 'notcoming' | 'maybe';

export function recorded(
  g: SampleGuest,
  answer: Answer,
  how: string,
  ticked: readonly boolean[],
  today: string,
): SampleGuest {
  return {
    ...g,
    kind: answer,
    when: today,
    companions: g.companions.map((c, index) => ({
      ...c,
      kind:
        answer === 'coming'
          ? ticked[index] === false
            ? 'notcoming'
            : 'coming'
          : answer === 'notcoming'
            ? 'notcoming'
            : 'held',
    })),
    recorded: { how, day: today },
  };
}

export function recordedLine(answer: ReplyKind, how: string, day: string, locale: string): string {
  return joined([REPLY_WORD[answer], say.recordedBy(READER, how, dayWords(day, locale))]);
}

export function markedInvited(g: SampleGuest, how: string, today: string): SampleGuest {
  return { ...g, kind: 'noreply', invited: { by: READER, how, day: today } };
}

export interface ReviewRow {
  key: string;
  name: string;
  country: string;
  number: string;
  saved: string | null;
  unreadable: boolean;
  listed: boolean;
  numberAt: number;
  places: number;
}

export function reviewProblems(rows: readonly ReviewRow[]): { fix: number; listed: number } {
  return {
    fix: rows.filter((row) => row.unreadable && row.number.trim() !== '').length,
    listed: rows.filter((row) => row.listed).length,
  };
}

/** From 80% of the plan's limit the list says what room is left; past it, sc-3930's block (a companion counts as one). */
export function planRoom(
  listed: number,
  adding: number,
): { after: number; room: number; over: boolean } | null {
  const after = listed + adding;
  if (after < PLAN.limit * 0.8) return null;
  return { after, room: PLAN.limit - after, over: after > PLAN.limit };
}

export interface DoorPerson {
  key: string;
  name: string;
  kind: ReplyKind | 'walkin';
  companion: boolean;
  arrivedAt: string | null;
  by: string | null;
  failed: boolean;
}

export function doorPeople(): DoorPerson[] {
  const out: DoorPerson[] = [];
  for (const g of GUESTS) {
    const kind = g.key === 'emeka' ? 'coming' : g.kind;
    const arrived = g.key === 'musa';
    out.push({
      key: g.key,
      name: g.name,
      kind,
      companion: false,
      arrivedAt: arrived ? '18:12' : null,
      by: arrived ? COLLEAGUE : null,
      failed: false,
    });
    g.companions.forEach((c, index) =>
      out.push({
        key: `${g.key}.${index}`,
        name: c.name,
        kind: g.key === 'emeka' ? 'coming' : c.kind,
        companion: true,
        arrivedAt: arrived ? '18:12' : null,
        by: arrived ? COLLEAGUE : null,
        failed: false,
      }),
    );
  }
  return out;
}

export function doorMatches(name: string, typed: string): boolean {
  const wanted = folded(typed.trim()).split(/\s+/u).filter(Boolean);
  if (wanted.length === 0) return true;
  const words = folded(name)
    .split(/[\s-]+/u)
    .filter(Boolean);
  return wanted.every((want) => words.some((word) => word.startsWith(want)));
}

export function doorShown(people: readonly DoorPerson[], typed: string): DoorPerson[] {
  if (typed.trim() === '') return [...people];
  const hostOf = (p: DoorPerson) => p.key.split('.')[0];
  const hit = new Set(people.filter((p) => doorMatches(p.name, typed)).map(hostOf));
  return people.filter((p) => hit.has(hostOf(p)));
}

export function counted(kind: DoorPerson['kind']): boolean {
  return kind === 'coming';
}

export const GUESTS_ON: readonly string[] = [WEDDING, ...Object.values(OWN_SAMPLE)];

export function startStateOf(state: GuestsState | null, event: string): GuestsState | null {
  return state ?? ownStateOf(event);
}

/** The paused party's split is the demo's: the boards give only 20 coming of 45 invited, 48 on the list. */
export const PAUSED: Counts = {
  ...PAUSED_COUNTS,
  notyet: 3,
  maybe: 3,
  notcoming: 3,
  noreply: 15,
  held: 4,
  havent: 19,
  walkin: 0,
};
export const DRAFT: Counts = {
  ...DRAFT_COUNTS,
  invited: 0,
  coming: 0,
  maybe: 0,
  notcoming: 0,
  noreply: 0,
  held: 0,
  havent: 0,
  walkin: 0,
};

export function guestsAt(state: GuestsState | null): SampleGuest[] {
  const swap = (key: string, change: (g: SampleGuest) => SampleGuest) =>
    GUESTS.map((g) => (g.key === key ? change(g) : g));
  switch (state) {
    case 'first':
      return [];
    case 'draft':
      return [...DRAFT_GUESTS];
    case 'paused':
      return [...PAUSED_GUESTS];
    case 'contactsAdded':
      return [...GUESTS, ...FROM_CONTACTS_ADDED].sort((a, b) => a.name.localeCompare(b.name));
    case 'recorded':
      return swap('emeka', (g) => recorded(g, 'coming', 'By phone', [true], TODAY));
    case 'marked':
      return swap('bisi', (g) => markedInvited(g, 'WhatsApp', TODAY));
    case 'saved':
      return swap('kwame', (g) => ({ ...g, email: 'kwame@mensah.co.uk' }));
    case 'onTheDay':
    case 'secondDay':
      return [...GUESTS, WALK_IN].sort((a, b) => a.name.localeCompare(b.name));
    default:
      return [...GUESTS];
  }
}

export function countsAt(
  state: GuestsState | null,
  event: string,
  guests: readonly SampleGuest[],
  added: number,
): Counts {
  const own = ownStateOf(event);
  if (own != null) return own === 'draft' ? DRAFT : PAUSED;
  return state === 'first' ? countsFrom(guests) : countsOf(guests, added);
}

/** Guests as it opens on an event: the state, the list, the counts and the card, all from the event when the URL gives no state. */
export function guestsOpening(given: GuestsState | null, event: string, locale: string) {
  const state = startStateOf(given, event);
  const start = areaStart(state);
  const role = roleOf(state);
  const guests = guestsAt(state);
  const added = start.added > 0 ? start.added - FROM_CONTACTS_ADDED.length : 0;
  const replyBy = replyByOf(event);
  const counts = countsAt(state, event, guests, added);
  const card = cardWords(state, role, counts, start.empty, locale, replyBy);
  return { state, start, role, guests, added, replyBy, counts, card };
}

export type Overlay =
  'edit' | 'record' | 'add' | 'picker' | 'android' | 'review' | 'mark' | 'replace' | null;

export type GuestToastKind = 'saved' | 'copied' | 'manyAdded' | null;

export interface AreaStart {
  filter: FilterKey;
  typed: string;
  menu: boolean;
  phase: 'ok' | 'loading' | 'failed';
  offline: boolean;
  empty: boolean;
  open: string | null;
  guestPhase: 'ok' | 'loading' | 'notFound';
  overlay: Overlay;
  toast: GuestToastKind;
  replies: 'closed' | 'reopened' | null;
  replaced: boolean;
  notReplaced: boolean;
  recorded: boolean;
  marked: boolean;
  added: number;
  walkIn: boolean;
}

const QUIET: AreaStart = {
  filter: 'all',
  typed: '',
  menu: false,
  phase: 'ok',
  offline: false,
  empty: false,
  open: null,
  guestPhase: 'ok',
  overlay: null,
  toast: null,
  replies: null,
  replaced: false,
  notReplaced: false,
  recorded: false,
  marked: false,
  added: 0,
  walkIn: false,
};

export function guestOf(state: GuestsState | null): string | null {
  switch (state) {
    case 'guest':
    case 'recorded':
    case 'repliesClosed':
    case 'reopened':
    case 'record':
    case 'recordRefused':
    case 'recordComing':
    case 'recordNotSaved':
    case 'guestLoading':
    case 'notFound':
      return 'emeka';
    case 'recordReplace':
      return 'ngozi';
    case 'notYetInvited':
    case 'linkCopied':
    case 'markAsInvited':
    case 'markRefused':
    case 'marked':
    case 'markNotSaved':
      return 'bisi';
    case 'editCompanions':
    case 'editMax':
      return 'musa';
    case 'languageEdit':
    case 'languageGuestChose':
    case 'editSeated':
      return 'ines';
    case 'languageSet':
      return 'sophie';
    default:
      return state != null && (isIn(GUEST_STATES, state) || isIn(EDIT_STATES, state))
        ? 'kwame'
        : null;
  }
}

export function areaStart(state: GuestsState | null): AreaStart {
  const open = guestOf(state);
  const base = { ...QUIET, open };

  if (state != null && isIn(EDIT_STATES, state)) return { ...base, overlay: 'edit' };
  if (state != null && isIn(RECORD_STATES, state)) return { ...base, overlay: 'record' };
  if (state === 'picker') return { ...base, overlay: 'picker' };
  if (state === 'androidPick' || state === 'androidNone') return { ...base, overlay: 'android' };
  if (state != null && isIn(ADD_STATES, state)) return { ...base, overlay: 'add' };
  if (state != null && isIn(REVIEW_STATES, state)) return { ...base, overlay: 'review' };

  switch (state) {
    case 'first':
      return { ...base, empty: true };
    case 'filterOpen':
      return { ...base, menu: true };
    case 'filtered':
      return { ...base, filter: 'noreply' };
    case 'search':
      return { ...base, typed: 'okon' };
    case 'searchNone':
      return { ...base, typed: 'kofi' };
    case 'filterNone':
      return { ...base, filter: 'held', typed: 'marta' };
    case 'loading':
      return { ...base, phase: 'loading' };
    case 'failed':
      return { ...base, phase: 'failed' };
    case 'offline':
      return { ...base, offline: true };
    case 'onTheDay':
    case 'secondDay':
      return { ...base, walkIn: true };
    case 'contactsAdded':
      return { ...base, toast: 'manyAdded', added: 23 };
    case 'guestLoading':
      return { ...base, guestPhase: 'loading' };
    case 'notFound':
      return { ...base, guestPhase: 'notFound' };
    case 'recorded':
      return { ...base, recorded: true };
    case 'repliesClosed':
      return { ...base, replies: 'closed' };
    case 'reopened':
      return { ...base, replies: 'reopened' };
    case 'saved':
      return { ...base, toast: 'saved' };
    case 'linkCopied':
      return { ...base, toast: 'copied' };
    case 'replaceAsk':
      return { ...base, overlay: 'replace' };
    case 'replaced':
      return { ...base, replaced: true };
    case 'notReplaced':
      return { ...base, notReplaced: true };
    case 'markAsInvited':
    case 'markRefused':
    case 'markNotSaved':
      return { ...base, overlay: 'mark' };
    case 'marked':
      return { ...base, marked: true };
    default:
      return base;
  }
}
