import { SEARCH_LEAST } from '@soirely/domain';

import { type Mesh, meshFor } from '../mesh.ts';

export type GroupKey = 'events' | 'guests' | 'members';

export type Found =
  | { kind: 'event'; id: string; name: string; line: string; mesh: Mesh }
  | { kind: 'guest'; id: string; name: string; line: string; event: string; guest?: string }
  | { kind: 'member'; id: string; name: string; line: string; standing: Standing | null };

export interface Group {
  key: GroupKey;
  heading: string;
  rows: readonly Found[];
}

/** What a person may find: events.read, guests.read on at least one event, members.read, and members.manage for Awaiting approval. */
export interface Reach {
  events: boolean;
  guests: boolean;
  members: boolean;
  manage: boolean;
}

export const REACHES = {
  owner: { events: true, guests: true, members: true, manage: true },
  member: { events: true, guests: true, members: false, manage: false },
  planner: { events: true, guests: false, members: true, manage: false },
  nobody: { events: false, guests: false, members: false, manage: false },
} as const satisfies Record<string, Reach>;

export function reachOfRole(role: 'Owner' | 'Admin' | 'Member'): Reach {
  return role === 'Member' ? REACHES.member : REACHES.owner;
}

export type Standing = 'Invited' | 'Awaiting approval' | 'Suspended';

export const SHOWN_IN_GROUP = 5;

export const TYPING_PAUSE_MS = 250;

export const SEARCH_WORDS = {
  search: 'Search',
  placeholder: (reach: Reach) => FIELD_WORDS[kindsOf(reach)][0],
  idle: (reach: Reach) => FIELD_WORDS[kindsOf(reach)][1],
  short: 'Type at least 2 characters.',
  searching: 'Searching…',
  showAll: 'Show all in Events',
  nothing: (term: string) => `Nothing matches “${term}”.`,
  clear: 'Clear search',
  offline: 'Search needs a connection.',
  keys: '↑ ↓ to move · Enter to open · Esc to close',
  results: 'Results',
  matches: (count: number) => (count === 1 ? '1 match' : `${count} matches`),
  headings: { events: 'Events', guests: 'Guests', members: 'Members' } as Record<GroupKey, string>,
  ownDesign: (name: string) => `${name} has its own design.`,
};

type Kinds = '' | 'e' | 'g' | 'm' | 'eg' | 'em' | 'gm' | 'egm';

/** One whole sentence for each combination of kinds, never assembled from words; nothing to find is "Search" and no hint. */
const FIELD_WORDS: Record<Kinds, readonly [string, string | null]> = {
  egm: ['Search events, guests and members', 'Find an event, a guest or a member.'],
  eg: ['Search events and guests', 'Find an event or a guest.'],
  em: ['Search events and members', 'Find an event or a member.'],
  gm: ['Search guests and members', 'Find a guest or a member.'],
  e: ['Search events', 'Find an event.'],
  g: ['Search guests', 'Find a guest.'],
  m: ['Search members', 'Find a member.'],
  '': ['Search', null],
};

function kindsOf(reach: Reach): Kinds {
  return `${reach.events ? 'e' : ''}${reach.guests ? 'g' : ''}${reach.members ? 'm' : ''}` as Kinds;
}

const event = (id: string, name: string, line: string, venue: string | null) => ({
  id,
  name,
  line,
  venue,
});

export const SEARCH_EVENTS = [
  event(
    'evt-wed-4',
    'Adaeze & Tunde’s wedding',
    'Thu, Nov 5 to Sat, Nov 7 · The Landmark, London',
    'The Landmark',
  ),
  event(
    'evt-ireti-2',
    'Ireti at 40',
    'Fri, Nov 13 to Sat, Nov 14 · Oslo Hall, London',
    'Oslo Hall',
  ),
  event(
    'evt-gala-4',
    'Gala Fundación Lucía',
    'Sat, Nov 14 · Casa de América, Madrid',
    'Casa de América',
  ),
  event(
    'evt-party-2',
    'Ire Events end-of-year party',
    'Thu, Dec 3 · The Clerk’s House, London',
    'The Clerk’s House',
  ),
  event('evt-cena-4', 'Cena benéfica Fundación Lucía', 'Sat, Dec 12 · Venue to be confirmed', null),
  event(
    'evt-off',
    'Team offsite',
    'Thu, Nov 12 to Fri, Nov 13 · Quinta da Regaleira, Sintra',
    'Quinta da Regaleira',
  ),
  event(
    'evt-grad-3',
    'Ana’s graduation lunch',
    'Fri, Oct 23 · Quinta das Flores, Lisbon',
    'Quinta das Flores',
  ),
  event(
    'evt-rafa-2',
    'Rafael & Inês’s wedding',
    'Sat, Oct 17 · Quinta do Torneiro, Oeiras',
    'Quinta do Torneiro',
  ),
  event(
    'evt-casamento-4',
    'Casamento de Maria Eduarda Albuquerque e João Pedro Vasconcelos',
    'Sat, May 22, 2027 · Quinta da Regaleira, Sintra',
    'Quinta da Regaleira',
  ),
  event(
    'evt-fado',
    'Quintas de fado no jardim',
    'Thu, Nov 19 · Casa do Jardim, Lisbon',
    'Casa do Jardim',
  ),
  event(
    'evt-vindima',
    'Vindima weekend',
    'Sat, Sep 11, 2027 · Quinta do Crasto, Douro',
    'Quinta do Crasto',
  ),
] as const;

