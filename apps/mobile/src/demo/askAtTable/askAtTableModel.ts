export const RUN_OUT = 'Chicken';
export const WAITER = 'Bisi Lawal';
export const SECTION = 'Section B';
export const NOW = '20:24';
export const NOT_BUILT = 'AC, not yet built';

export const COURSE: readonly string[] = ['Jollof rice', 'Chicken', 'Beef', 'Grilled fish'];

export const CONTAINS: Readonly<Record<string, readonly string[] | null>> = {
  'Jollof rice': [],
  Chicken: ['celery'],
  Beef: null,
  'Grilled fish': ['fish'],
};

export type FlagKind = 'allergen' | 'diet' | 'other';

export interface Flag {
  kind: FlagKind;
  code: string;
  words: string;
}

const FISH: Flag = { kind: 'allergen', code: 'fish', words: 'Fish allergy' };
const HALAL: Flag = { kind: 'diet', code: 'halal', words: 'Halal' };
const KIWI: Flag = { kind: 'other', code: 'other', words: 'Other allergy · kiwi' };

export interface Guest {
  id: string;
  name: string;
  table: number;
  seat: number;
  flags: readonly Flag[];
}

export const GUESTS: readonly Guest[] = [
  { id: 'fa', name: 'Funke Adeyemi', table: 9, seat: 1, flags: [FISH] },
  { id: 'hs', name: 'Hauwa Sani', table: 9, seat: 2, flags: [HALAL] },
  { id: 'tb', name: 'Tunde Bakare', table: 9, seat: 4, flags: [] },
  { id: 'ya', name: 'Yemi Alabi', table: 9, seat: 6, flags: [] },
  { id: 'ae', name: 'Adaora Eze', table: 14, seat: 2, flags: [KIWI] },
  { id: 'eo', name: 'Emeka Obi', table: 14, seat: 5, flags: [] },
];

export function guestOf(id: string): Guest {
  const g = GUESTS.find((x) => x.id === id);
  if (g == null) throw new Error(`No guest ${id}`);
  return g;
}

export type Stage = 'To serve' | 'Dishing';
export type By = 'guest' | 'lead' | null;

export interface Seat {
  guest: string;
  plate: readonly string[];
  stage: Stage;
  asked: boolean;
  everAsked: boolean;
  by: By;
  to: string | null;
  askedAt: string;
}

export interface Tray {
  table: number;
  plates: number;
  line: string;
}

export interface Request {
  id: string;
  table: number;
  words: string;
  opened: string;
}

export const TRAYS = {
  inHand: { table: 3, plates: 3, line: 'Stop 2 of 3 · Rice · Jollof, Bisi Okon' },
  given: { table: 8, plates: 3, line: 'Table 8’s tray, given to you by Ada Nwosu.' },
  next: { table: 10, plates: 4, line: 'Mains · Start the tray' },
} as const satisfies Record<string, Tray>;

export const REQUESTS: readonly Request[] = [
  { id: 'water', table: 12, words: 'More water for the table, please.', opened: '20:13' },
];

export type Screen = 'next' | 'floor' | 'ask';

export interface AskState {
  online: boolean;
  available: boolean;
  seats: readonly Seat[];
  screen: Screen;
  open: number | null;
  table: number;
  changing: string | null;
  refused: string;
  say: string;
  note: string;
}

export const ASK_STATES = [
  'askNext',
  'askOpen',
  'askAnswered',
  'askFlagged',
  'askFloor',
  'askChange',
  'askDishing',
  'askLeadChose',
  'askHeld',
  'askAvailable',
  'askOffline',
  'askNone',
] as const;

export type AskStateName = (typeof ASK_STATES)[number];

export const ASK_STATE_WHAT: Readonly<Record<AskStateName, readonly [string, string]>> = {
  askNext: [
    'Two asks on Next',
    'Table 9 and table 14 asks, after the tray in hand and the given tray, with a request between by age, before the next tray',
  ],
  askOpen: [
    'Table 9’s ask open',
    'Four guests in seat order, each with their choices as one group; one tap records an answer',
  ],
  askAnswered: [
    'An answer recorded',
    'Tunde Bakare answered Beef: he leaves the ask, which now reads ask 3 guests',
  ],
  askFlagged: [
    'A flagged guest',
    'Funke Adeyemi is left: Beef and Grilled fish are not for her, Beef’s allergens aren’t stated',
  ],
  askFloor: [
    'Table 9 on Floor',
    'Asked guests’ choices in their seat cards; Tunde’s seat reads Now Beef with Change',
  ],
  askChange: [
    'Change an answer',
    'Change open on Tunde’s seat: Beef marked Now, Cancel leaves it as it was',
  ],
  askDishing: [
    'Refused from Dishing',
    'Tunde’s plate is Dishing now, so the answer can’t change; Change has gone',
  ],
  askLeadChose: [
    'The floor lead chose',
    'The floor lead chose Beef for Yemi Alabi: her ask ends and her seat has no Change',
  ],
  askHeld: [
    'The held block',
    'Held guests keep their block; asked ones read Chicken has run out · asking at the table',
  ],
  askAvailable: [
    'Chicken available again',
    'Every ask leaves Next; one line says Chicken is available again; answers stand, with no Change',
  ],
  askOffline: [
    'No connection',
    'An answer tapped with no connection: refused on the device, nothing kept',
  ],
  askNone: ['No asks open', 'Every asked guest has answered: Next reads No asks open.'],
};

