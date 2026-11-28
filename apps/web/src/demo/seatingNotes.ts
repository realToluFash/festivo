import { demoWords } from './demoWords.ts';
import type { Item, Party, Plan } from './seating.ts';
import { SW } from './seatingWords.ts';

/** sc-1364's English, from its AC (28 Nov) and the 19 Oct boards (`Main.dc.html`, Seating notes · desk web); [en] owns every word. */
export const NOTE_WORDS = {
  without: 'Without a seat',
  notes: 'Notes',
  lists: 'Without a seat or notes',
  brokenCount_one: '1 broken note',
  brokenCount_other: '{{count}} broken notes',
  nothingBroken: 'No note is broken.',
  nothingBrokenLine:
    'Every note is kept, or waits for a guest without a seat. Open a guest’s notes from Without a seat, a chair or the List.',
  noNotes: 'No notes yet.',
  noNotesLine:
    'A note says who sits together, or not at the same table. Open a guest’s notes from Without a seat, a chair or the List.',
  allNotes_one: '1 note in all',
  allNotes_other: '{{count}} notes in all',
  together: 'Together with',
  apart: 'Not at the same table as',
  togetherShort: 'Together',
  apartShort: 'Apart',
  brokenApart: 'Apart: {{a}} and {{b}} are both at {{table}}.',
  brokenTogether: 'Together: {{a}} is at {{tableA}} and {{b}} is at {{tableB}}.',
  tagMany_one: '1 note',
  tagMany_other: '{{count}} notes',
  openNotes: 'Notes',
  openNotesFor_one: 'Notes for {{name}}, 1 note',
  openNotesFor_other: 'Notes for {{name}}, {{count}} notes',
  private: 'Seen only by people who can manage seating. Never printed or shared.',
  atTable: 'At {{table}}',
  noSeat: 'Without a seat',
  kept: 'Kept',
  broken: 'Broken',
  waiting: 'Not seated yet',
  remove: 'Remove',
  removeFor: 'Remove the note with {{name}}',
  noGuestNotes: 'No notes for {{name}} yet.',
  addNote: 'Add a note',
  kind: 'Kind',
  guest: 'Guest',
  searchGuests: 'Search guests',
  chooseKind: 'Choose a kind of note.',
  chooseGuest: 'Choose a guest.',
  noMatch: 'No guest matches “{{q}}”.',
  noMatchLine: 'Only guests on this event’s guest list can be chosen.',
  more_one: '1 more guest matches. Search to narrow the list.',
  more_other: '{{count}} more guests match. Search to narrow the list.',
  same: '{{name}} already has this note with {{other}}.',
  cancel: 'Cancel',
  add: 'Add note',
  replaceTitle: 'Replace the note?',
  replaceLine:
    '{{name}} and {{other}} already have the note “{{old}}”. Two guests hold one note, so “{{new}}” replaces it.',
  replace: 'Replace',
  added: 'Note added: {{kind}} {{other}}.',
  replaced: 'Note replaced: {{kind}} {{other}}.',
  removed: 'Note removed: {{kind}} {{other}}.',
  keptOld: 'The note is unchanged: {{kind}} {{other}}.',
  movedBy: '{{who}} moved {{name}} to {{table}}.',
  mended_one: '1 note is no longer broken.',
  mended_other: '{{count}} notes are no longer broken.',
  showTable: 'Show {{table}}',
} as const;

export const NW = NOTE_WORDS;

const WORDS = demoWords(NOTE_WORDS);

export const { filled: say, many } = WORDS;

export type NoteKind = 'together' | 'apart';
export type NoteState = 'kept' | 'broken' | 'waiting';

export interface SeatNote {
  id: string;
  kind: NoteKind;
  a: string;
  b: string;
}

export interface NoteDraft {
  kind: NoteKind | null;
  search: string;
  guest: string | null;
  errors: { kind?: string | undefined; guest?: string | undefined };
  /** The other kind already joins the two: Replace swaps it, Cancel keeps it. */
  asking: SeatNote | null;
}

export interface Notes {
  list: SeatNote[];
  shown: 'without' | 'notes';
  guest: string | null;
  draft: NoteDraft | null;
  live: boolean;
  said: string | null;
}

export const NO_NOTES: Notes = {
  list: [],
  shown: 'without',
  guest: null,
  draft: null,
  live: false,
  said: null,
};

export const EMPTY_DRAFT: NoteDraft = {
  kind: null,
  search: '',
  guest: null,
  errors: {},
  asking: null,
};

