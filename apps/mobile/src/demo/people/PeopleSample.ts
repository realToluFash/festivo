import { emailProblem, phoneLengthProblem } from '@soirely/domain';

import { ORGANISATION } from '../settings/MembersSample.ts';
import type { Load } from '../settings/RolesSample.ts';
import { MEMBERS } from '../settings/sample.ts';

export { ORGANISATION };

export const EVENT = 'Adaeze & Tunde’s wedding';
/** The organisation's country, which a mobile number typed without its +code is read in. */
export const ORGANISATION_COUNTRY = 'GB';

export const EVENT_ROLES = ['Lead', 'Can edit', 'Can view', 'Can check guests in'] as const;
export type EventRole = (typeof EVENT_ROLES)[number];
export const FIRST_ROLE: EventRole = 'Can view';

export const ROLE_LINES: Record<EventRole, string> = {
  Lead: 'Everything on this event, including its budget and who’s on it.',
  'Can edit': 'Everything except the budget and who’s on it.',
  'Can view': 'Sees the event and changes nothing. No contact details.',
  'Can check guests in': 'Checks guests in on the day. Names only, no contact details.',
};

const NOW_CAN: Record<EventRole, { one: string; several: string }> = {
  Lead: { one: 'leads this event now.', several: 'lead this event now.' },
  'Can edit': { one: 'can edit now.', several: 'can edit now.' },
  'Can view': { one: 'can view now.', several: 'can view now.' },
  'Can check guests in': { one: 'can check guests in now.', several: 'can check guests in now.' },
};

export const ADD_PROMPT = 'Add by name, email or mobile';
export const ON_EVENT = 'On this event';
export const EMPTY_TITLE = 'Nobody is on this event yet.';
export const EMPTY_LINE = 'Add the people working on it. Owners and admins see it already.';
export const READ_ONLY = 'Only owners, admins and the lead change who’s on this event.';
export const OUTSIDE_TAG = `Outside ${ORGANISATION}`;
export const OUTSIDE_ENDS = 'Their access ends when the event does.';
export const LEAD_OFF = `For members of ${ORGANISATION} only.`;
export const LEAD_MEMBERS = `Lead is for members of ${ORGANISATION}.`;
export const PICK_ANOTHER = 'Pick another role to add someone from outside.';
export const OUT_FOOT = `To add someone from outside ${ORGANISATION}, type their email or mobile number.`;
export const NOT_AN_ADDRESS =
  'That isn’t an email address or a mobile number we can use. Add stays off until it is one.';
export const IN_ORGANISATION = `In ${ORGANISATION}`;
export const FROM_OUTSIDE = `From outside ${ORGANISATION}`;
export const JOB_LABEL = 'Job label (optional)';
export const JOB_LIMIT = 60;
export const LOADING_WORDS = 'Loading the people on this event…';
export const FAILED_TITLE = 'We could not load the people on this event.';
export const FAILED_LINE = 'Check your connection and try again.';

export type OrgRole = 'Owner' | 'Admin' | 'Member';

export interface OrgMember {
  id: string;
  name: string;
  initials: string;
  tone: number;
  role: OrgRole;
  active: boolean;
}

/** Somebody on the event: a member by their email, or someone from outside by the address they were added with. */
export interface OnEvent {
  id: string;
  name: string;
  initials: string | null;
  tone: number;
  role: EventRole;
  outside: boolean;
  label: string | null;
}

export interface PeopleViewer {
  id: string;
  role: OrgRole;
}

const ORG_ROLES: Record<string, OrgRole> = {
  'folake@ire.events': 'Owner',
  'julien@ire.events': 'Admin',
};

export function sampleMembers(): OrgMember[] {
  return MEMBERS.map((member, index) => ({
    id: member.email,
    name: member.name,
    initials: member.initials,
    tone: index,
    role: ORG_ROLES[member.email] ?? 'Member',
    active: member.status === 'active',
  }));
}

const PRIYA = 'priya@ire.events';
const ANA = 'ana.souza@ire.events';
const TOM = 'tom.becker@gmail.com';
const JULIEN = 'julien@ire.events';

function onEventAs(id: string, role: EventRole): OnEvent {
  const member = sampleMembers().find((one) => one.id === id);
  if (member == null) throw new Error(`${id} is in the sample.`);
  const { name, initials, tone } = member;

  return { id, name, initials, tone, role, outside: false, label: null };
}

export function sampleOnEvent(): OnEvent[] {
  return [
    onEventAs(PRIYA, 'Lead'),
    onEventAs(ANA, 'Can edit'),
    onEventAs(TOM, 'Can check guests in'),
    {
      id: 'kemi.okafor@example.com',
      name: 'Kemi Okafor',
      initials: 'KO',
      tone: 3,
      role: 'Can check guests in',
      outside: true,
      label: 'Bar and drinks',
    },
    {
      id: 'sade@thelandmark.example',
      name: 'Sade Bello',
      initials: 'SB',
      tone: 4,
      role: 'Can view',
      outside: true,
      label: 'The Landmark’s coordinator',
    },
  ];
}