const FIRST_DAYS: Record<string, string> = {
  'evt-wed-4': 'Thu, Nov 5',
  'evt-rafa-2': 'Sat, Oct 17',
  'evt-gala-4': 'Sat, Nov 14',
  'evt-ireti-2': 'Fri, Nov 13',
  'evt-off': 'Thu, Nov 12',
  'evt-party-2': 'Thu, Dec 3',
};

/** `guest` is the guest's id where the Guests demo has them on that event. */
export const SEARCH_GUESTS: readonly { name: string; event: string; guest?: string }[] = [
  { name: 'Inês Duarte', event: 'evt-wed-4', guest: 'ines' },
  { name: 'Inês Duarte', event: 'evt-rafa-2' },
  { name: 'Inès Laurent', event: 'evt-gala-4' },
  { name: 'Inés García', event: 'evt-gala-4' },
  { name: 'Ines Okafor', event: 'evt-ireti-2' },
  { name: 'Inês Almeida', event: 'evt-off' },
  { name: 'Agnes Inesi', event: 'evt-party-2' },
  { name: 'Kwame Mensah', event: 'evt-wed-4', guest: 'kwame' },
  { name: 'Lucía Ortega', event: 'evt-wed-4', guest: 'lucia' },
];

/** Members as Settings › Members lists them; an Invited person has no name yet. */
export const SEARCH_MEMBERS: readonly {
  name: string | null;
  role: string;
  email: string;
  standing: Standing | null;
}[] = [
  { name: 'Folake Adeyemi', role: 'Owner', email: 'folake@ire-events.com', standing: null },
  { name: 'Inês Santos', role: 'Admin', email: 'ines.santos@ire-events.com', standing: null },
  { name: 'Inês Santos', role: 'Member', email: 'ines.s@gmail.com', standing: 'Suspended' },
  { name: null, role: 'Member', email: 'ines.moura@gmail.com', standing: 'Invited' },
  {
    name: 'Inês Rocha',
    role: 'Member',
    email: 'ines.rocha@outlook.com',
    standing: 'Awaiting approval',
  },
  { name: 'Julien Moreau', role: 'Admin', email: 'julien@ire-events.com', standing: null },
  { name: 'Kemi Adebayo', role: 'Member', email: 'kemi@ire-events.com', standing: null },
];

export function folded(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[‘’]/g, "'")
    .toLowerCase()
    .trim();
}

export function longEnough(term: string): boolean {
  return term.trim().length >= SEARCH_LEAST;
}

export function eventName(id: string): string {
  return SEARCH_EVENTS.find((one) => one.id === id)?.name ?? '';
}

const collator = new Intl.Collator('en', { sensitivity: 'base' });

/** Names that begin with the typed text first, then those that only contain it, each part alphabetical. */
export function ranked(rows: readonly Found[], term: string): Found[] {
  const q = folded(term);
  const rank = (row: Found) => (folded(row.name).startsWith(q) ? 0 : 1);

  return [...rows].sort(
    (a, b) => rank(a) - rank(b) || collator.compare(a.name, b.name) || collator.compare(a.id, b.id),
  );
}

/** Events, Guests and Members in that order, each only for a person who may open it, and an empty group left out. */
export function groupsFor(term: string, reach: Reach): Group[] {
  if (!longEnough(term)) return [];

  const q = folded(term);
  const has = (text: string | null) => text != null && folded(text).includes(q);
  const events: Found[] = reach.events
    ? SEARCH_EVENTS.filter((one) => has(one.name) || has(one.venue)).map((one) => ({
        kind: 'event',
        id: one.id,
        name: one.name,
        line: one.line,
        mesh: meshFor(one.id),
      }))
    : [];
  const people: Found[] = reach.guests
    ? SEARCH_GUESTS.filter((one) => has(one.name)).map((one) => ({
        kind: 'guest',
        id: `${one.event}:${one.guest ?? one.name}`,
        name: one.name,
        line: `${eventName(one.event)} · ${FIRST_DAYS[one.event] ?? ''}`,
        event: one.event,
        ...(one.guest == null ? {} : { guest: one.guest }),
      }))
    : [];
  const members: Found[] = reach.members
    ? SEARCH_MEMBERS.filter(
        (one) =>
          (reach.manage || one.standing !== 'Awaiting approval') &&
          (has(one.name) || has(one.email)),
      ).map((one) => ({
        kind: 'member',
        id: one.email,
        name: one.name ?? one.email,
        line: one.name == null ? one.role : `${one.email} · ${one.role}`,
        standing: one.standing,
      }))
    : [];
  const groups: Group[] = [
    { key: 'events', heading: SEARCH_WORDS.headings.events, rows: ranked(events, term) },
    { key: 'guests', heading: SEARCH_WORDS.headings.guests, rows: ranked(people, term) },
    { key: 'members', heading: SEARCH_WORDS.headings.members, rows: ranked(members, term) },
  ];

  return groups.filter((group) => group.rows.length > 0);
}