export function sampleNotes(): SeatNote[] {
  return [
    { id: 'n1', kind: 'apart', a: 'Lina Haddad', b: 'Imran Khan' },
    { id: 'n2', kind: 'together', a: 'Leila Haddad', b: 'Lina Haddad' },
    { id: 'n3', kind: 'apart', a: 'Tola Bakare', b: 'Amara Diallo' },
    { id: 'n4', kind: 'together', a: 'Inês Duarte', b: 'Lucía Ortega' },
  ];
}

export function kindWords(kind: NoteKind): string {
  return kind === 'together' ? NW.together : NW.apart;
}

export function shortWords(kind: NoteKind): string {
  return kind === 'together' ? NW.togetherShort : NW.apartShort;
}

/** The item a guest's own seat is on. A seat held for a companion has nobody's name on it, so it never counts. */
export function seatOf(plan: Plan, name: string): Item | null {
  return (
    plan.items.find((item) =>
      item.chairs.some((chair) => chair.state === 'taken' && chair.who === name),
    ) ?? null
  );
}

/** A row and a single seat count as a table, as each has its own card on Tables (sc-4003). */
export function stateOf(plan: Plan, note: SeatNote): { state: NoteState; tables: Item[] } {
  const a = seatOf(plan, note.a);
  const b = seatOf(plan, note.b);

  if (a == null || b == null) return { state: 'waiting', tables: [] };
  const same = a.id === b.id;
  const broken = note.kind === 'apart' ? same : !same;

  return { state: broken ? 'broken' : 'kept', tables: same ? [a] : [a, b] };
}

export interface Broken {
  note: SeatNote;
  tables: Item[];
  words: string;
}

export function brokenWords(note: SeatNote, tables: readonly Item[]): string {
  const [one, two] = tables;

  if (note.kind === 'apart')
    return say(NW.brokenApart, { a: note.a, b: note.b, table: one?.name ?? '' });
  return say(NW.brokenTogether, {
    a: note.a,
    b: note.b,
    tableA: one?.name ?? '',
    tableB: two?.name ?? '',
  });
}

export function brokenNotes(plan: Plan, notes: readonly SeatNote[]): Broken[] {
  return notes.flatMap((note) => {
    const { state, tables } = stateOf(plan, note);

    return state === 'broken' ? [{ note, tables, words: brokenWords(note, tables) }] : [];
  });
}

export function brokenAt(plan: Plan, notes: readonly SeatNote[], id: string): Broken[] {
  return brokenNotes(plan, notes).filter((one) => one.tables.some((item) => item.id === id));
}

export function tagWords(broken: readonly Broken[]): string {
  const [first] = broken;

  if (broken.length === 1 && first != null) return shortWords(first.note.kind);
  return many('tagMany', broken.length);
}

export function notesOf(notes: readonly SeatNote[], name: string): SeatNote[] {
  return notes.filter((note) => note.a === name || note.b === name);
}

export function otherIn(note: SeatNote, name: string): string {
  return note.a === name ? note.b : note.a;
}

function plain(text: string): string {
  return text
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('en');
}

/** Every guest and named companion on the guest list, whatever their reply and seated or not, never the guest themselves nor an unnamed companion place. */
export function offered(plan: Plan, tray: readonly Party[], self: string): string[] {
  const seated = plan.items.flatMap((item) =>
    item.chairs.flatMap((chair) =>
      chair.state === 'taken' && chair.who != null ? [chair.who] : [],
    ),
  );
  const waiting = tray.flatMap((party) => [
    ...(party.behind === true ? [] : [party.name]),
    ...party.companions,
  ]);

  return [...new Set([...seated, ...waiting])]
    .filter((name) => name !== self && !isUnnamed(name))
    .sort((x, y) => x.localeCompare(y, 'en'));
}

export function matching(names: readonly string[], search: string): string[] {
  const q = plain(search.trim());

  return q === '' ? [...names] : names.filter((name) => plain(name).includes(q));
}

export type Adding =
  | { kind: 'added'; list: SeatNote[]; note: SeatNote }
  | { kind: 'same'; old: SeatNote }
  | { kind: 'replace'; old: SeatNote };

function between(note: SeatNote, x: string, y: string): boolean {
  return (note.a === x && note.b === y) || (note.a === y && note.b === x);
}

/** Two guests hold at most one note: the same kind again is refused, the other kind asks before it replaces. */
export function adding(
  list: readonly SeatNote[],
  self: string,
  other: string,
  kind: NoteKind,
  id: string,
): Adding {
  const old = list.find((note) => between(note, self, other));

  if (old?.kind === kind) return { kind: 'same', old };
  if (old != null) return { kind: 'replace', old };
  const note: SeatNote = { id, kind, a: self, b: other };

  return { kind: 'added', list: [...list, note], note };
}

