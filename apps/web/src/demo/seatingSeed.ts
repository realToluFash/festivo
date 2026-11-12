import {
  type Colour,
  type Item,
  type Kind,
  type Party,
  type Person,
  type Plan,
  type Point,
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
  seatAt,
  sideBySide,
  usable,
  filled,
} from './seating.ts';

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
  presence: 'chips' | 'overflow' | 'reconnecting';
  onPlanOpen: boolean;
  rings: Record<string, Person>;
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
  unsure: boolean;
  search: string;
  groups: string[];
  hover: string | null;
  pop: Pop | null;
  undo: { plan: Plan; tray: Party[] } | null;
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
    unsure: false,
    search: '',
    groups: [],
    hover: null,
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

  switch (state) {
    case null:
    case 'plan':
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
          error: say(SW.shrinkRefused, { n: 3, width: '20 m', length: '18 m' }),
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
    case 'sectionDeleteEmpty':
      return {
        ...ui,
        plan: {
          ...plan,
          sections: [...plan.sections, { id: 'quiet', name: 'Quiet corner', colour: 'Blue' }],
          items: plan.items.map((item) => (item.id === 'rowA' ? { ...item, sec: 'quiet' } : item)),
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
        rings: { t7: PRIYA },
        people: [PRIYA, SADE],
        notice: { tone: 'amber', words: say(SW.tableChanged, { name: PRIYA.name }) },
      };
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
        rings: { t7: PRIYA },
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
      return { ...ui, rings: { t7: PRIYA } };
    case 'presenceBoth':
      return {
        ...ui,
        chosen: ['t7'],
        rings: { t7: PRIYA },
        people: [PRIYA, SADE],
        contest: { id: 't7', at: [810, 1120], by: PRIYA.name },
      };
    case 'presenceSix':
      return {
        ...ui,
        people: [...SIX],
        presence: 'overflow',
        onPlanOpen: true,
        rings: { t7: PRIYA, t2: SIX[2]!, t9: SIX[3]! },
      };
    case 'presenceViewer':
      return { ...ui, people: [PRIYA, SADE] };
    case 'reconnecting':
      return { ...ui, people: [], presence: 'reconnecting' };
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
  }
}
