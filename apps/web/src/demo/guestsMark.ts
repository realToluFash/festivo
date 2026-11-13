import { type Guest, WEDDING, markInvited, sampleGuests } from './guests.ts';
import { type HowInvited, figure, midSentence } from './guestsWords.ts';
import type { DemoLink } from './settings.ts';

/** sc-3776 limits every action in the bar to this many guests. */
export const MOST_AT_ONCE = 2000;
/** sc-46880 (Decided, 14 Nov): the dialog names at most five already invited, then "and {r} more". */
export const NAMED_MOST = 5;

function guests(count: number, one: string, many: string): string {
  return count === 1 ? one : many.replace('{n}', figure(count));
}

function names(all: readonly string[]): string {
  if (all.length > NAMED_MOST) {
    return `${all.slice(0, NAMED_MOST).join(', ')} and ${figure(all.length - NAMED_MOST)} more`;
  }
  if (all.length < 2) return all.join('');

  return `${all.slice(0, -1).join(', ')} and ${all.at(-1) ?? ''}`;
}

export const MW = {
  selectAll: (count: number) => `Select all ${figure(count)} shown`,
  select: (name: string) => `Select ${name}`,
  selected: (count: number) => `${figure(count)} selected`,
  withCompanions: (count: number) =>
    guests(count, 'and 1 companion with them', 'and {n} companions with them'),
  bar: 'Selected guests',
  markAsInvited: 'Mark as invited',
  addToGroup: 'Add to group',
  remove: 'Remove from the list',
  clear: 'Clear',
  title: (count: number) => guests(count, 'Mark 1 guest as invited', 'Mark {n} guests as invited'),
  already: (all: readonly string[]) =>
    all.length === 1
      ? `1 already invited, who stays as recorded: ${names(all)}.`
      : `${figure(all.length)} already invited, who stay as recorded: ${names(all)}.`,
  nothingToMark: (count: number) => `${figure(count)} already invited. Nothing to mark.`,
  marked: (count: number, how: HowInvited) =>
    `${figure(count)} marked as invited, ${midSentence(how)}.`,
  leftAsItWas: (count: number) => `${figure(count)} already invited, left as it was.`,
  removedMeanwhile: (count: number) => `${figure(count)} not changed: someone else removed them.`,
  failed: 'Nothing changed. We could not reach Soirely.',
  tryAgain: 'Try again',
  notLive: 'Nothing changed. This event is no longer live, so guests can’t be marked as invited.',
  narrowing:
    'You can act on up to 2,000 guests at once. Narrow the list with a tab, a search or a filter, then select again.',
  theirOwn: 'Add to group and Remove from the list are sc-3776’s, with their own demo to come.',
  pretend: (count: number) =>
    `Demo only: the sample has fewer guests, so this state counts ${figure(count)} selected.`,
} as const;

export type Line =
  | { kind: 'done'; marked: number; already: number; removed: number; how: HowInvited }
  | { kind: 'nothing'; already: number }
  | { kind: 'failed'; how: HowInvited }
  | { kind: 'notLive' };

export interface Meanwhile {
  removed: readonly string[];
  invited: readonly string[];
}

export interface MarkStart {
  event: string;
  paused: boolean;
  list: Guest[];
  selected: string[];
  pretend: number | null;
  dialog: { how: HowInvited | null; tried: boolean } | null;
  line: Line | null;
  meanwhile: Meanwhile;
}

/** A guest Not yet invited, never a companion: only these are marked (sc-3788). */
export function waiting(one: Guest): boolean {
  return one.reply === 'notYet';
}

function chosen(list: readonly Guest[], selected: ReadonlySet<string>): Guest[] {
  return list.filter((one) => selected.has(one.id));
}

/** Companions follow their host: counted under the bar, never selected or marked themselves. */
export function companionsWith(list: readonly Guest[], selected: ReadonlySet<string>): number {
  return chosen(list, selected).reduce((sum, one) => sum + one.companions.length, 0);
}

export type Press =
  | { kind: 'over' }
  | { kind: 'nothing'; already: number }
  | { kind: 'ask'; marks: number; already: string[] };

/** sc-46880: what pressing the bar's Mark as invited does, before anything is sent. */
export function pressMark(
  list: readonly Guest[],
  selected: ReadonlySet<string>,
  count = selected.size,
): Press {
  if (count > MOST_AT_ONCE) return { kind: 'over' };
  const picked = chosen(list, selected);
  const already = picked.filter((one) => !waiting(one)).map((one) => one.name);
  const marks = picked.length - already.length;

  return marks === 0
    ? { kind: 'nothing', already: already.length }
    : { kind: 'ask', marks, already };
}

