import { memberStanding, type MemberStanding } from '@soirely/domain';

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
] as const;

export type MembersState = (typeof MEMBERS_STATES)[number];

export function membersStateOf(name: string | undefined): MembersState {
  return MEMBERS_STATES.find((state) => state === name) ?? 'list';
}

export type Request =
  | 'resting'
  | 'approving'
  | 'turningDown'
  | { approved: string; role: string }
  | { turnedDown: string };

export type PersonStep = 'resting' | 'removing' | 'proving';

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
}

export type ClaimState = 'unclaimed' | 'open' | 'withdrawn';

export const KEEPS_WORKING =
  'Events, guests and your permissions keep working. Only Owner actions, such as billing, wait for an owner.';

export type CardStep = 'answer' | 'seePerson' | 'seeFormer' | 'becomeOwner' | 'checkRecord';

export interface MembersCard {
  says: string;
  line: string | null;
  step: { label: string; does: CardStep } | null;
  faces: Person[];
  more: number;
  readsOut: boolean;
}

export function ownerActive(people: readonly Person[]): boolean {
  return people.some((one) => one.role === 'Owner' && one.status === 'active');
}

export function membersCard({
  people,
  viewer,
  request,
  gone,
  claim,
  say,
}: {
  people: readonly Person[];
  viewer: MembersViewer;
  request: Request;
  gone: Person | null;
  claim: ClaimState | null;
  say: MembersSay;
}): MembersCard {
  const quiet = { line: null, faces: [], more: 0, readsOut: true };
  const seeFormer = { label: 'See Former', does: 'seeFormer' } as const;

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
  if (gone != null)
    return {
      ...quiet,
      says: `${gone.name} was removed`,
      line: `Their events stay with ${ORGANISATION}. They are listed under Former, with everything they did kept.`,
      step: seeFormer,
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
  const waiting = viewer.manages ? people.filter((one) => one.status === 'pendingApproval') : [];
  const asking = waiting[0];
  const faces = all.slice(0, 5);

  return {
    says: [
      headcount(all.length),
      ...(waiting.length > 0 ? [`${waiting.length} waiting`] : []),
    ].join(' · '),
    line: null,
    step: asking == null ? null : { label: `Answer ${asking.name}`, does: 'answer' },
    faces,
    more: all.length - faces.length,
    readsOut: false,
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

const LUCIA = 'lucia.gomez@outlook.com';
const PRIYA = 'priya@ire.events';
const ANA = 'ana.souza@ire.events';
const MARTA = 'marta.silva@ire.events';
const DANIEL = 'daniel.kim@ire.events';

export function membersStart(state: MembersState): MembersStart {
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
  };

  switch (state) {
    case 'list':
      return base;
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
      return { ...base, open: PRIYA, step: 'removing' };
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
