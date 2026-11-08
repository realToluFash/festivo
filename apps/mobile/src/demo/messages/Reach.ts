import {
  type Action,
  type FixKind,
  type Messages,
  type ReachFilter,
  type ReachedOf,
  personAt,
  reduce,
} from './MessagesModel.ts';
import {
  type GroupKey,
  INVITATION,
  INVITE_GROUPS,
  INVITE_REACHED,
  type MarkKey,
  type NotReached,
  PARKING_GROUPS,
  PARKING_REACH,
  PARKING_REACHED,
  READER,
  RESEND,
  type ReachGroup,
  type ReachLine,
  type ReachPart,
  SENDING_GROUPS,
  SENDING_REACH,
} from './MessagesSample.ts';
import { CHANNEL_WORD, W, say } from './MessagesWords.ts';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function isEmail(text: string): boolean {
  return EMAIL.test(text.trim());
}

/** A phone number starts with + and its country code, and has at least seven digits. */
export function isPhone(text: string): boolean {
  const typed = text.trim();

  return /^\+[\d\s().-]+$/u.test(typed) && typed.replace(/\D/gu, '').length >= 7;
}

export const FIX_WORD: Record<FixKind, string> = {
  fixEmail: W.fixEmail,
  addEmail: W.addEmail,
  addPhone: W.addPhone,
};

export function fixKindOf(word: string): FixKind | null {
  return (Object.keys(FIX_WORD) as FixKind[]).find((kind) => FIX_WORD[kind] === word) ?? null;
}

/** The line under Updated · not sent yet, one per action (sc-3966, settled on l10n's #31603). */
export const SINCE: Record<FixKind, string> = {
  fixEmail: W.emailChangedSince,
  addEmail: W.emailAddedSince,
  addPhone: W.phoneAddedSince,
};

export interface ReachPerson extends NotReached {
  offer: boolean;
}

function isChannel(line: ReachLine, how: FixKind): boolean {
  const [channel, none] =
    how === 'addPhone' ? [CHANNEL_WORD.sms, W.noPhone] : [CHANNEL_WORD.email, W.noEmail];

  return line.word.startsWith(channel) || line.word === none;
}

/** After a fix or an add: the channel lines keep what happened, and the row reads Updated · not sent yet until Send again, then the new channel reads Sent. */
function shownPerson(m: Messages, of: ReachedOf, person: NotReached): ReachPerson {
  const address = m.fixed[person.key];
  if (address == null) return { ...person, offer: false };

  const how = m.how[person.key] ?? 'fixEmail';
  const at = personAt(of, person.key);
  const sentAt = m.again[at];
  if (sentAt == null) {
    const waiting = m.waiting.includes(at);

    return {
      ...person,
      updated: SINCE[how],
      fixes: waiting ? person.fixes.filter((fix) => fix !== FIX_WORD[how]) : [],
      tellable: true,
      offer: !waiting,
    };
  }

  const channel = how === 'addPhone' ? CHANNEL_WORD.sms : CHANNEL_WORD.email;
  const sent: ReachLine = {
    mark: 'sent',
    word: [channel, W.sent, sentAt].join(' · '),
    reason: address,
  };
  const index = person.lines.findIndex((line) => isChannel(line, how));
  const lines =
    index < 0
      ? [sent, ...person.lines]
      : person.lines.map((line, place) => (place === index ? sent : line));

  return { ...person, lines, fixes: [W.toldInPerson], offer: false };
}

function toldPerson({ updated: _updated, ...person }: ReachPerson, time: string): ReachPerson {
  return {
    ...person,
    lines: [
      ...person.lines,
      { mark: 'delivered', word: W.toldInPersonLine, reason: say.markedBy(READER, time) },
    ],
    fixes: [W.undo],
    offer: false,
  };
}

export interface GroupView {
  key: GroupKey | 'told';
  mark: MarkKey;
  word: string;
  count: number;
  people: readonly ReachPerson[];
  more?: string;
}

export interface FilterOption {
  key: ReachFilter;
  word: string;
  count: number;
}

export interface ReachView {
  of: ReachedOf;
  title: string;
  line: string;
  parts: readonly ReachPart[];
  status: string | null;
  head: string;
  filter: boolean;
  filterOn: ReachFilter;
  options: readonly FilterOption[];
  groups: readonly GroupView[];
  /** The line a filter left with nobody shows, its own for each. */
  empty: string | null;
  resend: number;
}

interface Base {
  reached: number;
  of: number;
  groups: readonly ReachGroup[];
  reachedRows: readonly NotReached[];
  progress: number;
}

