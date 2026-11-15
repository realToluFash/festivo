import {
  type GroupFilter,
  type GuestGroup,
  WEDDING_GROUPS,
  groupNameOf,
  groupedWedding,
  withGroup,
} from './guestGroups.ts';
import { type Removed, arrivedIn, putBack, staysBecause } from './guestRemove.ts';
import { type Choice, type Guest, type ListView, WEDDING, sampleGuests } from './guests.ts';
import { MOST_AT_ONCE } from './guestsMark.ts';
import { figure } from './guestsWords.ts';
import type { DemoLink } from './settings.ts';

const LIST = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

function counted(count: number, one: string, many: string): string {
  return `${figure(count)} ${count === 1 ? one : many}`;
}

const guests = (count: number) => counted(count, 'guest', 'guests');
const companions = (count: number) => counted(count, 'companion', 'companions');
const haveArrived = (names: readonly string[]) =>
  `${LIST.format(names)} ${names.length === 1 ? 'has' : 'have'} arrived`;

/** sc-3776's English, kept in the demo; [en] owns the words and the developer puts them in the four locales. */
export const MMW = {
  heldNote: 'Companions are selected with their guest, on the All tab.',
  markTheirOwn: 'Mark as invited is sc-46880’s, in its own demo at /demo/guests/select.',
  cleared: 'Selection cleared.',
  clearedWhy: 'The list changed, so nothing hidden stays selected.',
  groupTitle: (count: number) =>
    count === 1 ? 'Add 1 guest to a group' : `Add ${figure(count)} guests to a group`,
  groupLine: 'Their companions go with them.',
  groupList: 'Groups on this event',
  people: (count: number) => counted(count, 'person', 'people'),
  newGroup: 'New group',
  groupName: 'Name of the new group',
  chooseOne: 'Choose a group, or make a new one.',
  moved: (count: number, group: string) => `${figure(count)} moved to ${group}.`,
  alreadyIn: (count: number, group: string) =>
    count === 1 ? `1 was already in ${group}.` : `${figure(count)} were already in ${group}.`,
  removedMeanwhile: (count: number) => `${figure(count)} not changed: someone else removed them.`,
  removeTitle: (count: number, with_: number) =>
    with_ === 0
      ? `Remove ${guests(count)}?`
      : `Remove ${guests(count)} and their ${companions(with_)}?`,
  replied: (count: number) =>
    count === 1
      ? '1 of them has replied. Their reply goes too.'
      : `${figure(count)} of them have replied. Their replies go too.`,
  companionsGo: (count: number) =>
    count === 1 ? '1 companion goes with them.' : `${figure(count)} companions go with them.`,
  stays: (names: readonly string[]) => `${haveArrived(names)}, so they stay on the list.`,
  nothingSent: 'Nothing is sent to them.',
  keep: 'Keep on the list',
  go: (count: number) => `Remove ${figure(count)}`,
  nothingToRemove: 'Nothing removed.',
  removed: (count: number, with_: number) =>
    with_ === 0
      ? `${guests(count)} removed.`
      : `${guests(count)} and ${companions(with_)} removed.`,
  notChangedArrived: (names: readonly string[]) =>
    `${figure(names.length)} not changed: ${haveArrived(names)}.`,
  undoNote: 'Undo puts them all back as they were.',
  undoOpen: 'Undo is open for 10 seconds.',
  undone: (count: number) =>
    count === 1
      ? '1 guest is back on the list, as they were.'
      : `${guests(count)} are back on the list, as they were.`,
  viewOnly: 'You can see the list. Selecting guests is for people who manage guests.',
} as const;

/** The group a move goes to: one of the event's, or a new one named in the sheet (sc-3775's rules). */
export type Target = { id: string } | { name: string };

export type Action = { kind: 'move'; to: Target } | { kind: 'remove' };

