import {
  type Chair,
  type Colour,
  type Item,
  type Kind,
  type Party,
  type Person,
  type Plan,
  type Point,
  type Presence,
  type Rings,
  type SeatingState,
  COLOURS,
  PRIYA,
  SADE,
  SIX,
  SW,
  YOU,
  copyOf,
  firstFree,
  many,
  newItem,
  peopleIn,
  reshaped,
  samplePlan,
  sampleTray,
  say,
  tableSizeRefusal,
  seatAt,
  sideBySide,
  usable,
  filled,
  freedFrom,
} from './seating.ts';
import {
  type AutoSeat,
  type AutoState,
  EARLIER_AT,
  NO_PROPOSAL,
  PROPOSED_AT,
  SAMPLE_NOTES,
  accepted,
  changedWords,
  isAutoState,
  propose,
  proposedGuests,
  proposedTables,
  readyWords,
  seatedWords as autoSeatedWords,
  stampOf,
} from './autoSeat.ts';
import {
  EMPTY_DRAFT,
  NO_NOTES,
  type NoteDraft,
  type NoteStateKey,
  type Notes,
  NW,
  isNoteState,
  sampleNotes,
  say as noteSay,
} from './seatingNotes.ts';
import { NOT_SHARED, SHARE_STATES, type Share, isShareState, shareOf } from './shareTables.ts';
import {
  type Fold,
  type Rect,
  aligned,
  copiesOf,
  gridOf,
  outsider,
  seatedOf,
  thingsOf,
  tooBig,
  withMoved,
} from './selection.ts';

export type View = 'plan' | 'tables' | 'list';
export type Tab = 'arrange' | 'seat';
export type SaveState = 'saved' | 'saving' | 'retrying' | 'notSaved';
export type Doc = 'lists' | 'cards' | 'floor' | 'floorPng';
export type DocState = 'idle' | 'preparing' | 'done' | 'failed';
export type ListTab = 'space' | 'full' | 'all';
export type Paper =
  'floor' | 'floorLetter' | 'floorImage' | 'lists' | 'listsEnd' | 'nobody' | 'card' | 'cardTop';

export interface Bar {
  kind: 'tint' | 'amber' | 'undo';
  words: string;
  does?: 'placing' | 'pick' | 'undo';
  at?: 'floor';
}

export interface FieldSeed {
  key: string;
  value: string;
  error?: string;
  warn?: string;
}

export type PanelMode =
  | { kind: 'start' }
  | { kind: 'room' }
  | { kind: 'sectionAdd' }
  | { kind: 'sectionEdit'; id: string };

export type Pop =
  | { kind: 'short'; table: string; party: string }
  | { kind: 'swap'; table: string; chair: number; party: string }
  | { kind: 'moveAll'; table: string };

export type Asking =
  | { kind: 'deletePlan' }
  | { kind: 'deleteItems'; ids: string[] }
  | { kind: 'deleteSection'; id: string };

export interface Camera {
  s: number;
  cx: number;
  cy: number;
}

export interface Ui {
  load: 'ready' | 'loading' | 'failed';
  plan: Plan;
  tray: Party[];
  readOnly: boolean;
  zoomStep: boolean;
  rowStep: boolean;
  units: 'metric' | 'us';
  view: View;
  tab: Tab;
  chosen: string[];
  chair: { id: string; i: number } | null;
  panel: PanelMode | null;
  camera: Camera | null;
  snap: boolean;
  save: SaveState;
  people: Person[];
  presence: Presence;
  onPlanOpen: boolean;
  rings: Rings;
  bar: Bar | null;
  asking: Asking | null;
  seed: FieldSeed | null;
  notice: { tone: 'green' | 'amber'; words: string } | null;
  note: string | null;
  menu: boolean;
  placing: { kind: Kind; another: boolean } | null;
  ghost: Item | null;
  tip: { at: Point; words: string } | null;
  shrink: { width: number; outside: string[] } | null;
  sectionsRefused: boolean;
  print: { open: boolean; paper: 'A4' | 'Letter'; docs: Record<Doc, DocState> };
  picked: string | null;
  moving: { table: string; chair: number } | null;
  hoverChair: number | null;
  unsure: boolean;
  search: string;
  groups: string[];
  hover: string | null;
  chairLabel: { id: string; i: number } | null;
  pop: Pop | null;
  undo: {
    plan: Plan;
    tray: Party[];
    chosen?: string[];
    stale?: boolean;
    auto?: AutoSeat;
  } | null;
  tablesSection: string | null;
  listTab: ListTab | null;
  listOpen: string | null;
  focus: string | null;
  spoken: string;
  colleague: { id: string; at: Point } | null;
  joining: Person | null;
  contest: { id: string; at: Point; by: string } | null;
  paper: Paper | null;
  start: {
    name: string;
    width: string;
    length: string;
    errors: { width?: string; length?: string };
  };
  adding: boolean;
  box: Rect | null;
  kindMenu: boolean;
  fold: Fold | null;
  grid: { columns: string; gap: string; errors: { columns?: string; gap?: string } };
  refused: string | null;
  renumber: { start: string; error: string | null };
  sectionPick: string;
  /** sc-4022: sharing the tables with guests, the card at the top of the panel. */
  share: Share;
  /** sc-4019: Auto-seat by group's one proposal for the event; its chairs are marked on the plan. */
  auto: AutoSeat;
  /** sc-1364: the host's notes on who sits together and who not at the same table. */
  notes: Notes;
}

const NO_DOCS: Record<Doc, DocState> = {
  lists: 'idle',
  cards: 'idle',
  floor: 'idle',
  floorPng: 'idle',
};

export function freshUi(): Ui {
  return {
    load: 'ready',
    plan: samplePlan(),
    tray: sampleTray(),
    readOnly: false,
    zoomStep: false,
    rowStep: false,
    units: 'metric',
    view: 'plan',
    tab: 'arrange',
    chosen: [],
    chair: null,
    panel: null,
    camera: null,
    snap: true,
    save: 'saved',
    people: [PRIYA],
    presence: 'chips',
    onPlanOpen: false,
    rings: {},
    bar: null,
    asking: null,
    seed: null,
    notice: null,
    note: null,
    menu: false,
    placing: null,
    ghost: null,
    tip: null,
    shrink: null,
    sectionsRefused: false,
    print: { open: false, paper: 'A4', docs: { ...NO_DOCS } },
    picked: null,
    moving: null,
    hoverChair: null,
    unsure: false,
    search: '',
    groups: [],
    hover: null,
    chairLabel: null,
    pop: null,
    undo: null,
    tablesSection: null,
    listTab: null,
    listOpen: null,
    focus: null,
    spoken: '',
    colleague: null,
    joining: null,
    contest: null,
    paper: null,
    start: { name: 'Main hall', width: '24', length: '', errors: {} },
    adding: false,
    box: null,
    kindMenu: false,
    fold: null,
    grid: { columns: '3', gap: '1', errors: {} },
    refused: null,
    renumber: { start: '1', error: null },
    sectionPick: '',
    share: NOT_SHARED,
    auto: NO_PROPOSAL,
    notes: NO_NOTES,
  };
}

