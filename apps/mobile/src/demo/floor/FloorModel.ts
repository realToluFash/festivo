export const NOW = '21:04';
export const ROOM_COURSE = 'Mains';
export const EVENT = 'Adaeze & Tunde’s wedding';
export const LEAD = 'Ifeoma Nduka';
export const ME = 'Bisi Lawal';
export const UNDO_MINUTES = 2;

export type OrderStage = 'To serve' | 'Dishing' | 'Checked' | 'On its way' | 'Served';
export type NoOrder = 'Not here yet' | 'Not fired yet' | 'Nothing for this course' | 'Left';
export type TrayStage = 'Dishing' | 'Checked' | 'On its way';
export type Reason = 'Wrong dish' | 'Not right' | 'Dropped' | 'Allergy concern';
export type Choice = 'What’s ready, now' | 'Wait for all';
export type Word =
  'To serve' | 'On a tray' | 'Waiting on the kitchen' | 'Not here yet' | 'Not fired yet' | 'Served';
export type PlaceKind = 'table' | 'row' | 'seats';
export type SectionId = 'A' | 'B' | 'C' | 'D';

export const WORD_ORDER: readonly Word[] = [
  'To serve',
  'On a tray',
  'Waiting on the kitchen',
  'Not here yet',
  'Not fired yet',
  'Served',
];
export const REASONS: readonly Reason[] = ['Wrong dish', 'Not right', 'Dropped', 'Allergy concern'];
export const READY_NOW: Choice = 'What’s ready, now';
export const WAIT_ALL: Choice = 'Wait for all';
const TRAY_STAGES: readonly string[] = ['Dishing', 'Checked', 'On its way'];

export interface Owed {
  id: number;
  items: string;
  why: 'Bring after' | 'To follow' | 'Sent back';
  reason: Reason | null;
  course: string;
  stage: OrderStage;
  kept: boolean;
  sentBack: boolean;
}

export interface Held {
  items: string;
  ready: number | null;
  anyReady: boolean;
  choice: Choice | null;
  kept: boolean;
}

/** One guest as sc-4005's read returns them: never a private note or access needs. */
export interface Guest {
  seat: number;
  name: string | null;
  dish: string | null;
  stage: OrderStage | NoOrder;
  flags: string[];
  held: Held | null;
  owed: Owed[];
  sentBack: boolean;
  kept: boolean;
}

export interface Tray {
  waiter: string;
  plates: number;
  stage: TrayStage;
  paused: boolean;
}

export interface Place {
  name: string;
  kind: PlaceKind;
  section: SectionId;
  covers: number;
  /** The latest course fired for it, null while none is. */
  course: string | null;
  seats: Guest[];
  trays: Tray[];
}

export type Sections = Record<SectionId, string[]>;

export interface SendBackSheet {
  place: string;
  seat: number;
  owed: number | null;
  reason: Reason | null;
}

export type Step =
  | { kind: 'choice'; place: string; seat: number; from: Choice | null }
  | {
      kind: 'sendBack';
      place: string;
      seat: number;
      made: number;
      /** The owed plate as it was before it went back, null when it was the order. */
      was: Pick<Owed, 'id' | 'why' | 'reason'> | null;
    };

export interface Undo {
  line: string;
  until: string;
  kept: boolean;
  step: Step;
}

export const FLOOR_STATES = [
  'yours',
  'asWell',
  'noSection',
  'manage',
  'moved',
  'offline',
  'notSent',
  'table',
  'nothingReady',
  'sendBack',
  'undo',
  'notYours',
  'nobody',
] as const;
export type FloorState = (typeof FLOOR_STATES)[number];

export interface Floor {
  state: FloorState;
  sections: Sections;
  manage: boolean;
  places: Place[];
  open: string | null;
  selected: string;
  sheet: SendBackSheet | null;
  undo: Undo | null;
  kept: number;
  notSent: string[];
  line: string;
  online: boolean;
  heard: string;
  /** Bumped by each step, so the same words said twice are read out twice. */
  said: number;
  steps: number;
}

export function floorStateOf(param: string | undefined): FloorState {
  return FLOOR_STATES.find((s) => s === param) ?? 'yours';
}

