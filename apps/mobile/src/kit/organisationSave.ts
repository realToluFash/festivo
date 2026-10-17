import { ApiError, type Membership, type Organisation } from '@soirely/api-client';
import {
  ORGANISATION_FIELDS,
  type OrganisationDetails,
  type OrganisationField,
  organisationChanges,
} from '@soirely/domain';

export type SaveOutcome =
  | { kind: 'saved'; organisation: Membership }
  | { kind: 'refused'; errors: Partial<Record<OrganisationField, string>> }
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

    return { kind: 'failed' };
  }
}

export function detailsOf(organisation: OrganisationDetails): OrganisationDetails {
  return {
    name: organisation.name,
    countryCode: organisation.countryCode,
    contactAddress: organisation.contactAddress,
    currency: organisation.currency,
    timezone: organisation.timezone,
  };
}