function baseOf(of: ReachedOf): Base {
  if (of === 'invite')
    return {
      reached: INVITATION.reached,
      of: INVITATION.of,
      groups: INVITE_GROUPS,
      reachedRows: INVITE_REACHED,
      progress: 0,
    };
  if (of === 'draft')
    return {
      reached: SENDING_REACH.reached,
      of: SENDING_REACH.of,
      groups: SENDING_GROUPS.filter((group) => group.key !== 'reached'),
      reachedRows: SENDING_GROUPS.find((group) => group.key === 'reached')?.people ?? [],
      progress: SENDING_REACH.inProgress,
    };

  return {
    reached: PARKING_REACH.reached,
    of: PARKING_REACH.of,
    groups: PARKING_GROUPS,
    reachedRows: PARKING_REACHED,
    progress: 0,
  };
}

interface Counted {
  base: Base;
  notReached: readonly GroupView[];
  told: GroupView;
  reached: GroupView;
  reachedCount: number;
}

function counted(m: Messages, of: ReachedOf): Counted {
  const base = baseOf(of);
  const going: ReachPerson[] = [];
  const told: ReachPerson[] = [];
  const groups = base.groups.map((group) => {
    const people = group.people.flatMap((person) => {
      const at = personAt(of, person.key);
      const shown = shownPerson(m, of, person);
      const toldAt = m.toldIn[at];
      if (toldAt != null) {
        told.push(toldPerson(shown, toldAt));
        return [];
      }
      if (m.again[at] != null && group.key !== 'inProgress') {
        going.push(shown);
        return [];
      }
      return [shown];
    });

    return { ...group, people };
  });
  const drawn = base.groups.find((group) => group.key === 'inProgress')?.people ?? [];
  const progressLeft = drawn.filter((person) => m.toldIn[personAt(of, person.key)] == null);
  const progress = base.progress - (drawn.length - progressLeft.length);
  const inProgress: GroupView = {
    key: 'inProgress',
    mark: 'sending',
    word: W.inProgress,
    count: progress + going.length,
    people: [...(groups.find((group) => group.key === 'inProgress')?.people ?? []), ...going],
    ...(progress > progressLeft.length
      ? { more: say.andMore(progress - progressLeft.length) }
      : {}),
  };
  const rest: GroupView[] = groups
    .filter((group) => group.key !== 'inProgress')
    .map((group) => ({ ...group, count: group.people.length }));
  const reachedCount = base.reached + told.length;
  const rows = base.reachedRows.map((person) => ({ ...person, offer: false }));

  return {
    base,
    notReached: [inProgress, ...rest].filter((group) => group.count > 0),
    told: {
      key: 'told',
      mark: 'delivered',
      word: W.markedAsTold,
      count: told.length,
      people: told,
    },
    reached: {
      key: 'reached',
      mark: 'delivered',
      word: W.reachedWord,
      count: base.reached,
      people: rows,
      ...(base.reached > rows.length ? { more: say.moreReached(base.reached - rows.length) } : {}),
    },
    reachedCount,
  };
}

function shownGroups(c: Counted, filter: ReachFilter): readonly GroupView[] {
  const told = c.told.count > 0 ? [c.told] : [];
  switch (filter) {
    case 'everyone':
      return [...c.notReached, ...told, c.reached];
    case 'notReached':
      return c.notReached;
    case 'told':
      return told;
    case 'reached':
      return [...told, c.reached];
    default:
      return c.notReached.filter((group) => group.key === filter);
  }
}

const ALWAYS: readonly ReachFilter[] = ['everyone', 'notReached', 'reached', 'told'];

/** The filters offered whatever their count say so in their own words when nobody is in them; Everyone always has someone. */
export const EMPTY_LINE: Partial<Record<ReachFilter, string>> = {
  notReached: W.noneLeft,
  reached: W.noneReached,
  told: W.noneTold,
};

const COUNT_WORDS: Partial<Record<GroupKey, (count: number) => string>> = {
  inProgress: say.inProgressCount,
  bounced: say.bouncedCount,
  notConfirmed: say.notConfirmedCount,
  optedOut: say.optedOutCount,
  none: say.noEmailOrPhoneCount,
  cant: say.cantBeToldCount,
};