export type Line =
  | { kind: 'moved'; moved: number; already: number; removed: number; group: string }
  | { kind: 'removed'; guests: number; companions: number; stayed: string[] }
  | { kind: 'nothingRemoved'; stayed: string[] }
  | { kind: 'undone'; guests: number }
  | { kind: 'failed'; action: Action };

export function lineWords(line: Line): string[] {
  switch (line.kind) {
    case 'moved':
      return [
        ...(line.moved > 0 ? [MMW.moved(line.moved, line.group)] : []),
        ...(line.already > 0 ? [MMW.alreadyIn(line.already, line.group)] : []),
        ...(line.removed > 0 ? [MMW.removedMeanwhile(line.removed)] : []),
      ];
    case 'removed':
      return [
        MMW.removed(line.guests, line.companions),
        ...(line.stayed.length > 0 ? [MMW.notChangedArrived(line.stayed)] : []),
        MMW.undoNote,
      ];
    case 'nothingRemoved':
      return [MMW.nothingToRemove, MMW.stays(line.stayed)];
    case 'undone':
      return [MMW.undone(line.guests)];
    case 'failed':
      return ['Nothing changed. We could not reach Soirely.'];
  }
}

/** The guests a list shows as their own rows: the ones a box selects. A companion's row has none, since they follow their guest. */
export function shownGuests(view: ListView): string[] {
  const rows = view.kind === 'groups' ? view.groups.flatMap((group) => group.rows) : view.rows;

  return rows.filter((row) => row.person.companion == null).map((row) => row.person.id);
}

/** True when the list shows rows but none of them a guest's, as on the Held tab: the note says where companions are selected. */
export function onlyCompanions(view: ListView): boolean {
  const rows = view.kind === 'groups' ? view.groups.flatMap((group) => group.rows) : view.rows;

  return rows.length > 0 && rows.every((row) => row.person.companion != null);
}

function chosen(list: readonly Guest[], selected: ReadonlySet<string>): Guest[] {
  return list.filter((one) => selected.has(one.id));
}

export function over(count: number): boolean {
  return count > MOST_AT_ONCE;
}

/** One move, many guests, all-or-nothing for those it can move; one removed meanwhile is left out and counted, one already there is counted too. */
export function moveMany(
  list: readonly Guest[],
  selected: ReadonlySet<string>,
  groups: readonly GuestGroup[],
  id: string,
  meanwhile: readonly string[] = [],
): { list: Guest[]; line: Line } {
  const gone = new Set(meanwhile);
  const after = list.filter((one) => !gone.has(one.id));
  const picked = chosen(after, selected);
  const already = picked.filter((one) => one.group === id).length;

  return {
    list: after.map((one) => (selected.has(one.id) ? withGroup(one, id) : one)),
    line: {
      kind: 'moved',
      moved: picked.length - already,
      already,
      removed: [...selected].filter((one) => gone.has(one)).length,
      group: groupNameOf(groups, id) ?? '',
    },
  };
}

export interface RemoveQuestion {
  goes: number;
  companions: number;
  replied: number;
  stays: string[];
}

/** What Remove from the list asks: {n} counts only the guests it can remove; who has arrived (or whose companion has) is named and stays (sc-1454). */
export function removeQuestion(
  list: readonly Guest[],
  selected: ReadonlySet<string>,
): RemoveQuestion {
  const picked = chosen(list, selected);
  const goes = picked.filter((one) => staysBecause(one) == null);

  return {
    goes: goes.length,
    companions: goes.reduce((sum, one) => sum + one.companions.length, 0),
    replied: goes.filter((one) => one.reply !== 'noReply' && one.reply !== 'notYet').length,
    stays: picked.filter((one) => staysBecause(one) != null).map((one) => one.name),
  };
}

