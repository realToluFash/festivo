import { emailProblem, phoneLengthProblem } from '@soirely/domain';

import { folded } from '../events/EventsModel.ts';
import {
  ARRIVALS,
  CLOCKS,
  COLLEAGUE,
  COUNTS,
  DRAFT_COUNTS,
  FIRST_ROWS,
  GUESTS,
  PAUSED_COUNTS,
  PLAN,
  READER,
  REPLY_BY,
  type Companion,
  type SampleGuest,
  WEDDING,
} from './GuestsSample.ts';
import { REPLY_WORD, type ReplyKind, W, say } from './GuestsWords.ts';

/** Every state of the app's Guests, by guests-a-spec.md §15's names: the same in both demos. */
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
] as const;

export const EDIT_STATES = [
  'edit',
  'editErrors',
  'editDuplicate',
  'editCompanions',
  'editMax',
  'editDiscard',
  'edit412',
  'editNotSaved',
  'editOffline',
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
  'androidRefused',
] as const;

export const REVIEW_STATES = [
  'review',
  'reviewPressed',
  'chooseNumber',
  'roomLeft',
  'overLimit',
  'limitRefused',
  'adding',
  'contactsFailed',
  'contactsOffline',
  'contactsDiscard',
  'allRemoved',
  'over250',
] as const;

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

export function eventOf(state: GuestsState | null): string {
  if (state === 'draft') return 'evt-draft-4';
  if (state === 'paused') return 'evt-party-2';
  if (state === 'roomLeft' || state === 'overLimit' || state === 'limitRefused') return PLAN.ireti;
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

/** sc-3780: a Not sure yet guest is asked to decide by the Reply by date, when the event has one. */
export function replyLine(g: SampleGuest, locale: string, short = false): string {
  if (g.kind === 'walkin') return say.walkInArrived(g.arrived ?? '');
  if (g.recorded != null && g.kind !== 'noreply' && g.kind !== 'notyet')
    return recordedLine(g.kind, g.recorded.how, g.recorded.day, locale);
  if (g.kind === 'noreply')
    return short
      ? REPLY_WORD.noreply
      : `${REPLY_WORD.noreply} · ${invitedWords(g, locale).replace(/^I/u, 'i')}`;
  if (g.kind === 'notyet') return REPLY_WORD.notyet;
  if (g.kind === 'maybe' && g.when != null) return say.askedBy(dayWords(REPLY_BY, locale));
  return say.replied(REPLY_WORD[g.kind], g.when == null ? '' : dayWords(g.when, locale));
}

function companionLine(c: Companion): string {
  return c.kind === 'held' ? W.heldLine : REPLY_WORD[c.kind];
}

function rowLine(g: SampleGuest, locale: string, filter: FilterKey): string {
  if (filter === 'noreply' && g.kind === 'noreply') return capital(invitedWords(g, locale));
  const short = g.kind === 'noreply' || g.kind === 'notyet';
  const count = g.companions.length;
  return [replyLine(g, locale, short), count > 0 ? say.companions(count) : null]
    .filter(Boolean)
    .join(' · ');
}

function hostRow(g: SampleGuest, locale: string, filter: FilterKey): Person {
  return {
    key: g.key,
    guest: g.key,
    name: g.name,
    kind: g.kind,
    line: rowLine(g, locale, filter),
    companion: false,
  };
}

function companionRow(g: SampleGuest, c: Companion, index: number): Person {
  return {
    key: `${g.key}.${index}`,
    guest: g.key,
    name: c.name,
    kind: c.kind,
    line: companionLine(c),
    companion: true,
  };
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
  contacts = true,
): Person[] {
  const out: Person[] = [];
  for (const g of guests) {
    const hostIn = inFilter(g.kind, filter);
    const hostMatch = hostIn && matchesGuest(g.name, g, typed, contacts);
    const comps = g.companions
      .map((c, index) => ({ c, index }))
      .filter(({ c }) => inFilter(c.kind, filter))
      .filter(({ c }) => hostMatch || matchesGuest(c.name, null, typed));
    if (hostMatch || (hostIn && comps.length > 0)) out.push(hostRow(g, locale, filter));
    for (const { c, index } of comps) out.push(companionRow(g, c, index));
  }
  return out;
}

export function groupRows(
  guests: readonly SampleGuest[],
  group: GroupKey,
  locale: string,
): Person[] {
  const first = FIRST_ROWS[group];
  const original = new Map(GUESTS.map((g) => [g.key, g.kind]));
  const out: Person[] = [];
  for (const g of guests) {
    if (g.kind !== group) continue;
    if (!first.includes(g.key) && original.get(g.key) === g.kind) continue;
    out.push(hostRow(g, locale, 'all'));
    g.companions.forEach((c, index) => out.push(companionRow(g, c, index)));
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
): GuestsCardWords {
  const says = say.says(counts.coming, counts.invited);
  const havent = say.havent(counts.havent, counts.noreply, counts.havent - counts.noreply);
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

/** Open check-in shows on every day of the event, all day, each day counted from 05:00 in its zone (sc-3895). */
export function onAnEventDay(now: Date, startsAt: string, endsAt: string): boolean {
  const day = (moment: number) => Math.floor((moment - 5 * 3_600_000) / 86_400_000);
  const today = day(now.getTime());
  return today >= day(Date.parse(startsAt)) && today <= day(Date.parse(endsAt));
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
  return say.recordedBy(REPLY_WORD[answer], READER, how, dayWords(day, locale));
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

/** Everyone on the list, A to Z, each companion under their host; on the day Dr Emeka Nwosu has said Coming. */
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

/** "okon fola" finds Chief Mrs Folasade Okonkwo-Williams: each word typed starts a word of the name, in any order. */
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
  if (state === 'androidPick') return { ...base, overlay: 'android' };
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
