import { memberStanding, type MemberStanding } from '@soirely/domain';

import { handedLines, HANDOVER_WORDS } from './MembersHandoverWords.ts';
import {
  type Answering,
  answerable,
  answeredWords,
  KOFI,
  oldestFirst,
  type RecoveryAnswer,
  type RecoveryAsk,
  waitingKinds,
} from './MembersRecoverySample.ts';
import type { ChipKind } from './parts.tsx';
import { type Load, people as headcount } from './RolesSample.ts';
import type { MarkKind } from './SummaryRows.tsx';
import { MEMBERS, type MemberStatus, type SampleMember, YOU } from './sample.ts';

export const ORGANISATION = YOU.organisation;
export const DOMAIN = 'ire.events';
/** The demo's today, where the sample's dates sit. */
export const TODAY = '2026-11-04';

export interface Person extends SampleMember {
  id: string;
  tone: number;
  gone: 'left' | 'removed' | null;
}

/** The three roles sc-29859 leaves an organisation, from the least to the most a person holds. */
export const ORG_ROLES = ['Member', 'Admin', 'Owner'] as const;

export function samplePeople(): Person[] {
  return MEMBERS.map((member, index) => ({
    ...member,
    id: member.email,
    tone: index,
    gone: member.status === 'former' ? 'left' : null,
  }));
}

export type Filter = 'all' | 'active' | 'suspended' | 'former';

export const FILTERS: readonly { filter: Filter; word: string }[] = [
  { filter: 'all', word: 'All' },
  { filter: 'active', word: 'Active' },
  { filter: 'suspended', word: 'Suspended' },
  { filter: 'former', word: 'Former' },
];

export function suspended(status: MemberStatus): boolean {
  return status === 'suspended' || status === 'domainSuspended';
}

/** All is everyone active or suspended; nobody awaiting approval is under a chip. */
export function isShown(status: MemberStatus, filter: Filter): boolean {
  switch (filter) {
    case 'all':
      return status === 'active' || suspended(status);
    case 'active':
      return status === 'active';
    case 'suspended':
      return suspended(status);
    case 'former':
      return status === 'former';
  }
}

export function counts(people: readonly Person[]): Record<Filter, number> {
  const count = (filter: Filter) => people.filter((one) => isShown(one.status, filter)).length;

  return {
    all: count('all'),
    active: count('active'),
    suspended: count('suspended'),
    former: count('former'),
  };
}

export function subtitle(people: readonly Person[]): string {
  return `${ORGANISATION} · ${counts(people).active} active`;
}

export function statusWord(person: Pick<Person, 'status' | 'gone'>): {
  word: string;
  kind: ChipKind;
} {
  switch (person.status) {
    case 'active':
      return { word: 'Active', kind: 'active' };
    case 'pendingApproval':
      return { word: 'Awaiting approval', kind: 'pending' };
    case 'suspended':
      return { word: 'Suspended', kind: 'suspended' };
    case 'domainSuspended':
      return { word: 'Suspended: company domain', kind: 'suspended' };
    case 'former':
      return { word: person.gone === 'removed' ? 'Removed' : 'Left', kind: 'former' };
  }
}

/** Dates as the server writes them for the organisation, in the reader's English. */
export interface MembersSay {
  date(day: string): string;
  day(at: string): string;
  deadline(at: string): string;
}

export function membersSayIn(locale: string): MembersSay {
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' });
  const date = format({ month: 'short', day: 'numeric', year: 'numeric' });
  const dayOnly = format({ month: 'short', day: 'numeric' });
  const day = format({ weekday: 'long', month: 'short', day: 'numeric' });
  const clock = format({ hour: 'numeric', minute: '2-digit' });

  return {
    date: (at) => date.format(new Date(`${at}T00:00Z`)),
    day: (at) => dayOnly.format(new Date(`${at}T00:00Z`)),
    // The sample's deadlines are wall clock in Lagos, so they are read in UTC and named WAT.
    deadline: (at) =>
      `${day.format(new Date(`${at}Z`))} at ${clock.format(new Date(`${at}Z`))} WAT`,
  };
}

