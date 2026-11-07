import { type Action, reduce } from './SeatingActs.ts';
import { type Point, free } from './SeatingGeometry.ts';
import {
  type Layout,
  NO_FIELDS,
  type Seating,
  type SeatingState,
  itemOf,
  partySize,
} from './SeatingModel.ts';
import {
  COLOURS,
  FOLAKE,
  type Item,
  PRIYA,
  ROOM,
  SADE,
  SECTIONS,
  SIX,
  sampleItems,
  sampleTray,
} from './SeatingSample.ts';
import { W, say } from './SeatingWords.ts';

const BOTH = [PRIYA, SADE];

export function blank(layout: Layout): Seating {
  const day = layout === 'phone';
  return {
    layout,
    load: 'ready',
    day,
    readOnly: false,
    offline: false,
    units: 'metric',
    room: ROOM,
    items: sampleItems(day),
    sections: [...SECTIONS],
    tray: sampleTray(day),
    view: 'Floor plan',
    tab: 'Arrange',
    arrange: 'room',
    sectionKey: null,
    chosen: null,
    chair: null,
    several: [],
    picked: null,
    lit: [],
    bar: null,
    undo: null,
    undoRefuses: false,
    save: 'saved',
    people: [PRIYA],
    presence: 'chips',
    rings: {},
    ask: null,
    pop: null,
    sheet: null,
    fields: NO_FIELDS,
    start: { name: '', width: '', length: '', errors: {} },
    roomDraft: { name: ROOM.name, width: '24', length: '18', error: null },
    outside: [],
    wallAt: null,
    sectionForm: { name: '', colour: 'Blue', error: null },
    zoom: null,
    shown: null,
    size: null,
    ghost: null,
    tip: null,
    placing: null,
    placeAnother: true,
    snap: true,
    listTab: 'With space',
    listOpen: null,
    tableFilter: null,
    trayOpen: false,
    search: '',
    group: null,
    showNotYet: false,
    paper: 'A4',
    preparing: null,
    printFailed: null,
    refreshing: false,
    spoken: null,
    guest: null,
    held: true,
  };
}

const run = (m: Seating, ...actions: Action[]): Seating => ({
  ...actions.reduce(reduce, m),
  held: true,
});

function moved(m: Seating, id: string, change: Partial<Item>): Seating {
  return { ...m, items: m.items.map((it) => (it.id === id ? { ...it, ...change } : it)) };
}

function added(
  m: Seating,
  it: Partial<Item> & Pick<Item, 'id' | 'kind' | 'name'>,
  seats: number,
): Seating {
  const base = itemOf(m, 't10') as Item;
  const one: Item = {
    ...base,
    d: 0,
    w: 0,
    l: 0,
    ends: 0,
    spacing: 0,
    rot: 0,
    label: '',
    sec: null,
    x: 1200,
    y: 1440,
    chairs: Array.from({ length: seats }, () => ({ state: 'empty', who: null })),
    ...it,
  };
  return { ...m, items: [...m.items, one] };
}

const at = (s: number, x: number, y: number): { s: number; centre: Point } => ({
  s,
  centre: { x, y },
});

function chosen(m: Seating, id: string, extra: Partial<Seating> = {}): Seating {
  return { ...m, chosen: id, tab: 'Arrange', ...extra };
}

function field(m: Seating, key: string, draft: string, error: string | null): Seating {
  return {
    ...m,
    fields: {
      ...m.fields,
      drafts: { [key]: draft },
      errors: error == null ? {} : { [key]: error },
      focus: key,
    },
  };
}

/** Everyone coming seated: each party at the first table with room for all of it. */
function seatEveryone(m: Seating): Seating {
  return m.tray.reduce((now, party) => {
    const table = now.items.find(
      (it) => it.kind !== 'row' && it.kind !== 'single' && free(it) >= partySize(party),
    );
    return table == null
      ? now
      : run(now, { type: 'pick', id: party.id }, { type: 'seatAt', id: table.id });
  }, m);
}

function settled(m: Seating): Seating {
  return { ...m, undo: null, bar: null, lit: [], save: 'saved', held: true };
}

