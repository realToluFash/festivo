import {
  type Pad,
  type Point,
  type View,
  centreOn,
  filled,
  firstEmpty,
  fit,
  free,
  feetInches,
  heldInside,
  inside,
  nearestFree,
  overlapping,
  parseMetres,
  parseWhole,
  sideBySide,
  snapped,
  zoomStep,
} from './SeatingGeometry.ts';
import {
  type ArrangeShows,
  type Ask,
  type Bar,
  type Doc,
  type ListTab,
  NO_FIELDS,
  type Pop,
  type Seating,
  type Sheet,
  type Tab,
  type ViewName,
  SHAPE_CHOICES,
  SHAPE_KIND,
  isTable,
  itemOf,
  length as shown,
  leastUsed,
  nextRowLabel,
  nextSeatName,
  nextTableName,
  partyOf,
  partySize,
  sameName,
  sectionOf,
} from './SeatingModel.ts';
import type { Chair, ColourName, Item, Kind, Party } from './SeatingSample.ts';
import { W, say } from './SeatingWords.ts';

export type Action =
  | { type: 'laid'; w: number; h: number; pad: Pad }
  | { type: 'view'; view: View }
  | { type: 'fit' }
  | { type: 'zoomStep'; up: boolean }
  | { type: 'setView'; view: ViewName }
  | { type: 'tab'; tab: Tab }
  | { type: 'tapItem'; id: string }
  | { type: 'tapChair'; id: string; chair: number }
  | { type: 'tapFloor'; at: Point }
  | { type: 'letGo' }
  | { type: 'moved'; id: string; at: Point }
  | { type: 'resized'; id: string; d?: number; w?: number; l?: number }
  | { type: 'turned'; id: string; rot: number }
  | { type: 'saved' }
  | { type: 'draft'; key: string; text: string }
  | { type: 'apply'; key: string }
  | { type: 'choose'; field: 'Section' | 'Shape' | 'Rotation'; value: string }
  | { type: 'pop'; pop: Pop | null }
  | { type: 'duplicate' }
  | { type: 'ask'; ask: Ask | null }
  | { type: 'confirm' }
  | { type: 'mark'; id: string; chair: number }
  | { type: 'startPlacing'; kind: Kind }
  | { type: 'placeCentre' }
  | { type: 'stopPlacing' }
  | { type: 'another' }
  | { type: 'addRow' }
  | { type: 'addSeat' }
  | { type: 'arrange'; shows: ArrangeShows; key?: string }
  | { type: 'roomDraft'; key: 'name' | 'width' | 'length'; text: string }
  | { type: 'roomApply' }
  | { type: 'sectionName'; name: string }
  | { type: 'sectionColour'; colour: ColourName }
  | { type: 'sectionAdd' }
  | { type: 'sectionApply' }
  | { type: 'snap' }
  | { type: 'openStart' }
  | { type: 'startDraft'; key: 'name' | 'width' | 'length'; text: string }
  | { type: 'startPlan' }
  | { type: 'pick'; id: string }
  | { type: 'cancelPick' }
  | { type: 'seatAt'; id: string; chair?: number }
  | { type: 'seatJust' }
  | { type: 'swapDo'; id: string; chair: number }
  | { type: 'undo' }
  | { type: 'unseat'; id: string; chair: number }
  | { type: 'moveTo'; id: string; chair: number; to: string }
  | { type: 'unseatAll'; id: string }
  | { type: 'moveAll'; id: string; to: string }
  | { type: 'sheet'; sheet: Sheet | null }
  | { type: 'sheetChair'; chair: number | null }
  | { type: 'listTab'; tab: ListTab }
  | { type: 'listOpen'; id: string | null }
  | { type: 'tableFilter'; key: string | null }
  | { type: 'trayOpen' }
  | { type: 'search'; text: string }
  | { type: 'group'; group: string | null }
  | { type: 'notYet' }
  | { type: 'clearSearch' }
  | { type: 'paper'; paper: 'A4' | 'Letter' }
  | { type: 'printDoc'; doc: Doc }
  | { type: 'printed' }
  | { type: 'retry' }
  | { type: 'loaded' }
  | { type: 'refresh' }
  | { type: 'refreshed' }
  | { type: 'tryAgain' }
  | { type: 'dismissBar' }
  | { type: 'fromGuest'; sheet: string | null; chair: number | null; pick: string | null };

const TIMERS = new Set<Action['type']>(['saved', 'printed', 'loaded', 'refreshed', 'laid']);
const LOOKS = new Set<Action['type']>([
  ...TIMERS,
  'view',
  'fit',
  'zoomStep',
  'setView',
  'tab',
  'listTab',
  'listOpen',
  'tableFilter',
  'trayOpen',
  'search',
  'group',
  'notYet',
  'clearSearch',
  'sheet',
  'sheetChair',
  'pop',
  'paper',
  'draft',
  'dismissBar',
]);

/** A deep link holds its moment (Saving…, Preparing…) until the first thing the person does; Undo lasts until the next thing they do. */
export function reduce(m: Seating, a: Action): Seating {
  const next = act(TIMERS.has(a.type) ? m : { ...m, held: false }, a);
  if (LOOKS.has(a.type) || a.type === 'undo' || next.undo !== m.undo || m.undo == null) return next;
  return { ...next, undo: null, bar: next.bar?.undo === true ? null : next.bar };
}

