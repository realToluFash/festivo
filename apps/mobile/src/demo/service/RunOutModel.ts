export const ITEM = 'Chicken';
export const STATION = 'Grill';
export const MARKED_BY = 'Tayo Bamidele';
export const MARKED_AT = '20:06';
export const MARKED = `Marked by ${MARKED_BY} on ${STATION} at ${MARKED_AT}`;
export const TITLE = `${ITEM} has run out`;
export const STANDS_LINE = 'Applies to guests still to come';
export const NO_MANAGE_LINE =
  'Only the floor lead chooses what guests get instead. Nothing changed.';
export const NOBODY_WAITING = 'Nobody is waiting for a choice now.';
export const ASKING = 'Asking at the table';
export const STAY_ASKED = 'Guests already asked at their tables stay asked';
export const NOT_BUILT = 'AC, not yet built';

export const COURSE_ITEMS: readonly string[] = ['Jollof rice', 'Chicken', 'Beef', 'Grilled fish'];

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

export const FLAGS = {
  fish: { kind: 'allergen', code: 'fish', words: 'Fish allergy' },
  sesame: { kind: 'allergen', code: 'sesame', words: 'Sesame allergy' },
  halal: { kind: 'diet', code: 'halal', words: 'Halal' },
  kiwi: { kind: 'other', code: 'other', words: 'Other allergy · kiwi' },
} as const satisfies Record<string, Flag>;

export type Stage = 'To serve' | 'Dishing';
export type GuestState = 'waiting' | 'changed' | 'back';

export interface Guest {
  id: string;
  name: string;
  table: number;
  seat: number;
  flags: readonly Flag[];
  plate: readonly string[];
  stage: Stage;
  state: GuestState;
  to: string | null;
  late: boolean;
  asked: boolean;
  everAsked: boolean;
  by: 'guest' | 'lead' | null;
}

export type Bulk = { kind: 'serve'; item: string } | { kind: 'without' } | { kind: 'ask' };

export interface RunOut {
  runOut: boolean;
  guests: Guest[];
  stands: Bulk | null;
  panel: boolean;
  confirm: Bulk | null;
  choosing: string | null;
  refused: string;
  say: string;
  raised: number;
  earlier?: EarlierRunOut | undefined;
}

/** An earlier course's item run out at its station while a plate still needs it (pm, 17 Nov): its kitchen line names its course and follows that station's items of the current course. */
export interface EarlierRunOut {
  course: string;
  item: string;
  station: string;
  waiting: number;
}

export const SMALL_CHOPS: EarlierRunOut = {
  course: 'Starter',
  item: 'Small chops',
  station: 'Fryer',
  waiting: 1,
};

export interface Can {
  online: boolean;
  manage: boolean;
}

function guest(
  id: string,
  name: string,
  table: number,
  seat: number,
  flags: readonly Flag[],
  plate: readonly string[],
  more: Partial<Guest> = {},
): Guest {
  return {
    id,
    name,
    table,
    seat,
    flags,
    plate,
    stage: 'To serve',
    state: 'waiting',
    to: null,
    late: false,
    asked: false,
    everAsked: false,
    by: null,
    ...more,
  };
}

const RICE_AND = ['Jollof rice', ITEM];

export function sampleGuests(): Guest[] {
  return [
    guest('fa', 'Funke Adeyemi', 9, 1, [FLAGS.fish], RICE_AND),
    guest('hs', 'Hauwa Sani', 9, 2, [FLAGS.halal], RICE_AND),
    guest('tb', 'Tunde Bakare', 9, 4, [], RICE_AND),
    guest('ya', 'Yemi Alabi', 9, 6, [], RICE_AND),
    guest('ka', 'Kemi Adebayo', 12, 3, [FLAGS.sesame], RICE_AND),
    guest('mb', 'Musa Bello', 12, 6, [], [...RICE_AND, 'Beef']),
    guest('ae', 'Adaora Eze', 14, 2, [FLAGS.kiwi], RICE_AND),
    guest('eo', 'Emeka Obi', 14, 5, [], RICE_AND),
    guest('bo', 'Bayo Ojo', 3, 4, [], [ITEM]),
    guest('sm', 'Sola Martins', 3, 1, [], RICE_AND, { state: 'changed', to: 'Beef' }),
    guest('ne', 'Ngozi Eze', 3, 2, [], RICE_AND, {
      state: 'changed',
      to: 'Beef',
      stage: 'Dishing',
    }),
  ];
}