function byId(plan: Plan, id: string): Item {
  const item = plan.items.find((one) => one.id === id);

  if (item == null) throw new Error(`No ${id} on the sample`);
  return item;
}

function moved(plan: Plan, id: string, change: Partial<Item>): Plan {
  return {
    ...plan,
    items: plan.items.map((item) => (item.id === id ? { ...item, ...change } : item)),
  };
}

function added(plan: Plan, item: Item): Plan {
  return { ...plan, items: [...plan.items, item] };
}

function newAt(plan: Plan, kind: Kind, at: Point, id: string): Item {
  return { ...newItem(kind, plan.items, at), id };
}

/** Seats a party at a table as sc-4013 does: side by side if they fit, else the first free chairs. */
export function seated(
  plan: Plan,
  tray: Party[],
  partyId: string,
  tableId: string,
): { plan: Plan; tray: Party[]; apart: boolean } {
  const party = tray.find((one) => one.id === partyId);
  const item = byId(plan, tableId);

  if (party == null) return { plan, tray, apart: false };
  const n = peopleIn(party);
  const run = sideBySide(item, n);
  const chairs = run ?? firstFree(item, n);

  return {
    plan: {
      ...plan,
      items: plan.items.map((one) => (one.id === tableId ? seatAt(one, party, chairs) : one)),
    },
    tray: tray.filter((one) => one.id !== partyId),
    apart: run == null && n > 1,
  };
}

/** `picked` while the guest picked is already seated (sc-4013): their chair is `moving`. */
export const MOVING = 'seated-guest';

type At = { table: string; chair: number };

/** Moves one seated guest, and only them, to a chosen empty chair or the table's first free one; null when there is none. */
export function movedSeat(
  plan: Plan,
  from: At,
  tableId: string,
  chair?: number,
): { plan: Plan; name: string } | null {
  const was = byId(plan, from.table).chairs[from.chair];
  const target = byId(plan, tableId);
  const to = chair ?? firstFree(target, 1)[0];

  if (was?.state !== 'taken' || to == null || target.chairs[to]?.state !== 'empty') return null;
  return {
    plan: withChairs(plan, [
      [from, { state: 'empty' }],
      [{ table: tableId, chair: to }, was],
    ]),
    name: was.who ?? '',
  };
}

/** Two seated guests change chairs (sc-4013). */
export function swappedSeats(plan: Plan, a: At, b: At): Plan {
  const one = byId(plan, a.table).chairs[a.chair];
  const two = byId(plan, b.table).chairs[b.chair];

  if (one == null || two == null) return plan;
  return withChairs(plan, [
    [a, two],
    [b, one],
  ]);
}

function withChairs(plan: Plan, changes: readonly (readonly [At, Chair])[]): Plan {
  return {
    ...plan,
    items: plan.items.map((item) =>
      changes.some(([at]) => at.table === item.id)
        ? {
            ...item,
            chairs: item.chairs.map(
              (chair, index) =>
                changes.find(([at]) => at.table === item.id && at.chair === index)?.[1] ?? chair,
            ),
          }
        : item,
    ),
  };
}

export function seatedWords(party: Party, table: string, apart: boolean): string {
  const others = peopleIn(party) - 1;

  if (others === 0) return say(SW.seatedOne, { name: party.name, table });
  return many(apart ? 'seatedApart' : 'seatedParty', others, { name: party.name, table });
}

export function pickWords(party: Party): string {
  const others = peopleIn(party) - 1;

  return others === 0
    ? say(SW.pickOne, { name: party.name })
    : many('pickParty', others, { name: party.name });
}

const NEW_SPOT: Point = [1200, 1440];

