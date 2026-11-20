import type { LinkStatus, Trail } from './StaffLinkModel.ts';

export interface OnRoster {
  id: string;
  name: string;
  job: string | null;
  station: string | null;
  /** Their first shift's times; the product sorts on sc-3908's full start. */
  shift: string | null;
  mobile: boolean;
  status: LinkStatus;
  trail: Trail | null;
}

export const RW = {
  roster: 'Roster',
  people: (n: number) => (n === 1 ? '1 person' : `${n} people`),
  empty: 'Nobody on the staff yet',
  emptyLine: '[People are added to the roster on the web.]',
  failed: '[The roster could not load.]',
  tryAgain: 'Try again',
  loading: '[Loading the roster]',
  lock: '[You can see the roster. Sharing links needs permission to manage staff.]',
  noJob: 'No job yet',
  noStation: 'No station yet',
  noShift: 'Not on a shift yet',
  noMobile: 'Add a mobile number to send a link',
  erased: 'Contact details removed after the event',
};

const KEMI = 'Kemi Adeyemi';
const YOU = 'Amara Nwosu';

const one = (
  id: string,
  name: string,
  job: string | null,
  station: string | null,
  shift: string | null,
  mobile: boolean,
  status: LinkStatus,
  trail: Trail | null = null,
): OnRoster => ({ id, name, job, station, shift, mobile, status, trail });

/** The web roster's sample (sc-3906, `/demo/events/evt-wed-4/staff/roster`), with a Shared row from the app. */
export function sampleRoster(): OnRoster[] {
  return [
    one('bisi', 'Bisi Okon', 'Cook', 'Kitchen', '15:00 to 23:00', true, 'opened', {
      by: '',
      at: '18:20',
    }),
    one('tayo', 'Tayo Bamidele', 'Cook', 'Grill', '15:00 to 23:00', true, 'sent', {
      by: YOU,
      at: '17:58',
    }),
    one('ada', 'Ada Nnaji', 'Cook', 'Pastry', '15:00 to 23:00', false, 'none'),
    one('ifeoma', 'Ifeoma Nduka', 'Floor lead', 'Floor', '16:00 to 01:00', true, 'opened', {
      by: '',
      at: '17:41',
    }),
    one('sade', 'Sade Lawal', 'Bar', 'Bar', '16:00 to 01:00', true, 'sent', {
      by: YOU,
      at: '18:02',
    }),
    one('tolu', 'Tolu Bello', 'Door', 'Door', '16:30 to 21:00', true, 'none'),
    one('amina', 'Amina Yusuf', 'Waiter', 'Section B', '17:00 to 00:00', true, 'copied', {
      by: YOU,
      at: '18:44',
    }),
    one('grace', 'Grace Udo', 'Waiter', 'Section A', '17:00 to 00:00', true, 'opened', {
      by: '',
      at: '19:05',
    }),
    one('kunle', 'Kunle Ajayi', 'Waiter', 'Section A', '17:00 to 00:00', true, 'shared', {
      by: KEMI,
      at: '18:44',
    }),
    one('ronke', 'Ronke Alade', 'Runner', 'Pass', '17:00 to 00:00', true, 'opened', {
      by: '',
      at: '18:31',
    }),
    one('emeka', 'Emeka Obi', 'Waiter', null, '19:00 to 23:00', true, 'none'),
    one('chinedu', 'Chinedu Eze', null, null, null, true, 'none'),
  ];
}

const DAY_TURNS = 6 * 60;

/** Minutes from 06:00, so a start after midnight sorts last. */
function startOf(person: OnRoster): number | null {
  const clock = person.shift?.split(' to ')[0];
  if (clock == null) return null;
  const [h = 0, m = 0] = clock.split(':').map(Number);

  return (h * 60 + m - DAY_TURNS + 24 * 60) % (24 * 60);
}

/** sc-3906's order: shift start, then name, people with no shift last. */
export function rosterOrder(people: readonly OnRoster[]): OnRoster[] {
  return [...people].sort((a, b) => {
    const at = startOf(a);
    const bt = startOf(b);
    if (at == null && bt != null) return 1;
    if (bt == null && at != null) return -1;
    if (at != null && bt != null && at !== bt) return at - bt;

    return a.name.localeCompare(b.name);
  });
}

export function firstName(name: string): string {
  return name.split(' ')[0] ?? name;
}

export type Shown = LinkStatus | 'noMobile' | 'erased';

export function shownOf(person: OnRoster, erased: boolean): Shown {
  if (erased) return 'erased';
  if (!person.mobile) return 'noMobile';

  return person.status;
}

export function rowLine(person: OnRoster): string {
  return [person.job ?? RW.noJob, person.station ?? RW.noStation, person.shift ?? RW.noShift].join(
    ' · ',
  );
}

export const ROSTER_STATES = [
  'populated',
  'loading',
  'failed',
  'empty',
  'readOnly',
  'live',
  'erased',
  'noRead',
] as const;

export type RosterState = (typeof ROSTER_STATES)[number];

export function rosterStateOf(raw: string | null | undefined): RosterState {
  return ROSTER_STATES.find((s) => s === raw) ?? 'populated';
}

/** ?state=live: the change made on the web that the app's roster shows within 10 seconds. */
export const LIVE_MS = 4000;
export const LIVE_CHANGE = {
  id: 'amina',
  status: 'sent' as const,
  trail: { by: KEMI, at: '19:14' },
};

/** The demo's roster between the list and a link screen: what one changed, the other reads on coming back. */
const kept = new Map<string, Pick<OnRoster, 'status' | 'trail'>>();
const gone = new Set<string>();

export function resetKept(): void {
  kept.clear();
  gone.clear();
}

export function keep(id: string, status: LinkStatus, trail: Trail | null): void {
  kept.set(id, { status, trail });
}

export function removeKept(id: string): void {
  gone.add(id);
}

export function withKept(people: readonly OnRoster[]): OnRoster[] {
  return people
    .filter((person) => !gone.has(person.id))
    .map((person) => ({ ...person, ...kept.get(person.id) }));
}

export function personOf(id: string | undefined): OnRoster | null {
  if (id == null) return null;

  return withKept(sampleRoster()).find((person) => person.id === id) ?? null;
}
