/** A section's queue (sc-36033, Queue.dc.html on page 35): the order its trays reach its tables, and the waiter's Next that follows it. */

export type PlaceKind = 'table' | 'row' | 'seats';
export type Control = 'front' | 'up' | 'down';
export type SectionId = 'A' | 'B' | 'C' | 'D' | 'E';

export interface Place {
  name: string;
  kind: PlaceKind;
  served: number;
  total: number;
  toServe: number;
  onTray: number;
  kitchen: number;
  owed: number;
  owedAt: string;
  flag: string;
  trayOf: string;
}

export interface Section {
  id: SectionId;
  name: string;
  on: readonly string[];
  places: readonly Place[];
}

export type Notice = { kind: 'offline' } | { kind: 'conflict'; by: string; section: SectionId };

export interface QueueState {
  selected: SectionId;
  queues: Record<SectionId, string[]>;
  places: Record<string, Place>;
  build: { section: SectionId; picked: string[] } | null;
  online: boolean;
  notice: Notice | null;
  say: string;
  focus: { place: string; control: Control } | null;
  manage: boolean;
  rivalFirst: boolean;
  moved: { place: string; by: string } | null;
  waiterToast: string;
  on: SectionId[];
  line: string;
  started: boolean;
}

export const LEAD = 'Ifeoma Nduka';
export const RIVAL = 'Tobi Adeyemi';
export const WAITER = 'Kunle Ajayi';
export const CONTROLS: readonly Control[] = ['front', 'up', 'down'];

export const RIVAL_QUEUES: Partial<Record<SectionId, readonly string[]>> = {
  D: ['Table 17', 'Table 15', 'Table 16', 'Table 18', 'Table 19'],
};

function place(
  name: string,
  kind: PlaceKind,
  served: number,
  total: number,
  more: Partial<Place> = {},
): Place {
  return {
    name,
    kind,
    served,
    total,
    toServe: 0,
    onTray: 0,
    kitchen: 0,
    owed: 0,
    owedAt: '',
    flag: '',
    trayOf: '',
    ...more,
  };
}

export const SECTIONS: readonly Section[] = [
  {
    id: 'A',
    name: 'Section A',
    on: [WAITER],
    places: [
      place('Seats 1 to 10', 'seats', 0, 10, { toServe: 7, kitchen: 3 }),
      place('Table 10', 'table', 2, 6, { toServe: 3, owed: 1, owedAt: '20:31' }),
      place('Row C', 'row', 0, 10, { toServe: 10, flag: '2 vegan' }),
      place('Table 2', 'table', 8, 8),
      place('Table 4', 'table', 3, 8, { onTray: 3, kitchen: 2, trayOf: WAITER }),
      place('Table 5', 'table', 0, 8, { toServe: 8, flag: '1 nut allergy' }),
    ],
  },
  {
    id: 'B',
    name: 'Section B',
    on: ['Funmi Bakare', 'Grace Udo'],
    places: [
      place('Table 6', 'table', 4, 10, { toServe: 6 }),
      place('Table 7', 'table', 10, 10),
      place('Table 8', 'table', 0, 8, { toServe: 8 }),
      place('Table 9', 'table', 2, 8, { toServe: 4, onTray: 2, trayOf: 'Funmi Bakare' }),
      place('Table 11', 'table', 0, 10, { toServe: 10 }),
    ],
  },
  {
    id: 'C',
    name: 'Section C',
    on: [],
    places: [place('Table 12', 'table', 0, 10, { toServe: 10 })],
  },
  {
    id: 'D',
    name: 'Section D',
    on: ['Chidi Okafor'],
    places: [
      place('Table 15', 'table', 8, 8),
      place('Table 16', 'table', 3, 10, { toServe: 4, onTray: 3, trayOf: 'Chidi Okafor' }),
      place('Table 17', 'table', 0, 8, { toServe: 8, flag: '1 gluten free' }),
      place('Table 18', 'table', 0, 10, { toServe: 10 }),
      place('Table 19', 'table', 0, 8, { toServe: 8 }),
    ],
  },
  { id: 'E', name: 'Section E', on: ['Yinka Hassan'], places: [] },
];

