import type { NeedsState } from './needsYou.ts';
import type { WriteState } from './guestsWrite.ts';
import { type ThankYouState, isCardState, isEndState } from './thankYou.ts';
import {
  type EventPhase,
  type EventState,
  type EventType,
  type EventsFilters,
  type EventsLook,
  NO_EVENTS_FILTERS,
  calledOff,
  endLabel,
  eventDayWords,
  eventPhase,
  eventsHome,
  calledOffDay,
  formatEventMoment,
  milestoneDistance,
  notThisYear,
  savedWallClock,
  searching,
  wallDayNumber,
} from '@soirely/domain';

import type { MarkKind } from '../components/SettingsParts.tsx';
import type { DemoLink } from './settings.ts';
import type { EventKey } from './today.ts';
import { type Mesh, meshFor } from '../mesh.ts';
import { SIDE_AREAS, type SideArea } from '../components/eventSideAreas.ts';
import { ARRIVAL_NOTE } from './arrivalNote.ts';

export interface Venue {
  name: string;
  address: string | null;
  city: string;
}

export interface SampleEvent {
  id: string;
  /** A draft duplicated with its guest list ticked: the event its guests come from (sc-3656). */
  guestsFrom?: string;
  name: string;
  type: EventType;
  status: EventState;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  concludedAt: string | null;
  venue: Venue | null;
  /** sc-24385: the host's own words, beside the venue and never inside it, so a note can stand without one. */
  arrivalNote: string | null;
  hosts: readonly string[];
  currency: Currency;
  mesh: Mesh;
  photo: boolean;
}

export type Currency = 'GBP' | 'EUR' | 'USD' | 'CAD' | 'NGN' | 'GHS' | 'BRL' | 'MXN';

export const CURRENCIES: Record<Currency, string> = {
  GBP: 'Pound sterling',
  EUR: 'Euro',
  USD: 'US dollar',
  CAD: 'Canadian dollar',
  NGN: 'Nigerian naira',
  GHS: 'Ghanaian cedi',
  BRL: 'Brazilian real',
  MXN: 'Mexican peso',
};

export const TYPE_WORDS: Record<EventType, string> = {
  wedding: 'Wedding',
  birthday: 'Birthday',
  anniversary: 'Anniversary',
  engagement: 'Engagement',
  baby_shower: 'Baby shower',
  graduation: 'Graduation',
  memorial: 'Memorial',
  religious: 'Religious celebration',
  cultural: 'Cultural celebration',
  party: 'Party',
  gala: 'Gala or fundraiser',
  conference: 'Conference',
  corporate: 'Corporate event',
  other: 'Other',
};

export const ZONES = [
  'Europe/London',
  'Europe/Lisbon',
  'Europe/Madrid',
  'Europe/Paris',
  'Africa/Lagos',
  'Africa/Accra',
  'America/Toronto',
  'America/Mexico_City',
  'America/Sao_Paulo',
] as const;

export const CLOCKS = {
  rest: new Date('2026-11-03T09:41:00Z'),
  now: new Date('2026-11-06T16:10:00Z'),
  finished: new Date('2026-11-11T09:41:00Z'),
} as const;

export const ORGANISATION = 'Ire Events';

export const TODAY_IDS: Record<EventKey, string> = {
  wed: 'evt-wed-4',
  ireti: 'evt-ireti-2',
  party: 'evt-party-2',
  draft: 'evt-draft-4',
};

const at = (venue: string, city: string, address: string | null = null): Venue => ({
  name: venue,
  address,
  city,
});

function sample(
  id: string,
  name: string,
  type: EventType,
  status: EventState,
  [startsAt, endsAt, timeZone]: readonly [string, string, string],
  venue: Venue | null,
  hosts: readonly string[],
  currency: Currency,
  extra: Partial<SampleEvent> = {},
): SampleEvent {
  return {
    id,
    name,
    type,
    status,
    startsAt,
    endsAt,
    timeZone,
    concludedAt: null,
    venue,
    arrivalNote: null,
    hosts,
    currency,
    mesh: meshFor(id),
    photo: false,
    ...extra,
  };
}

/** The boards' sample (events_a_kit.EV): 4 upcoming, 3 drafts and 13 past, every value a field the API returns. */
const SAMPLE_EVENTS: readonly SampleEvent[] = [
  sample(
    'evt-wed-4',
    'Adaeze & Tunde’s wedding',
    'wedding',
    'live',
    ['2026-11-05T18:00:00Z', '2026-11-07T15:00:00Z', 'Europe/London'],
    at('The Landmark', 'London', '222 Marylebone Road, London NW1 6JQ'),
    ['Adaeze Obi', 'Tunde Bakare'],
    'GBP',
    { arrivalNote: ARRIVAL_NOTE },
  ),
  sample(
    'evt-ireti-2',
    'Ireti at 40',
    'birthday',
    'live',
    ['2026-11-13T19:00:00Z', '2026-11-14T01:00:00Z', 'Europe/London'],
    at('Oslo Hall', 'London', '1 Oslo Street, London E2 8AB'),
    ['Ireti Bankole'],
    'GBP',
  ),
  sample(
    'evt-gala-4',
    'Gala Fundación Lucía',
    'gala',
    'live',
    ['2026-11-14T18:30:00Z', '2026-11-14T22:30:00Z', 'Europe/Madrid'],
    at('Casa de América', 'Madrid', 'Plaza de Cibeles 2, 28014 Madrid'),
    ['Fundación Lucía'],
    'EUR',
    { photo: true },
  ),
  sample(
    'evt-party-2',
    'Ire Events end-of-year party',
    'corporate',
    'paused',
    ['2026-12-03T18:30:00Z', '2026-12-03T23:30:00Z', 'Europe/London'],
    at('The Clerk’s House', 'London', '235 Shoreditch High Street, London E1 6PJ'),
    ['Ire Events'],
    'GBP',
  ),
  sample(
    'evt-shower-2',
    'Kemi’s baby shower',
    'baby_shower',
    'draft',
    ['2026-10-24T12:00:00Z', '2026-10-24T16:00:00Z', 'Europe/London'],
    at('The Orangery', 'London', 'Kensington Gardens, London W8 4PX'),
    ['Kemi Adebayo'],
    'GBP',
  ),
  sample(
    'evt-cena-4',
    'Cena benéfica Fundación Lucía',
    'gala',
    'draft',
    ['2026-12-12T19:00:00Z', '2026-12-12T22:30:00Z', 'Europe/Madrid'],
    null,
    [],
    'EUR',
  ),
  sample(
    'evt-draft-4',
    'Bisi & Kola’s engagement',
    'engagement',
    'draft',
    ['2027-01-09T14:00:00Z', '2027-01-09T22:00:00Z', 'Europe/London'],
    null,
    [],
    'GBP',
  ),
  sample(
    'evt-off',
    'Team offsite',
    'corporate',
    'ended',
    ['2026-11-12T09:00:00Z', '2026-11-13T17:00:00Z', 'Europe/Lisbon'],
    at('Quinta da Regaleira', 'Sintra', 'Rua Barbosa du Bocage 5, 2710-567 Sintra'),
    ['Ire Events'],
    'EUR',
    { concludedAt: '2026-10-30T10:00:00Z' },
  ),
  sample(
    'evt-grad-3',
    'Ana’s graduation lunch',
    'graduation',
    'live',
    ['2026-10-23T11:30:00Z', '2026-10-23T15:30:00Z', 'Europe/Lisbon'],
    at('Quinta das Flores', 'Lisbon', 'Rua das Flores 12, 1200-195 Lisboa'),
    ['Ana Ferreira'],
    'EUR',
  ),
  sample(
    'evt-rafa-2',
    'Rafael & Inês’s wedding',
    'wedding',
    'live',
    ['2026-10-17T14:00:00Z', '2026-10-17T22:30:00Z', 'Europe/Lisbon'],
    at('Quinta do Torneiro', 'Oeiras'),
    ['Rafael Costa', 'Inês Duarte'],
    'EUR',
  ),
  sample(
    'evt-quince-4',
    'Lucía’s quinceañera',
    'cultural',
    'live',
    ['2026-10-11T00:00:00Z', '2026-10-11T05:59:00Z', 'America/Mexico_City'],
    at('Hacienda de los Morales', 'Mexico City'),
    ['Familia Ortega'],
    'MXN',
  ),
  sample(
    'evt-mtl-3',
    'Montréal launch',
    'corporate',
    'live',
    ['2026-10-08T21:30:00Z', '2026-10-09T01:00:00Z', 'America/Toronto'],
    at('Le Windsor', 'Montréal'),
    ['Ire Events'],
    'CAD',
  ),
  sample(
    'evt-chidi-2',
    'Chidi’s 30th',
    'birthday',
    'live',
    ['2026-09-26T18:00:00Z', '2026-09-26T22:00:00Z', 'Europe/London'],
    at('The Book Club', 'London'),
    ['Chidi Okafor'],
    'GBP',
  ),
  sample(
    'evt-naming-3',
    'Amara’s naming ceremony',
    'cultural',
    'live',
    ['2026-09-18T10:00:00Z', '2026-09-18T14:00:00Z', 'Africa/Lagos'],
    at('The Wheatbaker', 'Lagos'),
    ['Nkem Eze'],
    'NGN',
  ),
  sample(
    'evt-summer-3',
    'Ire Events summer party',
    'party',
    'live',
    ['2026-08-22T12:00:00Z', '2026-08-22T17:00:00Z', 'Europe/London'],
    at('Sky Garden', 'London'),
    ['Ire Events'],
    'GBP',
  ),
  sample(
    'evt-anniv-4',
    'Funmi & Dayo’s anniversary',
    'anniversary',
    'live',
    ['2026-07-18T15:00:00Z', '2026-07-18T21:00:00Z', 'Africa/Lagos'],
    at('Eko Hotel', 'Lagos'),
    ['Funmilayo Adéṣínà-Ọláolúwa'],
    'NGN',
  ),
  sample(
    'evt-sofia',
    'Festa da Sofia',
    'birthday',
    'live',
    ['2026-06-13T17:00:00Z', '2026-06-13T22:00:00Z', 'America/Sao_Paulo'],
    at('Casa Natura', 'São Paulo'),
    ['Sofia Lima'],
    'BRL',
  ),
  sample(
    'evt-grace',
    'Remembering Grace Mensah',
    'memorial',
    'live',
    ['2026-05-29T10:00:00Z', '2026-05-29T13:00:00Z', 'Africa/Accra'],
    at('Holy Trinity Cathedral', 'Accra'),
    ['The Mensah family'],
    'GHS',
  ),
  sample(
    'evt-lea-2',
    'Léa & Hugo’s engagement',
    'engagement',
    'live',
    ['2026-05-16T16:00:00Z', '2026-05-16T21:00:00Z', 'Europe/Paris'],
    at('Le Pavillon', 'Lyon'),
    ['Léa Martin', 'Hugo Bernard'],
    'EUR',
  ),
  sample(
    'evt-tomi-3',
    'Tomi’s graduation',
    'graduation',
    'live',
    ['2026-03-14T12:00:00Z', '2026-03-14T16:00:00Z', 'Europe/London'],
    at('The Queens Hotel', 'Leeds'),
    ['Tomi Adeyemi'],
    'GBP',
  ),
];