export function askStateOf(raw: string | undefined): AskStateName {
  return (ASK_STATES as readonly string[]).includes(raw ?? '') ? (raw as AskStateName) : 'askNext';
}

export const HELD_LINE = `${RUN_OUT} has run out · waiting for the floor lead`;
export const ASKING_LINE = `${RUN_OUT} has run out · asking at the table`;
export const AVAILABLE_LINE = `${RUN_OUT} is available again`;
export const AVAILABLE_REFUSED = `${RUN_OUT} is available again, so answers can’t change. Nothing changed.`;
export const NO_ASKS = 'No asks open.';
export const OPEN_INTRO = 'Seat order. One tap records the guest’s answer.';
export const OFFLINE_RECORD =
  'Needs a connection to record an answer. Nothing is kept to send later.';
export const OFFLINE_ROOM =
  'This phone has no connection, so what happens elsewhere in the room shows once it reconnects.';

export function dishingLine(name: string): string {
  return `${name}’s plate is Dishing now, so it can’t change. Nothing changed.`;
}

export function leadChoseLine(name: string): string {
  return `The floor lead has chosen for ${name}, so the answer can’t change here. Nothing changed.`;
}

export function guestsWord(n: number): string {
  return `${n} ${n === 1 ? 'guest' : 'guests'}`;
}

export function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function where(g: Guest): string {
  return `Table ${g.table} · seat ${g.seat}`;
}

const RICE_AND = ['Jollof rice', RUN_OUT];

function seat(guest: string, askedAt: string, more: Partial<Seat> = {}): Seat {
  const asked = askedAt !== '';
  return {
    guest,
    plate: RICE_AND,
    stage: 'To serve',
    asked,
    everAsked: asked,
    by: null,
    to: null,
    askedAt,
    ...more,
  };
}

function start(): AskState {
  return {
    online: true,
    available: false,
    seats: [
      seat('fa', '20:12'),
      seat('hs', '20:14'),
      seat('tb', '20:14'),
      seat('ya', '20:14'),
      seat('ae', '20:17'),
      seat('eo', ''),
    ],
    screen: 'next',
    open: null,
    table: 9,
    changing: null,
    refused: '',
    say: '',
    note: '',
  };
}

function answered(s: AskState, guest: string, to: string, by: By = 'guest'): AskState {
  return {
    ...s,
    seats: s.seats.map((x) => (x.guest === guest ? { ...x, asked: false, by, to } : x)),
  };
}

function openAsk(s: AskState, table: number): AskState {
  return { ...s, open: table, screen: 'ask' };
}

function onFloor(s: AskState): AskState {
  return { ...s, screen: 'floor', table: 9 };
}

export function seed(name: AskStateName): AskState {
  const s = start();
  switch (name) {
    case 'askNext':
      return s;
    case 'askOpen':
      return openAsk(s, 9);
    case 'askAnswered':
      return openAsk(answered(s, 'tb', 'Beef'), 9);
    case 'askFlagged':
      return openAsk(
        answered(answered(answered(s, 'hs', 'Beef'), 'tb', 'Beef'), 'ya', 'Grilled fish'),
        9,
      );
    case 'askFloor':
      return onFloor(answered(s, 'tb', 'Beef'));
    case 'askChange':
      return { ...onFloor(answered(s, 'tb', 'Beef')), changing: 'tb' };
    case 'askDishing': {
      const t = answered(s, 'tb', 'Beef');
      return {
        ...onFloor(setStage(t, 'tb', 'Dishing')),
        refused: dishingLine(guestOf('tb').name),
      };
    }
    case 'askLeadChose':
      return onFloor(leadChooses(answered(s, 'tb', 'Beef'), 'ya', 'Beef'));
    case 'askHeld':
      return answered(s, 'tb', 'Beef');
    case 'askAvailable':
      return { ...markAvailable(answered(s, 'tb', 'Beef')), say: '' };
    case 'askOffline':
      return { ...openAsk(s, 9), online: false, refused: OFFLINE_RECORD };
    case 'askNone': {
      let t = s;
      for (const [g, to] of [
        ['fa', ''],
        ['hs', 'Beef'],
        ['tb', 'Beef'],
        ['ya', 'Grilled fish'],
        ['ae', 'Beef'],
      ] as const)
        t = answered(t, g, to);
      return t;
    }
  }
}

