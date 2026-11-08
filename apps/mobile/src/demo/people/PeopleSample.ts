import { formatWallDay } from '@soirely/domain';

import { writtenTime } from '../clock.ts';
import { ORGANISATION } from '../settings/MembersSample.ts';
import type { Load } from '../settings/RolesSample.ts';
import { MEMBERS } from '../settings/sample.ts';

export { ORGANISATION };

export const EVENT = 'Adaeze & Tunde’s wedding';

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

export const ADD_PROMPT = 'Add by name';
export const ON_EVENT = 'On this event';
export const EMPTY_TITLE = 'Nobody is on this event yet.';
export const EMPTY_LINE = 'Add the people working on it. Owners and admins see it already.';
export const READ_ONLY = 'Only owners, admins and the lead change who’s on this event.';
export const outsideTag = (organisation: string) => `Outside ${organisation}`;
export const leadOff = (organisation: string) => `For members of ${organisation} only.`;
export const inOrganisation = (organisation: string) => `In ${organisation}`;
export const fromOutside = (organisation: string) => `From outside ${organisation}`;
export const OUTSIDE_TAG = outsideTag(ORGANISATION);
export const OUTSIDE_ENDS = 'Their access ends when the event does.';
export const LEAD_OFF = leadOff(ORGANISATION);
export const IN_ORGANISATION = inOrganisation(ORGANISATION);
export const FROM_OUTSIDE = fromOutside(ORGANISATION);
export const BY_CODE = 'Door code';
/** People adds members only, found by name, until sc-71 adds someone from outside by their address (pm, 5 Nov 2026). */
export const NAME_LABEL = 'Name';
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
  /** Came in by a door code (sc-31774): which, and the day and time. */
  byCode?: { code: string; date: string; time: string } | undefined;
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
  return joined([
    person.role,
    person.label,
    person.byCode == null ? null : BY_CODE,
    person.id === viewer.id ? 'You' : null,
  ]);
}

export function sheetLine(person: OnEvent, organisation: string = ORGANISATION): string {
  return joined([
    person.outside ? fromOutside(organisation) : `Member of ${organisation}`,
    person.label,
  ]);
}

function andList(words: readonly string[]): string {
  if (words.length <= 1) return words.join('');

  return `${words.slice(0, -1).join(', ')} and ${words.at(-1) ?? ''}`;
}

export function seesEveryEvent(
  members: readonly OrgMember[],
  organisation: string = ORGANISATION,
): string {
  const above = (['Owner', 'Admin'] as const).map((role) =>
    members.filter((one) => one.active && one.role === role),
  );
  const names = above.flat().map((one) => one.name);
  const roles = above
    .map((held, index) =>
      held.length === 0 ? null : `${index === 0 ? 'owner' : 'admin'}${held.length > 1 ? 's' : ''}`,
    )
    .filter((role) => role != null);

  return `${andList(names)} ${names.length === 1 ? 'sees' : 'see'} every event, as ${andList(roles)} of ${organisation}.`;
}

export function firstName(person: Pick<OnEvent, 'name'>): string {
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
export const REMOVING = 'Removing…';
export const SAVE_MS = 600;
/** A link to a sending state holds it this long, then lands. */
export const HELD_MS = 8000;

/** l10n's line (#32341); a time not on `today` names its day (pm, 8 Nov). */
export function joinedWithLine(
  byCode: { code: string; date: string; time: string },
  locale: string,
  today: string = byCode.date,
): string {
  const time = writtenTime(byCode.time, locale);
  const at = byCode.date === today ? time : `${formatWallDay(byCode.date, locale)}, ${time}`;

  return `Joined with the door code ${byCode.code} at ${at}.`;
}

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

export function noMatchLine(typed: string, organisation: string = ORGANISATION): string {
  return `Nobody in ${organisation} matches “${typed}”.`;
}

export function offerLine(member: OrgMember, viewer: PeopleViewer): string {
  const held = member.role === 'Member' ? 'Member' : `${member.role} · sees every event`;

  return member.id === viewer.id ? `${held} · you` : held;
}

function plain(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/** Active members not on the event yet, members before the owners and admins who see it anyway, filtered by name. */
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
      (wanted === '' || plain(one.name).includes(wanted)),
  );

  return [
    ...free.filter((one) => one.role === 'Member'),
    ...free.filter((one) => one.role !== 'Member'),
  ];
}

export type AddView = { kind: 'members'; offered: OrgMember[] } | { kind: 'nobody'; typed: string };

/** What Add shows for the name typed: the members it finds to tick, or that nobody matches. */
export function addView(
  typed: string,
  members: readonly OrgMember[],
  onEvent: readonly OnEvent[],
): AddView {
  const text = typed.trim();
  const offered = offeredMembers(members, onEvent, text);
  if (text !== '' && offered.length === 0) return { kind: 'nobody', typed: text };

  return { kind: 'members', offered };
}

export function withRole(onEvent: readonly OnEvent[], id: string, role: EventRole): OnEvent[] {
  return onEvent.map((one) => (one.id === id ? { ...one, role } : one));
}

export function without(onEvent: readonly OnEvent[], id: string): OnEvent[] {
  return onEvent.filter((one) => one.id !== id);
}

/** Everyone ticked, at the role picked. */
export function withAdded(
  onEvent: readonly OnEvent[],
  role: EventRole,
  adding: readonly OrgMember[],
): { onEvent: OnEvent[]; names: string[] } {
  const added: OnEvent[] = adding.map(({ id, name, initials, tone }) => ({
    id,
    name,
    initials,
    tone,
    role,
    outside: false,
    label: null,
  }));

  return { onEvent: [...onEvent, ...added], names: adding.map(({ name }) => name) };
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

/** Whose People it is: Ire Events' wedding, or the door code's Lumen Feiras (sc-31774). */
export interface PeopleWorld {
  organisation: string;
  event: string;
  members: OrgMember[];
}

export function ireWorld(): PeopleWorld {
  return { organisation: ORGANISATION, event: EVENT, members: sampleMembers() };
}

export type Removing = 'ask' | 'sending' | null;

export interface PeopleStart {
  viewer: PeopleViewer;
  load: Load;
  onEvent: OnEvent[];
  roleFails: boolean;
  world?: PeopleWorld;
  /** Someone's sheet open on arrival, or its Remove asking or sending. */
  opened?: { id: string; removing: Removing };
  toast?: string;
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
