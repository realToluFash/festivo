import { type Membership } from '@soirely/api-client';
import {
  ORGANISATION_FIELDS,
  type OrganisationField,
  organisationProblem,
  roleHolds,
} from '@soirely/domain';
import { type TFunction } from 'i18next';

import { api } from '../../../api.ts';
import { replaceOrganisation } from '../../../session.ts';

/** In the reader's language alone, as a row names it. */
export function languageName(t: TFunction, code: string): string {
  return t(`languageNames.${code}`, { defaultValue: code });
}

/** Mid-sentence, where es, fr and pt write a language's name in lowercase. */
export function languageNameInSentence(t: TFunction, code: string): string {
  return t(`languageNamesInSentence.${code}`, { defaultValue: code });
}

/** The page's load, and the reread after a refusal: the session catches up so every other screen does too. */
export async function rereadOrganisation(
  id: string,
  watch: <T>(load: Promise<T>) => Promise<T> = (load) => load,
): Promise<void> {
  const fresh = (await watch(api.organisations())).find((membership) => membership.id === id);
  if (fresh != null) replaceOrganisation(fresh);
}

export function checkBeforeSending(
  values: Record<OrganisationField, string>,
  t: (key: string) => string,
): Partial<Record<OrganisationField, string>> {
  const errors: Partial<Record<OrganisationField, string>> = {};

  for (const field of ORGANISATION_FIELDS) {
    const problem = organisationProblem(field, values[field]);
    if (problem != null) errors[field] = t(`orgGeneral.${problem}`);
  }

  return errors;
}

/** A held Owner has no `organisation.manage`, and the server mounts it on transfer and delete alike (sc-30191). */
export function ownsAndManages(organisation: Membership): boolean {
  return organisation.role.seededAs === 'owner' && roleHolds(organisation, 'organisation.manage');
}