export const DEADLINES = {
  lucia: '2026-11-16T09:12',
  marta: '2026-11-11T10:00',
  claim: '2026-11-11T09:41',
} as const;

function verb(person: Person): string {
  switch (person.status) {
    case 'active':
      return 'since';
    case 'pendingApproval':
      return 'asked';
    case 'suspended':
    case 'domainSuspended':
      return 'suspended';
    case 'former':
      return person.gone ?? 'left';
  }
}

export function rowLine(person: Person, you: string, say: MembersSay): string {
  return [
    person.role ?? 'No role yet',
    ...(person.id === you ? ['you'] : []),
    person.how,
    `${verb(person)} ${say.date(person.when)}`,
  ].join(' · ');
}

const MARKS: Record<MemberStatus, MarkKind> = {
  active: 'yes',
  pendingApproval: 'waiting',
  suspended: 'paused',
  domainSuspended: 'paused',
  former: 'ended',
};

export function markOf(person: Pick<Person, 'status'>): MarkKind {
  return MARKS[person.status];
}

export function tagOf(
  person: Pick<Person, 'status' | 'gone'>,
): { kind: MarkKind; word: string } | null {
  return person.status === 'active'
    ? null
    : { kind: markOf(person), word: statusWord(person).word };
}

export function personLine(person: Person, you: string): string {
  return [person.role ?? 'No role yet', ...(person.id === you ? ['you'] : [])].join(' · ');
}

export function waitingLine(person: Person, say: MembersSay): string {
  return `${person.email} · asked ${say.day(person.when)}`;
}

export function whenWord(person: Pick<Person, 'status' | 'gone'>): string {
  switch (person.status) {
    case 'active':
      return 'Member since';
    case 'pendingApproval':
      return 'Asked on';
    case 'suspended':
    case 'domainSuspended':
      return 'Suspended since';
    case 'former':
      return person.gone === 'removed' ? 'Removed on' : 'Left on';
  }
}

export function firstName(person: Pick<Person, 'name'>): string {
  return person.name.split(' ')[0] ?? person.name;
}

export const ROLE_MEANS: Record<string, string> = {
  Owner: 'Everything, including billing and deleting the organisation.',
  Admin: 'Everything except billing. Sees every event and manages members.',
  Member: 'Works on the events they’re added to, and sees no others.',
};

export const WHERE_EVENTS = 'A member’s events come from each event’s People.';

/** Never Owner, and Member first: the least a person can be let in with. */
export function approvalRoles(): string[] {
  return ORG_ROLES.filter((role) => role !== 'Owner');
}

export interface MembersViewer {
  id: string;
  role: string;
  manages: boolean;
  owns: boolean;
}

export const VIEWERS = {
  folake: { id: YOU.email, role: 'Owner', manages: true, owns: true },
  tom: { id: 'tom.becker@gmail.com', role: 'Member', manages: false, owns: false },
  julien: { id: 'julien@ire.events', role: 'Admin', manages: true, owns: false },
} as const satisfies Record<string, MembersViewer>;

/** `as=` names who looks at Members, as the web's demo does: folake, julien or tom. */
export function membersViewerOf(name: string | undefined): MembersViewer | null {
  return Object.entries(VIEWERS).find(([key]) => key === name)?.[1] ?? null;
}

/** The roles the viewer may give, the most first: Owner only from an owner. */
export function grantable(viewer: MembersViewer): string[] {
  return [...ORG_ROLES].reverse().filter((role) => viewer.owns || role !== 'Owner');
}

export function underRoles(viewer: MembersViewer): string {
  return viewer.owns ? WHERE_EVENTS : `Only an owner makes someone an owner. ${WHERE_EVENTS}`;
}