/** Not one of the 20: the Calendar's `?state=monthEdge` adds it, so one event runs across a month's edge (calendar-lanes-spec). */
export const REUNION: SampleEvent = sample(
  'evt-reunion-3',
  'Okafor family reunion',
  'other',
  'live',
  ['2026-11-28T15:00:00Z', '2026-12-01T11:00:00Z', 'Europe/London'],
  at('Hampton Manor', 'Solihull'),
  ['The Okafor family'],
  'GBP',
);

/** What the demo changed since it opened: Pause, Delete and Duplicate carry back to the list until a state link or a reload opens the sample as drawn. */
let changed: Map<string, SampleEvent | null> = new Map();
let copies: SampleEvent[] = [];

export function resetSample(): void {
  changed = new Map();
  copies = [];
}

export function sampleEvents(): SampleEvent[] {
  return [...SAMPLE_EVENTS, ...copies]
    .map((event) => (changed.has(event.id) ? changed.get(event.id) : event))
    .filter((event): event is SampleEvent => event != null);
}

export function sampleEvent(id: string | undefined): SampleEvent | null {
  return sampleEvents().find((event) => event.id === id) ?? (id === REUNION.id ? REUNION : null);
}

export function keepChange(event: SampleEvent): void {
  changed.set(event.id, event);
}

export function forget(id: string): void {
  changed.set(id, null);
}

export function keepCopy(of: SampleEvent, startsAt: string, withGuests = false): SampleEvent {
  const length = Date.parse(of.endsAt) - Date.parse(of.startsAt);
  const id = `${of.id}-copy-${copies.length + 1}`;
  const copy: SampleEvent = {
    ...of,
    id,
    mesh: meshFor(id),
    status: 'draft',
    startsAt,
    endsAt: new Date(Date.parse(startsAt) + length).toISOString().replace('.000Z', 'Z'),
    concludedAt: null,
    hosts: [],
  };
  if (withGuests) copy.guestsFrom = of.id;
  else delete copy.guestsFrom;

  copies = [...copies, copy];

  return copy;
}

export const DISTINCT_HOSTS: readonly string[] = [
  ...new Set(SAMPLE_EVENTS.flatMap((event) => event.hosts)),
].sort(new Intl.Collator('en').compare);