function serial(m: Seating, prefix: string): [string, Seating] {
  return [`${prefix}-${m.serial}`, { ...m, serial: m.serial + 1 }];
}

function saving(m: Seating): Seating {
  return { ...m, save: 'saving' };
}

function snapshot(m: Seating): Seating['undo'] {
  return { items: m.items, tray: m.tray };
}

function patch(m: Seating, id: string, change: (it: Item) => Item): Seating {
  return { ...m, items: m.items.map((it) => (it.id === id ? change(it) : it)) };
}

function letGo(m0: Seating): Seating {
  const m = flush(m0, null);
  return {
    ...m,
    chosen: null,
    chair: null,
    arrange: 'room',
    fields: NO_FIELDS,
    ghost: null,
    tip: null,
    outside: [],
    wallAt: null,
  };
}

/** Choosing something else is leaving the field: what was typed applies first (pm, 7 Nov 2026). */
function flush(m: Seating, id: string | null): Seating {
  if (m.chosen == null || m.chosen === id) return m;
  return Object.keys(m.fields.drafts).reduce(applyField, m);
}

/** A refusal first met on leaving keeps the item chosen with the refusal beside its field; leaving again drops the typing, nothing saved. */
function refusedOnLeaving(m: Seating, to: string | null): Seating | null {
  if (m.chosen == null || m.chosen === to || Object.keys(m.fields.drafts).length === 0) return null;
  const tried = flush(m, to);
  const fresh = Object.keys(tried.fields.errors).some((key) => m.fields.errors[key] == null);
  return fresh ? tried : null;
}

/** A resize or a turn by finger is held inside the walls, as a drag is; one that cannot fit is refused. */
function heldAtWall(m: Seating, id: string, change: (it: Item) => Item): Seating {
  const it = itemOf(m, id);
  if (it == null) return m;
  const next = change(it);
  const held = { ...next, ...heldInside(next, m.room) };
  if (!inside(held, m.room))
    return { ...m, bar: { kind: 'amber', words: say.outsideRoom(it.name) } };
  return saving(patch(m, id, () => held));
}

function choose(m0: Seating, id: string, tab: Tab = 'Arrange'): Seating {
  const m = flush(m0, id);
  return {
    ...letGo(m),
    chosen: id,
    tab,
    pop: null,
    bar: m.bar?.kind === 'tint' && m.bar.placing !== true ? null : m.bar,
  };
}

function personBack(who: string, id: string): Party {
  return { id, lead: who, plus: 0, group: '', reply: null, companions: [] };
}

function namesOf(party: Party): string[] {
  return [party.lead, ...party.companions];
}

/** Seats `n` of the party in `chairs`; anyone left stays without a seat as "Guest of …". */
function placeParty(m: Seating, party: Party, id: string, chairs: number[]): Seating {
  const names = namesOf(party);
  const seatedNames = names.slice(0, chairs.length);
  const left = names.length - seatedNames.length;
  const [restId, counted] = serial(m, `${party.id}-rest`);
  const restNames = names.slice(seatedNames.length);
  const rest: Party[] =
    left > 0
      ? [
          {
            ...party,
            id: restId,
            lead: restNames[0] ?? '',
            companions: restNames.slice(1),
            plus: left - 1,
          },
        ]
      : [];
  const tray = m.tray.flatMap((p) => (p.id === party.id ? rest : [p]));
  return {
    ...counted,
    items: patch(m, id, (it) => ({
      ...it,
      chairs: it.chairs.map((c, i) => {
        const k = chairs.indexOf(i);
        return k < 0 ? c : { state: 'taken', who: seatedNames[k] ?? null };
      }),
    })).items,
    tray,
    picked: null,
  };
}

function seatedBar(party: Party, table: string, count: number, apart: boolean): Bar {
  return { kind: 'white', words: say.seatedParty(party.lead, count - 1, table, apart), undo: true };
}

function seatAt(m: Seating, id: string, at?: number): Seating {
  const party = partyOf(m, m.picked);
  const it = itemOf(m, id);
  if (party == null || it == null) return m;
  const size = partySize(party);
  const room = free(it);
  if (room <= 0)
    return { ...m, bar: { kind: 'amber', words: say.full(it.name) }, lit: [], pop: null };
  if (room < size)
    return m.layout === 'phone'
      ? { ...m, sheet: { kind: 'short', id }, lit: [id] }
      : { ...m, pop: { kind: 'short', id }, lit: [id] };
  let chairs = sideBySide(it, size);
  const apart = chairs == null && size > 1;
  if (at != null && it.chairs[at]?.state === 'empty') {
    const order = it.chairs.map((_, k) => (at + k) % it.chairs.length);
    chairs = order.filter((i) => it.chairs[i]?.state === 'empty').slice(0, size);
  }
  const placed = placeParty({ ...m, undo: snapshot(m) }, party, id, chairs ?? firstEmpty(it, size));
  return {
    ...placed,
    lit: [id],
    pop: null,
    sheet: m.sheet?.kind === 'short' ? null : m.sheet,
    bar: seatedBar(party, it.name, size, apart),
  };
}