export function standingOf(
  person: Person,
  people: readonly Person[],
  viewer: MembersViewer,
): MemberStanding {
  const shaped = (one: Person) => ({
    self: one.id === viewer.id,
    status:
      one.status === 'pendingApproval'
        ? ('pending_approval' as const)
        : one.status === 'former'
          ? ('left_or_removed' as const)
          : suspended(one.status)
            ? ('suspended' as const)
            : ('active' as const),
    role: { id: one.role ?? '', seededAs: one.role === 'Owner' ? 'owner' : one.role },
    suspension: suspended(one.status) ? { onlyOwner: onlyOwner(one, people) } : null,
  });
  const withheld = ORG_ROLES.filter((role) => !grantable(viewer).includes(role));

  return memberStanding(shaped(person), people.map(shaped), {
    owns: viewer.owns,
    manages: viewer.manages,
    withholds: withheld.map((id) => ({ id })),
  });
}

function onlyOwner(person: Person, people: readonly Person[]): boolean {
  return person.role === 'Owner' && people.filter((one) => one.role === 'Owner').length === 1;
}

export const RECOVERY_STATES = [
  'recovery',
  'recoveryApprove',
  'recoveryTurnDown',
  'recoveryApproved',
  'recoveryTurnedDown',
  'recoveryClosed',
  'recoverySending',
  'recoveryFailed',
  'recoveryDone',
  'recoveryOwn',
] as const;

type RecoveryState = (typeof RECOVERY_STATES)[number];

export const MEMBERS_STATES = [
  'list',
  'readOnly',
  'nobodySuspended',
  'nobodyLeft',
  'loading',
  'failed',
  'approving',
  'turningDown',
  'approved',
  'priya',
  'removing',
  'makingOwner',
  'marta',
  'self',
  'selfOwner',
  'claim',
  'withdraw',
  'handover',
  'handoverMenu',
  'handoverPicked',
  'handoverLong',
  'handoverSearch',
  'handoverSearchNobody',
  'removingNoWork',
  'handoverSending',
  'handoverFailed',
  'handoverDone',
  'handoverNow',
  'handoverNowSending',
  'handoverNowFailed',
  'handoverNowDone',
  'handoverReadOnly',
  ...RECOVERY_STATES,
] as const;

export type MembersState = (typeof MEMBERS_STATES)[number];

export function membersStateOf(name: string | undefined): MembersState {
  return MEMBERS_STATES.find((state) => state === name) ?? 'list';
}

function isRecovery(state: MembersState): state is RecoveryState {
  return RECOVERY_STATES.some((one) => one === state);
}

/** A recovery state only for those who answer, and Julien's own request only for him; anybody else gets Members with no state. */
export function reachableState(state: MembersState, viewer: MembersViewer | null): MembersState {
  const who = viewer ?? VIEWERS.folake;
  if (!isRecovery(state)) return state;
  if (!who.manages) return 'list';

  return state === 'recoveryOwn' && who.id !== JULIEN ? 'list' : state;
}

export type Request =
  | 'resting'
  | 'approving'
  | 'turningDown'
  | { approved: string; role: string }
  | { turnedDown: string };

export type PersonStep = 'resting' | 'removing' | 'proving' | 'handingOver';

/** Who leads which events, by person and event id: Lead on an event is the one work a member hands over (sc-614). */
export type Leads = Readonly<Record<string, readonly string[]>>;

/** Where a handover's Ask opens: who it starts on (null: you, or Nobody when leaving), the menu, the search and the answer. */
export interface HandoverStart {
  taker: string | null;
  menu: boolean;
  query: string;
  phase: 'asking' | 'sending' | 'failed';
}

export const ASKING: HandoverStart = { taker: null, menu: false, query: '', phase: 'asking' };

/** Somebody removed, and who leads their events now: `you` when the one removing kept them. */
export interface Removal {
  person: Person;
  handed: { count: number; to: string; you: boolean } | null;
}

export interface MembersStart {
  viewer: MembersViewer;
  load: Load;
  people: Person[];
  filter: Filter;
  open: string | null;
  request: Request;
  step: PersonStep;
  picked: string | null;
  claim: ClaimState | null;
  withdrawing: boolean;
  leads: Leads;
  handover: HandoverStart | null;
  gone: Removal | null;
  said: readonly string[] | null;
  recovery: string[];
  recoveryAsk: RecoveryAsk | null;
  recoveryAnswer: RecoveryAnswer | null;
  answering: Answering;
}

