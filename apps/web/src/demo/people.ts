import { ORGANISATION, samplePeople } from './members.ts';
import type { DemoLink } from './settings.ts';

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
export const outsideTag = (org: string = ORGANISATION) => `Outside ${org}`;
export const leadOff = (org: string = ORGANISATION) => `For members of ${org} only.`;
export const inOrganisation = (org: string = ORGANISATION) => `In ${org}`;
export const everyoneOn = (org: string = ORGANISATION) =>
  `Everyone in ${org} is on this event already.`;
export const OUTSIDE_TAG = outsideTag();
export const OUTSIDE_ENDS = 'Their access ends when the event does.';
export const LEAD_OFF = leadOff();
export const IN_ORGANISATION = inOrganisation();
export const EVERYONE_ON = everyoneOn();
export const BY_DOOR_CODE = 'Door code';
export const LOADING_WORDS = 'Loading the people on this event…';
export const FAILED_TITLE = 'We could not load the people on this event.';
export const FAILED_LINE = 'Check your connection and try again.';
export const SAVING = 'Saving…';
export const SAVE_MS = 600;
/** How long the arrow keys rest on a role before it is sent, since each press checks the radio it reaches. */
export const SETTLE_MS = 600;
export const LIT_MS = 2000;

export type OrgRole = 'Owner' | 'Admin' | 'Member';

/** A member Add people may offer: their name, and nothing else the API gives (sc-29915). */
export interface OrgMember {
  id: string;
  name: string;
  initials: string;
  tone: number;
  role: OrgRole;
  active: boolean;
}

export interface OnEvent {
  id: string;
  name: string;
  initials: string;
  tone: number;
  role: EventRole;
  outside: boolean;
  label: string | null;
  /** In by a door code (sc-72): which one, and when. */
  door?: { code: string; at: string } | null;
}

/** The organisation and the event a People screen is drawn for, as its sidebar shows them. */
export interface EventPlace {
  organisation: string;
  initials: string;
  event: string;
  when: string;
}

export const IRE_PLACE: EventPlace = {
  organisation: ORGANISATION,
  initials: 'IE',
  event: EVENT,
  when: 'Live · in 3 days',
};

export interface PeopleViewer {
  id: string;
  name: string;
  initials: string;
  role: OrgRole;
}

