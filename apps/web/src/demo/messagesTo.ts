import { useCallback, useRef, useState } from 'react';

import { demoWords } from './demoWords.ts';
import type { ConvoId, MessagesState, Row, Segment } from './messages.ts';
import { TW } from './messagesToWords.ts';
import { MW } from './messagesWords.ts';

/** Who gets it (sc-3957): conditions on the event's guests, counted live, saved under a name, and resolved when a message goes. */
export { TW };

const mw = demoWords(MW);
const tw = demoWords(TW);
const NUMBER = new Intl.NumberFormat('en-US');
const COLLATOR = new Intl.Collator('en', { sensitivity: 'base' });

export type Reply = 'coming' | 'notComing' | 'notSure' | 'none';
export type Plain =
  | 'replied'
  | 'notReplied'
  | 'coming'
  | 'notComing'
  | 'notSure'
  | 'invited'
  | 'notInvited'
  | 'hasEmail'
  | 'hasMobile';
export type Condition = Plain | `group:${string}`;
export type ToPick = 'coming' | 'notReplied' | 'who' | `saved:${string}`;
export type Audience =
  { kind: 'all' } | { kind: 'who'; conditions: readonly Condition[]; pick?: ToPick };

export interface Group {
  id: string;
  name: string;
  deleted?: boolean;
}

export interface Saved {
  id: string;
  name: string;
  conditions: readonly Condition[];
}

export interface Book {
  groups: readonly Group[];
  saved: readonly Saved[];
}

export interface SampleGuest {
  name: string;
  reply: Reply;
  invited: boolean;
  group: string | null;
  email: boolean;
  mobile: boolean;
}

export const NO_GROUP = 'none';
export const NAME_MOST = 60;
export const SAVED_MOST = 20;

export const GROUPS: readonly Group[] = [
  { id: 'family', name: 'Family' },
  { id: 'oldSchool', name: 'Old school friends' },
  { id: 'work', name: 'Work' },
];

export const SAVED: readonly Saved[] = [
  { id: 'comingMobile', name: 'Coming, with a mobile', conditions: ['coming', 'hasMobile'] },
  { id: 'elodie', name: 'Elodie’s friends', conditions: ['group:oldSchool'] },
  {
    id: 'familyNoReply',
    name: 'Family who haven’t replied',
    conditions: ['group:family', 'notReplied'],
  },
  { id: 'noReply', name: 'No reply yet', conditions: ['notReplied'] },
  { id: 'workEmail', name: 'Work, has an email', conditions: ['group:work', 'hasEmail'] },
];

export const BOOK: Book = { groups: GROUPS, saved: SAVED };

const FIRST = [
  'Ama',
  'Bruno',
  'Carmen',
  'Dayo',
  'Elena',
  'Femi',
  'Gabriel',
  'Hana',
  'Ikenna',
  'Jana',
  'Kunle',
  'Leila',
  'Mateo',
  'Nadia',
  'Oscar',
  'Precious',
  'Quentin',
  'Rosa',
  'Sanjay',
  'Tolu',
  'Uche',
  'Vera',
  'Wei',
  'Ximena',
  'Yusuf',
  'Zara',
  'Adwoa',
  'Bayo',
  'Clara',
  'Diego',
  'Efua',
  'Farid',
  'Gloria',
  'Hugo',
  'Ivan',
  'Jide',
  'Kiran',
  'Maya',
  'Nico',
  'Ola',
];

const LAST = [
  'Adebayo',
  'Afolabi',
  'Alves',
  'Amoah',
  'Banda',
  'Berger',
  'Campos',
  'Diallo',
  'Eze',
  'Fernandes',
  'Gomez',
  'Haddad',
  'Ito',
  'Jensen',
  'Kamara',
  'Lambert',
  'Mendes',
  'Moreau',
  'Nwosu',
  'Ogunde',
  'Okafor',
  'Owusu',
  'Park',
  'Petrov',
  'Quaye',
  'Reyes',
  'Rossi',
  'Sato',
  'Silva',
  'Soto',
  'Tanaka',
  'Torres',
  'Usman',
  'Varga',
  'Weber',
  'Yamada',
  'Yilmaz',
  'Zhou',
  'Abara',
  'Nunes',
];

function nameAt(index: number): string {
  const first = FIRST[index % FIRST.length] ?? '';
  const last = LAST[(index + 7 * Math.floor(index / FIRST.length)) % LAST.length] ?? '';

  return `${first} ${last}`;
}