export function seatOf(s: AskState, guest: string): Seat | undefined {
  return s.seats.find((x) => x.guest === guest);
}

export function isWaiting(x: Seat): boolean {
  return x.to == null && x.plate.includes(RUN_OUT);
}

export interface Conflict {
  line: string;
  note: string;
}

export function conflict(g: Guest, item: string): Conflict | null {
  const allergens = g.flags.filter((f) => f.kind === 'allergen');
  const contains = CONTAINS[item] ?? null;
  for (const f of allergens)
    if (contains?.includes(f.code) === true)
      return { line: `Not for ${g.name} · ${f.words}`, note: '' };
  const first = allergens[0];
  if (first != null && contains == null)
    return {
      line: `Not for ${g.name} · ${first.words}`,
      note: `${item}’s allergens aren’t stated`,
    };
  return null;
}

export interface Option {
  to: string;
  label: string;
  no: Conflict | null;
  now: boolean;
}

export function options(x: Seat): readonly Option[] {
  const g = guestOf(x.guest);
  const serve = COURSE.filter((i) => i !== RUN_OUT && !x.plate.includes(i)).map((item) => ({
    to: item,
    label: `Serve ${item}`,
    no: conflict(g, item),
    now: x.to === item,
  }));
  const rest = x.plate.filter((i) => i !== RUN_OUT);
  const without =
    rest.length > 0
      ? [{ to: '', label: `Serve without ${RUN_OUT}`, no: null, now: x.to === '' }]
      : [];
  return [...serve, ...without];
}

export function nowLine(x: Seat): string {
  if (x.to == null) return '';
  return x.to === '' ? `Without ${RUN_OUT}` : `Now ${x.to}`;
}

export function canChange(x: Seat): boolean {
  return x.to != null && x.by === 'guest' && x.stage === 'To serve';
}

export function changeable(s: AskState, x: Seat): boolean {
  return !s.available && canChange(x);
}

export interface Ask {
  table: number;
  item: string;
  seats: readonly Seat[];
  since: string;
}

const bySeat = (a: Seat, b: Seat) =>
  guestOf(a.guest).table - guestOf(b.guest).table || guestOf(a.guest).seat - guestOf(b.guest).seat;

export function asks(s: AskState): readonly Ask[] {
  const out: Ask[] = [];
  for (const x of s.seats.filter((y) => y.asked).sort(bySeat)) {
    const table = guestOf(x.guest).table;
    const a = out.find((y) => y.table === table);
    if (a == null) out.push({ table, item: RUN_OUT, seats: [x], since: x.askedAt });
    else
      out[out.indexOf(a)] = {
        ...a,
        seats: [...a.seats, x],
        since: minutes(x.askedAt) < minutes(a.since) ? x.askedAt : a.since,
      };
  }
  return out;
}

export function askOf(s: AskState, table: number | null): Ask | undefined {
  return asks(s).find((a) => a.table === table);
}

export function askTitle(a: Ask): string {
  return `Table ${a.table} · ${a.item} has run out · ask ${guestsWord(a.seats.length)}`;
}

export type NextItem =
  | { kind: 'inHand' | 'given' | 'nextTray'; tray: Tray }
  | { kind: 'request'; request: Request }
  | { kind: 'ask'; ask: Ask };

export function nextItems(s: AskState): readonly NextItem[] {
  const aged = [
    ...REQUESTS.map((request) => ({ at: request.opened, item: { kind: 'request', request } })),
    ...asks(s).map((ask) => ({ at: ask.since, item: { kind: 'ask', ask } })),
  ] as { at: string; item: NextItem }[];
  return [
    { kind: 'inHand', tray: TRAYS.inHand },
    { kind: 'given', tray: TRAYS.given },
    ...aged.sort((a, b) => minutes(a.at) - minutes(b.at)).map((a) => a.item),
    { kind: 'nextTray', tray: TRAYS.next },
  ];
}

export interface HeldRow {
  guest: Guest;
  line: string;
  asked: boolean;
}