const DISHES = [
  'Jollof rice · chicken',
  'Goat curry',
  'Grilled fish · pepper sauce',
  'Vegetable stew',
];

function guest(
  seat: number,
  name: string | null,
  dish: string | null,
  stage: Guest['stage'],
  extra: Partial<Guest> = {},
): Guest {
  return {
    seat,
    name,
    dish,
    stage,
    flags: [],
    held: null,
    owed: [],
    sentBack: false,
    kept: false,
    ...extra,
  };
}

function many(from: number, stage: Guest['stage'], names: readonly (string | null)[]): Guest[] {
  return names.map((name, i) =>
    guest(from + i, name, DISHES[(from + i - 1) % DISHES.length] ?? null, stage),
  );
}

function owed(items: string, why: Owed['why'], course: string, extra: Partial<Owed> = {}): Owed {
  return {
    id: 0,
    items,
    why,
    reason: null,
    course,
    stage: 'To serve',
    kept: false,
    sentBack: false,
    ...extra,
  };
}

function place(
  name: string,
  kind: PlaceKind,
  section: SectionId,
  covers: number,
  course: string | null,
  seats: Guest[],
  trays: Tray[] = [],
): Place {
  return { name, kind, section, covers, course, seats, trays };
}

function table2(): Place {
  return place(
    'Table 2',
    'table',
    'B',
    10,
    'Mains',
    [
      guest(1, 'Yemi Cole', 'Goat curry', 'To serve'),
      guest(2, 'Tari Briggs', 'Jollof rice · chicken', 'Served', {
        owed: [owed('Plantain', 'To follow', 'Mains')],
      }),
      guest(3, 'Adaeze Okafor', 'Grilled fish · pepper sauce', 'To serve', {
        flags: ['Nut allergy'],
        sentBack: true,
        owed: [
          owed('Grilled fish · pepper sauce', 'Sent back', 'Mains', { reason: 'Allergy concern' }),
        ],
      }),
      guest(4, null, 'Jollof rice · chicken', 'Dishing'),
      guest(5, 'Ada Obi', 'Grilled fish · pepper sauce', 'To serve', {
        flags: ['Gluten free'],
        held: { items: 'Grilled fish', ready: 5, anyReady: true, choice: WAIT_ALL, kept: false },
      }),
      guest(6, null, 'Vegetable stew', 'Checked'),
      guest(7, 'Seyi Adebayo', null, 'Left'),
      guest(8, 'Kemi Oke', 'Goat curry', 'Served', {
        owed: [owed('Small chops', 'Bring after', 'Starter', { stage: 'Served' })],
      }),
      guest(9, 'Musa Bello', 'Goat curry', 'Dishing'),
      guest(10, null, 'Jollof rice · chicken', 'Checked'),
    ],
    [
      { waiter: ME, plates: 2, stage: 'Dishing', paused: false },
      { waiter: 'Tomi Ade', plates: 2, stage: 'Checked', paused: true },
    ],
  );
}