/** Each `?state=` as the boards draw it (seating-a-spec.md §6). */
export function seedOf(state: SeatingState | null): Ui {
  const ui = freshUi();
  const plan = ui.plan;
  const at = (s: number, cx: number, cy: number) => ({ s, cx, cy });

  if (isAutoState(state)) return autoSeedOf(ui, state);
  if (isNoteState(state)) return notesSeedOf(ui, state);
  if (isShareState(state)) {
    const start = SHARE_STATES[state];

    return {
      ...ui,
      share: shareOf(state),
      readOnly: 'readOnly' in start,
      tray: 'allSeated' in start ? ui.tray.filter((party) => party.reply !== 'coming') : ui.tray,
    };
  }

  switch (state) {
    case null:
    case 'plan':
    case 'longName':
    case 'longNameFr':
    case 'crumbWidths':
    case 'crumbFocus':
      return ui;
    case 'presenceOne':
      return { ...ui, people: [], joining: PRIYA };
    case 'noPlan':
      return { ...ui, plan: { room: null, items: [], sections: [] }, people: [] };
    case 'startBlank':
      return {
        ...ui,
        plan: { room: null, items: [], sections: [] },
        people: [],
        panel: { kind: 'start' },
        start: { ...ui.start, errors: { length: SW.enterLength } },
        focus: 'startLength',
      };
    case 'startRange':
      return {
        ...ui,
        plan: { room: null, items: [], sections: [] },
        people: [],
        panel: { kind: 'start' },
        start: { ...ui.start, length: '1.5', errors: { length: SW.roomRange } },
        focus: 'startLength',
      };
    case 'newPlan':
      return {
        ...ui,
        plan: { ...plan, items: [], sections: [] },
        people: [],
        bar: { kind: 'tint', words: SW.firstItem, at: 'floor' },
      };
    case 'loading':
      return { ...ui, load: 'loading', people: [] };
    case 'failed':
      return { ...ui, load: 'failed', people: [] };
    case 'readOnly':
      return { ...ui, readOnly: true, people: [YOU, PRIYA] };
    case 'readOnlyTable':
      return {
        ...ui,
        readOnly: true,
        people: [YOU, PRIYA],
        plan: moved(plan, 't9', { rot: 15 }),
        chosen: ['t9'],
      };
    case 'readOnlyTableUs':
      return {
        ...ui,
        readOnly: true,
        units: 'us',
        people: [YOU, PRIYA],
        plan: moved(plan, 't9', { w: undefined, l: undefined }),
        chosen: ['t9'],
      };
    case 'zoomOut':
      return { ...ui, camera: at(0.2, 1200, 1100) };
    case 'corner':
      return { ...ui, camera: at(1, 1785, 620), chair: { id: 't4', i: 8 } };
    case 'sparse':
      return {
        ...ui,
        plan: {
          ...plan,
          items: [byId(plan, 't1')],
          sections: plan.sections.filter((one) => one.id === 'stage'),
        },
      };
    case 'roomSettings':
      return { ...ui, panel: { kind: 'room' } };
    case 'shrinkRefused':
      return {
        ...ui,
        panel: { kind: 'room' },
        shrink: { width: 2000, outside: ['t5', 't10', 'bar2'] },
        seed: {
          key: 'roomWidth',
          value: '20',
          error: many('shrinkRefused', 3, { width: '20 m', length: '18 m' }),
        },
        focus: 'roomWidth',
      };
    case 'deletePlan':
      return { ...ui, panel: { kind: 'room' }, asking: { kind: 'deletePlan' } };
    case 'roomChanged':
      return {
        ...ui,
        panel: { kind: 'room' },
        people: [PRIYA, SADE],
        seed: { key: 'roomWidth', value: '24', warn: say(SW.changedFirst, { name: PRIYA.name }) },
      };
    case 'usCustomary':
      return {
        ...ui,
        units: 'us',
        chosen: ['t4'],
        seed: { key: 'across', value: '85′ 6″', error: say(SW.outside, { name: 'Table 4' }) },
        focus: 'across',
      };
    case 'sectionAdd':
      return {
        ...ui,
        panel: { kind: 'sectionAdd' },
        seed: { key: 'sectionName', value: 'Window side' },
        focus: 'sectionName',
      };
    case 'sectionTaken':
      return {
        ...ui,
        panel: { kind: 'sectionAdd' },
        seed: {
          key: 'sectionName',
          value: 'Stage side',
          error: say(SW.sectionTaken, { name: 'Stage side' }),
        },
        focus: 'sectionName',
      };
    case 'sectionBlank':
      return {
        ...ui,
        panel: { kind: 'sectionAdd' },
        seed: { key: 'sectionName', value: '', error: SW.sectionBlank },
        focus: 'sectionName',
      };
    case 'sectionLimit': {
      const more = Array.from({ length: 27 }, (_, index) => ({
        id: `s${index + 4}`,
        name: `Section ${index + 4}`,
        colour: COLOURS[(index + 4) % COLOURS.length] as Colour,
      }));

      return {
        ...ui,
        plan: { ...plan, sections: [...plan.sections, ...more] },
        sectionsRefused: true,
      };
    }
    case 'sectionEdit':
      return {
        ...ui,
        plan: {
          ...plan,
          sections: plan.sections.map((one) =>
            one.id === 'stage' ? { ...one, colour: 'Wine' } : one,
          ),
        },
        panel: { kind: 'sectionEdit', id: 'stage' },
      };
    case 'sectionDelete':
      return {
        ...ui,
        panel: { kind: 'sectionEdit', id: 'stage' },
        asking: { kind: 'deleteSection', id: 'stage' },
      };
    case 'sectionDeleteRows':
      return {
        ...ui,
        plan: {
          ...plan,
          sections: [...plan.sections, { id: 'quiet', name: 'Quiet corner', colour: 'Blue' }],
          items: plan.items.map((item) =>
            item.id === 'rowA' || item.id === 'door' ? { ...item, sec: 'quiet' } : item,
          ),
        },
        panel: { kind: 'sectionEdit', id: 'quiet' },
        asking: { kind: 'deleteSection', id: 'quiet' },
      };
    case 'sectionDeleteEmpty':
      return {
        ...ui,
        plan: {
          ...plan,
          sections: [...plan.sections, { id: 'quiet', name: 'Quiet corner', colour: 'Blue' }],
        },
        panel: { kind: 'sectionEdit', id: 'quiet' },
        asking: { kind: 'deleteSection', id: 'quiet' },
      };
    case 'addMenu':
      return { ...ui, menu: true };
    case 'placing':
      return {
        ...ui,
        placing: { kind: 'round', another: true },
        ghost: newAt(plan, 'round', NEW_SPOT, 'placing'),
        bar: { kind: 'tint', words: say(SW.placing, { shape: 'round table' }), does: 'placing' },
      };
    case 'placed': {
      const item = newAt(plan, 'round', NEW_SPOT, 't11');

      return {
        ...ui,
        plan: added(plan, item),
        chosen: ['t11'],
        notice: { tone: 'green', words: say(SW.added, { name: item.name }) },
      };
    }
    case 'tapChooses':
      return { ...ui, chosen: ['t4'] };
    case 'zoomAbove':
      return { ...ui, zoomStep: true, chosen: ['t4'] };
    case 'zoomAboveMap':
      return { ...ui, zoomStep: true, chosen: ['t4'], camera: at(1, 1785, 620) };
    case 'rowStepped':
      return { ...seedOf('placing'), rowStep: true };
    case 'rect':
      return { ...ui, chosen: ['t9'] };
    case 'head':
      return { ...ui, chosen: ['top'] };
    case 'cocktail':
      return { ...ui, chosen: ['bar1'] };
    case 'shapeChanged': {
      const { item, note } = reshaped(byId(plan, 't10'), 'rect');

      return { ...ui, plan: moved(plan, 't10', item), chosen: ['t10'], note };
    }
    case 'squeeze':
      return { ...ui, plan: moved(plan, 't10', { d: 150 }), chosen: ['t10'], focus: 'diameter' };
    case 'nameTaken':
      return {
        ...ui,
        chosen: ['t10'],
        seed: { key: 'name', value: 'Table 2', error: say(SW.tableTaken, { name: 'Table 2' }) },
        focus: 'name',
      };
    case 'belowSeated':
      return {
        ...ui,
        chosen: ['t4'],
        seed: { key: 'seats', value: '6', error: say(SW.belowSeated, { n: 8, m: 8 }) },
        focus: 'seats',
      };
    case 'fieldBlank':
      return {
        ...ui,
        chosen: ['t10'],
        seed: { key: 'name', value: '', error: SW.tableBlank },
        focus: 'name',
      };
    case 'seatsRange':
      return {
        ...ui,
        chosen: ['t10'],
        seed: { key: 'seats', value: '40', error: SW.seatsRange },
        focus: 'seats',
      };
    case 'sizeRange':
      return {
        ...ui,
        chosen: ['t10'],
        seed: { key: 'diameter', value: '1200', error: tableSizeRefusal('metric') },
        focus: 'diameter',
      };
    case 'notNumber':
      return {
        ...ui,
        chosen: ['t9'],
        seed: { key: 'width', value: 'two metres', error: tableSizeRefusal('metric') },
        focus: 'width',
      };
    case 'endsRange':
      return {
        ...ui,
        chosen: ['t9'],
        seed: { key: 'ends', value: '10', error: say(SW.endsRange, { max: 8 }) },
        focus: 'ends',
      };
    case 'chair':
      return { ...ui, camera: at(0.75, 1590, 620), chair: { id: 't4', i: 8 } };
    case 'unusable': {
      const t4 = byId(plan, 't4');

      return {
        ...ui,
        plan: moved(plan, 't4', {
          chairs: t4.chairs.map((chair, index) => (index === 8 ? { state: 'unusable' } : chair)),
        }),
        camera: at(0.75, 1590, 620),
        chair: { id: 't4', i: 8 },
      };
    }
    case 'unusableRefused':
      return {
        ...ui,
        camera: at(0.75, 1590, 620),
        chair: { id: 't4', i: 1 },
        notice: { tone: 'amber', words: say(SW.chairTaken, { name: 'Chidi Obi' }) },
      };
    case 'duplicated':
    case 'duplicateKey': {
      const copy = {
        ...copyOf(byId(plan, 't4'), plan.items, plan.room!),
        id: 't11',
        x: NEW_SPOT[0],
        y: NEW_SPOT[1],
      };
      const words = say(SW.duplicated, { name: copy.name, of: 'Table 4' });

      return {
        ...ui,
        plan: added(plan, copy),
        chosen: ['t11'],
        notice: { tone: 'green', words },
        focus: state === 'duplicateKey' ? 'item:t11' : null,
        spoken: state === 'duplicateKey' ? words : '',
      };
    }
    case 'deleteTable':
      return { ...ui, chosen: ['t4'], asking: { kind: 'deleteItems', ids: ['t4'] } };
    case 'deleteEmpty':
      return { ...ui, chosen: ['t10'], asking: { kind: 'deleteItems', ids: ['t10'] } };
    case 'tableChanged':
      return {
        ...ui,
        chosen: ['t7'],
        rings: { t7: [{ who: PRIYA }] },
        people: [PRIYA, SADE],
        notice: { tone: 'amber', words: say(SW.tableChanged, { name: PRIYA.name }) },
      };
    case 'rowChanged':
    case 'seatChanged': {
      const id = state === 'rowChanged' ? 'rowA' : 'door';
      const words = state === 'rowChanged' ? SW.rowChanged : SW.seatChanged;

      return {
        ...ui,
        chosen: [id],
        rings: { [id]: [{ who: PRIYA }] },
        people: [PRIYA, SADE],
        notice: { tone: 'amber', words: say(words, { name: PRIYA.name }) },
      };
    }
    case 'rowAdded':
    case 'rowLabelTaken': {
      const row = newAt(plan, 'row', [1590, 1440], 'rowB');

      return {
        ...ui,
        plan: added(plan, row),
        chosen: ['rowB'],
        ...(state === 'rowAdded'
          ? { notice: { tone: 'green' as const, words: say(SW.rowAdded, { label: 'B', n: 10 }) } }
          : {
              seed: { key: 'label', value: 'A', error: say(SW.rowTaken, { label: 'A' }) },
              focus: 'label',
            }),
      };
    }
    case 'rowTurned':
      return {
        ...ui,
        plan: moved(plan, 'rowA', { rot: 15 }),
        camera: at(1, 560, 1400),
        chosen: ['rowA'],
        chair: { id: 'rowA', i: 3 },
      };
    case 'rowBelowSeated':
      return {
        ...ui,
        chosen: ['rowA'],
        seed: {
          key: 'seats',
          value: '3',
          error: say(SW.rowBelowSeated, { name: 'Lars Johansson', n: 4, m: 4 }),
        },
        focus: 'seats',
      };
    case 'deleteRow':
      return { ...ui, chosen: ['rowA'], asking: { kind: 'deleteItems', ids: ['rowA'] } };
    case 'seatAdded':
    case 'seatNameTaken': {
      const seat = newAt(plan, 'single', NEW_SPOT, 'seat1');

      return {
        ...ui,
        plan: added(plan, seat),
        chosen: ['seat1'],
        ...(state === 'seatAdded'
          ? { notice: { tone: 'green' as const, words: say(SW.added, { name: 'Seat 1' }) } }
          : {
              seed: {
                key: 'name',
                value: 'By the door',
                error: say(SW.seatTaken, { name: 'By the door' }),
              },
              focus: 'name',
            }),
      };
    }
    case 'drag':
    case 'saving':
    case 'retrying':
    case 'notSaved': {
      const t10 = byId(plan, 't10');
      const base = { ...ui, plan: moved(plan, 't10', { y: 1380 }), chosen: ['t10'] };

      if (state === 'drag')
        return {
          ...base,
          camera: at(0.5, 1800, 1200),
          ghost: { ...t10, id: 'ghost' },
          save: 'saving',
          tip: { at: [1980, 1380], words: say(SW.tip, { across: '19.80 m', down: '13.80 m' }) },
        };
      return {
        ...base,
        save: state,
        presence: state === 'saving' ? 'chips' : 'reconnecting',
        people: state === 'saving' ? [PRIYA] : [],
      };
    }
    case 'resize':
      return {
        ...ui,
        plan: moved(plan, 't9', { w: 300 }),
        chosen: ['t9'],
        camera: at(0.5, 1590, 1020),
        save: 'saving',
        tip: { at: [1740, 1020], words: say(SW.tipWidth, { n: 300 }) },
        focus: 'width',
      };
    case 'turn':
      return {
        ...ui,
        plan: moved(plan, 't9', { rot: 15 }),
        chosen: ['t9'],
        camera: at(0.5, 1590, 1020),
        focus: 'item:t9',
      };
    case 'several': {
      let next = plan;

      for (const id of ['t6', 't7', 't8']) next = moved(next, id, { y: 1080 });
      return {
        ...ui,
        plan: next,
        chosen: ['t6', 't7', 't8'],
        save: 'saving',
        tip: { at: [810, 1080], words: say(SW.tip, { across: '8.10 m', down: '10.80 m' }) },
      };
    }
    case 'overlap':
      return {
        ...ui,
        plan: moved(plan, 't9', { x: 1440, rot: 15 }),
        chosen: ['t9'],
        ghost: { ...byId(plan, 't9'), id: 'ghost' },
        camera: at(0.5, 1420, 1000),
      };
    case 'wall':
      return {
        ...ui,
        plan: moved(plan, 't5', { x: 2260 }),
        chosen: ['t5'],
        camera: at(0.5, 2050, 620),
        save: 'saving',
        tip: { at: [2400, 620], words: say(SW.tip, { across: '22.60 m', down: '6.20 m' }) },
      };
    case 'acrossRefused':
      return {
        ...ui,
        chosen: ['t5'],
        seed: { key: 'across', value: '23.5', error: say(SW.outside, { name: 'Table 5' }) },
        focus: 'across',
      };
    case 'stepRefused': {
      let next = plan;

      for (const id of ['t6', 't7', 't8']) next = moved(next, id, { y: 980 });
      return {
        ...ui,
        plan: next,
        chosen: ['t6', 't7', 't8'],
        rings: { t7: [{ who: PRIYA }] },
        people: [PRIYA, SADE],
        bar: { kind: 'amber', words: say(SW.moved, { name: PRIYA.name, table: 'Table 7' }) },
      };
    }
    case 'tabOrder':
      return { ...ui, chosen: ['t4'], focus: 'item:t4' };
    case 'arrows':
      return {
        ...ui,
        plan: moved(plan, 't4', { x: 1690 }),
        chosen: ['t4'],
        focus: 'item:t4',
        spoken: `${say(SW.movedTo, { name: 'Table 4', across: '16.90 m', down: '6.20 m' })} ${SW.saved}.`,
      };
    case 'screenReader':
      return { ...ui, focus: 'item:top' };
    case 'presenceChose':
      return { ...ui, rings: { t7: [{ who: PRIYA }] } };
    case 'presenceBoth':
      return {
        ...ui,
        chosen: ['t7'],
        rings: { t7: [{ who: PRIYA }] },
        people: [PRIYA, SADE],
        contest: { id: 't7', at: [810, 1120], by: PRIYA.name },
      };
    case 'presenceSix':
      return {
        ...ui,
        people: [...SIX],
        presence: 'overflow',
        onPlanOpen: true,
        rings: {
          t7: [{ who: PRIYA }, { who: SIX[2]! }],
          t2: [{ who: SIX[5]! }],
          t9: [{ who: SIX[3]!, seat: 1 }],
        },
      };
    case 'presenceSeatTables':
    case 'presenceSeatList':
      return {
        ...ui,
        people: [PRIYA, SIX[3]!],
        rings: { t9: [{ who: SIX[3]!, seat: 1 }] },
        ...(state === 'presenceSeatTables'
          ? { view: 'tables' as const }
          : { view: 'list' as const, listTab: 'all' as const, listOpen: 't9' }),
      };
    case 'presenceTwoTables':
    case 'presenceTwoList':
      return {
        ...ui,
        people: [...SIX],
        presence: 'overflow',
        rings: {
          t7: [{ who: PRIYA }, { who: SIX[2]! }],
          t4: [{ who: SIX[3]! }, { who: SIX[5]! }, { who: PRIYA }],
          t2: [{ who: SADE }],
        },
        ...(state === 'presenceTwoTables'
          ? { view: 'tables' as const }
          : { view: 'list' as const, listTab: 'all' as const }),
      };
    case 'presenceBothTables':
      return {
        ...ui,
        view: 'tables',
        chosen: ['t7'],
        rings: { t7: [{ who: PRIYA }] },
        people: [PRIYA, SADE],
      };
    case 'presenceViewer':
      return { ...ui, people: [PRIYA, SADE] };
    case 'reconnecting':
      return { ...ui, people: [], presence: 'reconnecting', rings: { t7: [{ who: PRIYA }] } };
    case 'left':
      return { ...ui, people: [SADE], spoken: say(SW.left, { name: PRIYA.name }) };
    case 'arriving':
      return { ...ui, chosen: ['t4'], colleague: { id: 't9', at: [1700, 1180] } };
    case 'seat':
      return { ...ui, tab: 'seat' };
    case 'picked':
      return {
        ...ui,
        tab: 'seat',
        picked: 'kwame',
        hover: 't8',
        bar: { kind: 'tint', words: pickWords(ui.tray[0]!), does: 'pick' },
      };
    case 'pickedOut':
      return {
        ...ui,
        tab: 'seat',
        picked: 'kwame',
        hover: 't8',
        camera: at(0.2, 1200, 1100),
        bar: { kind: 'tint', words: pickWords(ui.tray[0]!), does: 'pick' },
      };
    case 'pickedTight': {
      const closer = (id: string, y: number) => (now: Plan) => moved(now, id, { y });
      const tight = [
        ...['t6', 't7', 't8', 't9', 't10'].map((id) => closer(id, 900)),
        closer('rowA', 1090),
      ].reduce((now, step) => step(now), plan);

      return {
        ...ui,
        plan: tight,
        tab: 'seat',
        picked: 'kwame',
        hover: 't8',
        bar: { kind: 'tint', words: pickWords(ui.tray[0]!), does: 'pick' },
      };
    }
    case 'chairLabel':
      return {
        ...ui,
        tab: 'seat',
        picked: 'kwame',
        hover: 't9',
        camera: at(0.75, 1590, 1020),
        chairLabel: { id: 't9', i: 0 },
        bar: { kind: 'tint', words: pickWords(ui.tray[0]!), does: 'pick' },
      };
    case 'seated':
    case 'apart':
    case 'undoRefused': {
      const first = seated(plan, ui.tray, 'kwame', 't8');
      const kwame = ui.tray[0]!;

      if (state === 'seated')
        return {
          ...ui,
          tab: 'seat',
          plan: first.plan,
          tray: first.tray,
          chosen: [],
          hover: 't8',
          undo: { plan, tray: ui.tray },
          bar: { kind: 'undo', words: seatedWords(kwame, 'Table 8', false), does: 'undo' },
        };
      if (state === 'undoRefused')
        return {
          ...ui,
          tab: 'seat',
          plan: first.plan,
          tray: first.tray,
          people: [PRIYA, SADE],
          bar: { kind: 'amber', words: SW.undoRefused },
        };
      const t9 = byId(first.plan, 't9');
      const gapped: Item = {
        ...t9,
        chairs: t9.chairs.map((chair, index) =>
          index === 2
            ? { state: 'empty' }
            : index === 6
              ? { state: 'taken', who: 'Yaa Mensah' }
              : chair,
        ),
      };
      const before = moved(first.plan, 't9', gapped);
      const second = seated(before, first.tray, 'ines', 't9');
      const ines = ui.tray[1]!;

      return {
        ...ui,
        tab: 'seat',
        plan: second.plan,
        tray: second.tray,
        hover: 't9',
        undo: { plan: before, tray: first.tray },
        bar: { kind: 'undo', words: seatedWords(ines, 'Table 9', second.apart), does: 'undo' },
      };
    }
    case 'full':
      return {
        ...ui,
        tab: 'seat',
        picked: 'lucia',
        bar: { kind: 'amber', words: say(SW.full, { table: 'Table 1' }) },
      };
    case 'short':
      return {
        ...ui,
        tab: 'seat',
        picked: 'amaka',
        hover: 't4',
        pop: { kind: 'short', table: 't4', party: 'amaka' },
        bar: { kind: 'tint', words: pickWords(ui.tray[4]!), does: 'pick' },
      };
    case 'swap':
      return {
        ...ui,
        tab: 'seat',
        picked: 'lucia',
        camera: at(0.75, 1590, 620),
        pop: { kind: 'swap', table: 't4', chair: 2, party: 'lucia' },
        bar: { kind: 'tint', words: pickWords(ui.tray[2]!), does: 'pick' },
      };
    case 'race':
      return {
        ...ui,
        tab: 'seat',
        picked: 'lucia',
        people: [PRIYA, SADE],
        bar: { kind: 'amber', words: say(SW.race, { name: 'Lucía Ortega' }) },
      };
    case 'tableGuests':
      return { ...ui, tab: 'seat', chosen: ['t4'] };
    case 'moveAll':
      return {
        ...ui,
        tab: 'seat',
        chosen: ['t4'],
        hover: 't10',
        pop: { kind: 'moveAll', table: 't4' },
      };
    case 'moveAllNone': {
      const t10 = byId(plan, 't10');
      const six = [
        'Ada Obi',
        'Tomás Silva',
        'Chloé Martin',
        'Femi Bello',
        'Rui Costa',
        'Lea Klein',
      ];

      return {
        ...ui,
        tab: 'seat',
        plan: moved(plan, 't10', {
          chairs: t10.chairs.map((chair, index) =>
            index < six.length ? { state: 'taken', who: six[index]! } : chair,
          ),
        }),
        chosen: ['t1'],
        hover: 't1',
        pop: { kind: 'moveAll', table: 't1' },
      };
    }
    case 'emptyTable':
      return { ...ui, tab: 'seat', chosen: ['t10'] };
    case 'everyoneSeated': {
      let next = { plan, tray: ui.tray };

      for (const party of ui.tray.filter((one) => one.reply === 'coming')) {
        const table = next.plan.items.find(
          (item) => item.kind !== 'single' && usable(item) - filled(item) >= peopleIn(party),
        );

        if (table != null) next = seated(next.plan, next.tray, party.id, table.id);
      }
      return { ...ui, tab: 'seat', plan: next.plan, tray: next.tray };
    }
    case 'nobodyComing':
      return {
        ...ui,
        tab: 'seat',
        plan: {
          ...plan,
          items: plan.items.map((item) => ({
            ...item,
            chairs: item.chairs.map((chair) =>
              chair.state === 'taken' || chair.state === 'held'
                ? { state: 'empty' as const }
                : chair,
            ),
          })),
        },
        tray: ui.tray.filter((party) => party.reply !== 'coming'),
      };
    case 'noMatch':
      return { ...ui, tab: 'seat', search: 'Olu' };
    case 'notSureYet':
      return { ...ui, tab: 'seat', unsure: true };
    case 'tables':
      return { ...ui, tab: 'seat', view: 'tables' };
    case 'tablesPicked':
      return {
        ...ui,
        tab: 'seat',
        view: 'tables',
        picked: 'kwame',
        hover: 't8',
        bar: { kind: 'tint', words: pickWords(ui.tray[0]!), does: 'pick' },
      };
    case 'tablesChair':
      return {
        ...ui,
        tab: 'seat',
        view: 'tables',
        picked: 'kwame',
        hover: 't8',
        hoverChair: 7,
        bar: { kind: 'tint', words: pickWords(ui.tray[0]!), does: 'pick' },
      };
    case 'tablesSwap':
      return {
        ...ui,
        tab: 'seat',
        view: 'tables',
        picked: 'lucia',
        hover: 't4',
        hoverChair: 2,
        pop: { kind: 'swap', table: 't4', chair: 2, party: 'lucia' },
        bar: { kind: 'tint', words: pickWords(ui.tray[2]!), does: 'pick' },
      };
    case 'tablesMoving': {
      const name = byId(plan, 't4').chairs[2]?.who ?? '';

      return {
        ...ui,
        tab: 'seat',
        view: 'tables',
        picked: MOVING,
        moving: { table: 't4', chair: 2 },
        bar: { kind: 'tint', words: say(SW.pickOne, { name }), does: 'pick' },
      };
    }
    case 'tablesMoved': {
      const next = movedSeat(plan, { table: 't4', chair: 2 }, 't8');

      return {
        ...ui,
        tab: 'seat',
        view: 'tables',
        plan: next?.plan ?? plan,
        hover: 't8',
        undo: { plan, tray: ui.tray },
        bar: {
          kind: 'undo',
          words: say(SW.seatedOne, { name: next?.name ?? '', table: byId(plan, 't8').name }),
          does: 'undo',
        },
      };
    }
    case 'list':
      return { ...ui, tab: 'seat', view: 'list' };
    case 'listOpen':
      return {
        ...ui,
        tab: 'seat',
        view: 'list',
        picked: 'kwame',
        listOpen: 't8',
        bar: { kind: 'tint', words: pickWords(ui.tray[0]!), does: 'pick' },
      };
    case 'print':
      return { ...ui, print: { ...ui.print, open: true } };
    case 'printPreparing':
      return {
        ...ui,
        print: { ...ui.print, open: true, docs: { ...NO_DOCS, floor: 'preparing' } },
      };
    case 'printDone':
      return { ...ui, print: { ...ui.print, open: true, docs: { ...NO_DOCS, lists: 'done' } } };
    case 'printFailed':
      return { ...ui, print: { ...ui.print, open: true, docs: { ...NO_DOCS, cards: 'failed' } } };
    case 'printReadOnly':
      return { ...ui, readOnly: true, people: [YOU], print: { ...ui.print, open: true } };
    case 'paperFloor':
      return { ...ui, paper: 'floor' };
    case 'paperFloorLetter':
      return { ...ui, paper: 'floorLetter' };
    case 'paperFloorImage':
      return { ...ui, paper: 'floorImage' };
    case 'paperLists':
      return { ...ui, paper: 'lists' };
    case 'paperListsEnd':
      return { ...ui, paper: 'listsEnd' };
    case 'paperNobody':
      return { ...ui, paper: 'nobody' };
    case 'paperCard':
      return { ...ui, paper: 'card' };
    case 'paperCardTop':
      return { ...ui, paper: 'cardTop' };
    default:
      return choosingSeed(state, ui);
  }
}