const one = (
  name: string,
  reply: Reply,
  group: string | null,
  email: boolean,
  mobile: boolean,
  invited = true,
): SampleGuest => ({ name, reply, invited, group, email, mobile });

/** [group, reply, how many, with an email, with a mobile], the rest of the 142 by these sums. */
const CELLS: readonly [string | null, Reply, number, number, number][] = [
  ['family', 'coming', 10, 10, 4],
  ['family', 'notComing', 1, 1, 0],
  ['family', 'notSure', 1, 1, 1],
  ['oldSchool', 'coming', 9, 9, 3],
  ['oldSchool', 'none', 2, 2, 1],
  ['oldSchool', 'notComing', 1, 1, 0],
  ['work', 'coming', 16, 15, 6],
  ['work', 'notComing', 4, 3, 1],
  ['work', 'notSure', 2, 2, 0],
  [null, 'coming', 56, 53, 13],
  [null, 'none', 17, 15, 5],
  [null, 'notComing', 6, 5, 2],
  [null, 'notSure', 4, 4, 1],
];

function populated(): SampleGuest[] {
  let at = 0;
  const made = CELLS.flatMap(([group, reply, count, emails, mobiles]) =>
    Array.from({ length: count }, (_, index) => {
      at += 1;

      return one(nameAt(at - 1), reply, group, index < emails, index >= count - mobiles);
    }),
  );

  return [
    one('Abena Mensah', 'none', 'family', true, true),
    one('Chidi Okeke', 'none', 'family', true, false),
    one('Grace Adeyemi', 'none', 'family', false, true),
    one('Ifeoma Bello', 'none', 'family', true, true),
    one('Kofi Asante', 'none', 'family', false, false),
    one('Yetunde Bakare', 'none', 'family', true, false),
    ...['Bisi Adewale', 'Camille Dubois', 'Kemi Bankole', 'Kwame Mensah', 'Lucía Ortega'].map(
      (name) => one(name, 'coming', null, true, true),
    ),
    one('Joaquín Ruiz', 'none', null, false, false, false),
    one('Mei Lin Chen', 'none', null, false, false, false),
    ...made,
  ];
}

/** The wedding's 142 guests, each with their reply, invitation, group and channels. */
export const POPULATION: readonly SampleGuest[] = populated();

const PLAIN: Record<Plain, { word: string; line: string }> = {
  replied: { word: TW.hasReplied, line: TW.hasRepliedLine },
  notReplied: { word: MW.hasntReplied, line: TW.hasntRepliedLine },
  coming: { word: MW.isComing, line: TW.isComingLine },
  notComing: { word: TW.isntComing, line: TW.isntComingLine },
  notSure: { word: TW.notSureYet, line: TW.notSureYetLine },
  invited: { word: TW.invited, line: TW.invitedLine },
  notInvited: { word: TW.notYetInvited, line: TW.notYetInvitedLine },
  hasEmail: { word: TW.hasEmail, line: TW.hasEmailLine },
  hasMobile: { word: TW.hasMobile, line: TW.hasMobileLine },
};

export const ADDABLE: readonly (Plain | 'group')[] = [
  'replied',
  'notReplied',
  'coming',
  'notComing',
  'notSure',
  'group',
  'invited',
  'notInvited',
  'hasEmail',
  'hasMobile',
];

export const CONDITIONS: readonly Condition[] = ADDABLE.filter(
  (kind): kind is Plain => kind !== 'group',
);
export const COMING: Audience = { kind: 'who', conditions: ['coming'], pick: 'coming' };
export const NOT_REPLIED: Audience = {
  kind: 'who',
  conditions: ['notReplied'],
  pick: 'notReplied',
};

export function isGroup(condition: Condition): condition is `group:${string}` {
  return condition.startsWith('group:');
}

function groupIdOf(condition: `group:${string}`): string {
  return condition.slice('group:'.length);
}

export function addWord(kind: Plain | 'group'): string {
  return kind === 'group' ? TW.isInGroup : PLAIN[kind].word;
}

export function addLine(kind: Plain | 'group'): string {
  return kind === 'group' ? TW.isInGroupLine : PLAIN[kind].line;
}

export function conditionWord(condition: Condition, groups: readonly Group[]): string {
  if (!isGroup(condition)) return PLAIN[condition].word;

  const id = groupIdOf(condition);

  if (id === NO_GROUP) return tw.filled(TW.inGroup, { group: TW.noGroup });

  const group = groups.find((each) => each.id === id);
  const name = group?.name ?? id;

  return tw.filled(TW.inGroup, {
    group: group?.deleted === true ? tw.filled(TW.deletedGroup, { group: name }) : name,
  });
}