export const LATE_GUEST: Guest = guest('bi', 'Bola Ige', 14, 7, [], RICE_AND, { late: true });

export function fresh(): RunOut {
  return {
    runOut: true,
    guests: sampleGuests(),
    stands: null,
    panel: false,
    confirm: null,
    choosing: null,
    refused: '',
    say: '',
    raised: 1,
  };
}

export function guests(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export function waitingWords(n: number): string {
  return `${n} waiting for a choice`;
}

export function where(g: Guest): string {
  return `Table ${g.table} · seat ${g.seat}`;
}

const flagged = (g: Guest) => g.flags.length > 0;

export function order(a: Guest, b: Guest): number {
  return Number(flagged(b)) - Number(flagged(a)) || a.table - b.table || a.seat - b.seat;
}

export function waiting(r: RunOut): Guest[] {
  return r.guests.filter((g) => g.state === 'waiting').sort(order);
}

export function changed(r: RunOut): Guest[] {
  return r.guests.filter((g) => g.state === 'changed').sort(order);
}

export function plateNow(g: Guest): string[] {
  if (g.state !== 'changed') return [...g.plate];
  const rest = g.plate.filter((i) => i !== ITEM);
  return g.to == null || g.to === '' ? rest : [...rest, g.to];
}

function others(g: Guest): string[] {
  return g.plate.filter((i) => i !== ITEM);
}

/** Ask each guest asks every guest not asked yet, flagged guests included; no Serve choice covers a flagged guest or one being asked at the table. */
export function covers(c: Bulk, g: Guest): boolean {
  if (c.kind === 'ask') return !g.asked;
  if (flagged(g) || g.asked) return false;
  if (c.kind === 'serve') return !g.plate.includes(c.item);
  return others(g).length > 0;
}

/** Every guest waiting now that a bulk choice covers: never a flagged guest, never one whose plate has the substitute, never one it would empty. */
export function covered(r: RunOut, c: Bulk): Guest[] {
  return waiting(r).filter((g) => covers(c, g));
}

export function bulkLabel(c: Bulk): string {
  if (c.kind === 'ask') return 'Ask each guest';
  return c.kind === 'serve' ? `Serve ${c.item}` : `Serve without ${ITEM}`;
}

export function sameBulk(a: Bulk | null, b: Bulk | null): boolean {
  if (a == null || b == null) return false;
  if (a.kind === 'serve' && b.kind === 'serve') return a.item === b.item;
  return a.kind === b.kind;
}

export interface BulkRow {
  bulk: Bulk;
  label: string;
  stands: boolean;
}

export function bulkRows(r: RunOut): BulkRow[] {
  const serve: Bulk[] = COURSE_ITEMS.filter((i) => i !== ITEM).map((item) => ({
    kind: 'serve',
    item,
  }));
  const rest: Bulk[] = [{ kind: 'without' }, { kind: 'ask' }];
  return [...serve, ...rest].map((bulk) => ({
    bulk,
    label: bulkLabel(bulk),
    stands: sameBulk(r.stands, bulk),
  }));
}

export function confirmTitle(r: RunOut, c: Bulk): string {
  const n = covered(r, c).length;
  if (c.kind === 'ask')
    return n > 0
      ? `Ask ${n} ${guests(n, 'guest at their table', 'guests at their tables')}?`
      : 'Ask guests still to come at their tables?';
  if (c.kind === 'serve')
    return n > 0
      ? `Serve ${c.item} to ${n} ${guests(n, 'guest', 'guests')} instead of ${ITEM}?`
      : `Serve ${c.item} instead of ${ITEM} for guests still to come?`;
  return n > 0
    ? `Serve without ${ITEM} for ${n} ${guests(n, 'guest', 'guests')}?`
    : `Serve without ${ITEM} for guests still to come?`;
}

export function askedNow(r: RunOut): Guest[] {
  return waiting(r).filter((g) => g.asked);
}

/** A Serve choice leaves asked guests as they are, and says so while anyone is asked. */
export function confirmNote(r: RunOut, c: Bulk): string {
  return c.kind !== 'ask' && askedNow(r).length > 0 ? STAY_ASKED : '';
}

/** Counted only while someone is asked: everyone asked since the item ran out, less those the floor lead then chose for. */
export function countLine(r: RunOut): string {
  if (!r.runOut || askedNow(r).length === 0) return '';
  const asked = r.guests.filter((g) => g.everAsked && g.by !== 'lead');
  const chosen = asked.filter((g) => g.by === 'guest').length;
  const n = asked.length;
  return `${chosen} of ${n} ${guests(n, 'guest has', 'guests have')} chosen at the table`;
}

export interface Conflict {
  line: string;
  note: string;
}

/** An allergen the item contains, or any allergen when the item's are not stated; an Other allergy and a diet refuse nothing. */
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
  item: string;
  label: string;
  no: Conflict | null;
}