export function listed(onEvent: readonly OnEvent[]): OnEvent[] {
  return [...onEvent].sort(
    (one, other) =>
      EVENT_ROLES.indexOf(one.role) - EVENT_ROLES.indexOf(other.role) ||
      one.name.localeCompare(other.name, 'en'),
  );
}

/** An owner, an admin or the event's lead changes who is on it. */
export function manages(viewer: PeopleViewer, onEvent: readonly OnEvent[]): boolean {
  return (
    viewer.role !== 'Member' || onEvent.some((one) => one.id === viewer.id && one.role === 'Lead')
  );
}

export function opens(person: OnEvent, viewer: PeopleViewer, onEvent: readonly OnEvent[]): boolean {
  return manages(viewer, onEvent) && person.id !== viewer.id;
}

function joined(parts: readonly (string | null)[]): string {
  return parts.filter((part) => part != null && part !== '').join(' · ');
}

export function rowLine(person: OnEvent, viewer: PeopleViewer): string {
  return joined([person.role, person.label, person.id === viewer.id ? 'You' : null]);
}

export function sheetLine(person: OnEvent): string {
  return joined([person.outside ? FROM_OUTSIDE : `Member of ${ORGANISATION}`, person.label]);
}

function andList(words: readonly string[]): string {
  if (words.length <= 1) return words.join('');

  return `${words.slice(0, -1).join(', ')} and ${words.at(-1) ?? ''}`;
}

export function seesEveryEvent(members: readonly OrgMember[]): string {
  const above = (['Owner', 'Admin'] as const).map((role) =>
    members.filter((one) => one.active && one.role === role),
  );
  const names = above.flat().map((one) => one.name);
  const roles = above
    .map((held, index) =>
      held.length === 0 ? null : `${index === 0 ? 'owner' : 'admin'}${held.length > 1 ? 's' : ''}`,
    )
    .filter((role) => role != null);

  return `${andList(names)} ${names.length === 1 ? 'sees' : 'see'} every event, as ${andList(roles)} of ${ORGANISATION}.`;
}

export function firstName(person: Pick<OnEvent, 'name' | 'id'>): string {
  if (person.name === person.id) return person.name;

  return person.name.split(' ')[0] ?? person.name;
}

export function rolesOff(person: Pick<OnEvent, 'outside'>): EventRole[] {
  return person.outside ? ['Lead'] : [];
}

export function removeTitle(person: OnEvent): string {
  return `Remove ${person.name} from this event?`;
}

export function removeLine(person: Pick<OnEvent, 'outside'>): string {
  return person.outside
    ? 'Their access ends on their next request.'
    : `They lose this event on their next request. They stay in ${ORGANISATION}.`;
}

export const SAVING = 'Saving…';
export const SAVE_MS = 600;

export function savedWords(person: OnEvent, role: EventRole): string {
  return `Saved. ${person.name} ${NOW_CAN[role].one}`;
}

export function notChangedLine(person: OnEvent): string {
  return `We couldn’t change ${firstName(person)}’s role, so it’s still ${person.role}. Check your connection and pick again.`;
}

export function removedToast(person: OnEvent): string {
  return `${person.name} is off this event.`;
}

export function addedToast(names: readonly string[], role: EventRole): string {
  return names.length === 1
    ? `${names[0] ?? ''} ${NOW_CAN[role].one}`
    : `${names.length} people ${NOW_CAN[role].several}`;
}

export function fieldLabel(role: EventRole): string {
  return role === 'Lead' ? 'Name' : 'Name, email or mobile number';
}

export function jobHelp(count: number): string {
  return `What they’re there for, shown beside their name. It grants nothing. ${count} of ${JOB_LIMIT}.`;
}

export function noMatchLine(typed: string): string {
  return `Nobody in ${ORGANISATION} matches “${typed}”.`;
}

export function offerLine(member: OrgMember, viewer: PeopleViewer): string {
  const held = member.role === 'Member' ? 'Member' : `${member.role} · sees every event`;

  return member.id === viewer.id ? `${held} · you` : held;
}

export interface Address {
  kind: 'email' | 'mobile';
  text: string;
}

const DIALLED = /^\+?[\d\s().-]+$/u;

/** An email by the app's own check, or a number with a length the country uses; whether it reaches anyone is the API's to say. */
export function addressOf(typed: string, country: string): Address | null {
  const text = typed.trim();
  if (emailProblem(text) == null) return { kind: 'email', text };
  if (DIALLED.test(text) && /\d/u.test(text) && phoneLengthProblem(text, country) == null)
    return { kind: 'mobile', text };

  return null;
}

export function linkLine(address: Address): string {
  return `We send them a link by ${address.kind === 'email' ? 'email' : 'text'}. Their account is made from it.`;
}

function addressKey(text: string): string {
  const trimmed = text.trim().toLowerCase();

  return trimmed.includes('@') ? trimmed : trimmed.replace(/[^\d+]/gu, '');
}