export type Stop = { kind: 'row'; row: Found; group: GroupKey } | { kind: 'more'; group: GroupKey };

/** Each group's first five; past five, Events alone adds Show all in Events, since more typing narrows the others. */
export function stopsOf(groups: readonly Group[]): Stop[] {
  return groups.flatMap((group): Stop[] => {
    const more = group.key === 'events' && group.rows.length > SHOWN_IN_GROUP;

    return [
      ...group.rows
        .slice(0, SHOWN_IN_GROUP)
        .map((row): Stop => ({ kind: 'row', row, group: group.key })),
      ...(more ? [{ kind: 'more', group: group.key } as const] : []),
    ];
  });
}

export function countOf(groups: readonly Group[]): number {
  return groups.reduce((total, group) => total + group.rows.length, 0);
}

export function saidOf(term: string, groups: readonly Group[]): string {
  const count = countOf(groups);

  return count === 0 ? SEARCH_WORDS.nothing(term.trim()) : SEARCH_WORDS.matches(count);
}

/** ↑ ↓ stop at either end; Home and End jump there. */
export function moved(at: number, key: string, count: number): number | null {
  if (count === 0) return null;
  if (key === 'ArrowDown') return Math.min(at + 1, count - 1);
  if (key === 'ArrowUp') return Math.max(at - 1, 0);
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;

  return null;
}

export function onApple(platform: string | undefined): boolean {
  return /mac|iphone|ipad|ipod/i.test(platform ?? '');
}

export function keyHint(platform: string | undefined): string {
  return onApple(platform) ? '⌘K' : 'Ctrl K';
}

export function browserPlatform(): string | undefined {
  const agent = navigator as Navigator & { userAgentData?: { platform?: string } };

  return agent.userAgentData?.platform ?? navigator.platform;
}

export type Phase = 'idle' | 'short' | 'loading' | 'found' | 'offline';

export const SEARCH_STATES = [
  { key: 'idle', term: '', name: 'Idle, an owner: Find an event, a guest or a member.' },
  { key: 'short', term: 'i', name: 'Under 2 characters: “i”' },
  { key: 'loading', term: 'ine', name: 'Loading: three skeleton rows' },
  {
    key: 'mixed',
    term: 'ines',
    name: '“ines”, an owner: Events 1, Guests 7 with 5 shown, Members 4 with their standing',
  },
  { key: 'one', term: 'landmark', name: '“landmark”: one event, by its venue' },
  { key: 'none', term: 'garden party', name: 'No match: “garden party”, with Clear search' },
  { key: 'member', term: 'ines', name: 'Kemi Adebayo, a Member: events and guests, no Members' },
  {
    key: 'no-guests',
    term: 'ines',
    name: 'A custom role with events and members, no guests and no members.manage',
  },
  { key: 'nothing-to-find', term: '', name: 'A role that can find nothing: “Search”, no hint' },
  { key: 'two-events', term: 'duarte', name: '“duarte”: one guest on two events, two rows' },
  { key: 'long', term: 'quinta', name: '“quinta”: Events 6 with Show all in Events, a long name' },
  { key: 'offline', term: 'ines', name: 'Offline: Search needs a connection.' },
] as const;

export type SearchStateName = (typeof SEARCH_STATES)[number]['key'];

export interface SearchStart {
  term: string;
  phase: Phase;
  reach: Reach;
}

export function searchStateOf(raw: string | null): SearchStateName | null {
  return SEARCH_STATES.find((one) => one.key === raw)?.key ?? null;
}

export function phaseOf(term: string): Phase {
  if (term.trim() === '') return 'idle';

  return longEnough(term) ? 'found' : 'short';
}

const STATE_REACH: Partial<Record<SearchStateName, Reach>> = {
  member: REACHES.member,
  'no-guests': REACHES.planner,
  'nothing-to-find': REACHES.nobody,
};

export function searchStart(
  state: SearchStateName | null,
  reach: Reach = REACHES.owner,
): SearchStart {
  const term = SEARCH_STATES.find((one) => one.key === state)?.term ?? '';
  const phase = state === 'loading' ? 'loading' : state === 'offline' ? 'offline' : phaseOf(term);

  return {
    term,
    phase,
    reach: (state == null ? undefined : STATE_REACH[state]) ?? reach,
  };
}

export const SEARCH_PAGES: readonly {
  name: string;
  states: readonly { to: string; name: string }[];
}[] = [
  {
    name: 'Search as a command palette, over Today',
    states: SEARCH_STATES.map((state) => ({
      to: `/demo/search?state=${state.key}`,
      name: state.name,
    })),
  },
];
