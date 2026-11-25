import {
  emailProblem,
  formatPhone,
  listFormat,
  phoneE164,
  phoneLengthProblem,
} from '@soirely/domain';

import { ORGANISATION, samplePeople } from './members.ts';
import type { DemoLink } from './settings.ts';

export const EVENT = 'Adaeze & Tunde’s wedding';

export const EVENT_ROLES = ['Lead', 'Can edit', 'Can view', 'Can check guests in'] as const;
export type EventRole = (typeof EVENT_ROLES)[number];
export const FIRST_ROLE: EventRole = 'Can view';
/** sc-4002: the levels a join code or someone from outside may hold beside the event roles; never offered to a member. */
export const SERVICE_LEVELS = [
  'Can work the floor',
  'Can work the pass',
  'Can run the floor',
] as const;
export type ServiceLevel = (typeof SERVICE_LEVELS)[number];
export const SERVICE_LINES: Record<ServiceLevel, string> = {
  'Can work the floor': 'Marks plates and requests at their own tables.',
  'Can work the pass': 'Marks plates at the pass and the kitchen stations.',
  'Can run the floor':
    'Starts service, fires courses and acts on any table. Nothing else of the event.',
};

export const ROLE_LINES: Record<EventRole, string> = {
  Lead: 'Everything on this event, including its budget and who’s on it.',
  'Can edit': 'Everything except the budget and who’s on it.',
  'Can view': 'Sees the event and changes nothing. No contact details.',
  'Can check guests in': 'Checks guests in on the day. Names only, no contact details.',
};

export type Level = EventRole | ServiceLevel;
export const LEVEL_LINES: Record<Level, string> = { ...ROLE_LINES, ...SERVICE_LINES };
export const SERVICE_HEAD = 'For the service';
export const SERVICE_CLOSING =
  'The service levels open only the service. None of them sees contact details or the budget.';

const NOW_CAN: Record<Level, { one: string; several: string }> = {
  'Can work the floor': { one: 'can work the floor now.', several: 'can work the floor now.' },
  'Can work the pass': { one: 'can work the pass now.', several: 'can work the pass now.' },
  'Can run the floor': { one: 'can run the floor now.', several: 'can run the floor now.' },
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
  role: Level;
  outside: boolean;
  label: string | null;
  /** Added by an address the viewer is not shown: no name, no address, no kind of address. */
  withheld?: boolean;
  /** In by a door code (sc-72): which one, and when. */
  door?: { code: string; at: string } | null;
  /** In by their own staff link from the roster (sc-3912): one row a person, however many links they were given. */
  staffLink?: { job: string; ends: string; signedIn: boolean } | null;
}

export const NOT_SIGNED_IN = 'Not signed in yet';

export function staffLinkTitle(person: OnEvent): string | null {
  const link = person.staffLink;
  if (link == null) return null;

  return `Staff link · ${person.name} · ${link.job} · ends ${link.ends}`;
}

const STAFF_LINKS: readonly OnEvent[] = [
  {
    id: 'staff-grace',
    name: 'Grace Okon',
    initials: '',
    tone: 0,
    role: 'Can view',
    outside: false,
    label: null,
    staffLink: { job: 'Waiter', ends: '03:00 on Sunday, Oct 25', signedIn: false },
  },
  {
    id: 'staff-tolu',
    name: 'Tolu Bello',
    initials: '',
    tone: 0,
    role: 'Can check guests in',
    outside: false,
    label: null,
    staffLink: { job: 'Door', ends: '23:00', signedIn: true },
  },
];

/** The organisation and the event a People screen is drawn for, as its sidebar shows them. */
export interface EventPlace {
  organisation: string;
  /** Where a mobile number typed without its + code is read. */
  country: string;
  initials: string;
  event: string;
  eventId: string;
  when: string;
}