/** The words main has (events, eventPage, eventLive, eventEnd, eventPause, eventDelete, eventDuplicate, eventEdit, eventHosts, eventCover, eventNav, timeline), then the new ones the boards add, for review. */
export const EVENT_WORDS = {
  title: 'Events',
  loading: 'Loading events…',
  newEvent: 'New event',
  upcoming: 'Upcoming',
  drafts: 'Drafts',
  past: 'Past',
  showMore: 'Show more',
  moreShown: (count: number) =>
    count === 1 ? '1 more finished event shown.' : `${count} more finished events shown.`,
  summary: (upcoming: number, drafts: number) =>
    `${upcoming} upcoming · ${drafts === 1 ? '1 draft' : `${drafts} drafts`}`,
  footer: (count: number) =>
    count === 1 ? '1 event · Sorted by date' : `${count} events · Sorted by date`,
  days: (first: string, last: string) => `${first} to ${last}`,
  calledOffOn: (date: string) => `Called off on ${date}`,
  venueToBeConfirmed: 'Venue to be confirmed',
  inDays: (count: number) => (count === 1 ? 'in 1 day' : `in ${count} days`),
  today: 'today',
  firstRunTitle: 'Set up your first event',
  firstRunCreate: 'Create an event',
  firstRunAsk:
    'Events your organisation creates will show here. Ask an owner if you need to create one.',
  emptyTab: {
    upcoming: {
      title: 'Nothing coming up',
      line: 'Events you make live show here, with the next thing each one needs.',
    },
    drafts: {
      title: 'No drafts',
      line: 'New events stay drafts, visible only to your team, until you make them live.',
    },
    past: {
      title: 'Nothing finished yet',
      line: 'Finished events stay here, so you can look back or start the next one from them.',
    },
  },
  firstRunSteps: [
    'Name it and choose when it starts and ends.',
    'Check its time zone and currency.',
    'Open it from this list to carry on planning.',
  ],
  offline: (time: string) => `Offline · as of ${time}`,
  retry: 'Try again',
  phase: {
    draft: 'Draft',
    live: 'Live',
    happening_now: 'Happening now',
    paused: 'Paused',
    finished: 'Finished',
    calledOff: 'Called off',
  },
  guestsBlocked: 'Guests can’t be invited until this event is live.',
  makeLive: 'Make live',
  endPassed: 'This event’s end has passed, so it cannot be made live. Change its dates first.',
  changeDates: 'Change dates',
  nextResume: 'Paused. Guests can’t reply or change anything until you resume it.',
  resume: 'Resume',
  resumed: (name: string) => `${name} is live again.`,
  allPassed: 'Nothing coming up. Every date on this event has passed.',
  calledOffNotice: (date: string) =>
    `Called off on ${date}, before it started. Guests following their link are told it won’t go ahead.`,
  duplicate: 'Duplicate',
  nextStarts: (name: string) => `Next up: ${name} starts`,
  nextEnds: (name: string) => `Next up: ${name} ends`,
  dayOf: (day: number, of: number) => `Day ${day} of ${of}`,
  details: 'Details',
  dates: 'Dates',
  dayCount: (count: number) => `${count} days`,
  scheduleLocked: 'This event is over, so its start, end and time zone can’t be changed.',
  scheduleCalledOff: 'This event was called off, so its start, end and time zone can’t be changed.',
  venue: 'Venue',
  openInMaps: 'Open in maps',
  addVenue: 'Add the venue',
  hostedBy: 'Hosted by',
  noHosts: 'No hosts yet',
  noHostsLine: 'The event can be made live once it has at least one.',
  type: 'Type',
  currency: 'Currency',
  nameAndCover: 'Name and cover',
  eventName: 'Event name',
  cover: 'Cover',
  manage: 'Manage',
  pause: 'Pause',
  pauseLine:
    'Guests can’t reply or change anything until you resume it. Nothing is lost. Check-in and service keep working.',
  pauseTitle: (name: string) => `Pause ${name}?`,
  keepItLive: 'Keep it live',
  paused: (name: string) => `${name} is paused.`,
  callOffOpen: 'Call off…',
  callOff: 'Call off',
  callOffLine: 'It won’t go ahead. Guests following their link will be told. You can’t undo this.',
  callOffTitle: (name: string) => `Call off ${name}?`,
  endNowOpen: 'End now…',
  endNow: 'End now',
  endLine: 'It will be over for everybody. You can’t undo this.',
  endTitle: (name: string) => `End ${name} now?`,
  keepItOn: 'Keep it on',
  deleteOpen: 'Delete event…',
  deleteLine:
    'Removes the event and everything in it for your whole team. Guests following its link see that it isn’t available.',
  deleteTitle: (name: string) => `Delete ${name}?`,
  draftBody: 'It’s a draft with nobody on its guest list. It will be removed for your whole team.',
  removes: 'This removes, for your whole team:',
  removesEvent: 'the event, its details and its schedule',
  removesGuests: (people: string, count: number) =>
    count === 1
      ? `its guest list, with the ${people} person on it`
      : `its guest list, with the ${people} people on it`,
  guestsLink: 'Guests following their link will see that it isn’t available.',
  restoreWindow: (deadline: string) =>
    `If this was a mistake, support can restore it until ${deadline}. After that it’s gone for good.`,
  restoreUntil: 'Monday, Nov 16 at 14:20 GMT',
  typeName: (name: string) => `Type ${name} to delete it`,
  typeHint: 'Type it exactly, capitals included. A straight or curly apostrophe both count.',
  mismatch: (name: string) => `Type ${name} exactly as shown to delete it.`,
  keepIt: 'Keep it',
  delete: 'Delete',
  deleted: (name: string) => `${name} was deleted.`,
  callOffFirst: (name: string) => `Call off ${name} first?`,
  endFirst: (name: string) => `End ${name} first?`,
  callOffFirstLine:
    'Guests have been invited to this event, or staff briefed for it, so it can be deleted only once it is finished. Calling it off is how they hear it will not go ahead.',
  endFirstLine:
    'Guests have been invited to this event, or staff briefed for it, so it can be deleted only once it is finished. End it first: it will then be over for everybody.',
  askToCallOff: (area: string, organisation: string) =>
    `Ask someone who can change ${area} in ${organisation} to call it off.`,
  askToEnd: (area: string, organisation: string) =>
    `Ask someone who can change ${area} in ${organisation} to end it.`,
  duplicateLine:
    'Makes a new draft with the same name. Only your team sees it until you make it live.',
  starts: 'Starts',
  ends: 'Ends',
  created: 'Draft created. Opening it.',
  guestsPage: 'Guests’ page',
  preview: 'Preview the guests’ page',
  previewLine: 'What somebody you invite sees, before they reply',
  guestsCanWrite: 'Guests can write from their page',
  guestsCanWriteLine: 'Changes it for everyone on this event. Texts and emails still arrive.',
  guestsCanWriteReadOnly: 'Only members who manage messages can change this.',
  guestsCanWriteNotSaved: 'Not saved. Try again.',
  notBuilt: (story: string) => `AC, not yet built · ${story}`,
  cancel: 'Cancel',
  save: 'Save',
  saved: 'Saved',
  keepEditing: 'Keep editing',
  discardTitle: 'Discard your change?',
  discardLine: 'What you changed here is not saved.',
  discard: 'Discard',
  changedElsewhere:
    'Not saved. Somebody else changed this event since you opened it. What you typed is still here.',
  showLatest: 'Show the latest',
  showLatestTitle: 'Show the latest version?',
  showLatestBody: 'What you typed will be replaced by the version somebody else saved.',
  onceSaved: 'Once it is saved',
  tellGuests: 'Telling guests what changed: AC, not yet built · sc-4330',
  endsHint: 'An event can run past midnight. Choose the day it ends.',
  timeZone: 'Time zone',
  timesIn: (zone: string) => `Times in ${zone}`,
  endMoved: (end: string) => `Ends moved with the start, to ${end}.`,
  endBeforeStart: 'The end is before the start. Choose a later end.',
  date: 'Date',
  time: 'Time',
  venueName: 'Venue name',
  address: 'Address',
  optional: 'Optional',
  addressHint: 'Type at least 3 characters to see suggestions. You can also type any address.',
  suggestions: (count: number) =>
    count === 1 ? '1 suggestion below the address.' : `${count} suggestions below the address.`,
  zoneOffer: (zone: string) => `This venue is in ${zone}. Use it?`,
  zoneSet: (zone: string) => `Time zone set to ${zone}.`,
  takeZone: (zone: string) => `Use ${zone}`,
  keepZone: (zone: string) => `Keep ${zone}`,
  lookupDown:
    'Suggestions aren’t available right now. Type the address in full and it will be saved as you typed it.',
  hostsExplainer:
    'Guests read these names on their invitation and their page, in this order. Write them the way you want guests to see them.',
  host: (position: number) => `Host ${position}`,
  moveUp: (name: string) => `Move ${name} up`,
  moveDown: (name: string) => `Move ${name} down`,
  remove: 'Remove',
  removeNamed: (name: string) => `Remove ${name}`,
  addHost: 'Add a host',
  mostHosts: (most: number) => `${most} is the most hosts an event can have.`,
  lastHost:
    'Guests can see this event, so it needs at least one host. You can still change this name.',
  hostBlank: 'Enter a name or remove this host.',
  hostDuplicate: (name: string) => `${name} is already a host.`,
  hostTooLong: (most: number, length: number) =>
    `A host’s name can be at most ${most} characters. This one has ${length}.`,
  hostMoved: (name: string, position: number, count: number) =>
    `${name} moved to ${position} of ${count}`,
  hostRemoved: (name: string) => `${name} removed`,
  searchTypes: 'Search types',
  currencyInUse: 'The currency cannot change once amounts are recorded against this event.',
  nameCount: (count: number, most: number) => `${count} of ${most} characters`,
  nameBlank: 'Give the event a name.',
  nameTooLong: (most: number) => `Shorten the name to ${most} characters or fewer.`,
  coverPhoto: 'Cover photo',
  defaultCover: 'Default cover',
  yourPhoto: 'Your photo',
  coverLine: 'Soirely’s cover, in this event’s own colours. Add your own photo if you like.',
  upload: 'Upload a photo',
  accepted: 'JPEG, PNG, WebP or HEIC, up to 15 MB, at least 1200 × 675 pixels.',
  refusedDimensions:
    'That photo is smaller than 1200 × 675 pixels, so it would look blurred. Choose a larger one.',
  changePhoto: 'Change photo',
  position: 'Photo position',
  top: 'Top',
  bottom: 'Bottom',
  showing: (part: 'top' | 'middle' | 'bottom') => `Showing the ${part} of the photo`,
  describe: 'Describe the image',
  describeHint:
    'What a screen reader says for the photo. Leave it blank if the photo is only decoration.',
  describeCount: (count: number, most: number) => `${count} of ${most} characters`,
  removePhoto: 'Remove photo',
  removePhotoLine: 'The default cover comes back.',
  usePhoto: 'Use this photo',
  coverMiddle: 'Cover · Showing the middle of the photo',
  searchEvents: 'Search events',
  clearField: 'Clear the search',
  filter: 'Filter',
  filterLabel: (what: string) => `Filter: ${what}`,
  all: 'All',
  when: 'When',
  anyType: 'Any type',
  anyTime: 'Any time',
  anyone: 'Anyone',
  thisWeek: 'This week',
  thisMonth: 'This month',
  nextThreeMonths: 'Next 3 months',
  between: 'Between dates…',
  from: 'From',
  to: 'To',
  clearSearch: 'Clear search',
  clearFilters: 'Clear filters',
  count: (count: number) => (count === 1 ? '1 event' : `${count} events`),
  noMatch: 'No events match',
  searchedAndFiltered: (q: string, filters: string) =>
    `You searched for “${q}” and filtered by ${filters}.`,
  searched: (q: string) => `You searched for “${q}”.`,
  filtered: (filters: string) => `You filtered by ${filters}.`,
  searchOff: 'Search needs a connection.',
  overview: 'Overview',
  back: 'Events',
  crumb: 'Breadcrumb',
} as const;