function tablet(state: SeatingState, b: Seating): Seating {
  const t10Down = moved(b, 't10', { y: 1380 });
  const seat = { ...b, tab: 'Seat' as const };
  const kwame = run(seat, { type: 'pick', id: 'kwame' });
  const lucia = run(seat, { type: 'pick', id: 'lucia' });
  const kwameSeated = run(kwame, { type: 'seatAt', id: 't8' });
  const room = run(b, { type: 'arrange', shows: 'roomSettings' });
  const stageEdit = run(b, { type: 'arrange', shows: 'sectionEdit', key: 'stage' });
  const rowB = added(
    b,
    { id: 'rowB', kind: 'row', name: 'Row B', label: 'B', x: 1590, spacing: 50 },
    10,
  );
  const seat1 = added(b, { id: 'seat1', kind: 'single', name: 'Seat 1' }, 1);
  const t11 = added(b, { id: 't11', kind: 'round', name: 'Table 11', d: 180 }, 10);
  const three = (y: number) => ['t6', 't7', 't8'].reduce((m, id) => moved(m, id, { y }), b);
  switch (state) {
    case 'noPlan':
      return { ...b, load: 'noPlan', people: [] };
    case 'startBlank':
    case 'startRange':
      return {
        ...b,
        load: 'start',
        people: [],
        start:
          state === 'startBlank'
            ? { name: ROOM.name, width: '24', length: '', errors: { length: W.enterLength } }
            : { name: ROOM.name, width: '24', length: '1.5', errors: { length: W.roomRange } },
      };
    case 'newPlan':
      return {
        ...b,
        items: [],
        sections: [],
        people: [],
        bar: { kind: 'tint', words: W.firstTable },
      };
    case 'loading':
    case 'failed':
      return { ...b, load: state, people: [] };
    case 'readOnly':
      return { ...b, readOnly: true, people: [FOLAKE] };
    case 'offline':
      return {
        ...b,
        offline: true,
        people: [],
        bar: { kind: 'white', words: W.changesNeedConnection, glyph: 'offline' },
      };
    case 'zoomOut':
      return { ...b, zoom: at(0.2, 1200, 900) };
    case 'corner':
      return chosen(b, 't4', { chair: 8, zoom: at(1, 1785, 620) });
    case 'roomSettings':
      return room;
    case 'shrinkRefused':
      return run(room, { type: 'roomDraft', key: 'width', text: '20' }, { type: 'roomApply' });
    case 'deletePlan':
      return { ...room, ask: { kind: 'deletePlan' } };
    case 'roomChanged':
      return {
        ...room,
        people: BOTH,
        fields: { ...NO_FIELDS, changedBy: say.justChanged(PRIYA.name) },
      };
    case 'usCustomary':
      return field(
        chosen({ ...b, units: 'us' }, 't4'),
        'Across',
        '85′ 6″',
        say.outsideRoom('Table 4'),
      );
    case 'sectionAdd':
    case 'sectionTaken':
    case 'sectionBlank': {
      const form = run(b, { type: 'arrange', shows: 'sectionAdd' });
      const name = { sectionAdd: 'Window side', sectionTaken: 'Stage side', sectionBlank: '' }[
        state
      ];
      const typed = run(form, { type: 'sectionName', name });
      return state === 'sectionAdd' ? typed : run(typed, { type: 'sectionAdd' });
    }
    case 'sectionLimit': {
      const more = Array.from({ length: 27 }, (_, i) => ({
        key: `s${i + 4}`,
        name: `Section ${i + 4}`,
        colour: COLOURS[(i + 3) % COLOURS.length]?.[0] ?? 'Blue',
      }));
      return run(
        { ...b, sections: [...SECTIONS, ...more] },
        { type: 'arrange', shows: 'sectionAdd' },
      );
    }
    case 'sectionEdit':
      return {
        ...run(stageEdit, { type: 'sectionColour', colour: 'Wine' }),
        lit: ['t1', 't2', 't3', 't4', 't5'],
        save: 'saved',
      };
    case 'sectionDelete':
      return { ...stageEdit, ask: { kind: 'deleteSection', key: 'stage' } };
    case 'sparse':
      return {
        ...b,
        items: b.items.filter((it) => it.id === 't1'),
        sections: [SECTIONS[0] ?? { key: 'stage', name: 'Stage side', colour: 'Plum' }],
      };
    case 'addMenu':
      return { ...b, pop: { kind: 'addMenu' } };
    case 'placing':
      return {
        ...run(b, { type: 'startPlacing', kind: 'round' }),
        ghost: itemOf(t11, 't11'),
        save: 'saving',
      };
    case 'placed':
      return chosen(t11, 't11', { fields: { ...NO_FIELDS, added: say.added('Table 11') } });
    case 'rect':
      return chosen(b, 't9');
    case 'head':
      return chosen(b, 'top');
    case 'cocktail':
      return chosen(b, 'bar1');
    case 'shapeChanged':
      return settled(
        run(chosen(b, 't10'), { type: 'choose', field: 'Shape', value: 'Rectangular' }),
      );
    case 'squeeze':
      return settled(
        run(
          chosen(b, 't10'),
          { type: 'draft', key: 'Diameter', text: '150' },
          { type: 'apply', key: 'Diameter' },
        ),
      );
    case 'nameTaken':
      return run(
        chosen(b, 't10'),
        { type: 'draft', key: 'Name', text: 'Table 2' },
        { type: 'apply', key: 'Name' },
      );
    case 'belowSeated':
      return run(
        chosen(b, 't4'),
        { type: 'draft', key: 'Seats', text: '6' },
        { type: 'apply', key: 'Seats' },
      );
    case 'chair':
      return chosen(b, 't4', { chair: 8, zoom: at(0.75, 1590, 620) });
    case 'unusable':
      return settled(
        run(chosen(b, 't4', { chair: 8, zoom: at(0.75, 1590, 620) }), {
          type: 'mark',
          id: 't4',
          chair: 8,
        }),
      );
    case 'unusableRefused':
      return run(chosen(b, 't4', { chair: 1, zoom: at(0.75, 1590, 620) }), {
        type: 'mark',
        id: 't4',
        chair: 1,
      });
    case 'duplicated': {
      const copy = added(
        b,
        { ...(itemOf(b, 't4') as Item), id: 't11', name: 'Table 11', x: 1200, y: 1440 },
        10,
      );
      return chosen(copy, 't11', {
        fields: { ...NO_FIELDS, added: say.copied('Table 11', 'Table 4') },
      });
    }
    case 'deleteTable':
      return chosen(b, 't4', { ask: { kind: 'deleteItem', id: 't4' } });
    case 'deleteEmpty':
      return chosen(b, 't10', { ask: { kind: 'deleteItem', id: 't10' } });
    case 'tableChanged':
      return chosen(b, 't7', {
        people: BOTH,
        rings: { t7: PRIYA },
        fields: { ...NO_FIELDS, changedBy: say.tableChanged(PRIYA.name) },
      });
    case 'rowAdded':
      return chosen(rowB, 'rowB', { fields: { ...NO_FIELDS, added: say.rowAdded('B', 10) } });
    case 'rowTurned':
      return chosen(moved(b, 'rowA', { rot: 15 }), 'rowA', { chair: 3, zoom: at(1, 560, 1400) });
    case 'rowLabelTaken':
      return run(
        chosen(rowB, 'rowB'),
        { type: 'draft', key: 'Label', text: 'A' },
        { type: 'apply', key: 'Label' },
      );
    case 'rowBelowSeated':
      return run(
        chosen(b, 'rowA'),
        { type: 'draft', key: 'Seats', text: '3' },
        { type: 'apply', key: 'Seats' },
      );
    case 'deleteRow':
      return chosen(b, 'rowA', { ask: { kind: 'deleteItem', id: 'rowA' } });
    case 'seatAdded':
      return chosen(seat1, 'seat1', { fields: { ...NO_FIELDS, added: say.added('Seat 1') } });
    case 'seatNameTaken':
      return run(
        chosen(seat1, 'seat1'),
        { type: 'draft', key: 'Name', text: 'By the door' },
        { type: 'apply', key: 'Name' },
      );
    case 'drag':
      return chosen(t10Down, 't10', {
        ghost: itemOf(b, 't10'),
        zoom: at(0.5, 1800, 1200),
        tip: { words: say.where('19.80 m', '13.80 m'), at: { x: 1980, y: 1380 } },
        save: 'saving',
      });
    case 'resize':
      return chosen(moved(b, 't9', { w: 300 }), 't9', {
        zoom: at(0.5, 1590, 1020),
        tip: { words: say.widthTip(300), at: { x: 1740, y: 1020 } },
        save: 'saving',
      });
    case 'turn':
      return chosen(moved(b, 't9', { rot: 15 }), 't9', {
        zoom: at(0.5, 1590, 1020),
        save: 'saving',
      });
    case 'overlap':
      return chosen(moved(b, 't9', { x: 1440, rot: 15 }), 't9', {
        ghost: itemOf(b, 't9'),
        zoom: at(0.5, 1420, 1000),
      });
    case 'wall':
      return chosen(moved(b, 't5', { x: 2260 }), 't5', {
        zoom: at(0.5, 2050, 620),
        tip: { words: '22.60 m across', at: { x: 2260, y: 620 } },
        save: 'saving',
      });
    case 'acrossRefused':
      return run(
        chosen(b, 't5'),
        { type: 'draft', key: 'Across', text: '23.5' },
        { type: 'apply', key: 'Across' },
      );
    case 'keysUp':
      return field(chosen(b, 't5'), 'Across', '20.8', null);
    case 'saving':
      return chosen(t10Down, 't10', { save: 'saving' });
    case 'retrying':
    case 'notSaved':
      return chosen(t10Down, 't10', {
        save: state === 'retrying' ? 'retry' : 'failed',
        presence: 'reconnecting',
        people: [],
      });
    case 'stepRefused':
      return {
        ...three(980),
        several: ['t6', 't7', 't8'],
        rings: { t7: PRIYA },
        people: BOTH,
        bar: { kind: 'amber', words: say.stepRefused(PRIYA.name, 'Table 7') },
      };
    case 'presenceChose':
      return { ...b, rings: { t7: PRIYA } };
    case 'presenceBoth':
      return chosen(b, 't7', { rings: { t7: PRIYA }, people: BOTH });
    case 'presenceSix':
      return {
        ...b,
        people: [...SIX],
        rings: { t7: PRIYA, t2: SIX[2] ?? PRIYA, t9: SIX[3] ?? PRIYA },
        pop: { kind: 'people' },
      };
    case 'presenceViewer':
      return { ...b, people: BOTH, rings: { t2: SADE } };
    case 'reconnecting':
      return { ...b, presence: 'reconnecting', people: [] };
    case 'left':
      return { ...b, people: [SADE], spoken: say.left(PRIYA.name) };
    case 'arriving':
      return chosen(moved(b, 't9', { x: 1700, y: 1180 }), 't4', { rings: { t9: PRIYA } });
    case 'tapChooses':
      return chosen(b, 't4', { zoom: at(0.375, 1590, 820) });
    case 'seat':
      return seat;
    case 'picked':
      return { ...kwame, lit: ['t8'] };
    case 'seated':
      return { ...kwameSeated, held: true };
    case 'apart':
      return run(settled(kwameSeated), { type: 'pick', id: 'ines' }, { type: 'seatAt', id: 't9' });
    case 'full':
      return run(lucia, { type: 'seatAt', id: 't1' });
    case 'short':
      return run(seat, { type: 'pick', id: 'amaka' }, { type: 'seatAt', id: 't4' });
    case 'swap':
      return {
        ...lucia,
        zoom: at(0.75, 1590, 620),
        pop: { kind: 'swap', id: 't4', chair: 2 },
        lit: ['t4'],
      };
    case 'race':
      return { ...lucia, people: BOTH, bar: { kind: 'amber', words: say.race('Lucía Ortega') } };
    case 'undoRefused':
      return {
        ...kwameSeated,
        people: BOTH,
        lit: [],
        bar: { kind: 'amber', words: W.undidRefused },
        undo: null,
      };
    case 'tableGuests':
      return chosen(b, 't4', { tab: 'Seat' });
    case 'moveAll':
      return chosen(b, 't4', { tab: 'Seat', pop: { kind: 'moveAll', id: 't4' }, lit: ['t10'] });
    case 'emptyTable':
      return chosen(b, 't10', { tab: 'Seat' });
    case 'everyoneSeated':
      return settled(seatEveryone(seat));
    case 'noMatch':
      return { ...seat, search: 'Olu' };
    case 'notSureYet':
      return { ...seat, showNotYet: true };
    case 'tables':
      return { ...seat, view: 'Tables' };
    case 'tablesPicked':
      return { ...kwame, view: 'Tables', lit: ['t8'] };
    case 'list':
      return { ...seat, view: 'List' };
    case 'listOpen':
      return { ...kwame, view: 'List', listOpen: 't8' };
    default:
      return common(state, b);
  }
}