const KIND_ORDER: Record<PlaceKind, number> = { table: 0, row: 1, seats: 2 };
const COLLATOR = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** Tables by name with numbers by value, then rows by label, then blocks of single seats. */
export function startOrder(places: readonly Place[]): string[] {
  return [...places]
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || COLLATOR.compare(a.name, b.name))
    .map((p) => p.name);
}

export function sectionOf(id: SectionId): Section {
  const found = SECTIONS.find((s) => s.id === id);
  if (found == null) throw new Error(`No section ${id}`);
  return found;
}

export function fresh(): QueueState {
  const queues = {} as Record<SectionId, string[]>;
  const places: Record<string, Place> = {};
  for (const s of SECTIONS) {
    queues[s.id] = startOrder(s.places);
    for (const p of s.places) places[p.name] = { ...p };
  }
  return {
    selected: 'A',
    queues,
    places,
    build: null,
    online: true,
    notice: null,
    say: '',
    focus: null,
    manage: true,
    rivalFirst: false,
    moved: null,
    waiterToast: '',
    on: ['A'],
    line: '',
    started: true,
  };
}

function copy(s: QueueState): QueueState {
  return structuredClone(s);
}

/** Whether a control is drawn at this place: none on a one-table section, no Bring forward or Move up first, no Move down last. */
export function drawn(control: Control, index: number, count: number): boolean {
  if (count < 2) return false;
  return control === 'down' ? index < count - 1 : index > 0;
}

/** Where focus goes after a move: the pressed control if still drawn, else the place's next drawn control, else the one before. */
export function focusAfter(control: Control, index: number, count: number): Control | null {
  if (drawn(control, index, count)) return control;
  const at = CONTROLS.indexOf(control);
  for (const c of CONTROLS.slice(at + 1)) if (drawn(c, index, count)) return c;
  for (const c of CONTROLS.slice(0, at).reverse()) if (drawn(c, index, count)) return c;
  return null;
}

function placeOf(s: QueueState, name: string): Place {
  return s.places[name] ?? place(name, 'table', 0, 0);
}

export function upNext(s: QueueState, id: SectionId): string | null {
  return s.queues[id].find((n) => placeOf(s, n).toServe > 0) ?? null;
}

export function isServed(p: Place): boolean {
  return p.total > 0 && p.served >= p.total;
}

export function waiterSections(s: QueueState): SectionId[] {
  return s.on;
}

/** The waiter as Team left them (sc-36034): on these sections now, told so in one line. */
export function placedOn(on: readonly SectionId[], line: string): QueueState {
  return { ...fresh(), on: [...on], line };
}

/** A tray the waiter started in a section they are no longer on: still theirs to finish. */
export function trayToFinish(s: QueueState): { place: Place; section: SectionId } | null {
  for (const id of SECTIONS.map((x) => x.id))
    if (!s.on.includes(id))
      for (const n of s.queues[id]) {
        const p = s.places[n];
        if (p != null && p.trayOf === WAITER && p.onTray > 0) return { place: p, section: id };
      }
  return null;
}

/** Where the waiter is, as Next's header says it: their first section, and any other as well. */
export function onWords(on: readonly SectionId[]): string {
  const [first, ...rest] = on.map((id) => sectionOf(id).name);
  if (first == null) return 'On no section';
  return rest.length === 0 ? first : `${first}, and ${andList(rest)} as well`;
}

export interface WaiterNext {
  place: string;
  section: SectionId;
  owed: boolean;
}