const W = EVENT_WORDS;

export type Area = SideArea;

const AREA_NAMES: Record<Area, string> = {
  overview: 'Overview',
  guests: 'Guests',
  menu: 'Menu',
  seating: 'Seating',
  messages: 'Messages',
  schedule: 'Schedule',
  staff: 'Staff',
  people: 'People',
  budget: 'Budget',
  reports: 'Reports',
};

export const AREAS: readonly { area: Area; name: string }[] = SIDE_AREAS.map((area) => ({
  area,
  name: AREA_NAMES[area],
}));

export const COMING: Record<Exclude<Area, 'overview' | 'people'>, string> = {
  guests: 'The guest list for this event is coming.',
  menu: 'The menu for this event is coming.',
  seating: 'The seating plan for this event is coming.',
  messages: 'Messages for this event are coming.',
  schedule: 'The schedule for this event is coming.',
  staff: 'Staffing for this event is coming.',
  budget: 'The budget for this event is coming.',
  reports: 'Reports for this event are coming.',
};

export function areaOf(value: string | null): Area {
  return AREAS.find((one) => one.area === value)?.area ?? 'overview';
}

export type Shown = EventPhase | 'calledOff';

export function shownOf(event: SampleEvent, now: Date): Shown {
  const phase = eventPhase(event, now);

  return phase === 'finished' && calledOff(event) ? 'calledOff' : phase;
}

const LOCALE = 'en-US';

export function rangeOf(event: SampleEvent, now: Date, keepDays = false): string {
  const days = eventDayWords(event, now, LOCALE, keepDays);

  switch (days.kind) {
    case 'calledOffOn':
      return W.calledOffOn(days.date);
    case 'oneDay':
      return days.day;
    case 'days':
      return W.days(days.first, days.last);
  }
}

export function placeOf(event: SampleEvent): string {
  return event.venue == null ? W.venueToBeConfirmed : `${event.venue.name}, ${event.venue.city}`;
}

export function lineOf(event: SampleEvent, now: Date, keepDays = false): string {
  return `${rangeOf(event, now, keepDays)} · ${placeOf(event)}`;
}

export function soonOf(event: SampleEvent, now: Date): string | null {
  if (now.getTime() >= Date.parse(event.startsAt)) return null;

  const distance = milestoneDistance(event.startsAt, event.timeZone, now);

  return distance.kind === 'inDays' ? W.inDays(distance.count) : W.today;
}

export function localDay(moment: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { dateStyle: 'short', timeZone }).format(
    new Date(moment),
  );
}

export function localTime(moment: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(new Date(moment));
}

export type GlassKind = 'draft' | 'live' | 'now' | 'paused' | 'finished' | 'calledOff';

export interface Card {
  tags: readonly { kind: GlassKind | null; word: string }[];
  step:
    | { kind: 'next'; title: string; line: string }
    | { kind: 'button'; line: string; label: string; does: CardDoes };
}

export type CardDoes = 'makeLive' | 'changeDates' | 'resume' | 'duplicate';

export function cardOf(event: SampleEvent, now: Date): Card {
  const shown = shownOf(event, now);
  const soon = soonOf(event, now);
  const moment = (iso: string) =>
    formatEventMoment(iso, event.timeZone, LOCALE, notThisYear(event.timeZone, now, iso));
  const toThen = (iso: string) => {
    const distance = milestoneDistance(iso, event.timeZone, now);

    return distance.kind === 'inDays' ? W.inDays(distance.count) : W.today;
  };

  switch (shown) {
    case 'draft': {
      const passed = now.getTime() >= Date.parse(event.endsAt);

      return {
        tags: [{ kind: 'draft', word: W.phase.draft }, ...soonTag(passed ? null : soon)],
        step: passed
          ? { kind: 'button', line: W.endPassed, label: W.changeDates, does: 'changeDates' }
          : { kind: 'button', line: W.guestsBlocked, label: W.makeLive, does: 'makeLive' },
      };
    }
    case 'live':
      return {
        tags: [{ kind: 'live', word: W.phase.live }, ...soonTag(soon)],
        step: {
          kind: 'next',
          title: W.nextStarts(event.name),
          line: `${moment(event.startsAt)} · ${toThen(event.startsAt)}`,
        },
      };
    case 'happening_now': {
      const first = wallDayNumber(event.startsAt, event.timeZone);
      const total = wallDayNumber(event.endsAt, event.timeZone) - first + 1;

      return {
        tags: [
          { kind: 'now', word: W.phase.happening_now },
          ...(total > 1
            ? [{ kind: null, word: W.dayOf(wallDayNumber(now, event.timeZone) - first + 1, total) }]
            : []),
        ],
        step: {
          kind: 'next',
          title: W.nextEnds(event.name),
          line: `${moment(event.endsAt)} · ${toThen(event.endsAt)}`,
        },
      };
    }
    case 'paused':
      return {
        tags: [{ kind: 'paused', word: W.phase.paused }, ...soonTag(soon)],
        step: { kind: 'button', line: W.nextResume, label: W.resume, does: 'resume' },
      };
    case 'finished':
      return {
        tags: [{ kind: 'finished', word: W.phase.finished }],
        step: { kind: 'button', line: W.allPassed, label: W.duplicate, does: 'duplicate' },
      };
    case 'calledOff':
      return {
        tags: [{ kind: 'calledOff', word: W.phase.calledOff }],
        step: {
          kind: 'button',
          line: W.calledOffNotice(
            calledOffDay(event.concludedAt ?? event.endsAt, event.timeZone, now, LOCALE),
          ),
          label: W.duplicate,
          does: 'duplicate',
        },
      };
  }
}

