import { emailProblem } from './forms.ts';

/** The one remembered on this device while the account still belongs to it, else the first. */
export function chooseOrganisation<T extends { id: string }>(
  organisations: readonly T[],
  remembered: string | null,
): T | null {
  return organisations.find(({ id }) => id === remembered) ?? organisations[0] ?? null;
}

/** The paused organisation this device was in (sc-564), or the first when nothing else can open. */
export function choosePaused<T extends { id: string }>(
  paused: readonly T[],
  remembered: string | null,
  activeCount: number,
): T | null {
  return (
    paused.find(({ id }) => id === remembered) ?? (activeCount === 0 ? (paused[0] ?? null) : null)
  );
}

/** Switch organisation on the paused screen: straight into the only other active one, the switcher for more, absent for none. */
export function pausedSwitch<T>(others: readonly T[]): T | 'switcher' | null {
  if (others.length > 1) return 'switcher';

  return others[0] ?? null;
}

/** The paused screen's reason, worded for the person; Restore needs them only when their address went. */
export function pausedReasonKey(reason: string): string {
  if (reason === 'domain_closed') return 'accessPaused.becauseDomainClosed';
  if (reason === 'domain_managed_elsewhere') return 'accessPaused.becauseManagedElsewhere';

  return 'accessPaused.becauseAddressGone';
}

/** A seeded role is worded in the reader's language; a role an organisation made keeps its own name. */
export function roleName(
  word: (key: string) => string,
  role: { seededAs: string | null; name: string | null },
): string {
  return role.seededAs != null ? word(`roles.${role.seededAs}`) : (role.name ?? '');
}

/** What the member's role holds in this organisation, as the API lists it (sc-66): a control it cannot use is not shown. */
export function roleHolds(
  membership: { permissions: readonly string[] },
  permission: string,
): boolean {
  return permission !== '' && membership.permissions.includes(permission);
}

export type OrganisationField =
  'name' | 'countryCode' | 'contactAddress' | 'currency' | 'timezone' | 'locale';

export type OrganisationDetails = Record<OrganisationField, string>;

/** The order both clients show the fields in, and so the order a refusal takes focus in. */
export const ORGANISATION_FIELDS: readonly OrganisationField[] = [
  'name',
  'countryCode',
  'contactAddress',
  'currency',
  'timezone',
  'locale',
];

/** The API's OrganisationRules::NAME_MAXIMUM. */
export const ORGANISATION_NAME_MAXIMUM = 100;

/** What a request to join through the request link may say, in characters, as the API counts them (sc-562). */
export const REQUEST_MESSAGE_MAXIMUM = 500;

/** What a client checks before saving. Country, time zone and language come from pickers, so they cannot be wrong; a currency can still be unchosen (sc-909). */
export function organisationProblem(
  field: OrganisationField,
  value: string,
): 'nameBlank' | 'currencyBlank' | 'contactBlank' | 'contactInvalid' | null {
  if (field === 'name') return value.trim() === '' ? 'nameBlank' : null;

  if (field === 'currency') return value === '' ? 'currencyBlank' : null;

  if (field !== 'contactAddress') return null;

  const problem = emailProblem(value);

  if (problem == null) return null;

  return problem === 'blank' ? 'contactBlank' : 'contactInvalid';
}

/** Only what changed is sent, so an edit never rewrites a field somebody else has just saved. */
export function organisationChanges(
  saved: OrganisationDetails,
  values: OrganisationDetails,
): Partial<OrganisationDetails> {
  const changes: Partial<OrganisationDetails> = {};

  for (const field of ORGANISATION_FIELDS) {
    if (values[field].trim() !== saved[field]) changes[field] = values[field].trim();
  }

  return changes;
}

/** A stored value the platform does not list is still offered first, rather than silently replaced on save. */
export function withCurrent(listed: readonly string[], current: string): string[] {
  return listed.includes(current) ? [...listed] : [current, ...listed];
}

export type NewOrganisationField = 'name' | 'countryCode';

export type NewOrganisationProblem =
  { kind: 'nameBlank' } | { kind: 'nameLong'; length: number } | { kind: 'countryBlank' };

/** "Create an organisation" (sc-390): the name is counted after trimming, as the API counts it. */
export function newOrganisationProblem(
  field: NewOrganisationField,
  value: string,
): NewOrganisationProblem | null {
  if (field === 'countryCode') return value === '' ? { kind: 'countryBlank' } : null;

  const name = value.trim();
  const length = Array.from(name).length;

  if (length === 0) return { kind: 'nameBlank' };

  return length > ORGANISATION_NAME_MAXIMUM ? { kind: 'nameLong', length } : null;
}