/** The waiter's Next: owed plates across their sections, oldest first; then the place highest in its own queue, a tie to their own section. */
export function waiterNext(s: QueueState): WaiterNext | null {
  const owed: (WaiterNext & { at: string })[] = [];
  for (const id of waiterSections(s))
    for (const n of s.queues[id])
      if (placeOf(s, n).owed > 0)
        owed.push({ place: n, section: id, owed: true, at: placeOf(s, n).owedAt });
  owed.sort((a, b) => a.at.localeCompare(b.at));
  if (owed[0] != null) {
    const { place: p, section, owed: o } = owed[0];
    return { place: p, section, owed: o };
  }
  let best: (WaiterNext & { at: number }) | null = null;
  for (const id of waiterSections(s)) {
    const at = s.queues[id].findIndex((n) => placeOf(s, n).toServe > 0);
    if (at >= 0 && (best == null || at < best.at))
      best = { place: s.queues[id][at] ?? '', section: id, owed: false, at };
  }
  return best == null ? null : { place: best.place, section: best.section, owed: false };
}

function tellWaiter(s: QueueState, id: SectionId, before: string | null): void {
  if (!waiterSections(s).includes(id)) return;
  const next = waiterNext(s);
  if (next == null || next.owed || next.place === before) return;
  s.moved = { place: next.place, by: LEAD };
  s.waiterToast = `${LEAD} changed your queue · ${next.place} is next`;
}

export function movedTo(name: string, at: number, count: number): string {
  return `${name} moved to ${at} of ${count}`;
}

function refused(s: QueueState): QueueState {
  const next = copy(s);
  next.notice = { kind: 'offline' };
  next.say = OFFLINE_LINE;
  next.focus = null;
  return next;
}

export const OFFLINE_LINE = 'Changing the queue needs a connection.';

/** Bring forward, Move up or Move down, on the queue as the server has it. */
export function move(s0: QueueState, id: SectionId, name: string, control: Control): QueueState {
  if (!s0.online) return refused(s0);
  const s = copy(s0);
  s.notice = null;
  s.waiterToast = '';
  const q = s.queues[id];
  if (s.rivalFirst) {
    const i = q.indexOf(name);
    q.splice(i, 1);
    if (control === 'down') q.push(name);
    else q.unshift(name);
    s.rivalFirst = false;
  }
  const i = q.indexOf(name);
  const j = control === 'front' ? 0 : control === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= q.length || i === j) {
    s.say = movedTo(name, i + 1, q.length);
    const f = focusAfter(control, i, q.length);
    s.focus = f == null ? null : { place: name, control: f };
    return s;
  }
  const before = waiterNext(s0)?.place ?? null;
  q.splice(i, 1);
  q.splice(j, 0, name);
  s.say = movedTo(name, j + 1, q.length);
  const f = focusAfter(control, j, q.length);
  s.focus = f == null ? null : { place: name, control: f };
  tellWaiter(s, id, before);
  return s;
}

export function startBuild(s0: QueueState, id: SectionId): QueueState {
  if (!s0.online) return refused(s0);
  return { ...copy(s0), build: { section: id, picked: [] }, notice: null };
}

export function pick(s0: QueueState, name: string): QueueState {
  const s = copy(s0);
  if (s.build == null) return s;
  const at = s.build.picked.indexOf(name);
  if (at >= 0) s.build.picked.splice(at, 1);
  else s.build.picked.push(name);
  return s;
}

export function builtOrder(queue: readonly string[], picked: readonly string[]): string[] {
  return [...picked, ...queue.filter((n) => !picked.includes(n))];
}

export function cancelBuild(s0: QueueState): QueueState {
  return { ...copy(s0), build: null };
}