export function heldRows(s: AskState): readonly HeldRow[] {
  if (s.available) return [];
  return s.seats
    .filter((x) => x.stage === 'To serve' && isWaiting(x))
    .sort(bySeat)
    .map((x) => ({
      guest: guestOf(x.guest),
      line: x.asked ? ASKING_LINE : HELD_LINE,
      asked: x.asked,
    }));
}

function refuse(s: AskState, refused: string): AskState {
  return { ...s, refused, changing: null };
}

export function answer(s: AskState, guest: string, to: string): AskState {
  const x = seatOf(s, guest);
  if (x == null) return s;
  const g = guestOf(guest);
  if (!s.online) return { ...s, refused: OFFLINE_RECORD };
  if (s.available) return refuse(s, AVAILABLE_REFUSED);
  const opt = options(x).find((o) => o.to === to);
  if (opt == null) return s;
  if (opt.no != null) return refuse(s, `${opt.no.line}. Nothing changed.`);
  if (!x.asked) {
    if (x.by === 'lead') return refuse(s, leadChoseLine(g.name));
    if (x.stage !== 'To serve') return refuse(s, dishingLine(g.name));
    if (!canChange(x)) return s;
  }
  const next = answered({ ...s, refused: '', changing: null }, guest, to);
  const stillOpen = askOf(next, s.open) != null;
  return stillOpen
    ? next
    : { ...next, open: null, screen: next.screen === 'ask' ? 'next' : next.screen };
}

export function openChange(s: AskState, guest: string): AskState {
  const x = seatOf(s, guest);
  if (x == null || !changeable(s, x)) return s;
  return { ...s, changing: guest, refused: '' };
}

export function cancelChange(s: AskState): AskState {
  return { ...s, changing: null };
}

export function setStage(s: AskState, guest: string, stage: Stage): AskState {
  return { ...s, seats: s.seats.map((x) => (x.guest === guest ? { ...x, stage } : x)) };
}

export function leadAsks(s: AskState, guest: string): AskState {
  const x = seatOf(s, guest);
  if (x == null) return s;
  if (!s.online) return { ...s, note: OFFLINE_ROOM };
  if (s.available || x.asked || !isWaiting(x)) return s;
  const g = guestOf(guest);
  const before = askOf(s, g.table);
  const next: AskState = {
    ...s,
    note: '',
    seats: s.seats.map((y) =>
      y.guest === guest ? { ...y, asked: true, everAsked: true, by: null, askedAt: NOW } : y,
    ),
  };
  const now = askOf(next, g.table);
  return {
    ...next,
    say:
      now == null
        ? next.say
        : before == null
          ? `New ask: ${askTitle(now)}`
          : `${g.name} added to ${askTitle(now)}`,
  };
}

export function leadChooses(s: AskState, guest: string, to: string): AskState {
  const x = seatOf(s, guest);
  if (x == null) return s;
  if (!s.online) return { ...s, note: OFFLINE_ROOM };
  if (!isWaiting(x)) return s;
  const next = answered({ ...s, note: '' }, guest, to, 'lead');
  return askOf(next, s.open) != null
    ? next
    : { ...next, open: null, screen: next.screen === 'ask' ? 'next' : next.screen };
}

export function markAvailable(s: AskState): AskState {
  if (!s.online) return { ...s, note: OFFLINE_ROOM };
  return {
    ...s,
    available: true,
    note: '',
    open: null,
    screen: s.screen === 'ask' ? 'next' : s.screen,
    seats: s.seats.map((x) => ({ ...x, asked: false })),
    say: AVAILABLE_LINE,
  };
}

export interface FloorSeat {
  seat: Seat;
  guest: Guest;
  plate: string;
  now: string;
  change: boolean;
}

export function floorSeats(s: AskState, table: number): readonly FloorSeat[] {
  return s.seats
    .filter((x) => guestOf(x.guest).table === table)
    .sort(bySeat)
    .map((x) => {
      const rest = x.plate.filter((i) => i !== RUN_OUT);
      const items = x.to == null ? x.plate : x.to === '' ? rest : [...rest, x.to];
      return {
        seat: x,
        guest: guestOf(x.guest),
        plate: `${items.join(' · ')} · ${x.stage}`,
        now: nowLine(x),
        change: changeable(s, x),
      };
    });
}

export function floorTables(s: AskState): readonly { table: number; line: string }[] {
  return [9, 14].map((table) => {
    const seats = s.seats.filter((x) => guestOf(x.guest).table === table);
    const a = askOf(s, table);
    const parts = [`${seats.length} seats`];
    if (a != null) parts.push(`asking ${guestsWord(a.seats.length)}`);
    return { table, line: parts.join(' · ') };
  });
}