function soonTag(soon: string | null): Card['tags'] {
  return soon == null ? [] : [{ kind: null, word: soon }];
}

export type Manage = 'duplicate' | 'pause' | 'callOff' | 'endNow' | 'delete';

export function manageOf(event: SampleEvent, now: Date): Manage[] {
  const phase = eventPhase(event, now);
  const end = endLabel(event, phase, now);

  return [
    'duplicate',
    ...(phase === 'live' || phase === 'happening_now' ? (['pause'] as const) : []),
    ...(end == null ? [] : [end]),
    'delete',
  ];
}

/** sc-1468: only a Draft with nobody on its list keeps the plain question; `people` is the Guests header's N, guests and companions together. */
export function needsName(event: SampleEvent, people: number): boolean {
  return event.status !== 'draft' || people > 0;
}

export function phaseWord(shown: Shown): string {
  return W.phase[shown];
}

export function tagKind(shown: Shown): MarkKind | 'now' {
  switch (shown) {
    case 'draft':
      return 'waiting';
    case 'live':
      return 'yes';
    case 'happening_now':
      return 'now';
    case 'paused':
      return 'paused';
    case 'finished':
    case 'calledOff':
      return 'ended';
  }
}

export type Tab = 'upcoming' | 'drafts' | 'past';

export const TABS: readonly Tab[] = ['upcoming', 'drafts', 'past'];

export const PAST_PAGE = 10;

export interface Listed {
  upcoming: SampleEvent[];
  drafts: SampleEvent[];
  past: SampleEvent[];
  happeningNow: SampleEvent[];
}

/** The organisation's events with none on one tab, so the other tabs, the counts and the summary stay true. */
export function withoutTab(events: readonly SampleEvent[], tab: Tab, now: Date): SampleEvent[] {
  const lists = listed(events, now);
  const gone = tab === 'upcoming' ? [...lists.happeningNow, ...lists.upcoming] : lists[tab];

  return events.filter((event) => !gone.includes(event));
}

export function listed(events: readonly SampleEvent[], now: Date): Listed {
  const home = eventsHome(
    {
      unfinished: events
        .filter((event) => eventPhase(event, now) !== 'finished')
        .map((event) => ({ ...event, phase: eventPhase(event, now) })),
      past: events
        .filter((event) => eventPhase(event, now) === 'finished')
        .map((event) => ({ ...event, phase: eventPhase(event, now) })),
      pastTotal: events.filter((event) => eventPhase(event, now) === 'finished').length,
      at: now,
    },
    now,
    LOCALE,
  );
  const back = (list: readonly { id: string }[]) =>
    list.map(({ id }) => events.find((event) => event.id === id) as SampleEvent);

  return {
    upcoming: back(home.upcoming),
    drafts: back(home.drafts),
    past: back(home.past),
    happeningNow: back(home.happeningNow),
  };
}

export function offRule(shown: Shown, tab: Tab): boolean {
  if (shown === 'happening_now') return true;
  if (tab === 'upcoming') return shown !== 'live';
  if (tab === 'drafts') return shown !== 'draft';

  return shown !== 'finished';
}

let remembered: Tab = 'upcoming';

export function rememberedTab(): Tab {
  return remembered;
}

export function rememberTab(tab: Tab): void {
  remembered = tab;
}

function folded(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[‘’]/g, "'")
    .toLowerCase();
}

/** The sample's stand-in for the API's search: name or venue, any part of a word, case and accents ignored; within a filter any of, across filters all of; a day of it in `span`. */
export function matches(
  event: SampleEvent,
  look: EventsLook,
  span: { from: string; to: string } | null,
): boolean {
  const q = folded(look.q.trim());
  const named =
    !searching(look.q) ||
    folded(event.name).includes(q) ||
    (event.venue != null && folded(event.venue.name).includes(q));
  const typed = look.filters.types.length === 0 || look.filters.types.includes(event.type);
  const hosted =
    look.filters.hosts.length === 0 ||
    event.hosts.some((host) => look.filters.hosts.includes(host));
  const first = localDay(event.startsAt, event.timeZone);
  const last = localDay(event.endsAt, event.timeZone);
  const dated =
    span == null ||
    ((span.from === '' || last >= span.from) && (span.to === '' || first <= span.to));

  return named && typed && hosted && dated;
}

export type ListState =
  | 'loading'
  | 'first'
  | 'firstAsk'
  | 'emptyUpcoming'
  | 'emptyDrafts'
  | 'emptyPast'
  | 'drafts'
  | 'past'
  | 'pastMore'
  | 'pastFailed'
  | 'failed'
  | 'offline'
  | 'search'
  | 'filtered'
  | 'filterOpen'
  | 'manyFilters'
  | 'manyFiltersOpen'
  | 'longHost'
  | 'noMatch'
  | 'noGuests'
  | 'replyLands'
  | 'noGuestsRead'
  | 'tileInvited'
  | 'tileReplied';

const LIST_STATES: readonly ListState[] = [
  'loading',
  'first',
  'firstAsk',
  'emptyUpcoming',
  'emptyDrafts',
  'emptyPast',
  'drafts',
  'past',
  'pastMore',
  'pastFailed',
  'failed',
  'offline',
  'search',
  'filtered',
  'filterOpen',
  'manyFilters',
  'manyFiltersOpen',
  'longHost',
  'noMatch',
  'noGuests',
  'replyLands',
  'noGuestsRead',
  'tileInvited',
  'tileReplied',
];

/** guests-a-spec §15 names Events' first run and its 0 for both demos; `first` and `noGuests` are this page's own. */
export function listStateOf(value: string | null): ListState | null {
  const named = value === 'eventsFirst' ? 'first' : value === 'eventsZero' ? 'noGuests' : value;

  return LIST_STATES.find((state) => state === named) ?? null;
}

export interface ListStart {
  loading: boolean;
  tab: Tab | null;
  first: boolean;
  asks: boolean;
  emptied: Tab | null;
  offline: boolean;
  pastPages: number;
  menu: 'top' | 'type' | null;
  look: EventsLook | null;
  noGuests: boolean;
  /** sc-3786: a reply lands on the wedding a moment after the page opens. */
  replyLands: boolean;
  /** Without guests.read, no guest numbers anywhere (sc-3786). */
  readsGuests: boolean;
  tile: 'invited' | 'replied' | null;
  failed: boolean;
  moreFailed: boolean;
}

/** More picks than Filter has room for at 1280, and more than the menu's Type and Hosted by rows have; the wedding this week still matches (sc-39348). */
export const MANY_FILTERS: EventsFilters = {
  types: ['wedding', 'birthday', 'gala', 'corporate'],
  when: { kind: 'week' },
  hosts: ['Adaeze Obi', 'Tunde Bakare', 'The Mensah family'],
};

export const LONG_HOST = 'Funmilayo Adéṣínà-Ọláolúwa';