export type ClaimState = 'unclaimed' | 'open' | 'withdrawn';

export const KEEPS_WORKING =
  'Events, guests and your permissions keep working. Only Owner actions, such as billing, wait for an owner.';

export type CardStep =
  'answer' | 'answerRecovery' | 'seePerson' | 'seeFormer' | 'becomeOwner' | 'checkRecord';

export interface MembersCard {
  says: string;
  line: string | null;
  step: { label: string; does: CardStep } | null;
  faces: Person[];
  more: number;
  readsOut: boolean;
  /** An answer to a request to get back in takes the focus, so it is heard as one, sentence and line, and not read out again. */
  takesFocus: boolean;
}

export function ownerActive(people: readonly Person[]): boolean {
  return people.some((one) => one.role === 'Owner' && one.status === 'active');
}

export interface CardRecovery {
  /** Every request to get back in that waits, oldest first, the viewer's own among them. */
  waiting: readonly string[];
  answer: RecoveryAnswer | null;
}

const NO_RECOVERY: CardRecovery = { waiting: [], answer: null };

export function membersCard({
  people,
  viewer,
  request,
  gone,
  claim,
  say,
  recovery = NO_RECOVERY,
}: {
  people: readonly Person[];
  viewer: MembersViewer;
  request: Request;
  gone: Removal | null;
  claim: ClaimState | null;
  say: MembersSay;
  recovery?: CardRecovery;
}): MembersCard {
  const quiet = { line: null, faces: [], more: 0, readsOut: true, takesFocus: false };
  const seeFormer = { label: 'See Former', does: 'seeFormer' } as const;
  const nameOf = (id: string) => people.find((one) => one.id === id)?.name ?? '';
  const waiting = viewer.manages ? people.filter((one) => one.status === 'pendingApproval') : [];
  const back = viewer.manages ? answerable(recovery.waiting, viewer.id) : [];
  const asking = waiting[0];
  const answer =
    asking == null ? null : ({ label: `Answer ${asking.name}`, does: 'answer' } as const);
  const next: MembersCard['step'] =
    back[0] != null ? { label: `Answer ${nameOf(back[0])}`, does: 'answerRecovery' } : answer;

  if (typeof request === 'object') {
    const id = 'approved' in request ? request.approved : request.turnedDown;
    const name = people.find((one) => one.id === id)?.name ?? '';

    return 'approved' in request
      ? {
          ...quiet,
          says: `${name} joined as ${request.role}`,
          step: { label: `See ${name}`, does: 'seePerson' },
        }
      : {
          ...quiet,
          says: `You turned down ${name}`,
          line: 'They are listed under Former.',
          step: seeFormer,
        };
  }
  if (recovery.answer != null)
    return {
      ...quiet,
      ...answeredWords(recovery.answer, nameOf(recovery.answer.id)),
      step: next,
      readsOut: false,
      takesFocus: true,
    };
  if (gone != null)
    return {
      ...quiet,
      says: `${gone.person.name} was removed`,
      line: removalLine(gone),
      step: next ?? seeFormer,
    };
  if (claim != null && !ownerActive(people)) {
    const become = { label: 'Become the owner', does: 'becomeOwner' } as const;

    switch (claim) {
      case 'unclaimed':
        return {
          ...quiet,
          says: `${ORGANISATION} has no active owner`,
          line: KEEPS_WORKING,
          step: become,
          readsOut: false,
        };
      case 'open':
        return {
          ...quiet,
          says: 'Your claim is open',
          line: `We check every hour until ${say.deadline(DEADLINES.claim)}.`,
          step: { label: 'Check record', does: 'checkRecord' },
          readsOut: false,
        };
      case 'withdrawn':
        return {
          ...quiet,
          says: 'You withdrew your claim',
          line: 'Everybody who was told is emailed.',
          step: become,
        };
    }
  }

  const all = people.filter((one) => isShown(one.status, 'all'));
  const faces = all.slice(0, 5);
  const count = back.length + waiting.length;

  return {
    says: [headcount(all.length), ...(count > 0 ? [`${count} waiting`] : [])].join(' · '),
    line: waitingKinds(back.length, waiting.length),
    step: next,
    faces,
    more: all.length - faces.length,
    readsOut: false,
    takesFocus: false,
  };
}