export const IRE_PLACE: EventPlace = {
  organisation: ORGANISATION,
  country: 'NG',
  initials: 'IE',
  event: EVENT,
  eventId: 'evt-wed-4',
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

export const NOT_JOINED = 'Not joined yet';

/** Someone added by address with no account yet: only an owner, an admin or the lead sees the address, everyone else 'Not joined yet' (pm #67966). */
export function seenBy(onEvent: readonly OnEvent[], seesAddresses: boolean): OnEvent[] {
  return seesAddresses
    ? [...onEvent]
    : onEvent.map((one, index) =>
        one.initials === ''
          ? { ...one, id: `not-joined-${index}`, name: NOT_JOINED, withheld: true }
          : one,
      );
}

const LISTED_ORDER: readonly Level[] = [...EVENT_ROLES, ...SERVICE_LEVELS];

export function listed(onEvent: readonly OnEvent[]): OnEvent[] {
  return [...onEvent].sort(
    (one, other) =>
      LISTED_ORDER.indexOf(one.role) - LISTED_ORDER.indexOf(other.role) ||
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
  return manages(viewer, onEvent) && person.id !== viewer.id && person.staffLink == null;
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
  return listFormat('en', { style: 'long', type: 'conjunction' }).format(words);
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

/** Added by an address or a number and not joined: the API has no account name, only what they were added by (sc-91678). */
export function unnamed(person: Pick<OnEvent, 'outside' | 'initials'>): boolean {
  return person.outside && person.initials === '';
}

/** Only an account name is cut to its first word; nobody else is named on a button (sc-91678). */
export function keepWords(person: Pick<OnEvent, 'name' | 'outside' | 'initials'>): string {
  return unnamed(person) ? 'Keep them' : `Keep ${firstName(person)}`;
}

/** In a sentence, someone with no account name is their whole address or number (sc-91678). */
export function calledIn(person: Pick<OnEvent, 'name' | 'outside' | 'initials'>): string {
  return unnamed(person) ? person.name : firstName(person);
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

export function savedWords(person: OnEvent, role: Level): string {
  return `Saved. ${person.name} ${NOW_CAN[role].one}`;
}

export function notChangedLine(person: OnEvent): string {
  return `We couldn’t change ${calledIn(person)}’s role, so it’s still ${person.role}. Check your connection and pick again.`;
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

export const FIND_LABEL = 'Name, email or mobile number';
export const NAME_LABEL = 'Name';
export const UNUSABLE = 'That is not an email address or a mobile number we can use.';
export const PICK_ANOTHER = 'Pick another role to add someone from outside.';
export const fromOutside = (org: string = ORGANISATION) => `From outside ${org}`;
export const ALREADY_A_MEMBER = 'That person is already a member of this organisation.';

export type Address =
  | { kind: 'email'; address: string; shown: string }
  | { kind: 'mobile'; address: string; shown: string };

export type OutsideView =
  | { kind: 'none' }
  | { kind: 'offer'; address: Address }
  | { kind: 'unusable' }
  | { kind: 'leadOff' }
  | { kind: 'onEvent'; name: string };

function readAddress(text: string, country: string): Address | 'name' | 'unusable' {
  if (text.includes('@'))
    return emailProblem(text) == null ? { kind: 'email', address: text, shown: text } : 'unusable';
  if (text === '' || /\p{L}/u.test(text) || !/\d/u.test(text)) return 'name';
  const e164 = phoneLengthProblem(text, country) == null ? phoneE164(text, country) : null;

  return e164 == null ? 'unusable' : { kind: 'mobile', address: e164, shown: formatPhone(e164) };
}

/** sc-71's form checks: an @ is an email address, digits a mobile number by the country's lengths, letters a name to find. */
export function outsideView(
  typed: string,
  country: string,
  role: EventRole,
  onEvent: readonly OnEvent[] = [],
): OutsideView {
  const read = readAddress(typed.trim(), country);
  if (read === 'name') return { kind: 'none' };
  if (read === 'unusable') return { kind: 'unusable' };
  const there = onEvent.find((one) => one.id.toLowerCase() === read.address.toLowerCase());
  if (there != null) return { kind: 'onEvent', name: there.name };

  return role === 'Lead' ? { kind: 'leadOff' } : { kind: 'offer', address: read };
}

export function onAlreadyLine(name: string): string {
  return `${name} is on this event already.`;
}

/** The sample API: a member's own address is refused `already_a_member`, in the server's words. */
export function outsideRefusal(address: Address, members: readonly OrgMember[]): string | null {
  const typed = address.address.toLowerCase();

  return members.some((one) => one.id.toLowerCase() === typed) ? ALREADY_A_MEMBER : null;
}

export function withOutside(
  onEvent: readonly OnEvent[],
  role: EventRole,
  address: Address,
  job: string,
): OnEvent[] {
  const label = job.trim();

  return [
    ...onEvent,
    {
      id: address.address,
      name: address.shown,
      initials: '',
      tone: onEvent.length,
      role,
      outside: true,
      label: label === '' ? null : label,
    },
  ];
}

export function withRole(onEvent: readonly OnEvent[], id: string, role: Level): OnEvent[] {
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
  'addOutside',
  'addMobile',
  'addUnusable',
  'addLeadOutside',
  'addMemberAddress',
  'loading',
  'failed',
  'staffLinks',
  'addressShort',
  'addressDots',
  'addressUnbroken',
  'addressRemove',
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
  adding?: { typed: string; role: EventRole };
  /** The row whose role dialog is open, and whether its Remove ask is too. */
  open?: { id: string; asking: boolean };
}

export function peopleStateOf(name: string | null): PeopleState {
  return PEOPLE_STATES.find((one) => one === name) ?? 'people';
}

const BISI = 'bisi@lagoslights.example';

/** Added by her address and not joined yet, so the API has no name for her. */
export const BISI_ON: OnEvent = {
  id: BISI,
  name: BISI,
  initials: '',
  tone: 5,
  role: 'Can check guests in',
  outside: true,
  label: 'Lighting',
};

/** sc-91529's three addresses, added from outside and not joined, so each stands for its name. */
export const LONG_ADDRESSES = {
  addressShort: 'amaka.outside@soirely.test',
  addressDots: 'fundacao.comunitaria.de.oyo.e.artes@soirely.test',
  addressUnbroken: 'fundacaocomunitariadeoyoeartescontemporaneas@soirely.test',
} as const;

/** An outsider added by mobile number, whose groups stay whole. */
const MOBILE_ON: OnEvent = {
  id: '+2348031234567',
  name: '+234 803 123 4567',
  initials: '',
  tone: 6,
  role: 'Can view',
  outside: true,
  label: null,
};

function withAddress(start: PeopleStart, address: string, asking: boolean): PeopleStart {
  const outsider: OnEvent = { ...BISI_ON, id: address, name: address, label: null };

  return {
    ...start,
    onEvent: [...start.onEvent, outsider, MOBILE_ON],
    open: { id: address, asking },
  };
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
      return { ...start, viewer: PEOPLE_VIEWERS.ana, onEvent: [...start.onEvent, BISI_ON] };
    case 'lead':
      return { ...start, viewer: PEOPLE_VIEWERS.priya };
    case 'nobody':
      return { ...start, onEvent: [] };
    case 'addOutside':
      return { ...start, adding: { typed: BISI, role: FIRST_ROLE } };
    case 'addMobile':
      return { ...start, adding: { typed: '0803 555 0142', role: FIRST_ROLE } };
    case 'addUnusable':
      return { ...start, adding: { typed: 'bisi@lagos', role: FIRST_ROLE } };
    case 'addLeadOutside':
      return { ...start, adding: { typed: BISI, role: 'Lead' } };
    case 'addMemberAddress':
      return { ...start, adding: { typed: 'kofi@ire.events', role: FIRST_ROLE } };
    case 'staffLinks':
      return { ...start, onEvent: [...start.onEvent, ...STAFF_LINKS] };
    case 'addressShort':
    case 'addressDots':
    case 'addressUnbroken':
      return withAddress(start, LONG_ADDRESSES[state], false);
    case 'addressRemove':
      return withAddress(start, LONG_ADDRESSES.addressUnbroken, true);
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
      people('addOutside', 'Add someone from outside by email address'),
      people('addMobile', 'Add someone from outside by mobile number'),
      people('addUnusable', 'Half an address'),
      people('addLeadOutside', 'An address under Lead'),
      people('addMemberAddress', 'A member’s own address, refused by the server'),
      people('loading', 'Loading'),
      people('failed', 'Failed'),
      people('staffLinks', 'Staff links from the roster, one signed in and one not yet (sc-3912)'),
      people('addressShort', 'An outsider’s address, broken after its @ (sc-91529)'),
      people('addressDots', 'An address wider than a line, broken before its dots'),
      people('addressUnbroken', 'An address with no dot before its @, cut at the line’s end'),
      people('addressRemove', 'Remove asked for that address'),
    ],
  },
];