export function listStart(state: ListState | null): ListStart {
  const rest: ListStart = {
    loading: false,
    tab: null,
    first: false,
    asks: false,
    emptied: null,
    offline: false,
    pastPages: 1,
    menu: null,
    look: null,
    noGuests: false,
    replyLands: false,
    readsGuests: true,
    tile: null,
    failed: false,
    moreFailed: false,
  };

  switch (state) {
    case null:
      return rest;
    case 'loading':
      return { ...rest, loading: true };
    case 'first':
      return { ...rest, first: true };
    case 'firstAsk':
      return { ...rest, first: true, asks: true };
    case 'emptyUpcoming':
      return { ...rest, tab: 'upcoming', emptied: 'upcoming' };
    case 'emptyDrafts':
      return { ...rest, tab: 'drafts', emptied: 'drafts' };
    case 'emptyPast':
      return { ...rest, tab: 'past', emptied: 'past' };
    case 'drafts':
      return { ...rest, tab: 'drafts' };
    case 'past':
      return { ...rest, tab: 'past' };
    case 'pastMore':
      return { ...rest, tab: 'past', pastPages: 2 };
    case 'pastFailed':
      return { ...rest, tab: 'past', moreFailed: true };
    case 'failed':
      return { ...rest, failed: true };
    case 'offline':
      return { ...rest, offline: true };
    case 'search':
      return { ...rest, look: { q: 'lucia', filters: NO_EVENTS_FILTERS } };
    case 'filtered':
      return {
        ...rest,
        look: { q: '', filters: { ...NO_EVENTS_FILTERS, types: ['wedding', 'birthday'] } },
      };
    case 'filterOpen':
      return { ...rest, tab: 'upcoming', menu: 'type' };
    case 'manyFilters':
      return { ...rest, look: { q: '', filters: MANY_FILTERS } };
    case 'manyFiltersOpen':
      return { ...rest, menu: 'top', look: { q: '', filters: MANY_FILTERS } };
    case 'longHost':
      return { ...rest, look: { q: '', filters: { ...NO_EVENTS_FILTERS, hosts: [LONG_HOST] } } };
    case 'noMatch':
      return {
        ...rest,
        look: { q: 'garden party', filters: { ...NO_EVENTS_FILTERS, types: ['wedding'] } },
      };
    case 'noGuests':
      return { ...rest, noGuests: true };
    case 'replyLands':
      return { ...rest, replyLands: true };
    case 'noGuestsRead':
      return { ...rest, readsGuests: false };
    case 'tileInvited':
      return { ...rest, tile: 'invited' };
    case 'tileReplied':
      return { ...rest, tile: 'replied' };
  }
}

export type PhaseState =
  'draft' | 'draftPast' | 'live' | 'now' | 'paused' | 'finished' | 'calledOff' | 'photo';

export type EditState =
  | 'dates'
  | 'datesChanged'
  | 'datesError'
  | 'datesReplyBy'
  | 'datesReplyByAsk'
  | 'discard'
  | 'changedElsewhere'
  | 'showLatest'
  | 'venue'
  | 'venueSuggestions'
  | 'venueZone'
  | 'venueDown'
  | 'venueNote'
  | 'venueNoteTooLong'
  | 'venueNoteRefused'
  | 'venueNoteForbidden'
  | 'hosts'
  | 'hostsDuplicate'
  | 'hostsSix'
  | 'lastHost'
  | 'type'
  | 'currency'
  | 'currencyRefused'
  | 'name'
  | 'nameBlank'
  | 'cover'
  | 'coverRefused'
  | 'coverPhoto'
  | 'replyBy'
  | 'replyByEmpty'
  | 'replyByError'
  | 'replyBySooner'
  | 'replyByNow'
  | 'replyBySaved'
  | 'replyByRemoved';

export type LifeState =
  | 'pause'
  | 'callOff'
  | 'endNow'
  | 'deleteDraft'
  | 'deleteDraftGuests'
  | 'delete'
  | 'deleteMismatch'
  | 'deleteTyped'
  | 'deleteRefused'
  | 'deleteRefusedStarted'
  | 'deleteRefusedRead'
  | 'deleteRefusedStartedRead'
  | 'deleteRace'
  | 'deleteRaceRead'
  | 'deleteRefusedPaused'
  | 'duplicate'
  | 'duplicateTicked'
  | 'duplicateNoGuests'
  | 'duplicateNoManage'
  | 'duplicateCreating'
  | 'duplicateNotCreated'
  | 'duplicateOverPlan'
  | 'duplicateOverPlanAsk'
  | 'duplicateOverCeiling'
  | 'duplicateNoStart'
  | 'muted'
  | 'muteNotLoaded'
  | 'muteNotSaved'
  | WriteState
  | ThankYouState;

export type NoteState = 'noteNoVenue' | 'noteWide' | 'noteMarkup';

export type EventStateName = PhaseState | EditState | LifeState | NeedsState | NoteState;

export const EVENT_STATES: Record<EventStateName, string> = {
  draft: 'evt-draft-4',
  draftPast: 'evt-shower-2',
  live: 'evt-wed-4',
  now: 'evt-wed-4',
  paused: 'evt-party-2',
  finished: 'evt-wed-4',
  calledOff: 'evt-off',
  photo: 'evt-wed-4',
  dates: 'evt-wed-4',
  datesChanged: 'evt-wed-4',
  datesError: 'evt-wed-4',
  datesReplyBy: 'evt-wed-4',
  datesReplyByAsk: 'evt-wed-4',
  discard: 'evt-wed-4',
  changedElsewhere: 'evt-wed-4',
  showLatest: 'evt-wed-4',
  venue: 'evt-wed-4',
  venueSuggestions: 'evt-wed-4',
  venueZone: 'evt-wed-4',
  venueDown: 'evt-wed-4',
  venueNote: 'evt-wed-4',
  venueNoteTooLong: 'evt-wed-4',
  venueNoteRefused: 'evt-wed-4',
  venueNoteForbidden: 'evt-wed-4',
  noteNoVenue: 'evt-wed-4',
  noteWide: 'evt-wed-4',
  noteMarkup: 'evt-wed-4',
  hosts: 'evt-wed-4',
  hostsDuplicate: 'evt-wed-4',
  hostsSix: 'evt-wed-4',
  lastHost: 'evt-party-2',
  type: 'evt-wed-4',
  currency: 'evt-wed-4',
  currencyRefused: 'evt-wed-4',
  name: 'evt-wed-4',
  nameBlank: 'evt-wed-4',
  cover: 'evt-wed-4',
  coverRefused: 'evt-wed-4',
  coverPhoto: 'evt-wed-4',
  replyBy: 'evt-wed-4',
  replyByEmpty: 'evt-draft-4',
  replyByError: 'evt-wed-4',
  replyBySooner: 'evt-wed-4',
  replyByNow: 'evt-wed-4',
  replyBySaved: 'evt-wed-4',
  replyByRemoved: 'evt-wed-4',
  pause: 'evt-wed-4',
  callOff: 'evt-party-2',
  endNow: 'evt-wed-4',
  deleteDraft: 'evt-cena-4',
  deleteDraftGuests: 'evt-draft-4',
  delete: 'evt-wed-4',
  deleteMismatch: 'evt-wed-4',
  deleteTyped: 'evt-wed-4',
  deleteRefused: 'evt-wed-4',
  deleteRefusedStarted: 'evt-wed-4',
  deleteRefusedRead: 'evt-wed-4',
  deleteRefusedStartedRead: 'evt-wed-4',
  deleteRace: 'evt-wed-4',
  deleteRaceRead: 'evt-wed-4',
  deleteRefusedPaused: 'evt-party-2',
  duplicate: 'evt-wed-4',
  duplicateTicked: 'evt-draft-4',
  duplicateNoGuests: 'evt-cena-4',
  duplicateNoManage: 'evt-wed-4',
  duplicateCreating: 'evt-draft-4',
  duplicateNotCreated: 'evt-draft-4',
  duplicateOverPlan: 'evt-wed-4',
  duplicateOverPlanAsk: 'evt-wed-4',
  duplicateOverCeiling: 'evt-wed-4',
  duplicateNoStart: 'evt-wed-4',
  muted: 'evt-wed-4',
  muteNotLoaded: 'evt-wed-4',
  muteNotSaved: 'evt-wed-4',
  guestsCanWriteOff: 'evt-wed-4',
  guestsCanWriteSaving: 'evt-wed-4',
  guestsCanWriteFailed: 'evt-wed-4',
  guestsCanWriteReadOnly: 'evt-wed-4',
  thankYouLine: 'evt-wed-4',
  thankYouAdding: 'evt-wed-4',
  thankYouEditing: 'evt-wed-4',
  thankYouSaving: 'evt-wed-4',
  thankYouNotSaved: 'evt-wed-4',
  thankYouOver: 'evt-wed-4',
  thankYouLong: 'evt-wed-4',
  thankYouReadOnly: 'evt-wed-4',
  thankYouReadOnlyNone: 'evt-wed-4',
  endNowThankYou: 'evt-wed-4',
  endNowLong: 'evt-wed-4',
  endNowOver: 'evt-wed-4',
  endNowEnding: 'evt-wed-4',
  endNowNotEnded: 'evt-wed-4',
  needsYou: 'evt-wed-4',
  needsYouOne: 'evt-wed-4',
  needsYouOverdue: 'evt-wed-4',
  needsYouGiven: 'evt-wed-4',
  needsYouReadOnly: 'evt-wed-4',
  needsYouLoading: 'evt-wed-4',
  needsYouFailed: 'evt-wed-4',
};