/** sc-3774's remove for each guest it can remove, as one action with one Undo; the arrived stay and are named. */
export function removeMany(
  list: readonly Guest[],
  selected: ReadonlySet<string>,
): { list: Guest[]; removed: Removed[]; line: Line } {
  const asked = removeQuestion(list, selected);

  if (asked.goes === 0)
    return { list: [...list], removed: [], line: { kind: 'nothingRemoved', stayed: asked.stays } };
  const removed = list.flatMap((guest, at) =>
    selected.has(guest.id) && staysBecause(guest) == null ? [{ guest, at }] : [],
  );
  const gone = new Set(removed.map((one) => one.guest.id));

  return {
    list: list.filter((one) => !gone.has(one.id)),
    removed,
    line: {
      kind: 'removed',
      guests: asked.goes,
      companions: asked.companions,
      stayed: asked.stays,
    },
  };
}

/** Undo puts every guest back where they were, in the order they were taken. */
export function undoMany(list: readonly Guest[], removed: readonly Removed[]): Guest[] {
  return [...removed]
    .sort((a, b) => a.at - b.at)
    .reduce((now, one) => putBack(now, one), [...list]);
}

export const NEW_GROUP = 'new';

export interface Sheet {
  pick: string | null;
  typed: string;
  tried: boolean;
}

export interface ManyStart {
  list: Guest[];
  groups: GuestGroup[];
  manages: boolean;
  choice: Choice;
  q: string;
  groupFilter: GroupFilter | null;
  selected: string[];
  pretend: number | null;
  cleared: boolean;
  sheet: Sheet | null;
  asking: boolean;
  line: Line | null;
  undo: Removed[] | null;
  meanwhile: string[];
}

export const MANY_STATES = [
  { key: 'none', name: 'Nothing selected: a box on each guest, Select all shown' },
  { key: 'some', name: 'Some selected: the bar, and the companions with them' },
  { key: 'all', name: 'Every guest shown selected' },
  { key: 'held', name: 'The Held tab: companions only, the note, no boxes' },
  { key: 'searched', name: 'Searched: Select all counts only the guests found' },
  { key: 'filtered', name: 'Filtered by Work: all of it selected' },
  { key: 'cleared', name: 'Selection cleared by a search' },
  { key: 'noMatch', name: 'No guests match' },
  { key: 'group', name: 'Add to group: the sheet of groups, nothing chosen' },
  { key: 'groupBlank', name: 'Add to group with nothing chosen' },
  { key: 'newGroup', name: 'Add to group: New group, named' },
  { key: 'newGroupBlank', name: 'New group left blank: Enter a name for the group' },
  { key: 'moved', name: 'Moved: 3 moved to Bride’s side' },
  { key: 'movedAlready', name: 'Partly moved: 1 was already in Bride’s side' },
  { key: 'movedRemoved', name: 'Partly moved: 1 not changed, someone else removed them' },
  { key: 'remove', name: 'Remove from the list: the question, an arrived guest named' },
  { key: 'removeNoCompanions', name: 'Remove from the list: no companions, the clause dropped' },
  { key: 'removed', name: 'Removed, with Undo for 10 seconds' },
  {
    key: 'removedAll',
    name: 'Everyone removed: Undo above the empty event, Add guest on the card (sc-50772)',
  },
  {
    key: 'removedAllFiltered',
    name: 'Everyone removed with a group filter on: Undo turns it back on, a save clears it (sc-50772)',
  },
  { key: 'undone', name: 'Undone: back on the list, as they were' },
  { key: 'nothingRemoved', name: 'Only arrived guests selected: nothing removed' },
  { key: 'failed', name: 'Not saved: Nothing changed, with Try again' },
  { key: 'over', name: 'Over 2,000 selected: the narrowing line' },
  { key: 'viewOnly', name: 'Without guests.manage: no boxes and no bar' },
] as const;

export type ManyState = (typeof MANY_STATES)[number]['key'];

export function manyStateOf(raw: string | null): ManyState {
  return MANY_STATES.find((one) => one.key === raw)?.key ?? 'none';
}

export const MANY_AT = '/demo/guests/many';

export const MANY_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'Select many guests: Add to group, Remove from the list · sc-3776 · desk and 320',
    states: MANY_STATES.map((one) => ({ to: `${MANY_AT}?state=${one.key}`, name: one.name })),
  },
];