/** Save: refused offline, refused with 412 when another lead changed the queue since, else the whole queue replaced. */
export function save(s0: QueueState): QueueState {
  if (s0.build == null || s0.build.picked.length === 0) return s0;
  if (!s0.online) return refused(s0);
  const s = copy(s0);
  const id = s0.build.section;
  s.build = null;
  s.waiterToast = '';
  if (s.rivalFirst) {
    const rival = RIVAL_QUEUES[id];
    if (rival != null) s.queues[id] = [...rival];
    else {
      const q = s.queues[id];
      const last = q.pop();
      if (last != null) q.unshift(last);
    }
    s.rivalFirst = false;
    s.notice = { kind: 'conflict', by: RIVAL, section: id };
    s.say = conflictLine(RIVAL);
    return s;
  }
  const before = waiterNext(s0)?.place ?? null;
  s.queues[id] = builtOrder(s.queues[id], s0.build.picked);
  s.notice = null;
  const next = upNext(s, id);
  s.say = `${sectionOf(id).name} queue saved${next == null ? '' : ` · ${next} is next`}`;
  tellWaiter(s, id, before);
  return s;
}

export interface OnIt {
  name: string;
  initials: string;
  line: string;
}

export function onIt(s: QueueState, id: SectionId): OnIt[] {
  const sec = sectionOf(id);
  if (sec.on.length === 0)
    return [{ name: `Nobody on ${sec.name}`, initials: '–', line: 'Put someone on it from Team' }];
  const next = upNext(s, id);
  return sec.on.map((person) => {
    const tray = s.queues[id].map((n) => s.places[n]).find((p) => p?.trayOf === person);
    return {
      name: person,
      initials: person
        .split(' ')
        .filter((_, i, all) => i === 0 || i === all.length - 1)
        .map((word) => word[0])
        .join('')
        .toUpperCase(),
      line:
        tray != null
          ? `Serving ${tray.name} · ${tray.onTray} plates`
          : next != null
            ? `Next: ${next}`
            : 'Nobody left to serve',
    };
  });
}

export function conflictLine(by: string): string {
  return `${by} changed this queue while you were building it.`;
}

export function startTray(s0: QueueState): QueueState {
  const next = waiterNext(s0);
  if (next == null) return s0;
  const s = copy(s0);
  const p = s.places[next.place];
  if (p == null) return s0;
  const plates = p.owed > 0 ? p.owed : Math.min(3, p.toServe);
  if (p.owed > 0) {
    p.owed = 0;
    p.owedAt = '';
  } else p.toServe -= plates;
  p.onTray += plates;
  p.trayOf = WAITER;
  if (s.moved?.place === next.place) s.moved = null;
  s.waiterToast = '';
  return s;
}

export function goOnline(s0: QueueState, online: boolean): QueueState {
  const s = copy(s0);
  s.online = online;
  if (online && s.notice?.kind === 'offline') s.notice = null;
  return s;
}

export function select(s0: QueueState, id: SectionId): QueueState {
  const s = copy(s0);
  s.selected = id;
  if (s.notice?.kind === 'conflict') s.notice = null;
  return s;
}

export interface Tag {
  kind: 'next' | 'tray' | 'served' | 'owed';
  label: string;
}

/** A place's tags on the lead's Queue: whose tray is out, else Up next; Served; owed going first. */
export function tagsFor(s: QueueState, id: SectionId, name: string): Tag[] {
  const p = s.places[name];
  if (p == null) return [];
  const tags: Tag[] = [];
  if (p.trayOf !== '') tags.push({ kind: 'tray', label: `Now · ${p.trayOf.split(' ')[0]}’s tray` });
  else if (upNext(s, id) === name) tags.push({ kind: 'next', label: 'Up next' });
  if (isServed(p)) tags.push({ kind: 'served', label: 'Served' });
  if (p.owed > 0) tags.push({ kind: 'owed', label: 'Owed · goes first' });
  return tags;
}

