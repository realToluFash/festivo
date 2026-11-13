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
  RECEIPTS,
  RECEIPTS_CANT,
  INVITATION,
  INVITE_GROUPS,
  INVITE_REACHED,
  type MarkKey,
  type NotReached,
  PARKING_GROUPS,
  PARKING_REACH,
  PARKING_REACHED,
  NOW,
  READER,
  RESEND,
  type ReachGroup,
  type ReachLine,
  type ReachPart,
  SENDING_GROUPS,
  SENDING_REACH,
  SMS_FAILED,
  receiptPeople,
} from './MessagesSample.ts';
import { CHANNEL_WORD, W, say } from './MessagesWords.ts';
import { NIGHT_TEXT, REASONS_REACH, REASONS_REACHED, REASON_GROUPS } from './ReasonsSample.ts';
import { readsOnly } from './NoticeStates.ts';
import { failedReason } from './Sms.ts';
import { type TrySmsView, offersTrySms, textedGroup, textedLines, trySmsOf } from './TrySms.ts';

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

/** Fix email address says "which bounced" only when the email line reads Bounced (pm on ux's #46677). */
export function emailBounced(person: NotReached): boolean {
  const bounced = say.where(CHANNEL_WORD.email, W.bounced);
  return person.lines.some((line) => line.word === bounced);
}

/** The line under Updated · not sent yet, one per action (sc-3966, settled on l10n's #31603). */
export const SINCE: Record<FixKind, string> = {
  fixEmail: W.emailChangedSince,
  addEmail: W.emailAddedSince,
  addPhone: W.phoneAddedSince,
};

export interface ReachPerson extends NotReached {
  offer: boolean;
  /** Try SMS instead: offered beside the fixes, or open in their place. */
  trySms?: boolean;
  trying?: TrySmsView;
}

function isChannel(line: ReachLine, how: FixKind): boolean {
  const [channel, none] =
    how === 'addPhone' ? [CHANNEL_WORD.sms, W.noPhone] : [CHANNEL_WORD.email, W.noEmail];

  return line.word.startsWith(channel) || line.word === none;
}

/** After a fix or an add: the channel lines keep what happened, and the row reads Updated · not sent yet until Send again, then the new channel reads Sent. */
function shownPerson(m: Messages, of: ReachedOf, person: NotReached): ReachPerson {
  const texted = m.texted?.[personAt(of, person.key)];
  if (texted != null)
    return {
      ...person,
      lines: textedLines(person.lines, texted),
      fixes: [W.toldInPerson],
      offer: false,
    };
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
  key: GroupKey | 'told' | 'whatsApp';
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
  /** A group counted beyond the people it draws. */
  counts?: Partial<Record<GroupKey, number>>;
}

/** Reached by email, their text failed: they stay reached, and the counts do not change (sc-3946). */
export function smsFailedPeople(): readonly NotReached[] {
  return SMS_FAILED.map(([key, initials, name, code, seen]) => ({
    key,
    initials,
    name,
    lines: [
      { mark: 'delivered', word: say.where(CHANNEL_WORD.email, W.delivered), reason: NOW },
      {
        mark: 'bounced',
        word: say.where(CHANNEL_WORD.sms, W.failedReceipt),
        reason: failedReason(code),
      },
      seen == null
        ? { mark: 'none', word: W.theirPage, reason: W.notSeenYet }
        : { mark: 'delivered', word: W.theirPage, reason: say.seenAt(seen) },
    ],
    fixes: [],
  }));
}

function baseOf(m: Messages, of: ReachedOf): Base {
  if (of === 'receipts')
    return {
      reached: RECEIPTS.reached,
      of: RECEIPTS.of,
      groups: [{ key: 'cant', mark: 'none', word: W.cantBeTold, people: RECEIPTS_CANT }],
      reachedRows: PARKING_REACHED.filter((person) => person.key === 'ines'),
      progress: 0,
      counts: { cant: RECEIPTS.cant },
    };
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
      groups: SENDING_GROUPS.filter((group) => group.key !== 'reached').map((group) =>
        m.sample === 'nightText' && group.key === 'inProgress'
          ? { ...group, people: [NIGHT_TEXT, ...group.people] }
          : group,
      ),
      reachedRows: [
        ...(SENDING_GROUPS.find((group) => group.key === 'reached')?.people ?? []),
        ...(m.smsFailed === true ? smsFailedPeople() : []),
      ],
      progress: SENDING_REACH.inProgress,
    };
  if (m.sample === 'reasons')
    return {
      reached: REASONS_REACH.reached,
      of: REASONS_REACH.of,
      groups: REASON_GROUPS,
      reachedRows: REASONS_REACHED,
      progress: 0,
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
  notReached: readonly (GroupView & { key: GroupKey })[];
  told: GroupView;
  reached: GroupView;
  reachedCount: number;
}