/** The room as the API might send it: out of table order, which the screen never relies on. */
export function samplePlaces(): Place[] {
  return [
    place(
      'Table 10',
      'table',
      'B',
      10,
      null,
      many(1, 'Not here yet', [
        'Bola Ige',
        'Ife Ojo',
        null,
        'Sola Kuti',
        'Remi Ojo',
        null,
        'Nike Ade',
        'Tobi Eko',
        null,
        'Kola Ade',
      ]),
    ),
    place(
      'Row C',
      'row',
      'B',
      10,
      null,
      many(1, 'Not fired yet', [
        'Dayo Ola',
        'Uche Obi',
        null,
        'Gbemi Ala',
        'Wale Ajayi',
        'Efe Odia',
        null,
        'Ayo Bello',
        'Zainab Musa',
        null,
      ]),
    ),
    table2(),
    place(
      'Seats 1 to 10',
      'seats',
      'B',
      10,
      'Mains',
      many(1, 'Served', [
        'Toyin Bello',
        'Femi Ojo',
        'Ade Coker',
        null,
        'Lara Gold',
        'Obi Nna',
        null,
        'Yinka Bello',
        'Kunle Ade',
        'Rita Eze',
      ]),
    ),
    place('Table 6', 'table', 'B', 8, 'Mains', [
      guest(1, 'Lola Ojo', 'Goat curry', 'Served'),
      guest(2, 'Chidi Eze', 'Vegetable stew', 'Served'),
      guest(3, 'Femi Ade', 'Grilled fish · pepper sauce', 'To serve', {
        flags: ['Shellfish allergy'],
        held: { items: 'Grilled fish', ready: 4, anyReady: false, choice: null, kept: false },
      }),
      guest(4, 'Nkem Uzo', 'Goat curry', 'Served'),
      guest(5, null, 'Jollof rice · chicken', 'Served'),
      guest(6, 'Ireti Doyle', 'Goat curry', 'Served'),
      guest(7, 'Bayo Sanni', 'Vegetable stew', 'Served'),
      guest(8, null, 'Jollof rice · chicken', 'Served'),
    ]),
    place(
      'Table 4',
      'table',
      'B',
      10,
      'Mains',
      [
        ...many(1, 'Served', ['Amaka Obi', 'Tunji Ade', 'Halima Bello', 'Ola Peters']),
        ...many(5, 'On its way', [
          'Ibrahim Musa',
          null,
          'Nnamdi Eze',
          'Folake Ade',
          null,
          'Ese Oke',
        ]),
      ],
      [{ waiter: ME, plates: 6, stage: 'On its way', paused: false }],
    ),
    place(
      'Table 9',
      'table',
      'D',
      8,
      'Mains',
      many(1, 'Served', [
        'Kayode Ojo',
        'Mariam Ali',
        null,
        'Dele Ade',
        'Tope Ola',
        null,
        'Nneka Obi',
        'Sade Bello',
      ]),
    ),
    place('Table 3', 'table', 'A', 8, 'Mains', [
      ...many(1, 'Served', ['Peter Obi', 'Joy Eze']),
      guest(3, 'Uju Ade', 'Goat curry', 'To serve'),
      guest(4, 'Bimpe Ojo', 'Grilled fish · pepper sauce', 'To serve', { flags: ['Dairy free'] }),
      ...many(5, 'To serve', ['Emeka Nna', null, 'Ruth Ola', 'Seun Ade']),
    ]),
    place(
      'Table 1',
      'table',
      'A',
      8,
      'Mains',
      many(1, 'Served', [
        'Kelechi Obi',
        'Bukola Ade',
        null,
        'Jide Ola',
        'Nora Eze',
        null,
        'Tayo Bello',
        'Ama Ojo',
      ]),
    ),
    place(
      'Table 8',
      'table',
      'D',
      10,
      'Mains',
      many(1, 'To serve', [
        'Musa Ali',
        'Oge Eze',
        null,
        'Yetunde Ade',
        'Kunle Ojo',
        null,
        'Ronke Bello',
        'Chuka Obi',
        'Fola Ade',
        null,
      ]),
    ),
    place(
      'Table 7',
      'table',
      'C',
      6,
      'Mains',
      [
        ...many(1, 'Served', ['Hassan Bello', 'Eno Bassey', 'Lami Musa']),
        ...many(4, 'Dishing', ['Gozie Obi', null, 'Tolu Ade']),
      ],
      [{ waiter: 'Grace Udo', plates: 3, stage: 'Dishing', paused: false }],
    ),
    place(
      'Table 5',
      'table',
      'A',
      8,
      'Starter',
      many(1, 'Served', [
        'Ngozi Eze',
        'Biodun Ade',
        null,
        'Femi Cole',
        'Aisha Bello',
        null,
        'Ope Ojo',
        'Kemi Ade',
      ]),
    ),
  ];
}

function sectionsFor(state: FloorState): Sections {
  const s: Sections = { A: ['Mei Chen'], B: ['Tomi Ade', ME], C: [], D: ['Grace Udo'] };
  if (state === 'asWell') s.D = ['Grace Udo', ME];
  if (state === 'moved') {
    s.B = ['Tomi Ade'];
    s.D = ['Grace Udo', ME];
  }
  if (state === 'noSection' || state === 'manage') s.B = ['Tomi Ade'];
  return s;
}