export function approved(people: readonly Person[], id: string, role: string): Person[] {
  return people.map((one) =>
    one.id === id ? { ...one, status: 'active', role, when: TODAY } : one,
  );
}

export function turnedDown(people: readonly Person[], id: string): Person[] {
  return people.map((one) =>
    one.id === id ? { ...one, status: 'former', gone: 'removed', when: TODAY } : one,
  );
}

export function removed(people: readonly Person[], id: string): Person[] {
  return turnedDown(people, id);
}

export function restored(people: readonly Person[], id: string): Person[] {
  return people.map((one) => (one.id === id ? { ...one, status: 'active' } : one));
}

export function changedRole(people: readonly Person[], id: string, role: string): Person[] {
  return people.map((one) => (one.id === id ? { ...one, role } : one));
}

function removalLine({ handed }: Removal): string {
  if (handed == null) return `Their events stay with ${ORGANISATION}. ${HANDOVER_WORDS.former}`;

  return `${HANDOVER_WORDS.ledBy(handed.count, handed.you ? null : handed.to)} ${HANDOVER_WORDS.former}`;
}

/** Whom the menu offers: active members only, never the one leaving and never anyone suspended. */
export function offeredFor(people: readonly Person[], departing: string): Person[] {
  return people.filter((one) => one.status === 'active' && one.id !== departing);
}

/** Each event `from` leads, led by every one of `to` instead; anyone already leading it stays as they are. */
export function handedOver(leads: Leads, from: string, to: readonly string[]): Leads {
  const moving = leads[from] ?? [];
  const next: Record<string, readonly string[]> = { ...leads, [from]: [] };
  for (const taker of to) next[taker] = [...new Set([...(next[taker] ?? []), ...moving])];

  return next;
}

const LUCIA = 'lucia.gomez@outlook.com';
const PRIYA = 'priya@ire.events';
const ANA = 'ana.souza@ire.events';
const MARTA = 'marta.silva@ire.events';
const DANIEL = 'daniel.kim@ire.events';
const TOM = VIEWERS.tom.id;
const JULIEN = VIEWERS.julien.id;

/** Leave's states are Ana Souza's, who leads two events (handover-a-spec.md §6). */
export const LEAVER = ANA;

const WEDDING = 'evt-wed-4';
const IRETI = 'evt-ireti-2';
const GALA = 'evt-gala-4';
const PARTY = 'evt-party-2';
const CENA = 'evt-cena-4';
const ENGAGEMENT = 'evt-draft-4';
const OFFSITE = 'evt-off';
const MONTREAL = 'evt-mtl-3';

/** The sample's leads: Priya three (one called off), Ana two, Marta two; Folake, Julien, Tom and Kofi none. */
export const SAMPLE_LEADS: Leads = {
  [PRIYA]: [WEDDING, IRETI, OFFSITE],
  [ANA]: [GALA, MONTREAL],
  [MARTA]: [PARTY, CENA],
};

const EIGHT = [WEDDING, IRETI, GALA, PARTY, CENA, ENGAGEMENT, OFFSITE, MONTREAL];

const MORE_PEOPLE: readonly (readonly [string, string, string])[] = [
  ['Joana Ferreira', 'JF', 'joana.ferreira'],
  ['Jonas Weber', 'JW', 'jonas.weber'],
  ['João Pereira', 'JP', 'joao.pereira'],
  ['Amara Okafor', 'AO', 'amara.okafor'],
  ['Chen Wei', 'CW', 'chen.wei'],
  ['Sofía Herrera', 'SH', 'sofia.herrera'],
  ['Lars Nilsson', 'LN', 'lars.nilsson'],
  ['Aisha Bello', 'AB', 'aisha.bello'],
  ['Mateo Rossi', 'MR', 'mateo.rossi'],
  ['Hana Sato', 'HS', 'hana.sato'],
  ['Pierre Lambert', 'PL', 'pierre.lambert'],
];