function plain(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/** Active members not on the event yet, members before the owners and admins who see it anyway, filtered by name or email. */
export function offeredMembers(
  members: readonly OrgMember[],
  onEvent: readonly OnEvent[],
  typed: string,
): OrgMember[] {
  const wanted = plain(typed);
  const free = members.filter(
    (one) =>
      one.active &&
      !onEvent.some((there) => there.id === one.id) &&
      (wanted === '' || plain(one.name).includes(wanted) || plain(one.id).includes(wanted)),
  );

  return [
    ...free.filter((one) => one.role === 'Member'),
    ...free.filter((one) => one.role !== 'Member'),
  ];
}

export type AddView =
  | { kind: 'members'; offered: OrgMember[] }
  | { kind: 'outside'; address: Address }
  | { kind: 'leadAddress' }
  | { kind: 'nobody'; typed: string; notAnAddress: boolean };

/** What Add shows for what is typed: members to tick, someone from outside, or why nobody can be added yet. Lead takes members only. */
export function addView(
  role: EventRole,
  typed: string,
  members: readonly OrgMember[],
  onEvent: readonly OnEvent[],
): AddView {
  const text = typed.trim();
  const lead = role === 'Lead';
  const address = addressOf(text, ORGANISATION_COUNTRY);
  const aMember =
    address != null && members.some((one) => addressKey(one.id) === addressKey(address.text));

  if (address != null && !aMember)
    return lead ? { kind: 'leadAddress' } : { kind: 'outside', address };

  const offered = offeredMembers(members, onEvent, text);
  if (text !== '' && offered.length === 0)
    return { kind: 'nobody', typed: text, notAnAddress: !lead && address == null };

  return { kind: 'members', offered };
}

export function withRole(onEvent: readonly OnEvent[], id: string, role: EventRole): OnEvent[] {
  return onEvent.map((one) => (one.id === id ? { ...one, role } : one));
}

export function without(onEvent: readonly OnEvent[], id: string): OnEvent[] {
  return onEvent.filter((one) => one.id !== id);
}

function addressInitials(address: Address): string | null {
  if (address.kind === 'mobile') return null;
  const parts = (address.text.split('@')[0] ?? '').split(/[._+-]/u).filter((part) => part !== '');

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function outsiderFor(address: Address, onEvent: readonly OnEvent[]): OnEvent {
  const key = addressKey(address.text);
  const there = onEvent.find((one) => one.outside && addressKey(one.id) === key);

  return (
    there ?? {
      id: address.text,
      name: address.text,
      initials: addressInitials(address),
      tone: 3 + (onEvent.filter((one) => one.outside).length % 2),
      role: FIRST_ROLE,
      outside: true,
      label: null,
    }
  );
}

export interface Adding {
  members: readonly OrgMember[];
  outside: { address: Address; label: string } | null;
}

/** Everyone ticked, at the role picked; an address already on the event moves to it with the label as typed, as sharing a document again does. */
export function withAdded(
  onEvent: readonly OnEvent[],
  role: EventRole,
  adding: Adding,
): { onEvent: OnEvent[]; names: string[] } {
  const members: OnEvent[] = adding.members.map(({ id, name, initials, tone }) => ({
    id,
    name,
    initials,
    tone,
    role,
    outside: false,
    label: null,
  }));
  const names = adding.members.map(({ name }) => name);
  const next = [...onEvent, ...members];

  if (adding.outside == null) return { onEvent: next, names };

  const person = outsiderFor(adding.outside.address, onEvent);
  const label = adding.outside.label.trim();
  const placed = { ...person, role, label: label === '' ? null : label };
  const there = next.some((one) => one.id === person.id);

  return {
    onEvent: there ? next.map((one) => (one.id === person.id ? placed : one)) : [...next, placed],
    names: [...names, person.name],
  };
}

export const PEOPLE_STATES = [
  'people',
  'readOnly',
  'lead',
  'nobody',
  'roleFails',
  'loading',
  'failed',
] as const;
export type PeopleState = (typeof PEOPLE_STATES)[number];

export function peopleStateOf(name: string | undefined): PeopleState {
  return PEOPLE_STATES.find((state) => state === name) ?? 'people';
}

export const PEOPLE_VIEWERS = {
  julien: { id: JULIEN, role: 'Admin' },
  ana: { id: ANA, role: 'Member' },
  priya: { id: PRIYA, role: 'Member' },
} as const satisfies Record<string, PeopleViewer>;

export interface PeopleStart {
  viewer: PeopleViewer;
  load: Load;
  onEvent: OnEvent[];
  roleFails: boolean;
}

export function peopleStart(state: PeopleState): PeopleStart {
  const base: PeopleStart = {
    viewer: PEOPLE_VIEWERS.julien,
    load: 'loaded',
    onEvent: sampleOnEvent(),
    roleFails: false,
  };

  switch (state) {
    case 'people':
      return base;
    case 'readOnly':
      return { ...base, viewer: PEOPLE_VIEWERS.ana };
    case 'lead':
      return { ...base, viewer: PEOPLE_VIEWERS.priya };
    case 'nobody':
      return { ...base, onEvent: [] };
    case 'roleFails':
      return { ...base, roleFails: true };
    case 'loading':
    case 'failed':
      return { ...base, load: state };
  }
}
