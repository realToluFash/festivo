import { EVENT_AREAS, type EventArea, type EventState, type EventType } from '@soirely/domain';

import { ORGANISATION } from '../settings/MembersSample.ts';
import type { EventKey } from '../today.ts';

export { ORGANISATION };

export type MeshKey = 'rose' | 'teal' | 'accent' | 'amber';

const MESHES: readonly MeshKey[] = ['rose', 'teal', 'accent', 'amber'];

/** Main's `meshFor` (apps/mobile/src/kit/today.ts), which this branch does not have yet: the colour is the event's id. */
export function meshFor(id: string): MeshKey {
  const sum = [...id].reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 7);

  return MESHES[sum % MESHES.length] ?? 'accent';
}

export interface SampleVenue {
  name: string;
  address: string;
  /** The list's place: the venue and its town. */
  place: string;
}

export interface SampleEvent {
  id: string;
  name: string;
  type: EventType;
  venue: SampleVenue | null;
  timeZone: string;
  startsAt: string;
  endsAt: string;
  hosts: readonly string[];
  currency: string;
  status: EventState;
  concludedAt: string | null;
  photo: boolean;
}

/** The reader's clock, Tue, Nov 3, 2026, 09:41 in London; then the wedding's second day, and the week after it. */
export const CLOCKS = {
  reader: '2026-11-03T09:41:00Z',
  happening: '2026-11-06T16:10:00Z',
  finished: '2026-11-11T09:41:00Z',
} as const;

export const READER_ZONE = 'Europe/London';
export const OFFLINE_AS_OF = '09:32';
export const RESTORE_UNTIL = 'Monday, Nov 16 at 14:20 GMT';
export const PHOTO_DESCRIPTION = 'Adaeze and Tunde under the arch at The Landmark';

interface Row {
  id: string;
  name: string;
  type: EventType;
  venue: SampleVenue | null;
  timeZone: string;
  at: readonly [string, string];
  hosts: readonly string[];
  currency: string;
  status: EventState;
  concludedAt?: string;
  photo?: boolean;
}

function venue(name: string, address: string, town: string): SampleVenue {
  return { name, address, place: `${name}, ${town}` };
}

const LONDON = 'Europe/London';
const LISBON = 'Europe/Lisbon';
const LAGOS = 'Africa/Lagos';