export function reachViewOf(m: Messages, of: ReachedOf): ReachView {
  const c = counted(m, of);
  const notReached = c.base.of - c.reachedCount;
  const filterOn = m.filter ?? (of === 'draft' ? 'everyone' : 'notReached');
  const options: FilterOption[] = [
    { key: 'everyone', word: W.everyone, count: c.base.of },
    { key: 'notReached', word: W.notReachedWord, count: notReached },
    ...c.notReached.map((group) => ({ key: group.key, word: group.word, count: group.count })),
    { key: 'reached', word: W.reachedWord, count: c.reachedCount },
    { key: 'told', word: W.markedAsTold, count: c.told.count },
  ];
  const chosen = options.find((option) => option.key === filterOn) ?? options[1];
  const groups = shownGroups(c, filterOn);
  const count = (key: GroupKey) => c.notReached.find((group) => group.key === key)?.count ?? 0;
  const counts = c.notReached.flatMap((group) => {
    const words = COUNT_WORDS[group.key as GroupKey];
    return words == null ? [] : [words(group.count)];
  });
  const said = m.said?.startsWith(`${of}.`) === true ? m.said.slice(of.length + 1) : null;
  const saidName = c.notReached
    .flatMap((group) => group.people)
    .find((person) => person.key === said)?.name;

  const line =
    of === 'invite'
      ? [
          say.nowInvitedShort(INVITATION.reached),
          say.seenBy(INVITATION.seen),
          say.noEmailOrPhoneCount(count('none')),
        ].join(' · ')
      : of === 'draft'
        ? [
            say.inProgressCount(count('inProgress')),
            say.cantBeToldCount(count('cant')),
            say.seenBy(SENDING_REACH.seen),
          ].join(' · ')
        : [say.seenByStart(PARKING_REACH.seen), ...counts].join(' · ');

  return {
    of,
    title:
      of === 'draft'
        ? say.soFar(c.reachedCount, c.base.of)
        : say.reached(c.reachedCount, c.base.of),
    line,
    parts: [
      { mark: 'delivered', word: W.reachedWord, count: c.reachedCount },
      ...c.notReached.map((group) => ({ mark: group.mark, word: group.word, count: group.count })),
    ],
    status: saidName == null ? null : say.sentTo(saidName),
    head:
      filterOn === 'notReached'
        ? say.notReached(notReached)
        : say.section(chosen?.word ?? '', chosen?.count ?? 0),
    filter: true,
    filterOn,
    options,
    groups,
    empty: groups.length === 0 ? (EMPTY_LINE[filterOn] ?? null) : null,
    resend: c.notReached
      .filter((group) => group.key !== 'inProgress')
      .reduce((sum, group) => sum + group.count, 0),
  };
}

export interface ResendView {
  n: number;
  count: number;
  unconfirmed: number;
  still: number;
  names: readonly string[];
}

function whyNot(person: NotReached): string {
  const lines = person.lines.filter(
    (line) => line.word !== W.theirPage && line.word !== W.theirInvitation,
  );

  return [person.name, ...lines.map((line) => line.reason ?? line.word)].join(' · ');
}

/** Resend to the {n} not reached: in progress and told left out; those with an address the resend can use are told, the rest listed. */
export function resendOf(m: Messages, of: ReachedOf): ResendView {
  const c = counted(m, of);
  const people = c.notReached
    .filter((group) => group.key !== 'inProgress')
    .flatMap((group) => group.people);
  const n = c.notReached
    .filter((group) => group.key !== 'inProgress')
    .reduce((sum, group) => sum + group.count, 0);
  const count = people.filter((person) => person.tellable === true).length;
  const cant = people.filter((person) => person.tellable !== true);
  const sample = cant.filter((person) => person.key === 'joaquin' || person.key === 'sophie');

  return {
    n,
    count,
    unconfirmed: c.notReached.find((group) => group.key === 'notConfirmed')?.count ?? 0,
    still: n - count,
    names: of === 'parking' && sample.length === 2 ? RESEND.names : cant.slice(0, 2).map(whyNot),
  };
}

/** The one time the filter moves on its own (sc-3966's AC): a group offered only while it has someone, left with nobody, gives way to Not reached, or to Everyone once nobody is left not reached. */
export function keptFilter(m: Messages): Messages {
  const { filter, open } = m;
  if (open?.kind !== 'reached' || filter == null || ALWAYS.includes(filter)) return m;

  const c = counted(m, open.of);
  if (c.notReached.some((group) => group.key === filter)) return m;

  return { ...m, filter: c.base.of > c.reachedCount ? 'notReached' : 'everyone' };
}

/** The screen's reducer: the model's, then the filter's rule. */
export function reduceReach(m: Messages, action: Action): Messages {
  return keptFilter(reduce(m, action));
}