const SIX_TABLES = ['t1', 't2', 't3', 't4', 't5', 't6'];
const SCATTERED = ['t1', 't5', 't6', 't10'];
const MIXED = [...SCATTERED, 'rowA', 'door'];
const GARDEN = ['t6', 't7', 't8', 't9', 't10'];

/** The Selection panel's states (sc-4717): the box, Add to choice, Select all, and each tool. */
function choosingSeed(state: SeatingState, ui: Ui): Ui {
  const plan = ui.plan;
  const of = (ids: readonly string[]) => ids.map((id) => byId(plan, id));

  switch (state) {
    case 'boxDrawing':
      return {
        ...ui,
        chosen: ['t1', 't2', 't6', 't7'],
        box: { x0: 250, y0: 450, x1: 960, y1: 1100 },
      };
    case 'addOff':
      return { ...ui, chosen: ['t1'] };
    case 'addOn':
      return { ...ui, chosen: ['t1'], adding: true };
    case 'addBox':
      return {
        ...ui,
        chosen: MIXED,
        adding: true,
        box: { x0: 120, y0: 1400, x1: 900, y1: 1740 },
      };
    case 'addMixed':
      return { ...ui, chosen: MIXED, adding: true };
    case 'selectAll':
      return { ...ui, chosen: plan.items.map((item) => item.id) };
    case 'kindMenu':
      return { ...ui, kindMenu: true };
    case 'selection':
      return { ...ui, chosen: SIX_TABLES };
    case 'spaceTwo':
      return { ...ui, chosen: ['t6', 't7'] };
    case 'aligned': {
      const before = withMoved(plan, [
        { ...byId(plan, 't6'), y: 990 },
        { ...byId(plan, 't7'), y: 1060 },
        { ...byId(plan, 't8'), y: 1010 },
      ]);
      const chosen = ['t6', 't7', 't8'].map((id) => byId(before, id));
      const words = say(SW.doneTop, { things: thingsOf(chosen) });

      return {
        ...ui,
        plan: withMoved(before, aligned(chosen, 'top')),
        chosen: ['t6', 't7', 't8'],
        undo: { plan: before, tray: ui.tray },
        bar: { kind: 'undo', words, does: 'undo' },
        spoken: words,
      };
    }
    case 'gridOpen':
      return { ...ui, chosen: SIX_TABLES, fold: 'grid', grid: { ...ui.grid, gap: '1.5' } };
    case 'gridWall':
    case 'gridEdge': {
      const chosen = ['t3', 't4', 't5', 't9', 't10'];
      const out = outsider(plan, gridOf(of(chosen), 5, 100).moved);

      return {
        ...ui,
        chosen,
        fold: 'grid',
        grid: { columns: '5', gap: '1', errors: {} },
        refused:
          state === 'gridEdge' && out != null ? say(SW.edgeRefused, { name: out.name }) : null,
      };
    }
    case 'gridWide': {
      const chosen = plan.items.filter((item) => /^t\d+$/u.test(item.id)).map((item) => item.id);
      const { w, l } = gridOf(of(chosen), 10, 100);

      return {
        ...ui,
        chosen,
        fold: 'grid',
        grid: { columns: '10', gap: '1', errors: {} },
        refused: tooBig(plan, w, l, ui.units),
      };
    }
    case 'gridFields':
      return {
        ...ui,
        chosen: SIX_TABLES,
        fold: 'grid',
        grid: { columns: '0', gap: '12', errors: { columns: SW.columnsRange, gap: SW.gapRange } },
        focus: 'gridColumns',
      };
    case 'gridFeet':
      return {
        ...ui,
        units: 'us',
        chosen: SIX_TABLES,
        fold: 'grid',
        grid: { columns: '3', gap: '40', errors: { gap: SW.gapRangeFeet } },
        focus: 'gridGap',
      };
    case 'renumberOpen':
      return {
        ...ui,
        chosen: [...GARDEN, 'rowA'],
        fold: 'renumber',
        renumber: { start: '11', error: null },
      };
    case 'renumberClash':
      return {
        ...ui,
        chosen: ['t1', 't2', 't3', 't4', 't5'],
        fold: 'renumber',
        renumber: { start: '7', error: say(SW.renumberClash, { name: 'Table 7' }) },
        focus: 'renumberStart',
      };
    case 'renumberBlank':
      return {
        ...ui,
        chosen: ['t1', 't2', 't3', 't4', 't5'],
        fold: 'renumber',
        renumber: { start: '', error: SW.startRange },
        focus: 'renumberStart',
      };
    case 'sectionOpen':
      return { ...ui, chosen: GARDEN, fold: 'section', sectionPick: 'stage' };
    case 'duplicatedMany': {
      const made = copiesOf(plan, of(['t6', 't7', 't8']));

      if (!('copies' in made)) return ui;
      const words = many('duplicatedMany', made.copies.length);

      return {
        ...ui,
        plan: { ...plan, items: [...plan.items, ...made.copies] },
        chosen: made.copies.map((item) => item.id),
        undo: { plan, tray: ui.tray },
        bar: { kind: 'undo', words, does: 'undo' },
        spoken: words,
      };
    }
    case 'deleteMany':
      return { ...ui, chosen: SIX_TABLES, asking: { kind: 'deleteItems', ids: SIX_TABLES } };
    case 'deleteManyEmpty': {
      const ids = ['t10', 'bar1', 'bar2'];

      return { ...ui, chosen: ids, asking: { kind: 'deleteItems', ids } };
    }
    case 'deleteMixed': {
      const ids = ['t8', 'rowA', 'door'];

      return { ...ui, chosen: ids, asking: { kind: 'deleteItems', ids } };
    }
    case 'deleteManyChanged': {
      const doomed = plan.items.filter((item) => SIX_TABLES.includes(item.id));
      const freed = freedFrom(doomed);
      const after = { ...plan, items: plan.items.filter((item) => !SIX_TABLES.includes(item.id)) };
      const since = seated(after, [...ui.tray, ...freed], freed[0]!.id, 't8');

      return {
        ...ui,
        plan: since.plan,
        tray: since.tray,
        chosen: [],
        rings: { t8: [{ who: PRIYA }] },
        people: [PRIYA, SADE],
        undo: { plan, tray: ui.tray, chosen: SIX_TABLES, stale: true },
        bar: {
          kind: 'undo',
          words: many('deletedMany', seatedOf(doomed), { things: thingsOf(doomed) }),
          does: 'undo',
        },
      };
    }
    case 'toolChanged': {
      const chosen = ['t1', 't2', 't3', 't4', 't5'];

      return {
        ...ui,
        plan: moved(plan, 't5', { y: 660 }),
        chosen,
        rings: { t5: [{ who: PRIYA }] },
        people: [PRIYA, SADE],
        bar: {
          kind: 'amber',
          words: say(SW.stepChanged, { name: PRIYA.name, table: 'Table 5' }),
        },
      };
    }
    case 'readOnlyMany':
      return { ...ui, readOnly: true, people: [YOU, PRIYA] };
    default:
      return ui;
  }
}