const ROWS: readonly Row[] = [
  {
    id: 'evt-wed-4',
    name: 'Adaeze & Tunde’s wedding',
    type: 'wedding',
    venue: venue('The Landmark', '222 Marylebone Road, London NW1 6JQ', 'London'),
    timeZone: LONDON,
    at: ['2026-11-05T18:00:00Z', '2026-11-07T15:00:00Z'],
    hosts: ['Adaeze Obi', 'Tunde Bakare'],
    currency: 'GBP',
    status: 'live',
  },
  {
    id: 'evt-ireti-2',
    name: 'Ireti at 40',
    type: 'birthday',
    venue: venue('Oslo Hall', '1 Oslo Street, London E2 8AB', 'London'),
    timeZone: LONDON,
    at: ['2026-11-13T19:00:00Z', '2026-11-14T01:00:00Z'],
    hosts: ['Ireti Bankole'],
    currency: 'GBP',
    status: 'live',
  },
  {
    id: 'evt-gala-4',
    name: 'Gala Fundación Lucía',
    type: 'gala',
    venue: venue('Casa de América', 'Plaza de Cibeles 2, 28014 Madrid', 'Madrid'),
    timeZone: 'Europe/Madrid',
    at: ['2026-11-14T18:30:00Z', '2026-11-14T22:30:00Z'],
    hosts: ['Fundación Lucía'],
    currency: 'EUR',
    status: 'live',
    photo: true,
  },
  {
    id: 'evt-party-2',
    name: 'Ire Events end-of-year party',
    type: 'corporate',
    venue: venue('The Clerk’s House', '235 Shoreditch High Street, London E1 6PJ', 'London'),
    timeZone: LONDON,
    at: ['2026-12-03T18:30:00Z', '2026-12-03T23:30:00Z'],
    hosts: ['Ire Events'],
    currency: 'GBP',
    status: 'paused',
  },
  {
    id: 'evt-shower-2',
    name: 'Kemi’s baby shower',
    type: 'baby_shower',
    venue: venue('The Orangery', 'Kensington Gardens, London W8 4PX', 'London'),
    timeZone: LONDON,
    at: ['2026-10-24T12:00:00Z', '2026-10-24T16:00:00Z'],
    hosts: ['Kemi Adebayo'],
    currency: 'GBP',
    status: 'draft',
  },
  {
    id: 'evt-cena-4',
    name: 'Cena benéfica Fundación Lucía',
    type: 'gala',
    venue: null,
    timeZone: 'Europe/Madrid',
    at: ['2026-12-12T19:00:00Z', '2026-12-12T22:30:00Z'],
    hosts: [],
    currency: 'EUR',
    status: 'draft',
  },
  {
    id: 'evt-draft-4',
    name: 'Bisi & Kola’s engagement',
    type: 'engagement',
    venue: null,
    timeZone: LONDON,
    at: ['2027-01-09T14:00:00Z', '2027-01-09T22:00:00Z'],
    hosts: [],
    currency: 'GBP',
    status: 'draft',
  },
  {
    id: 'evt-off',
    name: 'Team offsite',
    type: 'corporate',
    venue: venue('Quinta da Regaleira', 'Rua Barbosa du Bocage 5, 2710-567 Sintra', 'Sintra'),
    timeZone: LISBON,
    at: ['2026-11-12T09:00:00Z', '2026-11-13T17:00:00Z'],
    hosts: ['Ire Events'],
    currency: 'EUR',
    status: 'ended',
    concludedAt: '2026-10-30T10:00:00Z',
  },
  past(
    'evt-grad-3',
    'Ana’s graduation lunch',
    'graduation',
    ['2026-10-23T11:30:00Z', '2026-10-23T15:30:00Z'],
    {
      venue: venue('Quinta das Flores', 'Rua das Flores 12, 1200-195 Lisboa', 'Lisbon'),
      timeZone: LISBON,
      hosts: ['Ana Ferreira'],
      currency: 'EUR',
    },
  ),
  past(
    'evt-rafa-2',
    'Rafael & Inês’s wedding',
    'wedding',
    ['2026-10-17T14:00:00Z', '2026-10-17T22:30:00Z'],
    {
      venue: venue('Quinta do Torneiro', 'Oeiras', 'Oeiras'),
      timeZone: LISBON,
      hosts: ['Rafael Costa', 'Inês Duarte'],
      currency: 'EUR',
    },
  ),
  past(
    'evt-quince-4',
    'Lucía’s quinceañera',
    'cultural',
    ['2026-10-11T00:00:00Z', '2026-10-11T05:59:00Z'],
    {
      venue: venue('Hacienda de los Morales', 'Mexico City', 'Mexico City'),
      timeZone: 'America/Mexico_City',
      hosts: ['Familia Ortega'],
      currency: 'MXN',
    },
  ),
  past(
    'evt-mtl-3',
    'Montréal launch',
    'corporate',
    ['2026-10-08T21:30:00Z', '2026-10-09T01:00:00Z'],
    {
      venue: venue('Le Windsor', 'Montréal', 'Montréal'),
      timeZone: 'America/Toronto',
      hosts: ['Ire Events'],
      currency: 'CAD',
    },
  ),
  past(
    'evt-chidi-2',
    'Chidi’s 30th',
    'birthday',
    ['2026-09-26T18:00:00Z', '2026-09-26T22:00:00Z'],
    {
      venue: venue('The Book Club', 'London', 'London'),
      timeZone: LONDON,
      hosts: ['Chidi Okafor'],
      currency: 'GBP',
    },
  ),
  past(
    'evt-naming-3',
    'Amara’s naming ceremony',
    'cultural',
    ['2026-09-18T10:00:00Z', '2026-09-18T14:00:00Z'],
    {
      venue: venue('The Wheatbaker', 'Lagos', 'Lagos'),
      timeZone: LAGOS,
      hosts: ['Nkem Eze'],
      currency: 'NGN',
    },
  ),
  past(
    'evt-summer-3',
    'Ire Events summer party',
    'party',
    ['2026-08-22T12:00:00Z', '2026-08-22T17:00:00Z'],
    {
      venue: venue('Sky Garden', 'London', 'London'),
      timeZone: LONDON,
      hosts: ['Ire Events'],
      currency: 'GBP',
    },
  ),
  past(
    'evt-anniv-4',
    'Funmi & Dayo’s anniversary',
    'anniversary',
    ['2026-07-18T15:00:00Z', '2026-07-18T21:00:00Z'],
    {
      venue: venue('Eko Hotel', 'Lagos', 'Lagos'),
      timeZone: LAGOS,
      hosts: ['Funmi Ade'],
      currency: 'NGN',
    },
  ),
  past(
    'evt-sofia',
    'Festa da Sofia',
    'birthday',
    ['2026-06-13T17:00:00Z', '2026-06-13T22:00:00Z'],
    {
      venue: venue('Casa Natura', 'São Paulo', 'São Paulo'),
      timeZone: 'America/Sao_Paulo',
      hosts: ['Sofia Lima'],
      currency: 'BRL',
    },
  ),
  past(
    'evt-grace',
    'Remembering Grace Mensah',
    'memorial',
    ['2026-05-29T10:00:00Z', '2026-05-29T13:00:00Z'],
    {
      venue: venue('Holy Trinity Cathedral', 'Accra', 'Accra'),
      timeZone: 'Africa/Accra',
      hosts: ['The Mensah family'],
      currency: 'GHS',
    },
  ),
  past(
    'evt-lea-2',
    'Léa & Hugo’s engagement',
    'engagement',
    ['2026-05-16T16:00:00Z', '2026-05-16T21:00:00Z'],
    {
      venue: venue('Le Pavillon', 'Lyon', 'Lyon'),
      timeZone: 'Europe/Paris',
      hosts: ['Léa Martin', 'Hugo Bernard'],
      currency: 'EUR',
    },
  ),
  past(
    'evt-tomi-3',
    'Tomi’s graduation',
    'graduation',
    ['2026-03-14T12:00:00Z', '2026-03-14T16:00:00Z'],
    {
      venue: venue('The Queens Hotel', 'Leeds', 'Leeds'),
      timeZone: LONDON,
      hosts: ['Tomi Adeyemi'],
      currency: 'GBP',
    },
  ),
];