/** handoverSearch's Ire Events: eleven more people, 18 in all, so the menu offers 16 and starts with its search. */
export function withMorePeople(people: readonly Person[]): Person[] {
  return [
    ...people,
    ...MORE_PEOPLE.map(([name, initials, local], index) => ({
      name,
      initials,
      email: `${local}@${DOMAIN}`,
      id: `${local}@${DOMAIN}`,
      role: 'Member',
      status: 'active' as const,
      how: 'Company email address',
      when: '2026-10-19',
      tone: people.length + index,
      gone: null,
    })),
  ];
}

function handoverStart(state: MembersState): HandoverStart {
  switch (state) {
    case 'handoverMenu':
      return { ...ASKING, menu: true };
    case 'handoverPicked':
      return { ...ASKING, taker: ANA };
    case 'handoverSearch':
      return { ...ASKING, menu: true, query: 'jo' };
    case 'handoverSearchNobody':
      return { ...ASKING, menu: true, query: 'kemi' };
    case 'handoverSending':
    case 'handoverNowSending':
      return { ...ASKING, phase: 'sending' };
    case 'handoverFailed':
    case 'handoverNowFailed':
      return { ...ASKING, phase: 'failed' };
    default:
      return ASKING;
  }
}

/** `viewer`, from the link's as=, looks at Members with no state and at the recovery states; every other state keeps its own. */
export function membersStart(
  state: MembersState,
  viewer: MembersViewer | null = null,
): MembersStart {
  const people = samplePeople();
  const base: MembersStart = {
    viewer: VIEWERS.folake,
    load: 'loaded',
    people,
    filter: 'all',
    open: null,
    request: 'resting',
    step: 'resting',
    picked: null,
    claim: null,
    withdrawing: false,
    leads: SAMPLE_LEADS,
    handover: null,
    gone: null,
    said: null,
    recovery: [],
    recoveryAsk: null,
    recoveryAnswer: null,
    answering: 'answers',
  };
  const removing: MembersStart = {
    ...base,
    open: PRIYA,
    step: 'removing',
    handover: handoverStart(state),
  };
  const handing: MembersStart = {
    ...base,
    open: MARTA,
    step: 'handingOver',
    handover: handoverStart(state),
  };
  const named = (id: string) => {
    const one = people.find((person) => person.id === id);
    if (one == null) throw new Error(`${id} is one of the sample’s people.`);

    return one;
  };
  const recovery = {
    ...base,
    viewer: viewer ?? VIEWERS.folake,
    recovery: oldestFirst([KOFI, PRIYA]),
  };
  const kofiAsks = (answer: RecoveryAsk['answer'], phase: RecoveryAsk['phase'] = 'asking') => ({
    ...recovery,
    recoveryAsk: { id: KOFI, answer, phase },
  });
  const kofiAnswered = (kind: RecoveryAnswer['kind']) => ({
    ...recovery,
    recovery: [PRIYA],
    recoveryAnswer: { id: KOFI, kind },
  });

  switch (state) {
    case 'list':
      return { ...base, viewer: viewer ?? VIEWERS.folake };
    case 'recovery':
      return recovery;
    case 'recoveryApprove':
      return kofiAsks('approve');
    case 'recoveryTurnDown':
      return kofiAsks('turnDown');
    case 'recoveryApproved':
      return kofiAnswered('approved');
    case 'recoveryTurnedDown':
      return kofiAnswered('turnedDown');
    case 'recoveryClosed':
      return kofiAsks('approve', 'closed');
    case 'recoverySending':
      return { ...kofiAsks('approve', 'sending'), answering: 'holds' };
    case 'recoveryFailed':
      return kofiAsks('approve', 'failed');
    case 'recoveryDone':
      return { ...recovery, recovery: [], recoveryAnswer: { id: PRIYA, kind: 'approved' } };
    case 'recoveryOwn':
      return { ...recovery, viewer: VIEWERS.julien, recovery: [JULIEN] };
    case 'readOnly':
      return { ...base, viewer: VIEWERS.tom };
    case 'nobodySuspended':
      return { ...base, people: restored(people, MARTA), filter: 'suspended' };
    case 'nobodyLeft':
      return { ...base, people: people.filter(({ id }) => id !== DANIEL), filter: 'former' };
    case 'loading':
    case 'failed':
      return { ...base, load: state };
    case 'approving':
    case 'turningDown':
      return { ...base, request: state };
    case 'approved':
      return {
        ...base,
        people: approved(people, LUCIA, 'Member'),
        request: { approved: LUCIA, role: 'Member' },
      };
    case 'priya':
      return { ...base, open: PRIYA };
    case 'removing':
    case 'handover':
    case 'handoverMenu':
    case 'handoverPicked':
    case 'handoverSending':
    case 'handoverFailed':
      return removing;
    case 'handoverLong':
      return { ...removing, open: JULIEN, leads: { ...SAMPLE_LEADS, [JULIEN]: EIGHT } };
    case 'handoverSearch':
    case 'handoverSearchNobody':
      return { ...removing, people: withMorePeople(people) };
    case 'removingNoWork':
      return { ...base, open: TOM, step: 'removing' };
    case 'handoverDone':
      return {
        ...base,
        people: removed(people, PRIYA),
        leads: handedOver(SAMPLE_LEADS, PRIYA, [ANA]),
        gone: {
          person: named(PRIYA),
          handed: { count: SAMPLE_LEADS[PRIYA]?.length ?? 0, to: named(ANA).name, you: false },
        },
      };
    case 'handoverNow':
    case 'handoverNowSending':
    case 'handoverNowFailed':
      return handing;
    case 'handoverNowDone':
      return {
        ...base,
        open: MARTA,
        leads: handedOver(SAMPLE_LEADS, MARTA, [YOU.email]),
        said: handedLines(named(MARTA).name, SAMPLE_LEADS[MARTA]?.length ?? 0, null),
      };
    case 'handoverReadOnly':
      return {
        ...base,
        viewer: VIEWERS.julien,
        people: changedRole(people, MARTA, 'Owner'),
        open: MARTA,
      };
    case 'makingOwner':
      return { ...base, open: ANA, step: 'proving', picked: 'Owner' };
    case 'marta':
      return { ...base, open: MARTA };
    case 'self':
      return { ...base, viewer: VIEWERS.julien, open: VIEWERS.julien.id };
    case 'selfOwner':
      return { ...base, open: YOU.email };
    case 'claim':
    case 'withdraw':
      return {
        ...base,
        viewer: VIEWERS.julien,
        people: people.map((one) => (one.id === YOU.email ? { ...one, status: 'suspended' } : one)),
        claim: state === 'claim' ? 'unclaimed' : 'open',
        withdrawing: state === 'withdraw',
      };
  }
}

export const CLAIM_RECORD = [
  { label: 'Type', value: 'TXT', copied: 'Type copied.' },
  { label: 'Name', value: `_soirely-verify.${DOMAIN}`, copied: 'Name copied.' },
  {
    label: 'Value',
    value: 'soirely-claim=h4k9m2tq7wx3c8rv5bn6jp1fzd0ys4ga',
    copied: 'Value copied.',
  },
] as const;

export const PROOF_MINUTES = 5;

/** The demo's password and codes, from samples.ts: the authenticator's code or a recovery code. */
export function proofProblem(
  password: string,
  code: string,
  sample: { password: string; authenticator: string; recovery: string },
): { field: 'password' | 'code'; message: string } | null {
  if (password === '') return { field: 'password', message: 'Enter your password.' };
  if (code.trim() === '')
    return { field: 'code', message: 'Enter a code from your app, or a recovery code.' };
  if (password !== sample.password)
    return {
      field: 'password',
      message: 'That is not your password. Try again, or reset it by email.',
    };
  if (![sample.authenticator, sample.recovery].includes(code.trim().toLowerCase()))
    return { field: 'code', message: 'That code did not work. Check your app and try again.' };

  return null;
}