function common(state: SeatingState, b: Seating): Seating {
  const print = { ...b, sheet: { kind: 'print' as const } };
  switch (state) {
    case 'print':
      return print;
    case 'printPreparing':
      return { ...print, preparing: 'Table cards' };
    case 'printDone':
      return { ...b, bar: { kind: 'white', words: say.ready('Table cards'), glyph: 'tick' } };
    case 'printFailed':
      return { ...print, printFailed: 'Table cards' };
    case 'printReadOnly':
      return { ...print, readOnly: true, people: [FOLAKE] };
    case 'printOffline':
      return { ...print, offline: true, people: [] };
    case 'guestSeat':
      return { ...b, guest: 'seat' };
    case 'guestNoSeat':
      return { ...b, guest: 'noSeat' };
    default:
      return b;
  }
}

function phone(state: SeatingState, b: Seating): Seating {
  const open = { ...b, trayOpen: true };
  const picked = run(open, { type: 'pick', id: 'joaquin' });
  const seated = { ...run(picked, { type: 'seatAt', id: 't8' }), trayOpen: false };
  const t8 = { ...b, sheet: { kind: 'table' as const, id: 't8' } };
  switch (state) {
    case 'noPlan':
    case 'loading':
    case 'failed':
      return { ...b, load: state };
    case 'readOnly':
      return { ...b, readOnly: true };
    case 'offline':
      return { ...b, offline: true };
    case 'seat':
      return open;
    case 'picked':
      return picked;
    case 'seated':
      return seated;
    case 'undoRefused':
      return { ...seated, undo: null, bar: { kind: 'amber', words: W.undidRefused } };
    case 'full':
      return run({ ...picked, listTab: 'All' }, { type: 'seatAt', id: 'top' });
    case 'short':
      return run(picked, { type: 'seatAt', id: 't9' });
    case 'swap':
      return {
        ...picked,
        sheet: { kind: 'table', id: 't8' },
        ask: { kind: 'swap', id: 't8', chair: 7 },
      };
    case 'race':
      return { ...picked, bar: { kind: 'amber', words: say.race('Joaquín Ruiz') } };
    case 'tableGuests':
      return { ...t8, chair: 1 };
    case 'moveAll':
      return { ...b, sheet: { kind: 'move', id: 't8', chair: 1 }, chair: 1 };
    case 'emptyTable':
      return { ...b, sheet: { kind: 'table', id: 't10' } };
    case 'chair':
      return { ...t8, chair: 9 };
    case 'unusable':
      return { ...run({ ...t8, chair: 9 }, { type: 'mark', id: 't8', chair: 9 }), save: 'saved' };
    case 'unusableRefused':
      return run({ ...t8, chair: 0 }, { type: 'mark', id: 't8', chair: 0 });
    case 'everyoneSeated':
      return settled(seatEveryone(b));
    case 'noMatch':
      return { ...open, search: 'Olu' };
    case 'notSureYet':
      return { ...open, showNotYet: true };
    case 'refresh':
      return { ...b, refreshing: true };
    default:
      return common(state, b);
  }
}

/** The model a deep link opens on: the iPad's planning sample, or the iPhone's on the day (seating-a-spec §6). */
export function startOf(state: SeatingState | null, layout: Layout): Seating {
  const b = blank(layout);
  if (state == null || state === 'plan') return b;
  const m = layout === 'phone' ? phone(state, b) : tablet(state, b);
  return { ...m, held: true };
}
