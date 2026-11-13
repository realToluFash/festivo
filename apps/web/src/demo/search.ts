import { SEARCH_LEAST } from '@soirely/domain';

import { type Mesh, meshFor } from '../mesh.ts';

export type GroupKey = 'events' | 'guests' | 'members';

export type Found =
  | { kind: 'event'; id: string; name: string; line: string; mesh: Mesh }
  | { kind: 'guest'; id: string; name: string; line: string; event: string }
  | { kind: 'member'; id: string; name: string; line: string };

export interface Group {
  key: GroupKey;
  heading: string;
  rows: readonly Found[];
}

export const SHOWN_IN_GROUP = 5;

export const TYPING_PAUSE_MS = 250;

export const SEARCH_WORDS = {
  search: 'Search',
  placeholder: (guests: boolean) =>
    guests ? 'Search events, guests and members' : 'Search events and members',
  idle: (guests: boolean) =>
    guests ? 'Find an event, a guest or a member' : 'Find an event or a member',
  short: 'Type at least 2 characters.',
  searching: 'Searching…',
  showAll: (count: number) => `Show all ${count}`,
  nothing: (term: string) => `Nothing matches “${term}”`,
  nothingLine: 'Search finds events by name or venue, and guests and members by name.',
  notLoaded: 'Not loaded.',
  tryAgain: 'Try again',
  keys: '↑ ↓ to move · Enter to open · Esc to close',
  results: 'Results',
  matches: (count: number) => (count === 1 ? '1 match' : `${count} matches`),
  headings: { events: 'Events', guests: 'Guests', members: 'Members' } as Record<GroupKey, string>,
};

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
] as const;

const FIRST_DAYS: Record<string, string> = {
  'evt-wed-4': 'Thu, Nov 5',
  'evt-rafa-2': 'Sat, Oct 17',
  'evt-gala-4': 'Sat, Nov 14',
  'evt-ireti-2': 'Fri, Nov 13',
  'evt-off': 'Thu, Nov 12',
  'evt-party-2': 'Thu, Dec 3',
};

export const SEARCH_GUESTS: readonly { name: string; event: string }[] = [
  { name: 'Inês Duarte', event: 'evt-wed-4' },
  { name: 'Inês Duarte', event: 'evt-rafa-2' },
  { name: 'Inès Laurent', event: 'evt-gala-4' },
  { name: 'Inés García', event: 'evt-gala-4' },
  { name: 'Ines Okafor', event: 'evt-ireti-2' },
  { name: 'Inês Almeida', event: 'evt-off' },
  { name: 'Agnes Inesi', event: 'evt-party-2' },
  { name: 'Kwame Mensah', event: 'evt-wed-4' },
  { name: 'Lucía Ortega', event: 'evt-wed-4' },
];

export const SEARCH_MEMBERS: readonly { name: string; role: string; email: string }[] = [
  { name: 'Folake Adeyemi', role: 'Owner', email: 'folake@ire-events.com' },
  { name: 'Inês Santos', role: 'Admin', email: 'ines.santos@ire-events.com' },
  { name: 'Julien Moreau', role: 'Admin', email: 'julien@ire-events.com' },
  { name: 'Kemi Adebayo', role: 'Member', email: 'kemi@ire-events.com' },
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

function eventName(id: string): string {
  return SEARCH_EVENTS.find((one) => one.id === id)?.name ?? '';
}

/** Events, Guests and Members in that order, an empty group left out, and no Guests at all for a role that cannot open an event's guests. */
export function groupsFor(term: string, guests: boolean): Group[] {
  if (!longEnough(term)) return [];

  const q = folded(term);
  const has = (text: string | null) => text != null && folded(text).includes(q);
  const events: Found[] = SEARCH_EVENTS.filter((one) => has(one.name) || has(one.venue)).map(
    (one) => ({ kind: 'event', id: one.id, name: one.name, line: one.line, mesh: meshFor(one.id) }),
  );
  const people: Found[] = guests
    ? SEARCH_GUESTS.filter((one) => has(one.name)).map((one) => ({
        kind: 'guest',
        id: `${one.event}:${one.name}`,
        name: one.name,
        line: `${eventName(one.event)} · ${FIRST_DAYS[one.event] ?? ''}`,
        event: one.event,
      }))
    : [];
  const members: Found[] = SEARCH_MEMBERS.filter((one) => has(one.name) || has(one.email)).map(
    (one) => ({ kind: 'member', id: one.email, name: one.name, line: one.role }),
  );
  const groups: Group[] = [
    { key: 'events', heading: SEARCH_WORDS.headings.events, rows: events },
    { key: 'guests', heading: SEARCH_WORDS.headings.guests, rows: people },
    { key: 'members', heading: SEARCH_WORDS.headings.members, rows: members },
  ];

  return groups.filter((group) => group.rows.length > 0);
}

export type Stop = { kind: 'row'; row: Found; group: GroupKey } | { kind: 'more'; group: GroupKey };

/** Each group's first five, or all of it once opened, then its Show all: the stops ↑ and ↓ move through. */
export function stopsOf(groups: readonly Group[], opened: readonly GroupKey[]): Stop[] {
  return groups.flatMap((group): Stop[] => {
    const all = opened.includes(group.key) || group.rows.length <= SHOWN_IN_GROUP;
    const rows = all ? group.rows : group.rows.slice(0, SHOWN_IN_GROUP);

    return [
      ...rows.map((row): Stop => ({ kind: 'row', row, group: group.key })),
      ...(all ? [] : [{ kind: 'more', group: group.key } as const]),
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
  { key: 'idle', term: '', name: 'Idle: Find an event, a guest or a member' },
  { key: 'short', term: 'i', name: 'Under 2 characters: “i”' },
  { key: 'loading', term: 'ine', name: 'Loading: three skeleton rows' },
  { key: 'mixed', term: 'ines', name: '“ines”: Events 1, Guests 7 with Show all 7, Members 1' },
  { key: 'all', term: 'ines', name: '“ines”, Show all 7 pressed' },
  { key: 'one', term: 'landmark', name: '“landmark”: one event, by its venue' },
  { key: 'none', term: 'garden party', name: 'No match: “garden party”' },
  { key: 'no-guests', term: 'ines', name: 'Kemi Adebayo, Member, without guest access' },
  { key: 'two-events', term: 'duarte', name: '“duarte”: one guest on two events, two rows' },
  { key: 'long', term: 'quinta', name: '“quinta”: four events, a long name on one line' },
  { key: 'offline', term: 'ines', name: 'Offline: Not loaded. with Try again' },
] as const;

export type SearchStateName = (typeof SEARCH_STATES)[number]['key'];

export interface SearchStart {
  term: string;
  phase: Phase;
  guests: boolean;
  opened: readonly GroupKey[];
}

export function searchStateOf(raw: string | null): SearchStateName | null {
  return SEARCH_STATES.find((one) => one.key === raw)?.key ?? null;
}

export function phaseOf(term: string): Phase {
  if (term.trim() === '') return 'idle';

  return longEnough(term) ? 'found' : 'short';
}

export function searchStart(state: SearchStateName | null): SearchStart {
  const term = SEARCH_STATES.find((one) => one.key === state)?.term ?? '';
  const phase = state === 'loading' ? 'loading' : state === 'offline' ? 'offline' : phaseOf(term);

  return {
    term,
    phase,
    guests: state !== 'no-guests',
    opened: state === 'all' ? ['guests'] : [],
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