export function sampleMembers(): OrgMember[] {
  return samplePeople().map(({ id, name, initials, tone, role, status }) => ({
    id,
    name,
    initials,
    tone,
    role: role === 'Owner' || role === 'Admin' ? role : 'Member',
    active: status === 'active',
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

export function rowLine(person: OnEvent, viewer: Pick<PeopleViewer, 'id'>): string {
  return joined([
    person.role,
    person.label,
    person.door == null ? null : BY_DOOR_CODE,
    person.id === viewer.id ? 'You' : null,
  ]);
}

export function sheetLine(person: OnEvent, org: string = ORGANISATION): string {
  return joined([person.outside ? `From outside ${org}` : `Member of ${org}`, person.label]);
}

function andList(words: readonly string[]): string {
  if (words.length <= 1) return words.join('');

  return `${words.slice(0, -1).join(', ')} and ${words.at(-1) ?? ''}`;
}

/** The foot everyone on the event reads: the owners and admins by name, who see every event (sc-29915). */
export function seesEveryEvent(members: readonly OrgMember[], org: string = ORGANISATION): string {
  const above = (['Owner', 'Admin'] as const).map((role) =>
    members.filter((one) => one.active && one.role === role),
  );
  const names = above.flat().map((one) => one.name);
  const roles = above
    .map((held, index) =>
      held.length === 0 ? null : `${index === 0 ? 'owner' : 'admin'}${held.length > 1 ? 's' : ''}`,
    )
    .filter((role) => role != null);

  return `${andList(names)} ${names.length === 1 ? 'sees' : 'see'} every event, as ${andList(roles)} of ${org}.`;
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

export function removeLine(person: Pick<OnEvent, 'outside'>, org: string = ORGANISATION): string {
  return person.outside
    ? 'Their access ends on their next request.'
    : `They lose this event on their next request. They stay in ${org}.`;
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

export function noMatchLine(typed: string, org: string = ORGANISATION): string {
  return `Nobody in ${org} matches “${typed.trim()}”.`;
}

function plain(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/** Active members not on the event yet, found by name only, and any already ticked so a tick never hides. */
export function offeredMembers(
  members: readonly OrgMember[],
  onEvent: readonly OnEvent[],
  viewer: Pick<PeopleViewer, 'id'>,
  typed: string,
  ticked: readonly string[] = [],
): OrgMember[] {
  const wanted = plain(typed);

  return members
    .filter(
      (one) =>
        one.active &&
        one.id !== viewer.id &&
        !onEvent.some((there) => there.id === one.id) &&
        (ticked.includes(one.id) || plain(one.name).includes(wanted)),
    )
    .sort((one, other) => one.name.localeCompare(other.name, 'en'));
}

export function withRole(onEvent: readonly OnEvent[], id: string, role: EventRole): OnEvent[] {
  return onEvent.map((one) => (one.id === id ? { ...one, role } : one));
}

export function without(onEvent: readonly OnEvent[], id: string): OnEvent[] {
  return onEvent.filter((one) => one.id !== id);
}

export function withAdded(
  onEvent: readonly OnEvent[],
  role: EventRole,
  adding: readonly OrgMember[],
): OnEvent[] {
  return [
    ...onEvent,
    ...adding.map(({ id, name, initials, tone }) => ({
      id,
      name,
      initials,
      tone,
      role,
      outside: false,
      label: null,
    })),
  ];
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

/** Who is looking: Julien, an admin; Ana, a member who can edit; Priya, a member who leads it. */
export const PEOPLE_VIEWERS = {
  julien: { id: JULIEN, name: 'Julien Moreau', initials: 'JM', role: 'Admin' },
  ana: { id: ANA, name: 'Ana Souza', initials: 'AS', role: 'Member' },
  priya: { id: PRIYA, name: 'Priya Shah', initials: 'PS', role: 'Member' },
} as const satisfies Record<string, PeopleViewer>;

export interface PeopleStart {
  viewer: PeopleViewer;
  onEvent: OnEvent[];
  roleFails: boolean;
  load: 'loaded' | 'loading' | 'failed';
  place: EventPlace;
  members: OrgMember[];
}

export function peopleStateOf(name: string | null): PeopleState {
  return PEOPLE_STATES.find((one) => one === name) ?? 'people';
}

export function peopleStart(state: PeopleState): PeopleStart {
  const start: PeopleStart = {
    viewer: PEOPLE_VIEWERS.julien,
    onEvent: sampleOnEvent(),
    roleFails: state === 'roleFails',
    load: state === 'loading' || state === 'failed' ? state : 'loaded',
    place: IRE_PLACE,
    members: sampleMembers(),
  };

  switch (state) {
    case 'readOnly':
      return { ...start, viewer: PEOPLE_VIEWERS.ana };
    case 'lead':
      return { ...start, viewer: PEOPLE_VIEWERS.priya };
    case 'nobody':
      return { ...start, onEvent: [] };
    default:
      return start;
  }
}

function people(state: PeopleState, name: string): DemoLink {
  return { to: state === 'people' ? '/demo/people' : `/demo/people?state=${state}`, name };
}

/** The states Web-People draws, opened from the demo's home. */
export const PEOPLE_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'People on an event',
    states: [
      people('people', 'Julien Moreau, an admin'),
      people('readOnly', 'Ana Souza, who can edit: read only'),
      people('lead', 'Priya Shah, the lead'),
      people('nobody', 'Nobody on it yet'),
      people('roleFails', 'A role change that does not save'),
      people('loading', 'Loading'),
      people('failed', 'Failed'),
    ],
  },
];