export function placeLine(p: Place): string {
  return [
    `${p.served} of ${p.total} served`,
    p.toServe > 0 ? `${p.toServe} to serve` : '',
    p.onTray > 0 ? `${p.onTray} on a tray` : '',
    p.kitchen > 0 ? `${p.kitchen} waiting on the kitchen` : '',
    p.owed > 0 ? `${p.owed} owed` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

export function andList(xs: readonly string[]): string {
  if (xs.length < 2) return xs.join('');
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

export function buildWords(queue: readonly string[], picked: readonly string[]) {
  const rest = queue.filter((n) => !picked.includes(n));
  const line =
    picked.length === 0
      ? 'Tap the tables in the order trays should go to them. Any you skip go after, as they are now.'
      : rest.length > 0
        ? `Then ${andList(rest)}, as they are now.`
        : 'Every table has its place.';
  const saveLabel =
    picked[0] == null ? 'Tap a table to start' : `Save the queue · ${picked[0]} first`;
  return { line, saveLabel, canSave: picked.length > 0 };
}

export const QUEUE_STATES = [
  'populated',
  'beforeStart',
  'moved',
  'oneTable',
  'noTables',
  'noManage',
  'buildEmpty',
  'buildPartial',
  'buildAll',
  'offline',
  'conflict',
  'rivalMove',
  'waiterNotice',
  'waiterSame',
  'asWell',
  'asWellTie',
] as const;
export type QueueStateName = (typeof QUEUE_STATES)[number];

export function queueStateOf(raw: string | null | undefined): QueueStateName {
  return QUEUE_STATES.find((s) => s === raw) ?? 'populated';
}

const NO_FOCUS = { focus: null } as const;

export function seed(name: QueueStateName): QueueState {
  const s = fresh();
  const settle = (x: QueueState): QueueState => ({ ...x, ...NO_FOCUS, say: '' });
  switch (name) {
    case 'populated':
      return s;
    case 'beforeStart':
      s.started = false;
      for (const p of Object.values(s.places))
        Object.assign(p, {
          served: 0,
          toServe: p.total,
          onTray: 0,
          kitchen: 0,
          owed: 0,
          owedAt: '',
          trayOf: '',
        });
      return s;
    case 'moved':
      return settle(move(s, 'A', 'Table 4', 'front'));
    case 'oneTable':
      return { ...s, selected: 'C' };
    case 'noTables':
      return { ...s, selected: 'E' };
    case 'noManage':
      return { ...s, manage: false };
    case 'buildEmpty':
      return { ...s, selected: 'D', build: { section: 'D', picked: [] } };
    case 'buildPartial':
      return {
        ...s,
        selected: 'D',
        build: { section: 'D', picked: ['Table 19', 'Table 18', 'Table 16', 'Table 15'] },
      };
    case 'buildAll':
      return {
        ...s,
        selected: 'D',
        build: {
          section: 'D',
          picked: ['Table 19', 'Table 18', 'Table 16', 'Table 15', 'Table 17'],
        },
      };
    case 'offline':
      return { ...s, online: false, notice: { kind: 'offline' } };
    case 'conflict':
      s.queues.D = [...(RIVAL_QUEUES.D ?? [])];
      return { ...s, selected: 'D', notice: { kind: 'conflict', by: RIVAL, section: 'D' } };
    case 'rivalMove':
      return { ...s, rivalFirst: true };
    case 'waiterNotice': {
      Object.assign(s.places['Table 4'] ?? {}, { served: 6, onTray: 0, trayOf: '' });
      Object.assign(s.places['Table 10'] ?? {}, { owed: 0, owedAt: '' });
      s.queues.A = ['Table 10', 'Table 2', 'Table 4', 'Table 5', 'Row C', 'Seats 1 to 10'];
      return settle(move(s, 'A', 'Table 5', 'front'));
    }
    case 'waiterSame':
      Object.assign(s.places['Table 10'] ?? {}, { owed: 0, owedAt: '' });
      return settle(move(s, 'A', 'Row C', 'up'));
    case 'asWell':
      Object.assign(s.places['Table 6'] ?? {}, { owed: 1, owedAt: '20:28' });
      return { ...s, on: ['A', 'B'] };
    case 'asWellTie':
      Object.assign(s.places['Table 10'] ?? {}, { owed: 0, owedAt: '' });
      s.queues.A = ['Table 5', 'Table 2', 'Table 4', 'Table 10', 'Row C', 'Seats 1 to 10'];
      return { ...s, on: ['A', 'B'] };
  }
}
