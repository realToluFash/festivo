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

/** By role, Lead first, then by name. */
export function inListOrder(people: readonly EventPerson[], locale: string): EventPerson[] {
  return [...people].sort(
    (one, other) =>
      EVENT_ROLES.indexOf(one.role) - EVENT_ROLES.indexOf(other.role) ||
      one.user.name.localeCompare(other.user.name, locale),
  );
}

/** Owners, Admins and the Lead change People: the API says so in the event's own permissions. */
export function managesPeople(event: { permissions: readonly string[] }): boolean {
  return event.permissions.includes('people.manage');
}

export function opensRow(person: EventPerson, manages: boolean, userId: string | null): boolean {
  return manages && person.user.id !== userId;
}

export function rowLine(t: TFunction, person: EventPerson, userId: string | null): string {
  return [
    t(`eventPeople.role.${person.role}`),
    person.jobLabel,
    person.user.id === userId ? t('eventPeople.you') : null,
  ]
    .filter((part) => part != null && part !== '')
    .join(' · ');
}

/** "Folake Adeyemi and Julien Morel see every event, as owner and admin of Ire Events.", or null with nobody above. */
export function seesEveryEvent(
  t: TFunction,
  read: Pick<EventPeople, 'owners' | 'admins'>,
  organisation: string,
  locale: string,
): string | null {
  const names = [...read.owners, ...read.admins];
  if (names.length === 0) return null;
  const list = listFormat(locale, { type: 'conjunction' });
  const roles = (['owner', 'admin'] as const)
    .map((role) => ({ role, held: read[`${role}s`].length }))
    .filter(({ held }) => held > 0)
    .map(({ role, held }) => t(`eventPeople.managerRole.${role}`, { count: held }));

  return t('eventPeople.managers', {
    count: names.length,
    names: list.format(names),
    roles: list.format(roles),
    organisation,
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