/** One mark, many guests, all-or-nothing for those it can mark; a guest removed meanwhile is left out and counted, one invited meanwhile counts as already invited. */
export function markMany(
  list: readonly Guest[],
  selected: ReadonlySet<string>,
  how: HowInvited,
  on: string,
  meanwhile: Meanwhile,
): { list: Guest[]; line: Line } {
  const gone = new Set(meanwhile.removed);
  const nowInvited = new Set(meanwhile.invited);
  const after = list
    .filter((one) => !gone.has(one.id))
    .map((one) =>
      nowInvited.has(one.id) && waiting(one)
        ? (markInvited([one], one.id, 'Other', on)[0] ?? one)
        : one,
    );
  const removed = [...selected].filter((id) => gone.has(id)).length;
  const picked = chosen(after, selected);
  const marks = picked.filter(waiting).map((one) => one.id);
  const marked = marks.reduce((was, id) => markInvited(was, id, how, on), after);

  return {
    list: marked,
    line: {
      kind: 'done',
      marked: marks.length,
      already: picked.length - marks.length,
      removed,
      how,
    },
  };
}

export function lineWords(line: Line): string[] {
  if (line.kind === 'nothing') return [MW.nothingToMark(line.already)];
  if (line.kind === 'failed') return [MW.failed];
  if (line.kind === 'notLive') return [MW.notLive];

  return [
    MW.marked(line.marked, line.how),
    ...(line.already > 0 ? [MW.leftAsItWas(line.already)] : []),
    ...(line.removed > 0 ? [MW.removedMeanwhile(line.removed)] : []),
  ];
}

export const MARK_STATES = [
  { key: 'selected', name: 'Guests selected: the bar, Mark as invited first' },
  { key: 'ask', name: 'How did you invite them? Nothing chosen' },
  { key: 'askAlready', name: 'The dialog naming five already invited, and 3 more' },
  { key: 'askBlank', name: 'Mark as invited with nothing chosen' },
  { key: 'marked', name: 'Marked: the line, with 2 already invited' },
  { key: 'markedRemoved', name: 'Marked: 1 not changed, someone else removed them' },
  { key: 'nothing', name: 'Everyone selected already invited: nothing to mark' },
  { key: 'failed', name: 'Not saved: Nothing changed, with Try again' },
  { key: 'notLive', name: 'Refused: the event is no longer live (409)' },
  { key: 'over', name: 'Over 2,000 selected: the narrowing line' },
  { key: 'paused', name: 'A paused event: no Mark as invited in the bar' },
] as const;

export type MarkState = (typeof MARK_STATES)[number]['key'];

export function markStateOf(raw: string | null): MarkState {
  return MARK_STATES.find((one) => one.key === raw)?.key ?? 'selected';
}

export const MARK_AT = '/demo/guests/select';

export const MARK_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'Mark as invited, from the selection bar · sc-46880',
    states: MARK_STATES.map((one) => ({ to: `${MARK_AT}?state=${one.key}`, name: one.name })),
  },
];

const NO_ONE: Meanwhile = { removed: [], invited: [] };

function pick(list: readonly Guest[], waitingCount: number, invitedCount: number): string[] {
  const notYet = list.filter(waiting).slice(0, waitingCount);
  const invited = list
    .filter((one) => !waiting(one) && one.reply !== 'walkIn')
    .slice(0, invitedCount);

  return [...notYet, ...invited].map((one) => one.id);
}

export function markStart(state: MarkState): MarkStart {
  const list = sampleGuests(WEDDING);
  const start: MarkStart = {
    event: WEDDING,
    paused: false,
    list,
    selected: pick(list, 9, 3),
    pretend: null,
    dialog: null,
    line: null,
    meanwhile: NO_ONE,
  };
  const asking = { how: null, tried: false };

  switch (state) {
    case 'selected':
      return start;
    case 'ask':
      return { ...start, selected: pick(list, 6, 0), dialog: asking };
    case 'askAlready':
      return { ...start, selected: pick(list, 6, 8), dialog: asking };
    case 'askBlank':
      return { ...start, selected: pick(list, 6, 2), dialog: { how: null, tried: true } };
    case 'marked': {
      const selected = pick(list, 6, 2);
      const done = markMany(list, new Set(selected), 'WhatsApp', '2026-11-03', NO_ONE);

      return { ...start, list: done.list, selected: [], line: done.line };
    }
    case 'markedRemoved': {
      const selected = pick(list, 5, 1);
      const meanwhile = { removed: selected.slice(0, 1), invited: [] };
      const done = markMany(list, new Set(selected), 'In person', '2026-11-03', meanwhile);

      return { ...start, list: done.list, selected: [], line: done.line };
    }
    case 'nothing':
      return { ...start, selected: pick(list, 0, 4), line: { kind: 'nothing', already: 4 } };
    case 'failed':
      return { ...start, line: { kind: 'failed', how: 'WhatsApp' } };
    case 'notLive':
      return { ...start, line: { kind: 'notLive' } };
    case 'over':
      return { ...start, selected: pick(list, 12, 140), pretend: 2140 };
    case 'paused':
      return { ...start, paused: true };
  }
}