/** The deleted groups a set of conditions names: each matches nobody (Decided, 26 Oct). */
export function deletedIn(conditions: readonly Condition[], groups: readonly Group[]): Group[] {
  return conditions
    .filter(isGroup)
    .map((condition) => groups.find((group) => group.id === groupIdOf(condition)))
    .filter((group): group is Group => group?.deleted === true);
}

function groupOf(guest: SampleGuest, groups: readonly Group[]): string | null {
  const group = groups.find((each) => each.id === guest.group);

  return group == null || group.deleted === true ? null : group.id;
}

function matches(guest: SampleGuest, condition: Condition, groups: readonly Group[]): boolean {
  switch (condition) {
    case 'replied':
      return guest.reply !== 'none';
    case 'notReplied':
      return guest.invited && guest.reply === 'none';
    case 'coming':
    case 'notComing':
    case 'notSure':
      return guest.reply === condition;
    case 'invited':
      return guest.invited;
    case 'notInvited':
      return !guest.invited;
    case 'hasEmail':
      return guest.email;
    case 'hasMobile':
      return guest.mobile;
    default: {
      const id = groupIdOf(condition);
      const group = groups.find((each) => each.id === id);

      if (id === NO_GROUP) return groupOf(guest, groups) == null;
      if (group == null || group.deleted === true) return false;

      return groupOf(guest, groups) === id;
    }
  }
}

export function whoMatches(
  conditions: readonly Condition[],
  groups: readonly Group[],
): SampleGuest[] {
  if (conditions.length === 0) return [];

  return POPULATION.filter((guest) =>
    conditions.every((condition) => matches(guest, condition, groups)),
  ).sort((a, b) => COLLATOR.compare(a.name, b.name));
}

export function countIn(conditions: readonly Condition[], groups: readonly Group[]): number | null {
  return conditions.length === 0 ? null : whoMatches(conditions, groups).length;
}

export function countOf(audience: Audience, groups: readonly Group[]): number | null {
  return audience.kind === 'all' ? POPULATION.length : countIn(audience.conditions, groups);
}

export function channelsOf(guest: SampleGuest): string {
  const has = [guest.email && TW.emailAddress, guest.mobile && TW.mobileNumber].filter(
    (word): word is string => word !== false,
  );

  return has.length === 0 ? TW.noChannels : has.join(' · ');
}

export function countWords(count: number | null): string {
  return count == null ? '' : count === 0 ? MW.nobodyMatches : mw.many('guests', count);
}

export function savedInOrder(saved: readonly Saved[]): Saved[] {
  return [...saved].sort((a, b) => COLLATOR.compare(a.name, b.name));
}

export function savedOf(book: Book, pick: ToPick | 'all'): Saved | null {
  if (!pick.startsWith('saved:')) return null;

  return book.saved.find((one) => `saved:${one.id}` === pick) ?? null;
}

export function pickOf(audience: Audience, book: Book): ToPick | 'all' {
  if (audience.kind === 'all') return 'all';

  const pick = audience.pick ?? 'who';

  return pick.startsWith('saved:') && savedOf(book, pick) == null ? 'who' : pick;
}

export function quickWord(pick: 'coming' | 'notReplied'): string {
  return pick === 'coming' ? TW.coming : MW.hasntReplied;
}

function pickConditions(pick: ToPick | 'all', book: Book): readonly Condition[] | null {
  if (pick === 'coming' || pick === 'notReplied') return [pick];

  return savedOf(book, pick)?.conditions ?? null;
}

/** The message's own copy of its conditions differs from where it was picked: this message only. */
export function changedFrom(audience: Audience, book: Book): boolean {
  if (audience.kind === 'all') return false;

  const from = pickConditions(pickOf(audience, book), book);

  return (
    from != null &&
    (from.length !== audience.conditions.length ||
      !from.every((condition) => audience.conditions.includes(condition)))
  );
}

export function audienceWords(audience: Audience, groups: readonly Group[]): string {
  if (audience.kind === 'all') return MW.allGuests;

  return [MW.guestsWho, audience.conditions.map((one) => conditionWord(one, groups)).join(' · ')]
    .filter(Boolean)
    .join(' ');
}