export function replacing(
  list: readonly SeatNote[],
  old: SeatNote,
  kind: NoteKind,
  self: string,
): SeatNote[] {
  return list.map((note) =>
    note.id === old.id ? { ...note, kind, a: self, b: otherIn(old, self) } : note,
  );
}

export function removing(list: readonly SeatNote[], id: string): SeatNote[] {
  return list.filter((note) => note.id !== id);
}

export const NOTE_KEYS = [
  'notesSeat',
  'notesList',
  'notesNone',
  'notesEmpty',
  'notesShown',
  'notesTables',
  'notesGuest',
  'notesChair',
  'notesTableGuests',
  'notesFromList',
  'notesAdd',
  'notesBlank',
  'notesSame',
  'notesReplace',
  'notesNoMatch',
  'notesLive',
  'notesReadOnly',
] as const;

export type NoteStateKey = (typeof NOTE_KEYS)[number];

export function isNoteState(value: string | null): value is NoteStateKey {
  return NOTE_KEYS.some((key) => key === value);
}

export const NOTE_GROUP = 'Seating notes (sc-1364)';

export const NOTE_STATES: Readonly<Record<NoteStateKey, string>> = {
  notesSeat: 'Seat: Without a seat beside Notes 2, the tags on the plan',
  notesList: 'Notes: the two broken notes',
  notesNone: 'Notes: nothing broken',
  notesEmpty: 'Notes: no notes yet',
  notesShown: 'Notes: an entry chosen, its table shown',
  notesTables: 'The Tables view: the tag on Table 6 and Table 8',
  notesGuest: 'A guest’s notes, from Without a seat',
  notesChair: 'A chair chosen on the plan: Notes for its guest',
  notesTableGuests: 'Tables: a table’s guests, each with Notes',
  notesFromList: 'The List, Table 6 opened: Notes on each guest',
  notesAdd: 'Adding a note: the kind, then the guest',
  notesBlank: 'Add note with nothing chosen',
  notesSame: 'The same note again, refused',
  notesReplace: 'The other kind: Replace or Cancel',
  notesNoMatch: 'A guest search that matches nobody',
  notesLive: 'A colleague’s move mends a note',
  notesReadOnly: 'Without Manage seating: no tags, no Notes',
};

export function brokenByTable(plan: Plan, notes: readonly SeatNote[]): Map<string, Broken[]> {
  const byTable = new Map<string, Broken[]>();

  for (const one of brokenNotes(plan, notes))
    for (const item of one.tables) byTable.set(item.id, [...(byTable.get(item.id) ?? []), one]);
  return byTable;
}

export function nextId(list: readonly SeatNote[]): string {
  const taken = list.map((note) => Number(note.id.slice(1))).filter(Number.isFinite);

  return `n${Math.max(0, ...taken) + 1}`;
}

export function tablesWords(tables: readonly Item[]): string {
  return tables.map((item) => item.name).join(' · ');
}

export function noteTags(
  plan: Plan,
  notes: readonly SeatNote[],
): Map<string, { tag: string; words: string }> {
  return new Map(
    [...brokenByTable(plan, notes)].map(([id, broken]) => [
      id,
      { tag: tagWords(broken), words: broken.map((one) => one.words).join(' ') },
    ]),
  );
}

/** ?state=notesLive: the colleague moves a guest into a free chair at another table, as a save arriving over Mercure would. */
export function movedInto(plan: Plan, name: string, to: string): Plan {
  const free = plan.items
    .find((item) => item.id === to)
    ?.chairs.findIndex((c) => c.state === 'empty');

  if (free == null || free < 0) return plan;
  return {
    ...plan,
    items: plan.items.map((item) => ({
      ...item,
      chairs: item.chairs.map((chair, index) =>
        item.id === to && index === free
          ? { state: 'taken', who: name }
          : chair.state === 'taken' && chair.who === name
            ? { state: 'empty' }
            : chair,
      ),
    })),
  };
}

export const LIVE_MOVE = { name: 'Leila Haddad', to: 't6' } as const;

/** The API refuses a note on an unnamed companion place, and two of one guest's places share a label, so neither is offered nor given Notes. */
export function isUnnamed(name: string): boolean {
  const [before = '', after = ''] = SW.guestOf.split('{{name}}');

  return (
    name.length > before.length + after.length && name.startsWith(before) && name.endsWith(after)
  );
}