function withActions(
  m: Messages,
  of: ReachedOf,
  group: GroupKey,
  person: ReachPerson,
): ReachPerson {
  if (readsOnly(m)) return { ...person, fixes: [], offer: false };
  const trySms =
    !person.offer &&
    offersTrySms({ group, told: false, mobile: person.mobile, lines: person.lines });
  const open = trySms && m.trying === personAt(of, person.key) ? person.mobile : undefined;

  return { ...person, trySms, ...(open == null ? {} : { trying: trySmsOf(open, m.balance) }) };
}

function counted(m: Messages, of: ReachedOf): Counted {
  const base = baseOf(m, of);
  const going: ReachPerson[] = [];
  const held: ReachPerson[] = [];
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
      const texted = m.texted?.[at];
      if (texted != null && group.key !== textedGroup(texted)) {
        (textedGroup(texted) === 'held' ? held : going).push(shown);
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
  const inProgress: GroupView & { key: GroupKey } = {
    key: 'inProgress',
    mark: 'sending',
    word: W.inProgress,
    count: progress + going.length,
    people: [...(groups.find((group) => group.key === 'inProgress')?.people ?? []), ...going],
    ...(progress > progressLeft.length
      ? { more: say.andMore(progress - progressLeft.length) }
      : {}),
  };
  const heldGroup: GroupView & { key: GroupKey } = {
    key: 'held',
    mark: 'sending',
    word: W.held,
    count: held.length,
    people: held,
  };
  const rest: (GroupView & { key: GroupKey })[] = groups
    .filter((group) => group.key !== 'inProgress')
    .map((group) => {
      const count = base.counts?.[group.key] ?? group.people.length;

      return {
        ...group,
        count,
        ...(count > group.people.length
          ? { more: say.moreReached(count - group.people.length) }
          : {}),
      };
    });
  const reachedCount = base.reached + told.length;
  const rows = base.reachedRows.map((person) => ({ ...person, offer: false }));

  return {
    base,
    notReached: [inProgress, heldGroup, ...rest]
      .filter((group) => group.count > 0)
      .map((group) => ({
        ...group,
        people: group.people.map((person) => withActions(m, of, group.key, person)),
      })),
    told: {
      key: 'told',
      mark: 'delivered',
      word: W.markedAsTold,
      count: told.length,
      people: readsOnly(m) ? told.map((person) => ({ ...person, fixes: [] })) : told,
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

/** Resend leaves out whoever is already on their way: in progress, or held for credits. */
const ON_THEIR_WAY: readonly GroupKey[] = ['inProgress', 'held'];

function resendCount(c: Counted): number {
  return c.notReached
    .filter((group) => !ON_THEIR_WAY.includes(group.key))
    .reduce((sum, group) => sum + group.count, 0);
}

/** The receipts' WhatsApp, its own group above the rest: not a filter, and not counted as not reached. */
function whatsAppGroup(): GroupView {
  const people = receiptPeople().map((person) => ({ ...person, offer: false }));

  return { key: 'whatsApp', mark: 'sending', word: CHANNEL_WORD.wa, count: people.length, people };
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

/** messages.read alone: every status and reason, and nothing to act on (sc-32077; sc-3966, Decided 13 Nov, point 2). */
function readOnlyGroup(group: GroupView): GroupView {
  return {
    ...group,
    people: group.people.map((person) => ({ ...person, fixes: [], offer: false })),
  };
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
  held: say.heldCount,
  failed: say.failedCount,
  skipped: say.skippedCount,
  none: say.noEmailOrPhoneCount,
  cant: say.cantBeToldCount,
};

export function reachViewOf(m: Messages, of: ReachedOf): ReachView {
  const c = counted(m, of);
  const notReached = c.base.of - c.reachedCount;
  const filterOn = m.filter ?? (of === 'draft' || of === 'receipts' ? 'everyone' : 'notReached');
  const options: FilterOption[] = [
    { key: 'everyone', word: W.everyone, count: c.base.of },
    { key: 'notReached', word: W.notReachedWord, count: notReached },
    ...c.notReached.map((group) => ({ key: group.key, word: group.word, count: group.count })),
    { key: 'reached', word: W.reachedWord, count: c.reachedCount },
    { key: 'told', word: W.markedAsTold, count: c.told.count },
  ];
  const chosen = options.find((option) => option.key === filterOn) ?? options[1];
  const reading = readsOnly(m);
  const shown = shownGroups(c, filterOn);
  const listed = of === 'receipts' && filterOn === 'everyone' ? [whatsAppGroup(), ...shown] : shown;
  const groups = reading ? listed.map(readOnlyGroup) : listed;
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
    resend: of === 'receipts' || reading ? 0 : resendCount(c),
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
    .filter((group) => !ON_THEIR_WAY.includes(group.key))
    .flatMap((group) => group.people);
  const n = resendCount(c);
  const count = people.filter((person) => person.tellable === true).length;
  const cant = people.filter((person) => person.tellable !== true);
  const sample = cant.filter((person) => person.key === 'joaquin' || person.key === 'sophie');

  return {
    n,
    count,
    unconfirmed: c.notReached.find((group) => group.key === 'notConfirmed')?.count ?? 0,
    still: n - count,
    names:
      of === 'parking' && m.sample == null && sample.length === 2
        ? RESEND.names
        : cant.slice(0, 2).map(whyNot),
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