const OPENS: Partial<Record<FloorState, string>> = {
  table: 'Table 2',
  sendBack: 'Table 2',
  undo: 'Table 2',
  nothingReady: 'Table 6',
  notYours: 'Table 3',
  nobody: 'Table 7',
};

export function floorSeed(state: FloorState): Floor {
  const places = samplePlaces();
  const open = OPENS[state] ?? null;
  const f: Floor = {
    state,
    sections: sectionsFor(state),
    manage: state === 'manage',
    places,
    open,
    selected: open ?? 'Table 2',
    sheet: null,
    undo: null,
    kept: 0,
    notSent: [],
    line: state === 'moved' ? 'You’re on Section D now.' : '',
    online: state !== 'offline',
    heard: '',
    said: 0,
    steps: 0,
  };
  const t2 = places.find((p) => p.name === 'Table 2');
  const ada = t2?.seats[4];
  const tari = t2?.seats[1];
  const kemi = t2?.seats[7];
  if (state === 'sendBack') f.sheet = { place: 'Table 2', seat: 8, owed: null, reason: null };
  if (state === 'undo' && kemi != null) {
    kemi.sentBack = true;
    kemi.stage = 'To serve';
    kemi.owed.unshift(owed('Goat curry', 'Sent back', 'Mains', { id: 1, reason: 'Not right' }));
    f.steps = 1;
    f.undo = {
      line: 'Sent back: Kemi Oke’s Goat curry · Not right',
      until: undoUntil(NOW),
      kept: false,
      step: { kind: 'sendBack', place: 'Table 2', seat: 8, made: 1, was: null },
    };
  }
  if (state === 'offline' && ada?.held != null && tari != null) {
    ada.held = { ...ada.held, choice: READY_NOW, kept: true };
    tari.sentBack = true;
    tari.stage = 'To serve';
    tari.owed.unshift(
      owed('Jollof rice · chicken', 'Sent back', 'Mains', { id: 1, reason: 'Dropped', kept: true }),
    );
    f.steps = 1;
    f.kept = 2;
  }
  if (state === 'notSent' && ada != null) {
    ada.held = null;
    ada.stage = 'Served';
    f.notSent = [
      'Ada Obi is now Served, marked by Tomi Ade.',
      'Too late to undo: 2 minutes had passed.',
    ];
  }
  return f;
}

function clonePlace(p: Place): Place {
  return {
    ...p,
    trays: p.trays.map((t) => ({ ...t })),
    seats: p.seats.map((g) => ({
      ...g,
      flags: [...g.flags],
      held: g.held == null ? null : { ...g.held },
      owed: g.owed.map((o) => ({ ...o })),
    })),
  };
}