function seatJust(m: Seating, id: string): Seating {
  const party = partyOf(m, m.picked);
  const it = itemOf(m, id);
  if (party == null || it == null) return m;
  const placed = placeParty({ ...m, undo: snapshot(m) }, party, id, firstEmpty(it, 1));
  return { ...placed, lit: [id], pop: null, sheet: null, bar: seatedBar(party, it.name, 1, false) };
}

function swapDo(m: Seating, id: string, chair: number): Seating {
  const party = partyOf(m, m.picked);
  const it = itemOf(m, id);
  const who = it?.chairs[chair]?.who;
  if (party == null || it == null || who == null) return m;
  const cleared = patch({ ...m, undo: snapshot(m) }, id, (one) => ({
    ...one,
    chairs: one.chairs.map((c, i) => (i === chair ? { state: 'empty', who: null } : c)),
  }));
  const [backId, counted] = serial(cleared, 'back');
  const placed = placeParty(
    { ...counted, tray: [...counted.tray, personBack(who, backId)] },
    party,
    id,
    [chair],
  );
  return { ...placed, lit: [id], pop: null, ask: null, bar: seatedBar(party, it.name, 1, false) };
}

function unseatChairs(m: Seating, id: string, which: (c: Chair, i: number) => boolean): Seating {
  const it = itemOf(m, id);
  if (it == null) return m;
  const going = it.chairs.flatMap((c, i) =>
    which(c, i) && c.state === 'taken' ? [c.who ?? W.taken] : [],
  );
  const back = going.map((who, k) => personBack(who, `back-${m.serial + k}`));
  return {
    ...patch({ ...m, serial: m.serial + going.length }, id, (one) => ({
      ...one,
      chairs: one.chairs.map((c, i) =>
        which(c, i) && c.state === 'taken' ? { state: 'empty', who: null } : c,
      ),
    })),
    tray: [...m.tray, ...back],
  };
}

function moveTo(m: Seating, id: string, chair: number, to: string): Seating {
  const it = itemOf(m, id);
  const dest = itemOf(m, to);
  const who = it?.chairs[chair]?.who;
  if (it == null || dest == null || who == null || free(dest) <= 0) return m;
  const target = firstEmpty(dest, 1)[0] ?? 0;
  const out = patch({ ...m, undo: snapshot(m) }, id, (one) => ({
    ...one,
    chairs: one.chairs.map((c, i) => (i === chair ? { state: 'empty', who: null } : c)),
  }));
  return {
    ...patch(out, to, (one) => ({
      ...one,
      chairs: one.chairs.map((c, i) => (i === target ? { state: 'taken', who } : c)),
    })),
    sheet: null,
    chair: null,
    lit: [to],
    bar: { kind: 'white', words: say.seatedParty(who, 0, dest.name, false), undo: true },
  };
}

function moveAll(m: Seating, id: string, to: string): Seating {
  const it = itemOf(m, id);
  const dest = itemOf(m, to);
  if (it == null || dest == null) return m;
  const who = it.chairs.flatMap((c) => (c.state === 'taken' ? [c.who] : []));
  if (free(dest) < who.length) return m;
  const targets = firstEmpty(dest, who.length);
  const out = patch({ ...m, undo: snapshot(m) }, id, (one) => ({
    ...one,
    chairs: one.chairs.map((c) => (c.state === 'taken' ? { state: 'empty', who: null } : c)),
  }));
  return {
    ...patch(out, to, (one) => ({
      ...one,
      chairs: one.chairs.map((c, i) => {
        const k = targets.indexOf(i);
        return k < 0 ? c : { state: 'taken', who: who[k] ?? null };
      }),
    })),
    pop: null,
    lit: [to],
    bar: { kind: 'white', words: say.movedAll(who.length, dest.name), undo: true },
  };
}

function unseatOne(m: Seating, id: string, chair: number): Seating {
  const who = itemOf(m, id)?.chairs[chair]?.who;
  if (who == null) return m;
  const out = unseatChairs({ ...m, undo: snapshot(m) }, id, (_, i) => i === chair);
  return {
    ...out,
    chair: null,
    sheet: m.layout === 'phone' ? null : m.sheet,
    lit: [id],
    bar: { kind: 'white', words: say.noSeatNow(who), undo: true },
  };
}

function unseatAll(m: Seating, id: string): Seating {
  const it = itemOf(m, id);
  if (it == null || filled(it) === 0) return m;
  return {
    ...unseatChairs({ ...m, undo: snapshot(m) }, id, () => true),
    lit: [id],
    bar: { kind: 'white', words: say.emptyNow(it.name), undo: true },
  };
}

const ROUND_DEFAULT = { d: 180 };
const SHAPE_DEFAULT: Record<Kind, Partial<Item>> = {
  round: ROUND_DEFAULT,
  cocktail: { d: 60 },
  rect: { w: 180, l: 76, ends: 0 },
  head: { w: 240, l: 76, ends: 0 },
  row: {},
  single: {},
};
const SHAPE_ADJECTIVE: Record<Kind, string> = {
  round: 'round',
  rect: 'rectangular',
  head: 'head table',
  cocktail: 'cocktail',
  row: 'row',
  single: 'seat',
};

export function sizeWords(it: Item, units: Seating['units'] = 'metric'): string {
  const us = units === 'us';
  if (it.kind === 'round' || it.kind === 'cocktail') return us ? feetInches(it.d) : `${it.d} cm`;
  return us ? `${feetInches(it.w)} × ${feetInches(it.l)}` : `${it.w} × ${it.l} cm`;
}