/** Runs Auto-seat on the Ui as `by` would at `at`: the plan carries the proposal, the tray keeps everyone until they are accepted. */
export function proposedUi(ui: Ui, by: Person, at: string): Ui {
  const run = propose(ui.plan, ui.tray, SAMPLE_NOTES);
  const tables = proposedTables(run.plan);

  return {
    ...ui,
    plan: run.plan,
    auto: {
      asking: false,
      by: by.name,
      at,
      stamps: Object.fromEntries(tables.map((item) => [item.id, stampOf(item)])),
      left: run.left,
    },
    spoken: readyWords(
      proposedGuests(run.plan),
      tables.length,
      run.left.reduce(
        (sum, one) => sum + peopleIn(ui.tray.find((party) => party.id === one.party)!),
        0,
      ),
    ),
  };
}

const FILLERS = [
  'Ada Okafor',
  'Ben Lima',
  'Carla Ruiz',
  'Dele Ajayi',
  'Eva Novak',
  'Femi Ojo',
  'Gina Russo',
  'Hassan Ali',
  'Iris Weber',
  'Jide Cole',
  'Kofi Boateng',
  'Lena Vogel',
  'Mina Park',
  'Noah Reed',
];

/** A fuller room for the reasons: Tables 7, 9 and 10 and the bars full, so a party of two finds no two seats together. */
function fuller(plan: Plan): Plan {
  const names = [...FILLERS];
  let k = 0;

  return {
    ...plan,
    items: plan.items.map((item) =>
      ['t7', 't9', 't10', 'bar1', 'bar2'].includes(item.id)
        ? {
            ...item,
            chairs: item.chairs.map((chair): Chair => {
              if (chair.state !== 'empty') return chair;
              k += 1;
              return { state: 'taken', who: names[k % names.length] };
            }),
          }
        : item,
    ),
  };
}