function past(
  id: string,
  name: string,
  type: EventType,
  at: readonly [string, string],
  rest: Pick<Row, 'venue' | 'timeZone' | 'hosts' | 'currency'>,
): Row {
  return { id, name, type, at, ...rest, status: 'ended', concludedAt: at[1] };
}

export const EVENTS: readonly SampleEvent[] = ROWS.map((row) => ({
  id: row.id,
  name: row.name,
  type: row.type,
  venue: row.venue,
  timeZone: row.timeZone,
  startsAt: row.at[0],
  endsAt: row.at[1],
  hosts: row.hosts,
  currency: row.currency,
  status: row.status,
  concludedAt: row.concludedAt ?? null,
  photo: row.photo ?? false,
}));

export function sampleEvent(id: string | undefined): SampleEvent | null {
  return EVENTS.find((event) => event.id === id) ?? null;
}

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

export const CURRENCIES: readonly { code: string; name: string }[] = [
  { code: 'GBP', name: 'Pound sterling' },
  { code: 'EUR', name: 'Euro' },
  { code: 'USD', name: 'US dollar' },
  { code: 'CAD', name: 'Canadian dollar' },
  { code: 'NGN', name: 'Nigerian naira' },
  { code: 'GHS', name: 'Ghanaian cedi' },
  { code: 'BRL', name: 'Brazilian real' },
  { code: 'MXN', name: 'Mexican peso' },
];

export function currencyWords(code: string): string {
  const named = CURRENCIES.find((currency) => currency.code === code);

  return named == null ? code : `${named.code} · ${named.name}`;
}

/** The zones the sample's events are in, for the Dates edit's picker. */
export const ZONES: readonly string[] = [...new Set(ROWS.map((row) => row.timeZone))].sort();

export interface Suggestion {
  name: string;
  address: string;
  timeZone: string;
}

export const SUGGESTIONS: readonly Suggestion[] = [
  {
    name: 'Eko Hotel',
    address: 'Adetokunbo Ademola Street, Victoria Island, Lagos',
    timeZone: LAGOS,
  },
  {
    name: 'Eko Hotel Convention Centre',
    address: '1415 Adetokunbo Ademola Street, Lagos',
    timeZone: LAGOS,
  },
  { name: 'Eko Signature', address: 'Plot 1415 Adetokunbo Ademola Street, Lagos', timeZone: LAGOS },
  { name: 'The Landmark', address: '222 Marylebone Road, London NW1 6JQ', timeZone: LONDON },
];

export const SIX_HOSTS: readonly string[] = [
  'Adaeze Obi',
  'Tunde Bakare',
  'Ngozi Obi',
  'Emeka Obi',
  'Funke Bakare',
  'Segun Bakare',
];

export type AreaKey = EventArea | 'people';

/** Main's areas with People after Staff, as the People branches have it. */
export const AREAS: readonly AreaKey[] = EVENT_AREAS.flatMap((area): AreaKey[] =>
  area === 'staff' ? [area, 'people'] : [area],
);

export const PHONE_TABS: readonly AreaKey[] = ['overview', 'guests', 'menu', 'messages'];

export const MORE_AREAS: readonly AreaKey[] = AREAS.filter((area) => !PHONE_TABS.includes(area));

export function areaOf(value: string | undefined): AreaKey | null {
  return AREAS.find((area) => area === value) ?? null;
}

/** Today's four events, by the ids the boards give them. */
export const EVENT_OF_KEY: Record<EventKey, string> = {
  wed: 'evt-wed-4',
  ireti: 'evt-ireti-2',
  party: 'evt-party-2',
  draft: 'evt-draft-4',
};