/** A chair needs about 55 cm of edge; under that the seats are tight (sc-4000), saved all the same. */
export function tight(it: Item): boolean {
  const n = it.chairs.length;
  if (it.kind === 'round') return (Math.PI * it.d) / n < 55;
  if (it.kind !== 'rect' && it.kind !== 'head') return false;
  const side = n - it.ends;
  const longest = it.kind === 'rect' ? Math.ceil(side / 2) : side;
  return it.w / Math.max(1, longest) < 55 || (it.ends > 0 && it.l / Math.ceil(it.ends / 2) < 55);
}

function squeezeWarn(it: Item, units: Seating['units']): string | null {
  return tight(it) ? say.squeeze(it.chairs.length, sizeWords(it, units)) : null;
}

function resizeChairs(chairs: readonly Chair[], n: number): Chair[] {
  if (n >= chairs.length)
    return [
      ...chairs,
      ...Array.from({ length: n - chairs.length }, (): Chair => ({ state: 'empty', who: null })),
    ];
  const out = [...chairs];
  for (let i = out.length - 1; out.length > n && i >= 0; i -= 1)
    if (out[i]?.state === 'empty' || out[i]?.state === 'unusable') out.splice(i, 1);
  return out;
}

function refuse(m: Seating, key: string, words: string): Seating {
  return {
    ...m,
    fields: { ...m.fields, errors: { ...m.fields.errors, [key]: words }, focus: key },
  };
}

function cleared(m: Seating, key: string): Seating {
  const drafts = { ...m.fields.drafts };
  const errors = { ...m.fields.errors };
  delete drafts[key];
  delete errors[key];
  return { ...m, fields: { ...m.fields, drafts, errors, focus: null } };
}

function length(m: Seating, text: string): number | null {
  return m.units === 'metric' ? parseMetres(text) : parseFeet(text);
}