function autoSeedOf(start: Ui, state: AutoState): Ui {
  const ui: Ui = { ...start, tab: 'seat' };

  switch (state) {
    case 'autoBefore':
      return ui;
    case 'autoAsk':
      return { ...ui, auto: { ...NO_PROPOSAL, asking: true } };
    case 'autoNobody':
      return { ...seedOf('everyoneSeated'), tab: 'seat' };
    case 'autoProposed':
      return proposedUi(ui, YOU, PROPOSED_AT);
    case 'autoLeftOver':
      return proposedUi({ ...ui, plan: fuller(ui.plan) }, YOU, PROPOSED_AT);
    case 'autoAccepted': {
      const was = proposedUi(ui, YOU, PROPOSED_AT);
      const done = accepted(was.plan, was.tray, ['t8']);
      const words = autoSeatedWords(done.guests, 1);

      return {
        ...was,
        plan: done.plan,
        tray: done.tray,
        auto: {
          ...was.auto,
          stamps: Object.fromEntries(Object.entries(was.auto.stamps).filter(([id]) => id !== 't8')),
        },
        undo: { plan: was.plan, tray: was.tray, auto: was.auto },
        bar: { kind: 'undo', words, does: 'undo' },
        spoken: words,
      };
    }
    case 'autoChanged':
    case 'autoAllChanged': {
      const was = proposedUi(ui, YOU, PROPOSED_AT);
      const plan = {
        ...was.plan,
        items: was.plan.items.map((item) =>
          item.id === 't8'
            ? {
                ...item,
                chairs: item.chairs.map((chair, index): Chair =>
                  index === 9
                    ? { state: 'taken', who: 'Hugo Lambert', party: 'hugo', reply: 'notSure' }
                    : chair,
                ),
              }
            : item,
        ),
      };
      const changed = was.plan.items.filter((item) => item.id === 't8');
      const tray = was.tray.filter((party) => party.id !== 'hugo');

      if (state === 'autoChanged')
        return {
          ...was,
          plan,
          tray,
          bar: { kind: 'amber', words: changedWords(changed) },
          spoken: changedWords(changed),
        };
      const done = accepted(plan, tray, ['t10']);
      const words = `${autoSeatedWords(done.guests, 1)} ${changedWords(changed)}`;

      return {
        ...was,
        plan: done.plan,
        tray: done.tray,
        auto: { ...was.auto, stamps: { t8: was.auto.stamps.t8 ?? '' } },
        undo: { plan, tray, auto: was.auto },
        bar: { kind: 'undo', words, does: 'undo' },
        spoken: words,
      };
    }
    case 'autoReplace': {
      const was = proposedUi(ui, PRIYA, EARLIER_AT);

      return { ...was, spoken: '', auto: { ...was.auto, asking: true } };
    }
    case 'autoTables':
      return { ...proposedUi(ui, YOU, PROPOSED_AT), view: 'tables', spoken: '' };
    case 'autoList':
      return { ...proposedUi(ui, YOU, PROPOSED_AT), view: 'list', listOpen: 't8', spoken: '' };
    case 'autoReadOnly':
      return { ...proposedUi(ui, PRIYA, EARLIER_AT), readOnly: true, people: [YOU], spoken: '' };
  }
}

