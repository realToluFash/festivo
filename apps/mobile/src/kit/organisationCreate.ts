import { ApiError, type Membership } from '@soirely/api-client';
import {
  type NewOrganisationField,
  formatTimeOfDay,
  lockLiftsAt,
  newOrganisationProblem,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

export const NEW_ORGANISATION_FIELDS: readonly NewOrganisationField[] = ['name', 'countryCode'];

export type CreateOutcome =
  | { kind: 'created'; organisation: Membership }
  | { kind: 'refused'; errors: Partial<Record<NewOrganisationField, string>> }
  | { kind: 'limited'; until: Date | null }
  | { kind: 'failed' };

/** sc-390's "Create an organisation", as the web's dialog sends it. */
export async function createOrganisation(
  create: (organisation: {
    name: string;
    countryCode: string;
    timezone: string;
  }) => Promise<Membership>,
  values: Record<NewOrganisationField, string>,
  timezone: string,
): Promise<CreateOutcome> {
  try {
    const organisation = await create({
      name: values.name.trim(),
      countryCode: values.countryCode,
      timezone,
    });

    return { kind: 'created', organisation };
  } catch (error) {
    if (error instanceof ApiError && error.is('too_many_attempts')) {
      return {
        kind: 'limited',
        until: lockLiftsAt(Number(error.response?.headers.get('Retry-After'))),
      };
    }

    if (error instanceof ApiError && error.is('validation_failed')) {
      const named = error.fieldErrors();
      const errors: Partial<Record<NewOrganisationField, string>> = {};
      for (const field of NEW_ORGANISATION_FIELDS) {
        if (named[field] != null) errors[field] = named[field];
      }

      return { kind: 'refused', errors };
    }

    return { kind: 'failed' };
  }
}

/** The check before sending, in the words both clients use. */
export function newOrganisationMessage(
  field: NewOrganisationField,
  value: string,
  t: TFunction,
): string | null {
  const problem = newOrganisationProblem(field, value);

  if (problem == null) return null;
  if (problem.kind === 'nameLong')
    return t('createOrganisation.nameLong', { length: problem.length });

  return problem.kind === 'nameBlank' ? t('orgGeneral.nameBlank') : t('forms.countryBlank');
}

/** "Too many new organisations for now. Try again at 14:35.", the time in the reader's own clock. */
export function limitMessage(until: Date | null, locale: string, t: TFunction): string {
  const title = t('createOrganisation.limitedTitle');

  return until == null
    ? title
    : `${title} ${t('createOrganisation.limitedBody', { time: formatTimeOfDay(until, locale) })}`;
}