export function toLine(audience: Audience, groups: readonly Group[]): string {
  return audience.kind === 'all'
    ? MW.toAll
    : mw.filled(MW.toAudience, { audience: audienceWords(audience, groups) });
}

/** The To chip: a quick pick as "Coming · 96", a saved audience by its name, else Guests who… with its count. */
export function chipWords(audience: Audience, book: Book): string {
  if (audience.kind === 'all') return `${MW.allGuests} · ${NUMBER.format(POPULATION.length)}`;

  const count = countIn(audience.conditions, book.groups);
  const pick = pickOf(audience, book);
  const kept = !changedFrom(audience, book);

  if (kept && (pick === 'coming' || pick === 'notReplied'))
    return `${quickWord(pick)} · ${NUMBER.format(count ?? 0)}`;

  const lead = (kept ? savedOf(book, pick)?.name : null) ?? MW.guestsWho;

  return count == null ? lead : `${lead} · ${countWords(count)}`;
}

export function refusalOf(audience: Audience, groups: readonly Group[]): string | null {
  if (audience.kind === 'all') return null;
  if (audience.conditions.length === 0) return MW.noCondition;

  const gone = deletedIn(audience.conditions, groups)[0];

  if (gone != null) return tw.filled(TW.deletedSend, { group: gone.name });

  return countIn(audience.conditions, groups) === 0 ? MW.nobodyLine : null;
}

export function nameLength(name: string): number {
  return [...name.trim()].length;
}

export function nameCount(name: string): string {
  return tw.filled(TW.nameCount, { count: nameLength(name), most: NAME_MOST });
}

function folded(name: string): string {
  return name.trim().normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('en');
}

/** A group name's rules (sc-3775): required, at most 60, and no other saved audience's name, ignoring case and accents. */
export function nameRefusal(name: string, saved: readonly Saved[], self?: string): string | null {
  if (name.trim() === '') return TW.nameBlank;
  if (nameLength(name) > NAME_MOST) return TW.nameLong;

  const taken = saved.find((one) => one.id !== self && folded(one.name) === folded(name));

  return taken == null ? null : tw.filled(TW.nameTaken, { name: taken.name });
}

export function saveRefusal(name: string, book: Book): string | null {
  return nameRefusal(name, book.saved) ?? (book.saved.length >= SAVED_MOST ? TW.full : null);
}

export function withSaved(
  book: Book,
  name: string,
  conditions: readonly Condition[],
): { book: Book; id: string } {
  let n = book.saved.length + 1;

  while (book.saved.some((one) => one.id === `audience${n}`)) n += 1;

  const id = `audience${n}`;

  return { book: { ...book, saved: [...book.saved, { id, name: name.trim(), conditions }] }, id };
}

export function withName(book: Book, id: string, name: string): Book {
  return {
    ...book,
    saved: book.saved.map((one) => (one.id === id ? { ...one, name: name.trim() } : one)),
  };
}

export function without(book: Book, id: string): Book {
  return { ...book, saved: book.saved.filter((one) => one.id !== id) };
}

export const LONG_NAME = 'Everyone on the bride’s side who hasn’t replied, with mobiles';
export const TAKEN_NAME = 'élodie’s friends';
export const NEW_NAME = 'Reminder: Family, no reply';

const WHO_MANY: readonly Condition[] = ['notReplied', 'group:family'];
const FAMILY_REMINDER: Saved = { id: 'familyReminder', name: NEW_NAME, conditions: WHO_MANY };

const MORE_SAVED: readonly Saved[] = (
  [
    ['Coming, Family', ['coming', 'group:family']],
    ['Coming, Old school friends', ['coming', 'group:oldSchool']],
    ['Coming, Work', ['coming', 'group:work']],
    ['Coming, with an email', ['coming', 'hasEmail']],
    ['Family', ['group:family']],
    ['Has replied', ['replied']],
    ['Hasn’t replied, with an email', ['notReplied', 'hasEmail']],
    ['Invited', ['invited']],
    ['Isn’t coming', ['notComing']],
    ['No group', ['group:none']],
    ['Not sure yet', ['notSure']],
    ['Not sure, with a mobile', ['notSure', 'hasMobile']],
    ['Not yet invited', ['notInvited']],
    ['Old school friends', ['group:oldSchool']],
    ['Work', ['group:work']],
  ] as const
).map(([name, conditions], index) => ({ id: `more${index + 1}`, name, conditions }));