/** sc-1364: each state opens on the sample's four notes, two of them broken at Table 6 and one of those reaching Table 8. */
function notesSeedOf(start: Ui, state: NoteStateKey): Ui {
  const notes: Notes = { ...NO_NOTES, list: sampleNotes() };
  const ui: Ui = { ...start, tab: 'seat', notes };
  const lina = (draft: Partial<NoteDraft>): Ui => ({
    ...ui,
    notes: { ...notes, guest: 'Lina Haddad', draft: { ...EMPTY_DRAFT, ...draft } },
  });

  switch (state) {
    case 'notesSeat':
      return ui;
    case 'notesList':
      return { ...ui, notes: { ...notes, shown: 'notes' } };
    case 'notesNone':
      return {
        ...ui,
        notes: { ...notes, shown: 'notes', list: notes.list.filter((one) => one.id > 'n2') },
      };
    case 'notesEmpty':
      return { ...ui, notes: { ...NO_NOTES, shown: 'notes' } };
    case 'notesShown':
      return { ...ui, chosen: ['t6'], notes: { ...notes, shown: 'notes' } };
    case 'notesTables':
      return { ...ui, view: 'tables', notes: { ...notes, shown: 'notes' } };
    case 'notesGuest':
      return { ...ui, notes: { ...notes, guest: 'Inês Duarte' } };
    case 'notesChair':
      return { ...ui, tab: 'arrange', chair: { id: 't6', i: 4 } };
    case 'notesTableGuests':
      return { ...ui, view: 'tables', chosen: ['t6'] };
    case 'notesFromList':
      return { ...ui, view: 'list', listTab: 'all', listOpen: 't6' };
    case 'notesAdd':
      return lina({ kind: 'together', search: 'Ross' });
    case 'notesBlank':
      return lina({ errors: { kind: NW.chooseKind, guest: NW.chooseGuest } });
    case 'notesSame':
      return lina({
        kind: 'apart',
        search: 'Imran',
        guest: 'Imran Khan',
        errors: { guest: noteSay(NW.same, { name: 'Lina Haddad', other: 'Imran Khan' }) },
      });
    case 'notesReplace': {
      const old = notes.list[0]!;

      return lina({ kind: 'together', search: 'Imran', guest: 'Imran Khan', asking: old });
    }
    case 'notesNoMatch':
      return lina({ kind: 'together', search: 'Femi Adebayo' });
    case 'notesLive':
      return { ...ui, notes: { ...notes, shown: 'notes', live: true }, people: [PRIYA] };
    case 'notesReadOnly':
      return { ...ui, readOnly: true, people: [YOU, PRIYA] };
  }
}