export function eventStateOf(value: string | null): EventStateName | null {
  return value != null && Object.hasOwn(EVENT_STATES, value) ? (value as EventStateName) : null;
}

export function clockOf(state: EventStateName | null): Date {
  if (
    state === 'now' ||
    state === 'endNow' ||
    isEndState(state) ||
    state === 'deleteRefusedStarted' ||
    state === 'deleteRefusedStartedRead'
  )
    return CLOCKS.now;
  if (state === 'finished' || isCardState(state)) return CLOCKS.finished;

  return CLOCKS.rest;
}

export type Part = 'dates' | 'replyBy' | 'venue' | 'hosts' | 'type' | 'currency' | 'name' | 'cover';

export function partOf(state: EventStateName | null): Part | null {
  switch (state) {
    case 'dates':
    case 'datesChanged':
    case 'datesError':
    case 'datesReplyBy':
    case 'datesReplyByAsk':
    case 'discard':
    case 'changedElsewhere':
    case 'showLatest':
      return 'dates';
    case 'venue':
    case 'venueSuggestions':
    case 'venueZone':
    case 'venueDown':
    case 'venueNote':
    case 'venueNoteTooLong':
    case 'venueNoteRefused':
    case 'venueNoteForbidden':
      return 'venue';
    case 'hosts':
    case 'hostsDuplicate':
    case 'hostsSix':
    case 'lastHost':
      return 'hosts';
    case 'type':
      return 'type';
    case 'currency':
    case 'currencyRefused':
      return 'currency';
    case 'name':
    case 'nameBlank':
      return 'name';
    case 'cover':
    case 'coverRefused':
    case 'coverPhoto':
      return 'cover';
    case 'replyBy':
    case 'replyByEmpty':
    case 'replyByError':
    case 'replyBySooner':
    case 'replyByNow':
      return 'replyBy';
    default:
      return null;
  }
}

/** A state drawn on another event, or one its phase does not allow, opens the page with no state. */
export function stateFits(state: EventStateName, event: SampleEvent): boolean {
  if (EVENT_STATES[state] !== event.id) return false;

  const now = clockOf(state);
  const manage = manageOf(event, now);
  const locked = eventPhase(event, now) === 'finished';

  if (state === 'pause') return manage.includes('pause');
  if (state === 'callOff') return manage.includes('callOff');
  if (state === 'endNow' || isEndState(state)) return manage.includes('endNow');
  if (isCardState(state)) return shownOf(event, now) === 'finished';
  const part = partOf(state);
  if (part === 'dates' || part === 'replyBy') return !locked;

  return true;
}

export interface SampleVenue {
  name: string;
  line: string;
  address: string;
  city: string;
  timeZone: string;
}

export const SUGGESTIONS: readonly SampleVenue[] = [
  {
    name: 'Eko Hotel',
    line: 'Adetokunbo Ademola Street, Victoria Island, Lagos',
    address: 'Adetokunbo Ademola Street, Victoria Island, Lagos',
    city: 'Lagos',
    timeZone: 'Africa/Lagos',
  },
  {
    name: 'Eko Hotel Convention Centre',
    line: '1415 Adetokunbo Ademola Street, Lagos',
    address: '1415 Adetokunbo Ademola Street, Lagos',
    city: 'Lagos',
    timeZone: 'Africa/Lagos',
  },
  {
    name: 'Eko Signature',
    line: 'Plot 1415 Adetokunbo Ademola Street, Lagos',
    address: 'Plot 1415 Adetokunbo Ademola Street, Lagos',
    city: 'Lagos',
    timeZone: 'Africa/Lagos',
  },
];

export function suggestionsFor(typed: string): readonly SampleVenue[] {
  const q = folded(typed.trim());
  const word = q.split(/\s+/)[0] ?? '';

  return q.length < 3
    ? []
    : SUGGESTIONS.filter((one) => folded(`${one.name} ${one.address}`).includes(word));
}

export const SIX_HOSTS = [
  'Adaeze Obi',
  'Tunde Bakare',
  'Ngozi Obi',
  'Emeka Obi',
  'Funke Bakare',
  'Segun Bakare',
];

export const PHOTO_DESCRIPTION = 'Adaeze and Tunde under the arch at The Landmark';

function on(state: EventStateName, name: string): DemoLink {
  return { to: `/demo/events/${EVENT_STATES[state]}?state=${state}`, name };
}

function list(state: ListState | null, name: string): DemoLink {
  return { to: state == null ? '/demo/events' : `/demo/events?state=${state}`, name };
}

