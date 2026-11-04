import { memberStanding, type MemberStanding } from '@soirely/domain';

import type { ChipKind } from './parts.tsx';
import { grantFor, type Load } from './RolesSample.ts';
import { MEMBERS, type MemberStatus, ROLES, type SampleMember, YOU } from './sample.ts';

export const ORGANISATION = YOU.organisation;
export const DOMAIN = 'ire.events';
/** The demo's today, where the sample's dates sit. */
export const TODAY = '2026-11-04';

export interface Person extends SampleMember {
  id: string;
  tone: number;
  gone: 'left' | 'removed' | null;
}

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
  deadline(at: string): string;
}

export function membersSayIn(locale: string): MembersSay {
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' });
  const date = format({ month: 'short', day: 'numeric', year: 'numeric' });
  const day = format({ weekday: 'long', month: 'short', day: 'numeric' });
  const clock = format({ hour: 'numeric', minute: '2-digit' });

  return {
    date: (at) => date.format(new Date(`${at}T00:00Z`)),
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

export const ROLE_MEANS: Record<string, string> = {
  Owner: 'Everything, including billing and deleting the organisation.',
  Administrator: 'Everything in events, plus members and roles. Not billing.',
  'Event manager': 'Everything inside events, and manages the budget. Never the margin.',
  Coordinator: 'Runs events. Reads the budget, never the margin.',
  'Read-only': 'Sees events. Changes nothing.',
};

/** Never Owner, and Read-only first: the least a person can be let in with. */
export function approvalRoles(): string[] {
  const offered = ROLES.map(({ name }) => name).filter((name) => name !== 'Owner');

  return [
    ...offered.filter((name) => name === 'Read-only'),
    ...offered.filter((name) => name !== 'Read-only'),
  ];
}

export interface MembersViewer {
  id: string;
  role: string;
  manages: boolean;
  owns: boolean;
}

export const VIEWERS = {
  folake: { id: YOU.email, role: 'Owner', manages: true, owns: true },
  // Door staff holds members.read but not members.manage in this sample.
  tom: { id: 'tom.becker@gmail.com', role: 'Door staff', manages: false, owns: false },
  julien: { id: 'julien@ire.events', role: 'Administrator', manages: true, owns: false },
} as const satisfies Record<string, MembersViewer>;

/** The roles the viewer may give: only what they hold, and Owner only from an owner. */
export function grantable(viewer: MembersViewer): string[] {
  const held = grantFor(viewer.role);

  return ROLES.map(({ name }) => name).filter(
    (name) =>
      (viewer.owns || name !== 'Owner') &&
      grantFor(name).every((permission) => held.includes(permission)),
  );
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
  const withheld = ROLES.map(({ name }) => name).filter(
    (name) => !grantable(viewer).includes(name),
  );

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
  claim: 'open' | null;
  withdrawing: boolean;
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
        people: approved(people, LUCIA, 'Read-only'),
        request: { approved: LUCIA, role: 'Read-only' },
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
      return { ...base, open: YOU.email };
    case 'claim':
    case 'withdraw':
      return {
        ...base,
        viewer: VIEWERS.julien,
        people: people.map((one) => (one.id === YOU.email ? { ...one, status: 'suspended' } : one)),
        claim: 'open',
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