export function options(g: Guest): Option[] {
  const now = plateNow(g);
  const out: Option[] = COURSE_ITEMS.filter((i) => i !== ITEM && !now.includes(i)).map((item) => ({
    item,
    label: `Serve ${item}`,
    no: conflict(g, item),
  }));
  const withoutAlready = g.state === 'changed' && g.to === '';
  if (others(g).length > 0 && !withoutAlready)
    out.push({ item: '', label: `Serve without ${ITEM}`, no: null });
  return out;
}

export function nowLine(g: Guest): string {
  return g.to == null || g.to === '' ? `Without ${ITEM}` : `Now ${g.to}`;
}

export function offlineLine(what: 'choose' | 'ask' | 'available' | 'runOut'): string {
  const doing =
    what === 'choose' || what === 'ask'
      ? what
      : what === 'available'
        ? `mark ${ITEM} available again`
        : `mark ${ITEM} run out`;
  return `Needs a connection to ${doing}. Nothing is kept to send later.`;
}

export function dishingLine(g: Guest): string {
  return `${g.name}’s plate is already being dished, so their choice stays as it is.`;
}

function copy(r: RunOut): RunOut {
  return structuredClone(r);
}

function refused(r: RunOut, line: string): RunOut {
  return { ...copy(r), refused: line, say: line };
}

function gate(r: RunOut, can: Can, what: 'choose' | 'ask' | 'available'): RunOut | null {
  if (!can.online) return refused(r, offlineLine(what));
  if (!can.manage) return refused(r, NO_MANAGE_LINE);
  return null;
}

export function openPanel(r: RunOut, can: Can): RunOut {
  const no = gate(r, can, 'choose');
  if (no != null) return no;
  return { ...copy(r), panel: r.runOut, refused: '', say: '' };
}

export function closePanel(r: RunOut): RunOut {
  return { ...copy(r), panel: false, confirm: null, choosing: null, refused: '', say: '' };
}

export function pressBulk(r: RunOut, can: Can, c: Bulk): RunOut {
  const no = gate(r, can, c.kind === 'ask' ? 'ask' : 'choose');
  if (no != null) return no;
  if (sameBulk(r.stands, c)) return r;
  return { ...copy(r), confirm: c, refused: '', say: '' };
}

export function cancel(r: RunOut): RunOut {
  return { ...copy(r), confirm: null, choosing: null, say: '' };
}

export function confirmBulk(r0: RunOut, can: Can): RunOut {
  const c = r0.confirm;
  if (c == null) return r0;
  const no = gate(r0, can, c.kind === 'ask' ? 'ask' : 'choose');
  if (no != null) return { ...no, confirm: null };
  const r = copy(r0);
  const ids = new Set(covered(r, c).map((g) => g.id));
  r.guests = r.guests.map((g) => (ids.has(g.id) ? applyBulk(g, c) : g));
  r.stands = c;
  r.confirm = null;
  r.refused = '';
  r.say = STANDS_LINE;
  return r;
}

function applyBulk(g: Guest, c: Bulk): Guest {
  if (c.kind === 'ask') return { ...g, asked: true, everAsked: true };
  return { ...g, state: 'changed', to: c.kind === 'serve' ? c.item : '', by: 'lead' };
}