export function bookOf(state: MessagesState | null): Book {
  switch (state) {
    case 'whoRenamed':
      return {
        ...BOOK,
        groups: GROUPS.map((one) =>
          one.id === 'family' ? { ...one, name: 'Bride’s family' } : one,
        ),
      };
    case 'whoDeleted':
      return {
        ...BOOK,
        groups: GROUPS.map((one) => (one.id === 'family' ? { ...one, deleted: true } : one)),
      };
    case 'saveFull':
      return { ...BOOK, saved: [...SAVED, ...MORE_SAVED] };
    case 'saved':
      return { ...BOOK, saved: [...SAVED, FAMILY_REMINDER] };
    case 'renamed':
      return withName(BOOK, 'elodie', 'Élodie’s friends');
    case 'deletedPicked':
      return without(BOOK, 'comingMobile');
    default:
      return BOOK;
  }
}

export type SentToId = 'replyBy' | 'reminder';

export const SENT_TO: readonly SentToId[] = ['reminder', 'replyBy'];

export type ToSeed =
  | { kind: 'compose'; to: Audience; open: boolean }
  | { kind: 'convo'; id: ConvoId; more: readonly ConvoId[]; untold?: boolean };

const writing = (conditions: readonly Condition[], pick: ToPick = 'who', open = true): ToSeed => ({
  kind: 'compose',
  to: { kind: 'who', conditions, pick },
  open,
});

export function toSeedOf(state: MessagesState | null): ToSeed | null {
  switch (state) {
    case 'whoAdded':
    case 'whoCounting':
      return writing(['coming', 'hasMobile'], 'coming');
    case 'whoNone':
      return writing([]);
    case 'whoNoneSend':
      return writing([], 'who', false);
    case 'whoMany':
    case 'seeWho':
    case 'saveName':
    case 'saveBlank':
    case 'saveLong':
    case 'saveTaken':
    case 'saveFull':
      return writing(WHO_MANY);
    case 'whoGroup':
      return writing(['notReplied']);
    case 'whoNobody':
      return writing(['group:family', 'group:work']);
    case 'whoRenamed':
    case 'whoDeleted':
      return writing(['group:family', 'notReplied'], 'saved:familyNoReply');
    case 'saved':
      return writing(WHO_MANY, 'saved:familyReminder');
    case 'savedChanged':
      return writing(['coming', 'hasEmail'], 'saved:comingMobile');
    case 'audienceMenu':
    case 'rename':
    case 'renamed':
    case 'deleteAsk':
      return writing(['coming'], 'coming');
    case 'deletedPicked':
      return writing(['coming', 'hasMobile']);
    case 'noManage':
      return { kind: 'convo', id: 'ines', more: [], untold: true };
    case 'resolvedRow':
      return { kind: 'convo', id: 'replyBy', more: SENT_TO };
    case 'nobodyDue':
      return { kind: 'convo', id: 'reminder', more: SENT_TO };
    default:
      return null;
  }
}

export interface ToView {
  adding: 'top' | 'group' | null;
  seeing: boolean;
  counting: boolean;
  saveRefused: boolean;
  saving: { name: string; wrong: string | null } | null;
  menu: string | null;
  renaming: { id: string; name: string; wrong: string | null } | null;
  deleting: string | null;
  said: string | null;
  first: string | null;
}

const VIEW: ToView = {
  adding: null,
  seeing: false,
  counting: false,
  saveRefused: false,
  saving: null,
  menu: null,
  renaming: null,
  deleting: null,
  said: null,
  first: null,
};

export function viewOf(state: MessagesState | null, book: Book): ToView {
  const saving = (name: string, wrong: string | null): ToView => ({
    ...VIEW,
    saving: { name, wrong },
    first: 'name',
  });

  switch (state) {
    case 'whoNone':
      return { ...VIEW, saveRefused: true, first: 'save' };
    case 'whoGroup':
      return { ...VIEW, adding: 'group', first: 'add-item' };
    case 'whoCounting':
      return { ...VIEW, counting: true, first: 'add' };
    case 'seeWho':
      return { ...VIEW, seeing: true, first: 'see' };
    case 'saveName':
      return saving('', null);
    case 'saveBlank':
      return saving('', saveRefusal('', book));
    case 'saveLong':
      return saving(LONG_NAME, saveRefusal(LONG_NAME, book));
    case 'saveTaken':
      return saving(TAKEN_NAME, saveRefusal(TAKEN_NAME, book));
    case 'saveFull':
      return saving(NEW_NAME, saveRefusal(NEW_NAME, book));
    case 'saved':
      return { ...VIEW, said: tw.filled(TW.savedSaid, { name: NEW_NAME }) };
    case 'audienceMenu':
      return { ...VIEW, menu: 'comingMobile', first: 'menu-item' };
    case 'rename':
      return {
        ...VIEW,
        renaming: { id: 'elodie', name: 'Elodie’s friends', wrong: null },
        first: 'rename',
      };
    case 'renamed':
      return {
        ...VIEW,
        said: tw.filled(TW.renamedSaid, { name: 'Élodie’s friends' }),
        first: 'more:elodie',
      };
    case 'deleteAsk':
      return { ...VIEW, deleting: 'comingMobile', first: 'keep' };
    case 'deletedPicked':
      return { ...VIEW, said: tw.filled(TW.deletedSaid, { name: 'Coming, with a mobile' }) };
    default:
      return VIEW;
  }
}

