import {
  type AddableMember,
  EVENT_ROLES,
  type EventPeople,
  type EventPerson,
  type EventRole,
} from '@soirely/api-client';
import {
  emailProblem,
  formatPhone,
  listFormat,
  phoneE164,
  phoneLengthProblem,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

import { refusalSaid } from './refusal.ts';

/** By the role's place in `order`, Lead first, then by name. */
export function inRoleOrder<P, R>(
  people: readonly P[],
  order: readonly R[],
  of: (person: P) => { role: R; name: string },
  locale: string,
): P[] {
  return [...people].sort((one, other) => {
    const a = of(one);
    const b = of(other);

    return order.indexOf(a.role) - order.indexOf(b.role) || a.name.localeCompare(b.name, locale);
  });
}

export function inListOrder(people: readonly EventPerson[], locale: string): EventPerson[] {
  return inRoleOrder(
    people,
    EVENT_ROLES,
    (one) => ({ role: one.role, name: one.user?.name ?? one.address ?? '' }),
    locale,
  );
}

export type PersonShown =
  | { kind: 'named'; name: string; userId: string }
  | { kind: 'address'; name: string; mark: 'mail' | 'phone' }
  | { kind: 'notJoined' };

/** Added by an address with no account yet: the address only to those the API sends it, "Not joined yet" to everyone else. */
export function personShown(person: EventPerson): PersonShown {
  if (person.user != null) return { kind: 'named', name: person.user.name, userId: person.user.id };
  if (person.address == null) return { kind: 'notJoined' };

  return person.addressKind === 'mobile'
    ? { kind: 'address', name: formatPhone(person.address), mark: 'phone' }
    : { kind: 'address', name: person.address, mark: 'mail' };
}

/** Owners, Admins and the Lead change People: the API says so in the event's own permissions. */
export function managesPeople(event: { permissions: readonly string[] }): boolean {
  return event.permissions.includes('people.manage');
}

/** Nobody opens their own row. */
export function opensRow(
  userId: string | null,
  manages: boolean,
  viewerId: string | null,
): boolean {
  return manages && (userId == null || userId !== viewerId);
}

/** The parts of a row's line that are there, a middle dot between them. */
export function joinedLine(parts: readonly (string | null | undefined)[]): string {
  return parts.filter((part) => part != null && part !== '').join(' · ');
}

export function rowLine(t: TFunction, person: EventPerson, userId: string | null): string {
  return joinedLine([
    t(`eventPeople.role.${person.role}`),
    person.jobLabel,
    person.user != null && person.user.id === userId ? t('eventPeople.you') : null,
  ]);
}

/** The foot's line from the names above the event, or null with nobody above; `say` puts the names and their roles in words. */
export function everyEventLine(
  above: { owners: readonly string[]; admins: readonly string[] },
  locale: string,
  say: {
    role: (role: 'owner' | 'admin', held: number) => string;
    line: (names: string, roles: string, count: number) => string;
  },
): string | null {
  const names = [...above.owners, ...above.admins];
  if (names.length === 0) return null;
  const list = listFormat(locale, { type: 'conjunction' });
  const roles = (['owner', 'admin'] as const)
    .map((role) => ({ role, held: above[`${role}s`].length }))
    .filter(({ held }) => held > 0)
    .map(({ role, held }) => say.role(role, held));

  return say.line(list.format(names), list.format(roles), names.length);
}

/** "Folake Adeyemi and Julien Morel see every event, as owner and admin of Ire Events.", or null with nobody above. */
export function seesEveryEvent(
  t: TFunction,
  read: Pick<EventPeople, 'owners' | 'admins'>,
  organisation: string,
  locale: string,
): string | null {
  return everyEventLine(read, locale, {
    role: (role, held) => t(`eventPeople.managerRole.${role}`, { count: held }),
    line: (names, roles, count) => t('eventPeople.managers', { count, names, roles, organisation }),
  });
}

export function nowCan(t: TFunction, role: EventRole, names: readonly string[]): string {
  return names.length === 1
    ? t(`eventPeople.nowOne.${role}`, { name: names[0] ?? '' })
    : t(`eventPeople.nowMany.${role}`, { count: names.length });
}

function plain(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/** Active members not on the event yet, by name. */
export function offered(addable: readonly AddableMember[], typed: string): AddableMember[] {
  const wanted = plain(typed);

  return wanted === '' ? [...addable] : addable.filter((one) => plain(one.name).includes(wanted));
}

/** Add people's one line: who went in, if anyone did, then why the rest did not. */
export function addRefused(
  t: TFunction,
  error: unknown,
  role: EventRole,
  went: readonly string[],
  left: readonly string[],
): string {
  const refused = refusalSaid(
    error,
    left.length === 1
      ? t('eventPeople.addFailedOne', { name: left[0] ?? '' })
      : t('eventPeople.addFailedMany', { count: left.length }),
  );

  return went.length === 0
    ? refused
    : t('eventPeople.addedThenRefused', { added: nowCan(t, role, went), refused });
}

export const JOB_LABEL_MOST = 60;

export interface Address {
  kind: 'email' | 'mobile';
  /** As sent and compared: an email as typed, a mobile number in E.164. */
  address: string;
  shown: string;
}

export type Typed = { kind: 'name' } | { kind: 'address'; address: Address } | { kind: 'unusable' };

/** sc-71: with an @, an email address; digits, a mobile number by sc-62's lengths for `country` unless it starts with its own + code; letters alone, a name to find. */
export function readTyped(typed: string, country: string): Typed {
  const text = typed.trim();
  if (text === '') return { kind: 'name' };
  if (text.includes('@'))
    return emailProblem(text) == null
      ? { kind: 'address', address: { kind: 'email', address: text, shown: text } }
      : { kind: 'unusable' };
  if (/\p{L}/u.test(text) || !/\d/u.test(text)) return { kind: 'name' };
  const e164 = phoneLengthProblem(text, country) == null ? phoneE164(text, country) : null;

  return e164 == null
    ? { kind: 'unusable' }
    : { kind: 'address', address: { kind: 'mobile', address: e164, shown: formatPhone(e164) } };
}

export type OutsideView =
  | { kind: 'none' }
  | { kind: 'offer'; address: Address }
  | { kind: 'unusable' }
  | { kind: 'leadOff' }
  | { kind: 'onEvent'; name: string };

/** What Add shows for someone from outside; `onEvent` names whoever already holds the address. */
export function outsideView(
  typed: string,
  country: string,
  leadPicked: boolean,
  onEvent: (address: Address) => string | null,
): OutsideView {
  const read = readTyped(typed, country);
  if (read.kind === 'name') return { kind: 'none' };
  if (read.kind === 'unusable') return { kind: 'unusable' };
  const there = onEvent(read.address);
  if (there != null) return { kind: 'onEvent', name: there };

  return leadPicked ? { kind: 'leadOff' } : { kind: 'offer', address: read.address };
}

/** Emails ignoring case, numbers in E.164, against the addresses the API sent. */
export function holderOf(
  people: readonly EventPerson[],
  address: Address,
  notJoined: string,
): string | null {
  const wanted = address.address.toLowerCase();
  const there = people.find((one) => one.address != null && one.address.toLowerCase() === wanted);
  if (there == null) return null;
  const shown = personShown(there);

  return shown.kind === 'notJoined' ? notJoined : shown.name;
}

/** Overview's People card (sc-68607): how many People lists under On this event, and who holds Lead, `you` when it is the viewer. */
export function cardFacts(
  people: readonly EventPerson[],
  viewerId: string | null,
): { count: number; lead: { name: string; you: boolean } | null } {
  const lead = people.find((one) => one.role === 'lead');

  return {
    count: people.length,
    lead: lead?.user == null ? null : { name: lead.user.name, you: lead.user.id === viewerId },
  };
}

/** The card's row: its count, its Lead line, and the one sentence VoiceOver reads for the row. */
export function cardWords(
  t: TFunction,
  facts: ReturnType<typeof cardFacts>,
): { title: string; line: string | undefined; label: string } {
  const opens = t('eventPeople.card.opens');

  if (facts.count === 0) {
    const title = t('eventPeople.nobody');

    return { title, line: undefined, label: `${title} ${opens}` };
  }

  const title = t('eventPeople.card.count', { count: facts.count });
  const name = facts.lead == null ? null : facts.lead.you ? t('eventPeople.you') : facts.lead.name;

  return {
    title,
    line: name == null ? undefined : t('eventPeople.card.lead', { name }),
    label: joinedSaid([
      `${title}.`,
      name == null ? null : t('eventPeople.card.leadSaid', { name }),
      opens,
    ]),
  };
}

const joinedSaid = (parts: readonly (string | null)[]) =>
  parts.filter((part) => part != null).join(' ');