const SOME = ['sophie', 'tomas', 'nadia', 'seun'];
const NO_COMPANIONS = ['tomas', 'nadia', 'seun'];
const REMOVING = ['kwame', 'tomas', 'nadia', 'sophie'];
const ARRIVED = 'kwame';

export function manyStart(state: ManyState): ManyStart {
  const list = groupedWedding(sampleGuests(WEDDING));
  const groups = [...WEDDING_GROUPS];
  const start: ManyStart = {
    list,
    groups,
    manages: true,
    choice: 'all',
    q: '',
    groupFilter: null,
    selected: [],
    pretend: null,
    cleared: false,
    sheet: null,
    asking: false,
    line: null,
    undo: null,
    meanwhile: [],
  };
  const some = { ...start, selected: SOME };
  const arrived = arrivedIn(list, ARRIVED, '18:05');

  switch (state) {
    case 'none':
      return start;
    case 'some':
      return some;
    case 'all':
      return { ...start, selected: list.map((one) => one.id) };
    case 'held':
      return { ...start, choice: 'held' };
    case 'searched':
      return { ...start, q: 'Tomás', selected: ['tomas'] };
    case 'filtered':
      return {
        ...start,
        groupFilter: 'g-work',
        selected: list.filter((one) => one.group === 'g-work').map((one) => one.id),
      };
    case 'cleared':
      return { ...start, q: 'Okon', cleared: true };
    case 'noMatch':
      return { ...start, q: 'Zainab' };
    case 'group':
      return { ...some, sheet: { pick: null, typed: '', tried: false } };
    case 'groupBlank':
      return { ...some, sheet: { pick: null, typed: '', tried: true } };
    case 'newGroup':
      return { ...some, sheet: { pick: NEW_GROUP, typed: 'Cousins', tried: false } };
    case 'newGroupBlank':
      return { ...some, sheet: { pick: NEW_GROUP, typed: '', tried: true } };
    case 'moved': {
      const done = moveMany(list, new Set(SOME), groups, 'g-bride');

      return { ...start, list: done.list, line: done.line };
    }
    case 'movedAlready': {
      const done = moveMany(list, new Set([...SOME, 'emeka']), groups, 'g-bride');

      return { ...start, list: done.list, line: done.line };
    }
    case 'movedRemoved': {
      const done = moveMany(list, new Set([...SOME, 'joaquin']), groups, 'g-bride', ['joaquin']);

      return { ...start, list: done.list, line: done.line };
    }
    case 'remove':
      return { ...start, list: arrived, selected: REMOVING, asking: true };
    case 'removeNoCompanions':
      return { ...start, selected: NO_COMPANIONS, asking: true };
    case 'removed': {
      const done = removeMany(arrived, new Set(REMOVING));

      return { ...start, list: done.list, line: done.line, undo: done.removed };
    }
    case 'removedAll': {
      const done = removeMany(list, new Set(list.map((one) => one.id)));

      return { ...start, list: done.list, line: done.line, undo: done.removed };
    }
    case 'removedAllFiltered': {
      const work = list.filter((one) => one.group === 'g-work');
      const done = removeMany(work, new Set(work.map((one) => one.id)));

      return {
        ...start,
        list: done.list,
        groupFilter: 'g-work',
        line: done.line,
        undo: done.removed,
      };
    }
    case 'undone':
      return { ...start, list: arrived, line: { kind: 'undone', guests: REMOVING.length - 1 } };
    case 'nothingRemoved':
      return {
        ...start,
        list: arrived,
        selected: [ARRIVED],
        line: { kind: 'nothingRemoved', stayed: ['Kwame Mensah'] },
      };
    case 'failed':
      return {
        ...some,
        line: { kind: 'failed', action: { kind: 'move', to: { id: 'g-bride' } } },
      };
    case 'over':
      return { ...start, selected: list.map((one) => one.id), pretend: 2140 };
    case 'viewOnly':
      return { ...start, manages: false };
  }
}
