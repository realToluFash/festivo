import {
  EVENT_TYPES,
  type EventPhase,
  type EventState,
  type EventType,
  calledOff,
  endLabel,
  eventDays,
  eventPhase,
  eventsHome,
  formatEventDate,
  formatEventMoment,
  formatEventShortDay,
  formatEventWeekday,
  hostsLine,
  milestoneDistance,
  savedWallClock,
} from '@soirely/domain';

import type { MarkKind } from '../components/SettingsParts.tsx';
import type { DemoLink } from './settings.ts';
import type { EventKey } from './today.ts';
import { type Mesh, meshFor } from '../mesh.ts';

export interface Venue {
  name: string;
  address: string | null;
  city: string;
}

export interface SampleEvent {
  id: string;
  name: string;
  type: EventType;
  status: EventState;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  concludedAt: string | null;
  venue: Venue | null;
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
    ['Funmi Ade'],
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

export function keepCopy(of: SampleEvent, startsAt: string): SampleEvent {
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

  copies = [...copies, copy];

  return copy;
}

export const DISTINCT_HOSTS: readonly string[] = [
  ...new Set(SAMPLE_EVENTS.flatMap((event) => event.hosts)),
].sort(new Intl.Collator('en').compare);

/** The words main has (events, eventPage, eventLive, eventEnd, eventPause, eventDelete, eventDuplicate, eventEdit, eventHosts, eventCover, eventNav, timeline), then the new ones the boards add, for review. */
export const EVENT_WORDS = {
  title: 'Events',
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
  venue: 'Venue',
  openInMaps: 'Open in maps',
  hostedBy: 'Hosted by',
  noHosts: 'No hosts yet',
  noHostsLine: 'The event can be made live once it has at least one.',
  type: 'Type',
  currency: 'Currency',
  nameAndCover: 'Name and cover',
  eventName: 'Event name',
  cover: 'Cover',
  manage: 'Manage',
  justForYou: 'Just for you',
  mute: 'Mute this event',
  muteNote: 'Nobody else on this event is affected.',
  muteNotLoaded: 'Could not check whether this event is muted.',
  muteNotSaved: 'Not saved. Try again.',
  notificationSettings: 'Notification settings',
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
  removes:
    'This removes, for your whole team: the event, its details and its schedule. Guests following their link will see that it isn’t available.',
  restoreWindow: (deadline: string) =>
    `If this was a mistake, support can restore it until ${deadline}. After that it’s gone for good.`,
  restoreUntil: 'Monday, Nov 16 at 14:20 GMT',
  typeName: (name: string) => `Type ${name} to delete it`,
  typeHint: 'Type it exactly, capitals included. A straight or curly apostrophe both count.',
  mismatch: (name: string) => `Type ${name} exactly as shown to delete it.`,
  keepIt: 'Keep it',
  delete: 'Delete',
  deleted: (name: string) => `${name} was deleted.`,
  duplicateTitle: (name: string) => `Duplicate ${name}`,
  duplicateLine:
    'Makes a new draft with the same name. Only your team sees it until you make it live.',
  createDraft: 'Create draft',
  copied: 'Copied',
  copiedItems: [
    'Name',
    'Type',
    'Venue',
    'Cover and its description',
    'Time zone',
    'Currency',
    'Length',
  ],
  notCopied: 'Not copied',
  notCopiedItems: ['Hosts', 'Guests', 'Replies', 'Anything that happened at the event'],
  starts: 'Starts',
  ends: 'Ends',
  copyEnds: (end: string, hours: string, zone: string) =>
    `It ends ${end}, ${hours} later, like the original. Times in ${zone}.`,
  created: 'Draft created. Opening it.',
  guestsPage: 'Guests’ page',
  preview: 'Preview the guests’ page',
  previewLine: 'What somebody you invite sees, before they reply',
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

export type Area =
  | 'overview'
  | 'guests'
  | 'menu'
  | 'seating'
  | 'messages'
  | 'schedule'
  | 'staff'
  | 'people'
  | 'budget'
  | 'reports';

/** main's EVENT_AREAS, with People between Staff and Budget as the web's People branch (sc-29915, #1354) has it. */
export const AREAS: readonly { area: Area; name: string }[] = [
  { area: 'overview', name: 'Overview' },
  { area: 'guests', name: 'Guests' },
  { area: 'menu', name: 'Menu' },
  { area: 'seating', name: 'Seating' },
  { area: 'messages', name: 'Messages' },
  { area: 'schedule', name: 'Schedule' },
  { area: 'staff', name: 'Staff' },
  { area: 'people', name: 'People' },
  { area: 'budget', name: 'Budget' },
  { area: 'reports', name: 'Reports' },
];

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

export function rangeOf(event: SampleEvent, keepDays = false): string {
  const days = eventDays(event);

  if (days.kind === 'calledOffOn' && !keepDays)
    return W.calledOffOn(formatEventShortDay(days.concludedAt, event.timeZone, LOCALE));
  if (days.kind === 'oneDay' || (days.kind === 'calledOffOn' && sameDay(event)))
    return formatEventWeekday(event.startsAt, event.timeZone, LOCALE);

  return W.days(
    formatEventWeekday(event.startsAt, event.timeZone, LOCALE),
    formatEventWeekday(event.endsAt, event.timeZone, LOCALE),
  );
}

function sameDay(event: SampleEvent): boolean {
  return localDay(event.startsAt, event.timeZone) === localDay(event.endsAt, event.timeZone);
}

export function placeOf(event: SampleEvent): string {
  return event.venue == null ? W.venueToBeConfirmed : `${event.venue.name}, ${event.venue.city}`;
}

export function lineOf(event: SampleEvent, keepDays = false): string {
  return `${rangeOf(event, keepDays)} · ${placeOf(event)}`;
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

export interface DayTile {
  weekday: string;
  day: string;
  today: boolean;
}

export function dayTiles(event: SampleEvent, now: Date): DayTile[] {
  const first = localDay(event.startsAt, event.timeZone);
  const last = localDay(event.endsAt, event.timeZone);
  const today = localDay(now, event.timeZone);
  const tiles: DayTile[] = [];

  for (let day = first; day <= last; day = nextDay(day)) {
    const noon = new Date(`${day}T12:00:00Z`);
    tiles.push({
      weekday: new Intl.DateTimeFormat(LOCALE, { weekday: 'short', timeZone: 'UTC' }).format(noon),
      day: new Intl.DateTimeFormat(LOCALE, { day: 'numeric', timeZone: 'UTC' }).format(noon),
      today: day === today,
    });
  }

  return tiles.length > 1 ? tiles : [];
}

export function nextDay(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);

  return date.toISOString().slice(0, 10);
}

export type GlassKind = 'draft' | 'live' | 'now' | 'paused' | 'finished' | 'calledOff';

export interface Card {
  tags: readonly { kind: GlassKind | null; word: string }[];
  tiles: DayTile[];
  step:
    | { kind: 'next'; title: string; line: string }
    | { kind: 'button'; line: string; label: string; does: CardDoes };
}

export type CardDoes = 'makeLive' | 'changeDates' | 'resume' | 'duplicate';

export function cardOf(event: SampleEvent, now: Date): Card {
  const shown = shownOf(event, now);
  const soon = soonOf(event, now);
  const tiles = shown === 'finished' || shown === 'calledOff' ? [] : dayTiles(event, now);
  const moment = (iso: string) => formatEventMoment(iso, event.timeZone, LOCALE);
  const toThen = (iso: string) => {
    const distance = milestoneDistance(iso, event.timeZone, now);

    return distance.kind === 'inDays' ? W.inDays(distance.count) : W.today;
  };

  switch (shown) {
    case 'draft': {
      const passed = now.getTime() >= Date.parse(event.endsAt);

      return {
        tags: [{ kind: 'draft', word: W.phase.draft }, ...soonTag(passed ? null : soon)],
        tiles,
        step: passed
          ? { kind: 'button', line: W.endPassed, label: W.changeDates, does: 'changeDates' }
          : { kind: 'button', line: W.guestsBlocked, label: W.makeLive, does: 'makeLive' },
      };
    }
    case 'live':
      return {
        tags: [{ kind: 'live', word: W.phase.live }, ...soonTag(soon)],
        tiles,
        step: {
          kind: 'next',
          title: W.nextStarts(event.name),
          line: `${moment(event.startsAt)} · ${toThen(event.startsAt)}`,
        },
      };
    case 'happening_now': {
      const lit = tiles.findIndex((tile) => tile.today);

      return {
        tags: [
          { kind: 'now', word: W.phase.happening_now },
          ...(tiles.length > 1 && lit >= 0
            ? [{ kind: null, word: W.dayOf(lit + 1, tiles.length) }]
            : []),
        ],
        tiles,
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
        tiles,
        step: { kind: 'button', line: W.nextResume, label: W.resume, does: 'resume' },
      };
    case 'finished':
      return {
        tags: [{ kind: 'finished', word: W.phase.finished }],
        tiles,
        step: { kind: 'button', line: W.allPassed, label: W.duplicate, does: 'duplicate' },
      };
    case 'calledOff':
      return {
        tags: [{ kind: 'calledOff', word: W.phase.calledOff }],
        tiles,
        step: {
          kind: 'button',
          line: W.calledOffNotice(
            formatEventDate(event.concludedAt ?? event.endsAt, event.timeZone, LOCALE),
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

export function needsName(event: SampleEvent): boolean {
  return event.status !== 'draft';
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

export type When = 'any' | 'week' | 'month' | 'quarter' | 'between';

export interface Filters {
  q: string;
  types: readonly EventType[];
  from: string;
  to: string;
  hosts: readonly string[];
}

export const NO_FILTERS: Filters = { q: '', types: [], from: '', to: '', hosts: [] };

const DAY_PATTERN = /^\d{4}-\d\d-\d\d$/;

/** q, type, from, to and host, as the address carries them: several types as `type=wedding,birthday`, each host its own `host=`. */
export function filtersOf(params: URLSearchParams): Filters {
  const types = params
    .getAll('type')
    .flatMap((value) => value.split(','))
    .filter((value): value is EventType => (EVENT_TYPES as readonly string[]).includes(value));
  const day = (value: string | null) => (value != null && DAY_PATTERN.test(value) ? value : '');

  return {
    q: params.get('q') ?? '',
    types: EVENT_TYPES.filter((type) => types.includes(type)),
    from: day(params.get('from')),
    to: day(params.get('to')),
    hosts: DISTINCT_HOSTS.filter((host) => params.getAll('host').includes(host)),
  };
}

export function paramsOf(filters: Filters, keep: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams();

  for (const [name, value] of keep)
    if (!['q', 'type', 'from', 'to', 'host', 'state'].includes(name)) next.append(name, value);
  if (filters.q !== '') next.set('q', filters.q);
  if (filters.types.length > 0) next.set('type', filters.types.join(','));
  if (filters.from !== '') next.set('from', filters.from);
  if (filters.to !== '') next.set('to', filters.to);
  for (const host of filters.hosts) next.append('host', host);

  return next;
}

export function searching(filters: Filters): boolean {
  return filters.q.trim().length >= 2;
}

export function filtering(filters: Filters): boolean {
  return (
    filters.types.length > 0 || filters.from !== '' || filters.to !== '' || filters.hosts.length > 0
  );
}

function folded(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[‘’]/g, "'")
    .toLowerCase();
}

export function whenRange(when: Exclude<When, 'any' | 'between'>, now: Date): [string, string] {
  const today = localDay(now, 'Europe/London');
  const date = new Date(`${today}T12:00:00Z`);
  const shift = (days: number) => {
    const moved = new Date(date);
    moved.setUTCDate(moved.getUTCDate() + days);

    return moved.toISOString().slice(0, 10);
  };

  if (when === 'week') {
    const monday = (date.getUTCDay() + 6) % 7;

    return [shift(-monday), shift(6 - monday)];
  }
  if (when === 'month') {
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12));

    return [`${today.slice(0, 8)}01`, last.toISOString().slice(0, 10)];
  }

  const later = new Date(date);
  later.setUTCMonth(later.getUTCMonth() + 3);

  return [today, later.toISOString().slice(0, 10)];
}

export function whenOf(filters: Filters, now: Date): When {
  if (filters.from === '' && filters.to === '') return 'any';

  for (const when of ['week', 'month', 'quarter'] as const) {
    const [from, to] = whenRange(when, now);
    if (filters.from === from && filters.to === to) return when;
  }

  return 'between';
}

export function whenWord(filters: Filters, now: Date): string {
  const when = whenOf(filters, now);
  const day = (value: string) =>
    new Intl.DateTimeFormat(LOCALE, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${value}T12:00:00Z`));

  switch (when) {
    case 'any':
      return W.anyTime;
    case 'week':
      return W.thisWeek;
    case 'month':
      return W.thisMonth;
    case 'quarter':
      return W.nextThreeMonths;
    case 'between':
      return filters.from !== '' && filters.to !== ''
        ? W.days(day(filters.from), day(filters.to))
        : day(filters.from || filters.to);
  }
}

/** Name or venue, any part of a word, case and accents ignored; within a filter any of, across filters all of; a day of it in the range. */
export function matches(event: SampleEvent, filters: Filters): boolean {
  const q = folded(filters.q.trim());
  const named =
    !searching(filters) ||
    folded(event.name).includes(q) ||
    (event.venue != null && folded(event.venue.name).includes(q));
  const typed = filters.types.length === 0 || filters.types.includes(event.type);
  const hosted =
    filters.hosts.length === 0 || event.hosts.some((host) => filters.hosts.includes(host));
  const first = localDay(event.startsAt, event.timeZone);
  const last = localDay(event.endsAt, event.timeZone);
  const dated =
    (filters.from === '' || last >= filters.from) && (filters.to === '' || first <= filters.to);

  return named && typed && hosted && dated;
}

export function filterWord(filters: Filters, now: Date): string {
  const chosen = chosenWords(filters, now);

  return chosen.length === 0 ? W.all : chosen.join(', ');
}

function chosenWords(filters: Filters, now: Date): string[] {
  return [
    ...filters.types.map((type) => TYPE_WORDS[type]),
    ...(filters.from === '' && filters.to === '' ? [] : [whenWord(filters, now)]),
    ...filters.hosts,
  ];
}

export function noMatchLine(filters: Filters, now: Date): string {
  const chosen = hostsLine(chosenWords(filters, now), LOCALE);
  const q = filters.q.trim();

  if (searching(filters) && filtering(filters)) return W.searchedAndFiltered(q, chosen);

  return searching(filters) ? W.searched(q) : W.filtered(chosen);
}

export type ListState =
  | 'first'
  | 'drafts'
  | 'past'
  | 'pastMore'
  | 'offline'
  | 'search'
  | 'filtered'
  | 'filterOpen'
  | 'noMatch';

const LIST_STATES: readonly ListState[] = [
  'first',
  'drafts',
  'past',
  'pastMore',
  'offline',
  'search',
  'filtered',
  'filterOpen',
  'noMatch',
];

export function listStateOf(value: string | null): ListState | null {
  return LIST_STATES.find((state) => state === value) ?? null;
}

export interface ListStart {
  tab: Tab | null;
  first: boolean;
  offline: boolean;
  pastPages: number;
  menu: 'top' | 'type' | null;
  filters: Filters | null;
}

export function listStart(state: ListState | null): ListStart {
  const rest: ListStart = {
    tab: null,
    first: false,
    offline: false,
    pastPages: 1,
    menu: null,
    filters: null,
  };

  switch (state) {
    case null:
      return rest;
    case 'first':
      return { ...rest, first: true };
    case 'drafts':
      return { ...rest, tab: 'drafts' };
    case 'past':
      return { ...rest, tab: 'past' };
    case 'pastMore':
      return { ...rest, tab: 'past', pastPages: 2 };
    case 'offline':
      return { ...rest, offline: true };
    case 'search':
      return { ...rest, filters: { ...NO_FILTERS, q: 'lucia' } };
    case 'filtered':
      return { ...rest, filters: { ...NO_FILTERS, types: ['wedding', 'birthday'] } };
    case 'filterOpen':
      return { ...rest, tab: 'upcoming', menu: 'type' };
    case 'noMatch':
      return { ...rest, filters: { ...NO_FILTERS, q: 'garden party', types: ['wedding'] } };
  }
}

export type PhaseState =
  'draft' | 'draftPast' | 'live' | 'now' | 'paused' | 'finished' | 'calledOff' | 'photo';

export type EditState =
  | 'dates'
  | 'datesChanged'
  | 'datesError'
  | 'discard'
  | 'changedElsewhere'
  | 'showLatest'
  | 'venue'
  | 'venueSuggestions'
  | 'venueZone'
  | 'venueDown'
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
  | 'coverPhoto';

export type LifeState =
  | 'pause'
  | 'callOff'
  | 'endNow'
  | 'deleteDraft'
  | 'delete'
  | 'deleteMismatch'
  | 'deleteTyped'
  | 'duplicate'
  | 'muted'
  | 'muteNotLoaded'
  | 'muteNotSaved';

export type EventStateName = PhaseState | EditState | LifeState;

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
  discard: 'evt-wed-4',
  changedElsewhere: 'evt-wed-4',
  showLatest: 'evt-wed-4',
  venue: 'evt-wed-4',
  venueSuggestions: 'evt-wed-4',
  venueZone: 'evt-wed-4',
  venueDown: 'evt-wed-4',
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
  pause: 'evt-wed-4',
  callOff: 'evt-party-2',
  endNow: 'evt-wed-4',
  deleteDraft: 'evt-draft-4',
  delete: 'evt-wed-4',
  deleteMismatch: 'evt-wed-4',
  deleteTyped: 'evt-wed-4',
  duplicate: 'evt-wed-4',
  muted: 'evt-wed-4',
  muteNotLoaded: 'evt-wed-4',
  muteNotSaved: 'evt-wed-4',
};

export function eventStateOf(value: string | null): EventStateName | null {
  return value != null && Object.hasOwn(EVENT_STATES, value) ? (value as EventStateName) : null;
}

export function clockOf(state: EventStateName | null): Date {
  if (state === 'now' || state === 'endNow') return CLOCKS.now;
  if (state === 'finished') return CLOCKS.finished;

  return CLOCKS.rest;
}

export type Part = 'dates' | 'venue' | 'hosts' | 'type' | 'currency' | 'name' | 'cover';

export function partOf(state: EventStateName | null): Part | null {
  switch (state) {
    case 'dates':
    case 'datesChanged':
    case 'datesError':
    case 'discard':
    case 'changedElsewhere':
    case 'showLatest':
      return 'dates';
    case 'venue':
    case 'venueSuggestions':
    case 'venueZone':
    case 'venueDown':
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
  if (state === 'endNow') return manage.includes('endNow');
  if (partOf(state) === 'dates') return !locked;

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
      list('first', 'A first run'),
      list('offline', 'Offline'),
    ],
  },
  {
    name: 'Searching and filtering',
    states: [
      { to: '/demo/events?q=lucia', name: 'Searching “lucia”' },
      list('filterOpen', 'The Filter menu, on Type'),
      { to: '/demo/events?type=wedding,birthday', name: 'Filtered by Wedding and Birthday' },
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
    name: 'Dates and venue, in place',
    states: [
      on('dates', 'Dates, opened'),
      on('datesChanged', 'Dates, the start moved'),
      on('datesError', 'Dates, the end before the start'),
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
    name: 'Pause, end, delete, duplicate and mute',
    states: [
      on('pause', 'Pause'),
      on('callOff', 'Call off'),
      on('endNow', 'End now'),
      on('deleteDraft', 'Delete a draft'),
      on('delete', 'Delete, type its name'),
      on('deleteMismatch', 'Delete, not a match'),
      on('deleteTyped', 'Delete, the name typed'),
      on('duplicate', 'Duplicate'),
      on('muted', 'Muted'),
      on('muteNotLoaded', 'Mute, not loaded'),
      on('muteNotSaved', 'Mute, not saved'),
    ],
  },
  {
    name: 'The event’s areas',
    states: [
      { to: '/demo/events/evt-wed-4?area=guests', name: 'Guests, coming' },
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

export function copyStart(event: SampleEvent): Wall {
  return wallOf(
    new Date(Date.parse(event.startsAt) + 364 * 86_400_000).toISOString(),
    event.timeZone,
  );
}

export function latestOf(event: SampleEvent): SampleEvent {
  const later = (moment: string) =>
    new Date(Date.parse(moment) + 3_600_000).toISOString().replace('.000Z', 'Z');

  return { ...event, startsAt: later(event.startsAt), endsAt: later(event.endsAt) };
}