/** Ask {name}: one guest, no confirmation, nothing left standing. */
export function askOne(r0: RunOut, can: Can, id: string): RunOut {
  const no = gate(r0, can, 'ask');
  if (no != null) return no;
  const g0 = r0.guests.find((x) => x.id === id);
  if (g0 == null || g0.state !== 'waiting' || g0.asked) return r0;
  const r = copy(r0);
  r.guests = r.guests.map((g) => (g.id === id ? { ...g, asked: true, everAsked: true } : g));
  r.refused = '';
  r.say = `${g0.name}: ${ASKING.toLowerCase()}.`;
  return r;
}

/** The guest's own answer, recorded by their waiter at the table: it applies as Choose for {name} does, and ends their ask. */
export function answer(r0: RunOut, id: string, item: string): RunOut {
  const g0 = r0.guests.find((x) => x.id === id);
  if (!r0.runOut || g0 == null || !g0.asked || g0.stage !== 'To serve') return r0;
  const offered = options(g0).find((o) => o.item === item);
  if (offered == null || offered.no != null) return r0;
  const r = copy(r0);
  r.guests = r.guests.map((g) =>
    g.id === id ? { ...g, state: 'changed', to: item, asked: false, by: 'guest' } : g,
  );
  r.say = countLine(r);
  return r;
}

export function openChoose(r: RunOut, can: Can, id: string): RunOut {
  const no = gate(r, can, 'choose');
  if (no != null) return no;
  const g = r.guests.find((x) => x.id === id);
  if (g == null) return r;
  if (g.stage !== 'To serve') return refused(r, dishingLine(g));
  return { ...copy(r), choosing: id, refused: '', say: '' };
}

/** A choice for one guest, made again while their plate is at To serve; from Dishing on it is refused (409 plate_stage_invalid). */
export function pick(r0: RunOut, can: Can, item: string): RunOut {
  const id = r0.choosing;
  const g0 = r0.guests.find((x) => x.id === id);
  if (g0 == null) return r0;
  const no = gate(r0, can, 'choose');
  if (no != null) return { ...no, choosing: null };
  if (g0.stage !== 'To serve') return { ...refused(r0, dishingLine(g0)), choosing: null };
  const offered = options(g0).find((o) => o.item === item);
  if (offered == null || offered.no != null) return r0;
  const r = copy(r0);
  r.guests = r.guests.map((g) =>
    g.id === id ? { ...g, state: 'changed', to: item, asked: false, by: 'lead' } : g,
  );
  r.choosing = null;
  r.refused = '';
  r.say = `${g0.name}: ${item === '' ? `without ${ITEM}` : `now ${item}`}.`;
  return r;
}

/** Gives the item back to every guest still waiting; guests already changed keep theirs, and the standing choice ends. */
export function markAvailable(r0: RunOut, can: Can): RunOut {
  const no = gate(r0, can, 'available');
  if (no != null) return no;
  const r = copy(r0);
  r.guests = r.guests.map((g) =>
    g.state === 'waiting' ? { ...g, state: 'back', asked: false } : g,
  );
  r.runOut = false;
  r.stands = null;
  r.panel = false;
  r.confirm = null;
  r.choosing = null;
  r.refused = '';
  r.say = `${ITEM} is available again.`;
  return r;
}

/** A guest who starts waiting later: a standing choice that covers them changes them at once with no alert; otherwise the alert is raised again. */
export function lateArrival(r0: RunOut): RunOut {
  if (!r0.runOut || r0.guests.some((g) => g.id === LATE_GUEST.id)) return r0;
  const r = copy(r0);
  const s = r.stands;
  if (s?.kind === 'ask') {
    r.guests.push({ ...LATE_GUEST, asked: true, everAsked: true });
    r.say = `${LATE_GUEST.name} arrived late: ${ASKING.toLowerCase()}.`;
    return r;
  }
  if (s != null && covers(s, LATE_GUEST)) {
    r.guests.push(applyBulk(LATE_GUEST, s));
    r.say = `${LATE_GUEST.name} arrived late: ${s.kind === 'serve' ? `now ${s.item}` : `without ${ITEM}`}.`;
    return r;
  }
  r.guests.push({ ...LATE_GUEST });
  r.raised += 1;
  const a = alertOf(r);
  r.say = a == null ? '' : `${a.title}. ${a.sub}.`;
  return r;
}

