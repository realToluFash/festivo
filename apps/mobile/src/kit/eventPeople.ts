import {
  type AddableMember,
  ApiError,
  EVENT_ROLES,
  type EventPeople,
  type EventPerson,
  type EventRole,
} from '@soirely/api-client';
import { listFormat } from '@soirely/domain';
import type { TFunction } from 'i18next';

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
    (one) => ({ role: one.role, name: one.user.name }),
    locale,
  );
}

/** Owners, Admins and the Lead change People: the API says so in the event's own permissions. */
export function managesPeople(event: { permissions: readonly string[] }): boolean {
  return event.permissions.includes('people.manage');
}

/** Nobody opens their own row. */
export function opensRow(userId: string, manages: boolean, viewerId: string | null): boolean {
  return manages && userId !== viewerId;
}

/** The parts of a row's line that are there, a middle dot between them. */
export function joinedLine(parts: readonly (string | null | undefined)[]): string {
  return parts.filter((part) => part != null && part !== '').join(' · ');
}

export function rowLine(t: TFunction, person: EventPerson, userId: string | null): string {
  return joinedLine([
    t(`eventPeople.role.${person.role}`),
    person.jobLabel,
    person.user.id === userId ? t('eventPeople.you') : null,
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

/** Active members not on the event yet, by name only (sc-71 adds an address). */
export function offered(addable: readonly AddableMember[], typed: string): AddableMember[] {
  const wanted = plain(typed);

  return wanted === '' ? [...addable] : addable.filter((one) => plain(one.name).includes(wanted));
}

/** The API's reason when it refused, or the fallback when it never answered. */
export function refusal(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError) || error.status === 0 || error.status >= 500) return fallback;
  const { violations, detail, title } = error.problem;

  return violations?.[0]?.message ?? detail ?? title;
}