export const EVENTS_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The list',
    states: [
      list(null, 'Upcoming, the soonest as the card'),
      list('drafts', 'Drafts, the soonest with its dates passed'),
      list('past', 'Past, a page of ten'),
      list('pastMore', 'Past, after Show more'),
      list('pastFailed', 'Past, More finished events did not load'),
      list('failed', 'The events did not load'),
      list('loading', 'Loading, the card and rows as shapes'),
      list('first', 'A first run'),
      list('firstAsk', 'A first run, without Create events'),
      list('emptyUpcoming', 'Nothing on Upcoming'),
      list('emptyDrafts', 'No drafts'),
      list('emptyPast', 'Nothing on Past'),
      list('offline', 'Offline'),
      list('noGuests', 'Nobody invited yet, the guest counts at 0'),
      list('replyLands', 'A reply lands: 97 coming, 24 haven’t replied, in place'),
      list('tileInvited', 'Guests invited chosen: the events with invited guests, and Clear'),
      list('tileReplied', 'Replies in chosen: the events with guests who haven’t replied'),
      list('noGuestsRead', 'Without guests.read: no guest numbers anywhere'),
    ],
  },
  {
    name: 'New event, its top once the band has gone (sc-39509)',
    states: [{ to: '/demo/events/new', name: 'New event: ‹ Events and the bell, then the title' }],
  },
  {
    name: 'Searching and filtering',
    states: [
      { to: '/demo/events?q=lucia', name: 'Searching “lucia”' },
      list('filterOpen', 'The Filter menu, on Type'),
      { to: '/demo/events?type=wedding,birthday', name: 'Filtered by Wedding and Birthday' },
      list('manyFilters', 'More filters than fit on a line'),
      list('manyFiltersOpen', 'The Filter menu, its rows ending in +N more'),
      list('longHost', 'One host longer than the line'),
      { to: '/demo/events?q=garden+party&type=wedding', name: 'No match' },
    ],
  },
  {
    name: 'An event, by phase',
    states: [
      on('draft', 'Draft'),
      on('draftPast', 'Draft, its dates passed'),
      on('live', 'Live'),
      on('now', 'Happening now'),
      on('paused', 'Paused'),
      on('finished', 'Finished'),
      on('calledOff', 'Called off'),
      on('photo', 'Live, with a cover photo'),
    ],
  },
  {
    name: 'Needs you, on the Overview',
    states: [
      on('needsYou', 'Rows, an overdue one first, with and without its button'),
      on('needsYouOne', 'One row'),
      on('needsYouOverdue', 'Overdue on the day, 1 day and 2 days, and a tie by title'),
      on('needsYouGiven', 'A copy recorded, its row gone'),
      on('live', 'Nothing needs you'),
      on('now', 'Nothing needs you, the event started'),
      on('needsYouReadOnly', 'Nothing needs you, a member who only reads the menu'),
      on('needsYouLoading', 'Not loaded yet'),
      on('needsYouFailed', 'The read failed'),
    ],
  },
  {
    name: 'Dates and venue, in place',
    states: [
      on('dates', 'Dates, opened'),
      on('datesChanged', 'Dates, the start moved'),
      on('datesError', 'Dates, the end before the start'),
      on('datesReplyBy', 'Dates, the start on the Reply by day (sc-3780)'),
      on('datesReplyByAsk', 'Dates asks before closing replies sooner (sc-3780)'),
      on('discard', 'Cancel with a change'),
      on('changedElsewhere', 'Changed elsewhere'),
      on('showLatest', 'Show the latest'),
      on('venue', 'Venue, opened'),
      on('venueSuggestions', 'Venue, suggestions'),
      on('venueZone', 'Venue, in another time zone'),
      on('venueDown', 'Venue, the lookup down'),
    ],
  },
  {
    name: 'The arrival note (sc-24385)',
    states: [
      on('venueNote', 'Venue, the arrival note under Address'),
      on('venueNoteTooLong', 'Venue, a note of 501 characters: refused before sending'),
      on('venueNoteRefused', 'Venue, the note refused by the server (422)'),
      on('venueNoteForbidden', 'Venue, a role changed while open (403)'),
      on('noteNoVenue', 'Details, Venue to be confirmed with a note'),
      on('noteWide', 'Details, a note of 500 characters with no spaces'),
      on('noteMarkup', 'Details, markup typed as text'),
    ],
  },
  {
    name: 'Hosts, type, currency, name and cover, in place',
    states: [
      on('hosts', 'Hosted by'),
      on('hostsDuplicate', 'Hosted by, the same name twice'),
      on('hostsSix', 'Hosted by, six'),
      on('lastHost', 'Hosted by, the last host'),
      on('type', 'Type'),
      on('currency', 'Currency'),
      on('currencyRefused', 'Currency, refused'),
      on('name', 'Event name'),
      on('nameBlank', 'Event name, blank'),
      on('cover', 'Cover, the default'),
      on('coverRefused', 'Cover, a photo refused'),
      on('coverPhoto', 'Cover, a photo'),
    ],
  },
  {
    name: 'Reply by, in place (sc-3780)',
    states: [
      on('replyBy', 'Reply by, opened'),
      on('replyByEmpty', 'Reply by, no date yet'),
      on('replyByError', 'Reply by, on the day it starts'),
      on('replyBySooner', 'Reply by, moved sooner'),
      on('replyByNow', 'Reply by, moved into the past'),
      on('replyBySaved', 'Reply by, saved'),
      on('replyByRemoved', 'Reply by, removed'),
    ],
  },
  {
    name: 'Pause, end, delete, duplicate and mute',
    states: [
      on('pause', 'Pause'),
      on('callOff', 'Call off'),
      on('endNow', 'End now'),
      on('deleteDraft', 'Delete a draft with nobody on its list'),
      on('deleteDraftGuests', 'Delete a draft with people on its list, type its name'),
      on('delete', 'Delete, type its name'),
      on('deleteMismatch', 'Delete, not a match'),
      on('deleteTyped', 'Delete, the name typed'),
      on('deleteRefused', 'Delete, refused: call it off first'),
      on('deleteRefusedStarted', 'Delete, refused from the start: end it first'),
      on('deleteRefusedRead', 'Delete, refused without Events at Change'),
      on('deleteRefusedStartedRead', 'Delete, refused without Events at Change, from the start'),
      on('deleteRace', 'Delete, a guest invited while the name is typed'),
      on('deleteRaceRead', 'Delete, the same race without Events at Change'),
      on('deleteRefusedPaused', 'Delete, refused on the Paused party: call it off first'),
      on('duplicate', 'Duplicate'),
      on('duplicateTicked', 'Duplicate, the guest list ticked'),
      on('duplicateNoGuests', 'Duplicate, no guests'),
      on('duplicateNoManage', 'Duplicate, without guests.manage'),
      on('duplicateCreating', 'Duplicate, creating'),
      on('duplicateNotCreated', 'Duplicate, not created'),
      on('duplicateOverPlan', 'Duplicate, the copy over the plan'),
      on('duplicateOverPlanAsk', 'Duplicate, the copy over the plan, Ask an owner'),
      on('duplicateOverCeiling', 'Duplicate, the copy over the ceiling'),
      on('duplicateNoStart', 'Duplicate, Starts left empty'),
      on('muted', 'Muted'),
      on('muteNotLoaded', 'Mute, not loaded'),
      on('muteNotSaved', 'Mute, not saved'),
    ],
  },
  {
    name: 'Guests can write from their page (sc-3978)',
    states: [
      { to: '/demo/events/evt-wed-4', name: 'Guests can write from their page, on' },
      on('guestsCanWriteOff', 'Guests can write from their page, off'),
      on('guestsCanWriteSaving', 'Guests can write from their page, saving'),
      on('guestsCanWriteFailed', 'Guests can write from their page, not saved'),
      on('guestsCanWriteReadOnly', 'Guests can write from their page, without messages.manage'),
    ],
  },
  {
    name: 'A thank-you for your guests (sc-6476)',
    states: [
      on('finished', 'Finished, Add a thank-you'),
      on('thankYouAdding', 'The field open, empty'),
      on('thankYouLine', 'The line, signed with the hosts, and Edit thank-you'),
      on('thankYouEditing', 'Edit thank-you, the field holds the line'),
      on('thankYouSaving', 'Saving…'),
      on('thankYouNotSaved', 'Not saved, the text kept'),
      on('thankYouOver', 'Over 280, Save pressed: nothing sent'),
      on('thankYouLong', 'A 280-character line'),
      on('thankYouReadOnly', 'Without the permission to end it: the line, read-only'),
      on('thankYouReadOnlyNone', 'Without the permission to end it, no line: no card'),
      on('endNow', 'End now, the field left empty'),
      on('endNowThankYou', 'End now, with a thank-you'),
      on('endNowLong', 'End now, 280 characters'),
      on('endNowOver', 'End now, over 280: nothing sent'),
      on('endNowEnding', 'End now, Ending…'),
      on('endNowNotEnded', 'End now, not ended, the thank-you kept'),
    ],
  },
  {
    name: 'The event’s areas',
    states: [
      { to: '/demo/events/evt-wed-4?area=menu', name: 'Menu, coming' },
      { to: '/demo/events/evt-wed-4?area=messages', name: 'Messages, coming' },
      { to: '/demo/events/evt-wed-4?area=budget', name: 'Budget, coming' },
    ],
  },
];

export interface Wall {
  date: string;
  time: string;
}

export function wallOf(moment: string, timeZone: string): Wall {
  return { date: localDay(moment, timeZone), time: localTime(moment, timeZone) };
}

function offsetAt(instant: number, timeZone: string): number {
  const at = new Date(instant).toISOString();

  return Date.parse(`${localDay(at, timeZone)}T${localTime(at, timeZone)}Z`) - instant;
}

export function instantOf(date: string, time: string, timeZone: string): string | null {
  const wall = savedWallClock(date, time, timeZone);
  const guess = wall == null ? Number.NaN : Date.parse(`${wall}Z`);

  if (Number.isNaN(guess)) return null;

  const instant = guess - offsetAt(guess - offsetAt(guess, timeZone), timeZone);

  return new Date(instant).toISOString().replace('.000Z', 'Z');
}

export function latestOf(event: SampleEvent): SampleEvent {
  const later = (moment: string) =>
    new Date(Date.parse(moment) + 3_600_000).toISOString().replace('.000Z', 'Z');

  return { ...event, startsAt: later(event.startsAt), endsAt: later(event.endsAt) };
}