export function startDishing(r0: RunOut, id: string): RunOut {
  const r = copy(r0);
  r.guests = r.guests.map((g) => (g.id === id ? { ...g, stage: 'Dishing' } : g));
  r.say = '';
  return r;
}

export function heldTables(r: RunOut): number[] {
  return r.runOut ? [...new Set(waiting(r).map((g) => g.table))] : [];
}

export interface RunOutAlert {
  title: string;
  sub: string;
  count: string;
}

export function alertOf(r: RunOut): RunOutAlert | null {
  const n = waiting(r).length;
  if (!r.runOut || n === 0) return null;
  return { title: TITLE, sub: `${STATION} · ${waitingWords(n)}`, count: countLine(r) };
}

export interface Counts {
  due: number;
  served: number;
  choice: number;
  onTray: number;
  kitchen: number;
  toServe: number;
  notHere: number;
}

export type Bucket = 'choice' | 'toServe';

/** Where a guest at To serve counts: waiting for a choice, or To serve, as every substitute is Ready while the item is run out. */
export function bucketOf(g: Guest): Bucket {
  return g.state === 'waiting' ? 'choice' : 'toServe';
}

/** The read's counts before the item ran out hold every one of these guests at To serve; each moves to where it counts now, so the counts still add up to the guests due. */
export function countsWith(base: Omit<Counts, 'choice'>, r: RunOut): Counts {
  const out: Counts = { ...base, choice: 0 };
  for (const g of r.guests) {
    if (g.stage !== 'To serve') continue;
    if (g.late) {
      out.due += 1;
      out.notHere -= 1;
    } else out.toServe -= 1;
    out[bucketOf(g)] += 1;
  }
  return out;
}

export function sum(c: Counts): number {
  return c.choice + c.onTray + c.kitchen + c.toServe + c.served;
}

export const SECTION_TABLES: Readonly<Record<string, readonly number[]>> = {
  A: [3],
  B: [9],
  C: [12, 14],
};

export function leftOut(r: RunOut, tables: readonly number[]): number {
  return r.guests.filter(
    (g) => g.stage === 'To serve' && tables.includes(g.table) && bucketOf(g) !== 'toServe',
  ).length;
}

export function leftEachWithout(leftEach: number, people: number, out: number): number {
  if (people === 0) return 0;
  return Math.max(0, Math.ceil((leftEach * people - out) / people));
}

export const RUN_OUT_STATES = [
  'runOutAlert',
  'runOutPanel',
  'runOutConfirm',
  'runOutConfirmLater',
  'runOutStands',
  'runOutWithout',
  'runOutChooseFor',
  'runOutChanged',
  'runOutAvailable',
  'runOutNoManage',
  'runOutOffline',
  'runOutEarlier',
  'runOutAskConfirm',
  'runOutAskOne',
  'runOutAsking',
  'runOutAskAnswered',
  'runOutAskLeadChose',
  'runOutAskLater',
  'runOutServeWhileAsked',
  'runOutAskOffline',
] as const;

export type RunOutStateName = (typeof RUN_OUT_STATES)[number];