function parseFeet(text: string): number | null {
  const ft = /^\s*(\d+(?:\.\d+)?)\s*(?:′|'|ft)\s*(?:(\d+)\s*(?:″|"|in))?\s*$/u.exec(text);
  if (ft?.[1] != null) return (Number(ft[1]) * 12 + Number(ft[2] ?? 0)) * 2.54;
  const inches = /^\s*(\d+)\s*in\s*$/u.exec(text);
  return inches?.[1] == null ? null : Number(inches[1]) * 2.54;
}

/** A table's field applies as it is entered (Enter, or leaving it): refused beside the field, and nothing saved (pm, 7 Nov 2026). */
function applyField(m: Seating, key: string): Seating {
  const it = itemOf(m, m.chosen);
  const text = m.fields.drafts[key];
  if (it == null || text == null) return m;
  const done = (change: Partial<Item>, extra: Partial<Seating['fields']> = {}) => {
    const next = patch(cleared(m, key), it.id, (one) => ({ ...one, ...change }));
    const now = itemOf(next, it.id) ?? it;
    if (!inside(now, m.room)) return refuse(m, key, say.outsideRoom(it.name));
    return saving({
      ...next,
      fields: { ...next.fields, warn: squeezeWarn(now, m.units), ...extra },
    });
  };
  const whole = parseWhole(text);
  const size = m.units === 'us' && key !== 'Ends' ? length(m, text) : whole;
  switch (key) {
    case 'Name':
    case 'Label': {
      const name = key === 'Label' ? text.trim().toLocaleUpperCase() : text.trim();
      if (name === '') return cleared(m, key);
      const rows = it.kind === 'row';
      const clash = m.items.some(
        (other) =>
          other.id !== it.id &&
          (rows
            ? other.kind === 'row' && sameName(other.label, name)
            : (it.kind === 'single') === (other.kind === 'single') && sameName(other.name, name)),
      );
      if (clash)
        return refuse(
          m,
          key,
          rows
            ? say.rowTaken(name)
            : it.kind === 'single'
              ? say.seatTaken(name)
              : say.tableTaken(name),
        );
      return done(rows ? { label: name, name: `Row ${name}` } : { name });
    }
    case 'Seats': {
      if (whole == null || whole < 1) return cleared(m, key);
      if (it.kind === 'row') {
        const last = it.chairs.reduce((n, c, i) => (c.state === 'taken' ? i + 1 : n), 0);
        const who = it.chairs[last - 1]?.who ?? W.taken;
        if (whole < last) return refuse(m, key, say.rowBelow(who, last, last));
        return done({ chairs: resizeChairs(it.chairs.slice(0, Math.max(whole, last)), whole) });
      }
      const seated = filled(it);
      if (whole < seated) return refuse(m, key, say.belowSeated(seated, seated));
      return done({ chairs: resizeChairs(it.chairs, whole) });
    }
    case 'Diameter':
    case 'Width':
    case 'Length':
    case 'Spacing':
    case 'Ends': {
      const us = m.units === 'us';
      if (key === 'Ends' && size == null) return cleared(m, key);
      if (size == null) return refuse(m, key, us ? W.usHint : W.sizeMin);
      if (key !== 'Ends' && size < (us ? 30.48 : 30))
        return refuse(m, key, us ? W.sizeMinFeet : W.sizeMin);
      const field = { Diameter: 'd', Width: 'w', Length: 'l', Spacing: 'spacing', Ends: 'ends' }[
        key
      ];
      return done({
        [field]: key === 'Ends' ? Math.min(size, it.chairs.length) : Math.round(size),
      });
    }
    case 'Across':
    case 'Down': {
      const cm = length(m, text);
      if (cm == null) return cleared(m, key);
      const moved = { ...it, [key === 'Across' ? 'x' : 'y']: Math.round(cm) };
      if (!inside(moved, m.room)) return refuse(m, key, say.outsideRoom(it.name));
      return done({ x: moved.x, y: moved.y });
    }
    default:
      return cleared(m, key);
  }
}

function chooseField(m: Seating, field: 'Section' | 'Shape' | 'Rotation', value: string): Seating {
  const it = itemOf(m, m.chosen);
  if (it == null) return { ...m, pop: null };
  const base = { ...m, pop: null };
  if (field === 'Section') {
    const sec = m.sections.find((s) => s.name === value)?.key ?? null;
    return saving(patch(base, it.id, (one) => ({ ...one, sec })));
  }
  if (field === 'Rotation') {
    const rot = parseWhole(value) ?? 0;
    if (!inside({ ...it, rot }, m.room)) return refuse(base, 'Rotation', say.outsideRoom(it.name));
    return saving(patch(base, it.id, (one) => ({ ...one, rot })));
  }
  const kind = SHAPE_KIND[value as (typeof SHAPE_CHOICES)[number]];
  if (kind == null || kind === it.kind) return base;
  const changed = {
    ...it,
    kind,
    rot: kind === 'rect' || kind === 'head' ? it.rot : 0,
    ...SHAPE_DEFAULT[kind],
  };
  if (!inside(changed, m.room)) return refuse(base, 'Shape', say.outsideRoom(it.name));
  const note = say.shapeReset(
    SHAPE_ADJECTIVE[kind],
    sizeWords(changed, m.units),
    changed.chairs.length,
  );
  return saving({
    ...patch(base, it.id, () => changed),
    fields: { ...NO_FIELDS, note, warn: squeezeWarn(changed, m.units) },
  });
}

function newItem(m: Seating, kind: Kind, at: Point): Item {
  const seats = { round: 10, rect: 6, head: 4, cocktail: 4, row: 10, single: 1 }[kind];
  const label = kind === 'row' ? nextRowLabel(m.items) : '';
  const name =
    kind === 'row'
      ? `Row ${label}`
      : kind === 'single'
        ? nextSeatName(m.items)
        : nextTableName(m.items);
  const it: Item = {
    id: `item-${m.serial}`,
    kind,
    name,
    label,
    x: at.x,
    y: at.y,
    d: 0,
    w: 0,
    l: 0,
    ends: 0,
    spacing: kind === 'row' ? 50 : 0,
    rot: 0,
    sec: null,
    chairs: Array.from({ length: seats }, () => ({ state: 'empty', who: null })),
    ...SHAPE_DEFAULT[kind],
  };
  return { ...it, ...nearestFree(it, m.items, m.room, at) };
}

function add(m: Seating, kind: Kind, at: Point): Seating {
  const it = newItem(m, kind, at);
  const words = kind === 'row' ? say.rowAdded(it.label, it.chairs.length) : say.added(it.name);
  const keep = kind !== 'row' && kind !== 'single' && m.placeAnother && m.placing != null;
  const next = saving({ ...m, items: [...m.items, it], serial: m.serial + 1, pop: null });
  if (keep) return next;
  return {
    ...choose({ ...next, placing: null, bar: null }, it.id),
    fields: { ...NO_FIELDS, added: words },
  };
}

function centre(m: Seating): Point {
  return { x: m.room.w / 2, y: m.room.l / 2 };
}

const FEET_RANGE = { min: 7, max: 1640 } as const;

/** The room's width or length in the plan's units, as the web reads it: metres, or feet (a bare number is feet). */
export function readRoom(
  text: string,
  which: 'width' | 'length',
  units: Seating['units'],
): { cm: number } | { refused: string } {
  const typed = text.trim();
  if (typed === '') return { refused: which === 'width' ? W.enterWidth : W.enterLength };
  if (units === 'us') {
    const cm = parseFeet(typed) ?? parseFeet(`${typed} ft`);
    const ft = cm == null ? null : cm / 30.48;
    return cm == null || ft == null || ft < FEET_RANGE.min || ft > FEET_RANGE.max + 0.99
      ? { refused: say.roomRangeFeet(FEET_RANGE.min, FEET_RANGE.max) }
      : { cm: Math.round(cm) };
  }
  const cm = parseMetres(typed);
  return cm == null || cm < 200 || cm > 50000 ? { refused: W.roomRange } : { cm };
}

function roomText(m: Seating, cm: number): string {
  return m.units === 'us' ? feetInches(cm) : `${cm / 100}`;
}

function applyRoom(m: Seating): Seating {
  const d = m.roomDraft;
  const name = d.name.trim() === '' ? m.room.name : d.name.trim();
  const w =
    d.width.trim() === roomText(m, m.room.w)
      ? { cm: m.room.w }
      : readRoom(d.width, 'width', m.units);
  const l =
    d.length.trim() === roomText(m, m.room.l)
      ? { cm: m.room.l }
      : readRoom(d.length, 'length', m.units);
  if ('refused' in w) return { ...m, roomDraft: { ...d, error: w.refused } };
  if ('refused' in l) return { ...m, roomDraft: { ...d, error: l.refused } };
  const room = { name, w: w.cm, l: l.cm };
  const out = m.items.filter((it) => !inside(it, room));
  if (out.length > 0)
    return {
      ...m,
      roomDraft: { ...d, error: say.outside(out.length, shown(m, room.w), shown(m, room.l)) },
      outside: out.map((it) => it.id),
      wallAt: room.w < m.room.w ? room.w : null,
    };
  return saving({ ...m, room, roomDraft: { ...d, error: null }, outside: [], wallAt: null });
}

function startPlan(m: Seating): Seating {
  const s = m.start;
  const width = readRoom(s.width, 'width', m.units);
  const length = readRoom(s.length, 'length', m.units);
  const errors: Record<string, string> = {
    ...('refused' in width ? { width: width.refused } : {}),
    ...('refused' in length ? { length: length.refused } : {}),
  };
  if ('refused' in width || 'refused' in length) return { ...m, start: { ...s, errors } };
  const w = width.cm;
  const l = length.cm;
  return {
    ...m,
    load: 'ready',
    room: { name: s.name.trim() === '' ? W.room : s.name.trim(), w, l },
    items: [],
    sections: [],
    shown: m.size == null ? null : fit(m.size.w, m.size.h, { name: '', w, l }, m.size.pad),
    zoom: null,
    bar: { kind: 'tint', words: W.firstTable },
    save: 'saving',
  };
}

function sectionSubmit(m: Seating): Seating {
  const f = m.sectionForm;
  const name = f.name.trim();
  if (name === '') return { ...m, sectionForm: { ...f, error: W.enterSectionName } };
  if ([...name].length > 40) return { ...m, sectionForm: { ...f, error: W.sectionTooLong } };
  if (m.sections.some((s) => sameName(s.name, name)))
    return { ...m, sectionForm: { ...f, error: say.sectionTaken(name) } };
  const key = `sec-${m.serial}`;
  return saving({
    ...m,
    serial: m.serial + 1,
    sections: [...m.sections, { key, name, colour: f.colour }],
    arrange: 'room',
    sectionForm: { name: '', colour: f.colour, error: null },
  });
}

function sectionApply(m: Seating): Seating {
  const f = m.sectionForm;
  const name = f.name.trim();
  const key = m.sectionKey;
  if (key == null) return m;
  if (name === '') return { ...m, sectionForm: { ...f, error: W.enterSectionName } };
  if ([...name].length > 40) return { ...m, sectionForm: { ...f, error: W.sectionTooLong } };
  if (m.sections.some((s) => s.key !== key && sameName(s.name, name)))
    return { ...m, sectionForm: { ...f, error: say.sectionTaken(name) } };
  return saving({
    ...m,
    sections: m.sections.map((s) => (s.key === key ? { ...s, name, colour: f.colour } : s)),
    sectionForm: { ...f, error: null },
  });
}

function confirm(m: Seating): Seating {
  const ask = m.ask;
  if (ask == null) return m;
  if (ask.kind === 'deletePlan') {
    const going = m.items.flatMap((it) =>
      it.chairs.flatMap((c) => (c.state === 'taken' ? [c.who ?? W.taken] : [])),
    );
    const back = going.map((who, k) => personBack(who, `back-${m.serial + k}`));
    return {
      ...letGo({ ...m, serial: m.serial + going.length }),
      ask: null,
      load: 'noPlan',
      items: [],
      tray: [...m.tray, ...back],
      bar: null,
    };
  }
  if (ask.kind === 'deleteSection')
    return saving({
      ...m,
      ask: null,
      arrange: 'room',
      sectionKey: null,
      sections: m.sections.filter((s) => s.key !== ask.key),
      items: m.items.map((it) => (it.sec === ask.key ? { ...it, sec: null } : it)),
    });
  if (ask.kind === 'deleteItem') {
    const gone = unseatChairs(m, ask.id, () => true);
    return saving({
      ...letGo(gone),
      ask: null,
      items: gone.items.filter((it) => it.id !== ask.id),
    });
  }
  return swapDo({ ...m, ask: null }, ask.id, ask.chair);
}

function tapChair(m: Seating, id: string, chair: number): Seating {
  const it = itemOf(m, id);
  const c = it?.chairs[chair];
  if (it == null || c == null) return m;
  if (m.picked != null) {
    if (c.state === 'taken') return { ...m, pop: { kind: 'swap', id, chair }, lit: [id] };
    if (c.state === 'empty') return seatAt(m, id, chair);
    return m;
  }
  return { ...choose(m, id), chair };
}

function mark(m: Seating, id: string, chair: number): Seating {
  const it = itemOf(m, id);
  const c = it?.chairs[chair];
  if (it == null || c == null) return m;
  if (c.state === 'taken' || c.state === 'held')
    return { ...m, fields: { ...m.fields, errors: { chair: say.inThisSeat(c.who ?? W.taken) } } };
  const state = c.state === 'unusable' ? 'empty' : 'unusable';
  return saving({
    ...patch(m, id, (one) => ({
      ...one,
      chairs: one.chairs.map((k, i) => (i === chair ? { state, who: null } : k)),
    })),
    fields: NO_FIELDS,
  });
}

function act(m: Seating, a: Action): Seating {
  switch (a.type) {
    case 'laid': {
      if (m.size?.w === a.w && m.size.h === a.h && m.size.pad === a.pad && m.shown != null)
        return m;
      const shown =
        m.zoom != null ? centreOn(m.zoom.centre, m.zoom.s, a.w, a.h) : fit(a.w, a.h, m.room, a.pad);
      return { ...m, size: { w: a.w, h: a.h, pad: a.pad }, shown };
    }
    case 'view':
      return { ...m, shown: a.view, zoom: null };
    case 'fit':
      return m.size == null
        ? m
        : { ...m, zoom: null, shown: fit(m.size.w, m.size.h, m.room, m.size.pad) };
    case 'zoomStep':
      return m.size == null || m.shown == null
        ? m
        : { ...m, zoom: null, shown: zoomStep(m.shown, a.up, m.size.w, m.size.h) };
    case 'setView':
      return { ...m, view: a.view, pop: null, listOpen: null };
    case 'tab':
      return { ...m, tab: a.tab, pop: null };
    case 'tapItem':
      if (m.picked != null) return seatAt(m, a.id);
      return refusedOnLeaving(m, a.id) ?? choose(m, a.id);
    case 'tapChair':
      return tapChair(m, a.id, a.chair);
    case 'tapFloor':
      if (m.placing != null)
        return add(m, m.placing, { x: snapped(a.at.x, m.snap), y: snapped(a.at.y, m.snap) });
      return (
        refusedOnLeaving(m, null) ?? { ...letGo(m), pop: null, lit: m.picked == null ? [] : m.lit }
      );
    case 'letGo':
      return refusedOnLeaving(m, null) ?? letGo(m);
    case 'moved': {
      const it = itemOf(m, a.id);
      if (it == null) return m;
      const at = heldInside(
        { ...it, x: snapped(a.at.x, m.snap), y: snapped(a.at.y, m.snap) },
        m.room,
      );
      return saving(
        choose(
          patch(m, a.id, (one) => ({ ...one, ...at })),
          a.id,
        ),
      );
    }
    case 'resized':
      return heldAtWall(m, a.id, (one) => ({
        ...one,
        d: a.d != null ? snapped(a.d, true) : one.d,
        w: a.w != null ? snapped(a.w, true) : one.w,
        l: a.l != null ? snapped(a.l, true) : one.l,
      }));
    case 'turned':
      return heldAtWall(m, a.id, (one) => ({
        ...one,
        rot: (((Math.round(a.rot / 15) * 15) % 360) + 360) % 360,
      }));
    case 'saved':
      return m.save === 'saving' ? { ...m, save: 'saved' } : m;
    case 'draft':
      return { ...m, fields: { ...m.fields, drafts: { ...m.fields.drafts, [a.key]: a.text } } };
    case 'apply':
      return applyField(m, a.key);
    case 'choose':
      return chooseField(m, a.field, a.value);
    case 'pop':
      return { ...m, pop: a.pop };
    case 'duplicate': {
      const it = itemOf(m, m.chosen);
      if (it == null) return m;
      const copy: Item = {
        ...it,
        id: `copy-${m.serial}`,
        name: isTable(it)
          ? nextTableName(m.items)
          : it.kind === 'row'
            ? `Row ${nextRowLabel(m.items)}`
            : nextSeatName(m.items),
        label: it.kind === 'row' ? nextRowLabel(m.items) : '',
        chairs: it.chairs.map((c) => (c.state === 'unusable' ? c : { state: 'empty', who: null })),
      };
      const placed = { ...copy, ...nearestFree(copy, m.items, m.room, { x: it.x, y: it.y + 400 }) };
      const next = saving({ ...m, items: [...m.items, placed], serial: m.serial + 1 });
      return {
        ...choose(next, placed.id),
        fields: { ...NO_FIELDS, added: say.copied(placed.name, it.name) },
      };
    }
    case 'ask':
      return { ...m, ask: a.ask, pop: null };
    case 'confirm':
      return confirm(m);
    case 'mark':
      return mark(m, a.id, a.chair);
    case 'startPlacing':
      return {
        ...letGo(m),
        pop: null,
        placing: a.kind,
        bar: { kind: 'tint', words: say.placeBar(SHAPE_WORD[a.kind]), placing: true },
      };
    case 'placeCentre':
      return m.placing == null ? m : add({ ...m, placeAnother: false }, m.placing, centre(m));
    case 'stopPlacing':
      return { ...m, placing: null, bar: null };
    case 'another':
      return { ...m, placeAnother: !m.placeAnother };
    case 'addRow':
      return add({ ...m, placing: null, bar: null }, 'row', centre(m));
    case 'addSeat':
      return add({ ...m, placing: null, bar: null }, 'single', centre(m));
    case 'arrange': {
      const base = {
        ...letGo(m),
        tab: 'Arrange' as const,
        arrange: a.shows,
        sectionKey: a.key ?? null,
      };
      if (a.shows === 'roomSettings')
        return {
          ...base,
          roomDraft: {
            name: m.room.name,
            width: roomText(m, m.room.w),
            length: roomText(m, m.room.l),
            error: null,
          },
        };
      if (a.shows === 'sectionAdd') {
        if (m.sections.length >= 30) return { ...base, arrange: 'sectionLimit' };
        return { ...base, sectionForm: { name: '', colour: leastUsed(m.sections), error: null } };
      }
      if (a.shows === 'sectionEdit') {
        const s = sectionOf(m, a.key ?? null);
        return s == null
          ? base
          : { ...base, sectionForm: { name: s.name, colour: s.colour, error: null } };
      }
      return base;
    }
    case 'roomDraft':
      return { ...m, roomDraft: { ...m.roomDraft, [a.key]: a.text } };
    case 'roomApply':
      return applyRoom(m);
    case 'sectionName':
      return { ...m, sectionForm: { ...m.sectionForm, name: a.name, error: null } };
    case 'sectionColour': {
      const next = { ...m, sectionForm: { ...m.sectionForm, colour: a.colour } };
      return m.arrange === 'sectionEdit' ? sectionApply(next) : next;
    }
    case 'sectionAdd':
      return sectionSubmit(m);
    case 'sectionApply':
      return sectionApply(m);
    case 'snap':
      return { ...m, snap: !m.snap };
    case 'openStart':
      return { ...m, load: 'start', start: { name: '', width: '', length: '', errors: {} } };
    case 'startDraft':
      return {
        ...m,
        start: { ...m.start, [a.key]: a.text, errors: { ...m.start.errors, [a.key]: '' } },
      };
    case 'startPlan':
      return startPlan(m);
    case 'pick': {
      if (m.picked === a.id) return { ...m, picked: null, bar: null, lit: [] };
      const party = partyOf(m, a.id);
      if (party == null) return m;
      const lead = party.lead;
      return {
        ...m,
        picked: a.id,
        lit: [],
        pop: null,
        bar: { kind: 'tint', words: say.pick(lead, party.plus), cancel: true },
      };
    }
    case 'cancelPick':
      return {
        ...m,
        picked: null,
        bar: null,
        lit: [],
        pop: null,
        sheet: m.sheet?.kind === 'short' ? null : m.sheet,
      };
    case 'seatAt':
      return seatAt(m, a.id, a.chair);
    case 'seatJust':
      return seatJust(
        m,
        m.pop?.kind === 'short' ? m.pop.id : m.sheet?.kind === 'short' ? m.sheet.id : '',
      );
    case 'swapDo':
      return swapDo(m, a.id, a.chair);
    case 'undo':
      if (m.undoRefuses) return { ...m, bar: { kind: 'amber', words: W.undidRefused }, undo: null };
      return m.undo == null
        ? m
        : saving({ ...m, items: m.undo.items, tray: m.undo.tray, undo: null, bar: null, lit: [] });
    case 'unseat':
      return unseatOne(m, a.id, a.chair);
    case 'moveTo':
      return moveTo(m, a.id, a.chair, a.to);
    case 'unseatAll':
      return unseatAll(m, a.id);
    case 'moveAll':
      return moveAll(m, a.id, a.to);
    case 'sheet':
      return {
        ...m,
        sheet: a.sheet,
        chair: a.sheet?.kind === 'move' ? m.chair : null,
        fields: NO_FIELDS,
      };
    case 'sheetChair':
      return { ...m, chair: m.chair === a.chair ? null : a.chair, fields: NO_FIELDS };
    case 'listTab':
      return { ...m, listTab: a.tab };
    case 'listOpen':
      return { ...m, listOpen: m.listOpen === a.id ? null : a.id };
    case 'tableFilter':
      return { ...m, tableFilter: a.key };
    case 'trayOpen':
      return { ...m, trayOpen: !m.trayOpen };
    case 'search':
      return { ...m, search: a.text };
    case 'group':
      return { ...m, group: m.group === a.group ? null : a.group };
    case 'notYet':
      return { ...m, showNotYet: !m.showNotYet };
    case 'clearSearch':
      return { ...m, search: '', group: null };
    case 'paper':
      return { ...m, paper: a.paper };
    case 'printDoc':
      return m.offline ? m : { ...m, preparing: a.doc, printFailed: null };
    case 'printed':
      return m.preparing == null
        ? m
        : {
            ...m,
            preparing: null,
            sheet: null,
            bar: { kind: 'white', words: say.ready(m.preparing), glyph: 'tick' },
          };
    case 'retry':
      return { ...m, load: 'loading' };
    case 'loaded':
      return m.load === 'loading' ? { ...m, load: 'ready' } : m;
    case 'refresh':
      return { ...m, refreshing: true };
    case 'refreshed':
      return { ...m, refreshing: false };
    case 'tryAgain':
      return { ...m, save: 'saving', presence: 'chips' };
    case 'dismissBar':
      return { ...m, bar: null };
    case 'fromGuest': {
      const base = {
        ...m,
        guest: null,
        sheet: a.sheet == null ? null : ({ kind: 'table', id: a.sheet } as const),
        chair: a.chair,
      };
      return a.pick == null ? base : act({ ...base, trayOpen: true }, { type: 'pick', id: a.pick });
    }
  }
}

const SHAPE_WORD: Record<Kind, string> = {
  round: 'Round table',
  rect: 'Rectangular table',
  head: 'Head table',
  cocktail: 'Cocktail table',
  row: 'Row',
  single: 'Single seat',
};

export const overlapsOf = (m: Seating, id: string | null): Item[] => {
  const it = itemOf(m, id);
  return it == null ? [] : overlapping(it, m.items);
};