export function refusedFirst(
  state: MessagesState | null,
  audience: Audience | undefined,
  groups: readonly Group[],
): string | null {
  if (audience == null) return null;

  return state === 'whoNoneSend' || state === 'whoNobody' || state === 'whoDeleted'
    ? refusalOf(audience, groups)
    : null;
}

export const SENT_TO_MESSAGES: Record<
  SentToId,
  {
    subject: string;
    body: readonly Segment[];
    to: Audience;
    day: string;
    row: string;
    at: string;
  }
> = {
  replyBy: {
    subject: 'Please reply by Friday',
    body: [
      { kind: 'token', token: 'greeting' },
      { kind: 'text', text: ', please reply by Friday so we can plan the tables.' },
    ],
    to: { kind: 'who', conditions: ['notReplied', 'group:family'], pick: 'who' },
    day: 'Thu, Oct 29',
    row: 'Oct 29',
    at: '10:00',
  },
  reminder: {
    subject: 'Reply reminder',
    body: [
      { kind: 'token', token: 'greeting' },
      { kind: 'text', text: ', a reminder to reply on your page by Friday.' },
    ],
    to: { kind: 'who', conditions: ['group:work', 'notReplied'], pick: 'who' },
    day: 'Fri, Oct 30',
    row: 'Oct 30',
    at: '09:00',
  },
};

export const REPLY_BY_SEEN = 4;

export function isSentTo(id: string): id is SentToId {
  return (SENT_TO as readonly string[]).includes(id);
}

export function resolvedCount(id: SentToId): number {
  return id === 'reminder' ? 0 : (countOf(SENT_TO_MESSAGES[id].to, GROUPS) ?? 0);
}

export function sentToHead(id: SentToId, groups: readonly Group[]): string {
  const message = SENT_TO_MESSAGES[id];

  return id === 'reminder'
    ? toLine(message.to, groups)
    : `${toLine(message.to, groups)} · ${NUMBER.format(resolvedCount(id))}`;
}

export function sentToRow(id: SentToId, groups: readonly Group[]): Row {
  const message = SENT_TO_MESSAGES[id];
  const count = resolvedCount(id);

  return {
    id,
    title: message.subject,
    line:
      id === 'reminder'
        ? `${tw.filled(TW.nobodyDueRow, { time: message.at })} · ${TW.sentNothing}`
        : `${toLine(message.to, groups)} · ${mw.filled(MW.reached, { count, total: count })}`,
    when: message.row,
    lead: { kind: 'many' },
    tag: null,
    fresh: false,
  };
}

export interface ToApi {
  state: MessagesState | null;
  book: Book;
  setBook: (change: (book: Book) => Book) => void;
  manage: boolean;
  view: () => ToView;
  refused: (audience: Audience | undefined) => string | null;
  viewed: () => void;
}

/** The event's groups and saved audiences, kept in the page's memory only; nothing is sent. */
export function useTo(state: MessagesState | null): ToApi {
  const [book, setBook] = useState(() => bookOf(state));
  const shown = useRef(false);
  const view = useCallback(() => (shown.current ? VIEW : viewOf(state, bookOf(state))), [state]);
  const refused = useCallback(
    (audience: Audience | undefined) =>
      shown.current ? null : refusedFirst(state, audience, bookOf(state).groups),
    [state],
  );
  const viewed = useCallback(() => {
    shown.current = true;
  }, []);

  return {
    state,
    book,
    setBook,
    manage: state !== 'noManage' && state !== 'stoppedNoManage',
    view,
    refused,
    viewed,
  };
}