export const RUN_OUT_WHAT: Record<RunOutStateName, string> = {
  runOutAlert:
    'Chicken run out at 20:06: the alert with Choose, Waiting for a choice first, the kitchen line',
  runOutPanel: 'The choice panel from Choose: the bulk choices, nine guests waiting, flagged first',
  runOutConfirm: 'Serve Beef pressed: “Serve Beef to 4 guests instead of Chicken?”',
  runOutConfirmLater:
    'Serve Beef stands and Musa Bello is chosen for: Serve Grilled fish confirms for guests still to come',
  runOutStands:
    'Serve Beef stands: a line, “Applies to guests still to come”; a late arrival is covered at once',
  runOutWithout: 'After Serve without Chicken: Bayo Ojo still listed, his plate would be empty',
  runOutChooseFor: 'Choose for Funke Adeyemi: Beef and Grilled fish not for her, Fish allergy',
  runOutChanged: 'Guests already changed: Sola Martins at To serve, Ngozi Eze at Dishing, the 409',
  runOutAvailable: 'After Mark available again: Chicken Ready, the alert and the count gone',
  runOutNoManage: 'Without service.manage: no alert, no panel, a choice by link refused (403)',
  runOutOffline: 'No connection: Choose pressed and refused, nothing kept',
  runOutEarlier:
    'Starter · Small chops run out at the Fryer too, owed to a guest already waiting on Chicken: its line follows the Fryer’s Plantain',
  runOutAskConfirm:
    'Ask each guest pressed: “Ask 9 guests at their tables?”, the four flagged guests included',
  runOutAskOne:
    'Ask Tunde Bakare and Ask Yemi Alabi: their rows read Asking at the table; 0 of 2 have chosen',
  runOutAsking:
    'Ask each guest stands: a line, “Applies to guests still to come”; 0 of 9 have chosen at the table',
  runOutAskAnswered:
    'Tunde Bakare chose Beef and Emeka Obi Grilled fish at their tables: 2 of 9, both in Already changed',
  runOutAskLeadChose:
    'The floor lead chose for Funke Adeyemi while she was asked: she leaves the count, 0 of 8',
  runOutAskLater:
    'Every waiting guest asked one by one: Ask each guest confirms for guests still to come',
  runOutServeWhileAsked:
    'Two guests asked: Serve Beef counts 2 guests and says those asked stay asked',
  runOutAskOffline: 'No connection: Ask Tunde Bakare pressed and refused, nothing kept',
};

const LEAD_CAN: Can = { online: true, manage: true };
const BEEF: Bulk = { kind: 'serve', item: 'Beef' };
const ASK: Bulk = { kind: 'ask' };

function choose(r: RunOut, id: string, item: string): RunOut {
  return pick(openChoose(r, LEAD_CAN, id), LEAD_CAN, item);
}

function settle(r: RunOut): RunOut {
  return { ...r, say: '' };
}

export function runOutSeed(name: RunOutStateName): RunOut {
  const r = fresh();
  const panel = { ...r, panel: true };
  const beef = confirmBulk(pressBulk(panel, LEAD_CAN, BEEF), LEAD_CAN);
  const asking = settle(confirmBulk(pressBulk(panel, LEAD_CAN, ASK), LEAD_CAN));
  const two = askOne(askOne(panel, LEAD_CAN, 'tb'), LEAD_CAN, 'ya');
  switch (name) {
    case 'runOutAlert':
      return r;
    case 'runOutPanel':
      return panel;
    case 'runOutConfirm':
      return pressBulk(panel, LEAD_CAN, BEEF);
    case 'runOutConfirmLater':
      return pressBulk(choose(beef, 'mb', ''), LEAD_CAN, { kind: 'serve', item: 'Grilled fish' });
    case 'runOutStands':
      return settle(beef);
    case 'runOutWithout':
      return settle(confirmBulk(pressBulk(panel, LEAD_CAN, { kind: 'without' }), LEAD_CAN));
    case 'runOutChooseFor':
      return openChoose(panel, LEAD_CAN, 'fa');
    case 'runOutChanged':
      return settle(pick({ ...panel, choosing: 'ne' }, LEAD_CAN, 'Grilled fish'));
    case 'runOutAvailable':
      return settle(markAvailable(beef, LEAD_CAN));
    case 'runOutNoManage':
      return settle(openPanel(r, { online: true, manage: false }));
    case 'runOutOffline':
      return settle(openPanel(r, { online: false, manage: true }));
    case 'runOutEarlier':
      return { ...r, earlier: SMALL_CHOPS };
    case 'runOutAskConfirm':
      return pressBulk(panel, LEAD_CAN, ASK);
    case 'runOutAskOne':
      return settle(two);
    case 'runOutAsking':
      return asking;
    case 'runOutAskAnswered':
      return settle(answer(answer(asking, 'tb', 'Beef'), 'eo', 'Grilled fish'));
    case 'runOutAskLeadChose':
      return settle(choose(asking, 'fa', ''));
    case 'runOutAskLater': {
      const all = waiting(panel).reduce((x, g) => askOne(x, LEAD_CAN, g.id), panel);
      return pressBulk(settle(all), LEAD_CAN, ASK);
    }
    case 'runOutServeWhileAsked':
      return pressBulk(settle(two), LEAD_CAN, BEEF);
    case 'runOutAskOffline':
      return { ...settle(two), refused: offlineLine('ask') };
  }
}
