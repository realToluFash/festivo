import { ApiError, type Membership, type Organisation } from '@soirely/api-client';
import {
  ORGANISATION_FIELDS,
  type OrganisationDetails,
  type OrganisationField,
  organisationChanges,
} from '@soirely/domain';
import { type TFunction } from 'i18next';

export type SaveOutcome =
  | { kind: 'saved'; organisation: Membership }
  | { kind: 'refused'; errors: Partial<Record<OrganisationField, string>> }
  | { kind: 'forbidden'; byRule: boolean }
  | { kind: 'failed' };

export async function saveOrganisation(
  update: (id: string, changes: Partial<OrganisationDetails>) => Promise<Organisation>,
  organisation: Membership,
  values: OrganisationDetails,
): Promise<SaveOutcome> {
  try {
    const saved = await update(
      organisation.id,
      organisationChanges(detailsOf(organisation), values),
    );

    return { kind: 'saved', organisation: { ...organisation, ...saved } };
  } catch (error) {
    if (error instanceof ApiError && error.is('validation_failed')) {
      const named = error.fieldErrors();
      const errors: Partial<Record<OrganisationField, string>> = {};
      for (const field of ORGANISATION_FIELDS) {
        if (named[field] != null) errors[field] = named[field];
      }

      return { kind: 'refused', errors };
    }

    if (error instanceof ApiError && error.is('permission_required'))
      return { kind: 'forbidden', byRule: false };

    if (
      error instanceof ApiError &&
      (error.is('oauth_only_unlinked') || error.is('organisation_two_factor_required'))
    )
      return { kind: 'forbidden', byRule: true };

    return { kind: 'failed' };
  }
}

export type Refusal = {
  errors: Partial<Record<OrganisationField, string>>;
  focus: { field: 'name' | 'contactAddress' } | null;
};

export const NO_REFUSAL: Refusal = { errors: {}, focus: null };

/** A new focus request only here, when a save comes back refused; edits keep the one they had. */
export function refusalOf(errors: Refusal['errors']): Refusal {
  const first = ORGANISATION_FIELDS.find((field) => errors[field] != null);

  return {
    errors,
    focus: first === 'name' || first === 'contactAddress' ? { field: first } : null,
  };
}

export function afterEdit(refusal: Refusal, field: OrganisationField): Refusal {
  return { errors: { ...refusal.errors, [field]: undefined }, focus: refusal.focus };
}

export function detailsOf(organisation: OrganisationDetails): OrganisationDetails {
  return {
    name: organisation.name,
    countryCode: organisation.countryCode,
    contactAddress: organisation.contactAddress,
    currency: organisation.currency,
    timezone: organisation.timezone,
    locale: organisation.locale,
  };
}

export type CardSaid = { kind: 'saved'; words: string } | { kind: 'transferred'; to: string };

export function cardWords(
  t: TFunction,
  details: OrganisationDetails,
  said: CardSaid | null,
): { says: string; line: string; said: boolean } {
  if (said == null) return { says: details.name, line: details.contactAddress, said: false };
  if (said.kind === 'saved')
    return { says: t('orgGeneral.savedSays'), line: said.words, said: true };

  return {
    says: t('ownership.transferredSays', { name: said.to }),
    line: t('ownership.transferredLine'),
    said: true,
  };
}

/** A new invitation language is named, since it changes what goes out from now on. */
export function savedWords(
  t: TFunction,
  now: OrganisationDetails,
  before: OrganisationDetails,
): string {
  return now.locale === before.locale
    ? t('orgGeneral.saved', { name: now.name })
    : t('orgGeneral.savedLanguage', {
        language: t(`languageNamesInSentence.${now.locale}`, { defaultValue: now.locale }),
      });
}