export function undoUntil(now: string): string {
  const [h = 0, m = 0] = now.split(':').map(Number);
  const total = (h * 60 + m + UNDO_MINUTES) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

const KIND_ORDER: Record<PlaceKind, number> = { table: 0, row: 1, seats: 2 };
const COLLATOR = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

export function inOrder(places: readonly Place[]): Place[] {
  return [...places].sort(
    (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || COLLATOR.compare(a.name, b.name),
  );
}

function openStages(g: Guest): string[] {
  return [g.stage, ...g.owed.map((o) => o.stage)];
}

/** The first word that applies, in the room plan’s order (sc-4026). */
export function wordOf(p: Place): Word {
  const gs = p.seats;
  if (gs.some((g) => g.held == null && openStages(g).includes('To serve'))) return 'To serve';
  if (gs.some((g) => openStages(g).some((s) => TRAY_STAGES.includes(s)))) return 'On a tray';
  if (gs.some((g) => g.held != null)) return 'Waiting on the kitchen';
  if (gs.every((g) => g.stage === 'Not here yet')) return 'Not here yet';
  if (p.course == null) return 'Not fired yet';
  return 'Served';
}

export function wordSaid(p: Place): string {
  const w = wordOf(p);
  return p.course != null && p.course !== ROOM_COURSE ? `${p.course} · ${w}` : w;
}

const ORDER_WORDS: readonly string[] = [
  'To serve',
  'Dishing',
  'Checked',
  'On its way',
  'Served',
  'Not here yet',
  'Not fired yet',
];

/** For the latest course fired, or the room’s while none is: m guests with an order, n of them Served. */
export function servedOf(p: Place): { n: number; m: number } {
  const ordered = p.seats.filter((g) => g.dish != null && ORDER_WORDS.includes(g.stage));
  return { n: ordered.filter((g) => g.stage === 'Served').length, m: ordered.length };
}

export function flaggedOpen(p: Place): Guest[] {
  return p.seats.filter(
    (g) => g.flags.length > 0 && (g.stage !== 'Served' || g.owed.some((o) => o.stage !== 'Served')),
  );
}

export function servedLine(p: Place): string {
  const { n, m } = servedOf(p);
  return `${n} of ${m} served`;
}

export function coversLine(n: number): string {
  return n === 1 ? '1 cover' : `${n} covers`;
}

export function flaggedLine(n: number): string {
  return `${n} flagged`;
}

export function flaggedSaid(n: number): string {
  return n === 1 ? '1 flagged guest still to serve' : `${n} flagged guests still to serve`;
}

export function platesLine(n: number): string {
  return n === 1 ? '1 plate' : `${n} plates`;
}

export function tapsWaiting(n: number): string {
  return n === 1 ? '1 tap waiting' : `${n} taps waiting`;
}

export function rowSaid(p: Place, other: boolean): string {
  const f = flaggedOpen(p).length;
  return [
    p.name,
    wordSaid(p),
    servedLine(p),
    coversLine(p.covers),
    ...(f > 0 ? [flaggedSaid(f)] : []),
    ...(other ? [`Section ${p.section}`] : []),
  ].join(', ');
}

function on(f: Floor, id: SectionId): boolean {
  return f.sections[id].includes(ME);
}

export function isMine(f: Floor, p: Place): boolean {
  return on(f, p.section);
}

/** sc-4002: service.manage anywhere, a waiter at their own sections and at any with nobody on it. */
export function mayWrite(f: Floor, p: Place): boolean {
  return f.manage || on(f, p.section) || f.sections[p.section].length === 0;
}

export function namesShown(f: Floor, p: Place): boolean {
  return mayWrite(f, p);
}

export function refusalAt(f: Floor, p: Place): string | null {
  return mayWrite(f, p) ? null : 'table_not_yours';
}

export function guestName(f: Floor, p: Place, g: Guest): string {
  return namesShown(f, p) && g.name != null ? g.name : `Seat ${g.seat}`;
}

export type Group =
  | { kind: 'yours'; title: string; places: Place[] }
  | { kind: 'none'; line: string }
  | { kind: 'other'; title: string; places: Place[] };

export function groupsOf(f: Floor): Group[] {
  const out: Group[] = [];
  const mine = (Object.keys(f.sections) as SectionId[]).filter((id) => on(f, id)).sort();
  if (mine.length === 0 && !f.manage)
    out.push({ kind: 'none', line: `No tables yet. ${LEAD} will put you on a section.` });
  for (const id of mine)
    out.push({
      kind: 'yours',
      title: `Yours · Section ${id}`,
      places: inOrder(f.places.filter((p) => p.section === id)),
    });
  out.push({
    kind: 'other',
    title: 'Other tables',
    places: inOrder(f.places.filter((p) => !isMine(f, p))),
  });
  return out;
}

export function seatWord(g: Guest): string {
  return g.held != null ? 'Waiting on the kitchen' : g.stage;
}

export function heldLine(h: Held): string {
  return h.ready == null ? h.items : `${h.items} · Ready in about ${h.ready} min`;
}

/** What’s ready, now is not offered while nothing on the order is Ready (sc-4005’s 409 plate_empty). */
export function choicesFor(h: Held): Choice[] {
  return h.anyReady ? [READY_NOW, WAIT_ALL] : [WAIT_ALL];
}

export function owedLine(p: Place, o: Owed): string {
  const course = o.course !== (p.course ?? ROOM_COURSE) ? [o.course] : [];
  return [...course, o.why, ...(o.reason == null ? [] : [o.reason]), o.items].join(' · ');
}

export function trayLine(t: Tray): string {
  return `${t.waiter} · ${platesLine(t.plates)} · ${t.stage}`;
}

export function onItLine(f: Floor, p: Place): string {
  const people = f.sections[p.section];
  return `On it · Section ${p.section} · ${people.length > 0 ? people.join(', ') : 'Nobody on it'}`;
}

export function headerLine(p: Place): string {
  return `${coversLine(p.covers)} · Section ${p.section}`;
}

export function stripLine(f: Floor): string {
  if (f.online) return `Connected · up to date at ${NOW}`;
  return f.kept > 0
    ? `No connection · as of ${NOW} · ${tapsWaiting(f.kept)}`
    : `No connection · as of ${NOW}`;
}

export function placeOf(f: Floor, name: string | null): Place | null {
  return f.places.find((p) => p.name === name) ?? null;
}

export function shownPlace(f: Floor): Place | null {
  return placeOf(f, f.open ?? f.selected);
}

function withPlace(f: Floor, name: string, change: (p: Place) => Place): Place[] {
  return f.places.map((p) => (p.name === name ? change(clonePlace(p)) : p));
}

export function openTable(f: Floor, name: string): Floor {
  return { ...f, open: name, selected: name, sheet: null };
}

export function closeTable(f: Floor): Floor {
  return { ...f, open: null, sheet: null };
}

export function choose(f: Floor, name: string, seat: number, choice: Choice): Floor {
  const p = placeOf(f, name);
  const g = p?.seats.find((x) => x.seat === seat);
  if (p == null || g?.held == null || !mayWrite(f, p)) return f;
  if (!choicesFor(g.held).includes(choice) || g.held.choice === choice) return f;
  const kept = !f.online;
  const line = `${guestName(f, p, g)}: ${choice}`;
  const step: Step = { kind: 'choice', place: name, seat, from: g.held.choice };
  return {
    ...f,
    places: withPlace(f, name, (q) => ({
      ...q,
      seats: q.seats.map((x) =>
        x.seat === seat && x.held != null ? { ...x, held: { ...x.held, choice, kept } } : x,
      ),
    })),
    undo: { line, until: undoUntil(NOW), kept, step },
    kept: f.kept + (kept ? 1 : 0),
    heard: line,
    said: f.said + 1,
  };
}

export function canSendBack(f: Floor, p: Place, g: Guest): boolean {
  return mayWrite(f, p) && g.stage === 'Served' && !g.sentBack;
}

export function canSendBackOwed(f: Floor, p: Place, o: Owed): boolean {
  return mayWrite(f, p) && o.stage === 'Served' && !o.sentBack;
}

export function openSendBack(f: Floor, name: string, seat: number, owedAt: number | null): Floor {
  const p = placeOf(f, name);
  if (p == null || !mayWrite(f, p)) return f;
  return { ...f, sheet: { place: name, seat, owed: owedAt, reason: null } };
}

export function pickReason(f: Floor, reason: Reason): Floor {
  return f.sheet == null ? f : { ...f, sheet: { ...f.sheet, reason } };
}

export function cancelSendBack(f: Floor): Floor {
  return { ...f, sheet: null };
}

export function sendBackItems(f: Floor): { title: string; who: string } | null {
  const sh = f.sheet;
  const p = placeOf(f, sh?.place ?? null);
  const g = p?.seats.find((x) => x.seat === sh?.seat);
  if (sh == null || p == null || g == null) return null;
  const items = sh.owed == null ? (g.dish ?? '') : (g.owed[sh.owed]?.items ?? '');
  return { title: `Send back ${items}?`, who: `${guestName(f, p, g)} · ${p.name}` };
}

export function sendBack(f: Floor): Floor {
  const sh = f.sheet;
  const p = placeOf(f, sh?.place ?? null);
  const g = p?.seats.find((x) => x.seat === sh?.seat);
  if (sh?.reason == null || p == null || g == null || !mayWrite(f, p)) return f;
  const reason = sh.reason;
  const from = sh.owed == null ? null : (g.owed[sh.owed] ?? null);
  if (from == null ? !canSendBack(f, p, g) : !canSendBackOwed(f, p, from)) return f;
  const items = from?.items ?? g.dish ?? '';
  const kept = !f.online;
  const line = `Sent back: ${guestName(f, p, g)}’s ${items} · ${reason}`;
  const made = f.steps + 1;
  const back = {
    id: made,
    why: 'Sent back',
    reason,
    stage: 'To serve',
    kept,
    sentBack: true,
  } as const;
  const sent = (x: Guest): Guest =>
    from == null
      ? {
          ...x,
          stage: 'To serve',
          sentBack: true,
          owed: [owed(items, 'Sent back', p.course ?? ROOM_COURSE, back), ...x.owed],
        }
      : { ...x, owed: x.owed.map((o, i) => (i === sh.owed ? { ...o, ...back } : o)) };
  return {
    ...f,
    places: withPlace(f, p.name, (q) => ({
      ...q,
      seats: q.seats.map((x) => (x.seat === g.seat ? sent(x) : x)),
    })),
    sheet: null,
    undo: {
      line,
      until: undoUntil(NOW),
      kept,
      step: {
        kind: 'sendBack',
        place: p.name,
        seat: g.seat,
        made,
        was: from == null ? null : { id: from.id, why: from.why, reason: from.reason },
      },
    },
    kept: f.kept + (kept ? 1 : 0),
    heard: line,
    said: f.said + 1,
    steps: made,
  };
}

export function alertsLead(reason: Reason): boolean {
  return reason === 'Allergy concern';
}

function reversed(g: Guest, step: Step, kept: boolean): Guest {
  if (step.kind === 'choice')
    return g.held == null ? g : { ...g, held: { ...g.held, choice: step.from, kept } };
  const plate = g.owed.find((o) => o.id === step.made);
  if (plate == null) return g;
  if (step.was == null)
    return {
      ...g,
      stage: 'Served',
      sentBack: false,
      kept,
      owed: g.owed.filter((o) => o !== plate),
    };
  const was = { ...step.was, stage: 'Served', kept, sentBack: false } as const;
  return { ...g, owed: g.owed.map((o) => (o === plate ? { ...o, ...was } : o)) };
}

export function undo(f: Floor): Floor {
  const u = f.undo;
  if (u == null) return f;
  const kept = !f.online;
  const { step } = u;
  return {
    ...f,
    places: withPlace(f, step.place, (q) => ({
      ...q,
      seats: q.seats.map((g) => (g.seat === step.seat ? reversed(g, step, kept) : g)),
    })),
    undo: null,
    kept: f.kept + (kept ? 1 : 0),
    heard: `Undone: ${u.line}`,
    said: f.said + 1,
  };
}

export function loseConnection(f: Floor): Floor {
  return { ...f, online: false };
}

export function reconnect(f: Floor): Floor {
  return {
    ...f,
    online: true,
    kept: 0,
    undo: f.undo == null ? null : { ...f.undo, kept: false },
    places: f.places.map((p) => ({
      ...p,
      seats: p.seats.map((g) => ({
        ...g,
        kept: false,
        held: g.held == null ? null : { ...g.held, kept: false },
        owed: g.owed.map((o) => ({ ...o, kept: false })),
      })),
    })),
  };
}

export function dismissNotSent(f: Floor): Floor {
  return { ...f, notSent: [] };
}

export function servedElsewhere(f: Floor): Floor {
  return {
    ...f,
    places: withPlace(f, 'Table 4', (q) => ({
      ...q,
      trays: [],
      seats: q.seats.map((g) => (g.stage === 'On its way' ? { ...g, stage: 'Served' } : g)),
    })),
  };
}

export function movedTo(f: Floor, to: SectionId): Floor {
  const sections = { ...f.sections };
  for (const id of Object.keys(sections) as SectionId[])
    sections[id] = sections[id].filter((n) => n !== ME);
  sections[to] = [...sections[to], ME];
  const line = `You’re on Section ${to} now.`;
  return { ...f, sections, line, heard: line, said: f.said + 1 };
}
