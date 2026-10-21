import { ApiError, type Membership } from '@soirely/api-client';
import { describe, expect, it, vi } from 'vitest';

import { afterEdit, detailsOf, refusalOf, saveOrganisation } from './organisationSave.ts';

const organisation: Membership = {
  id: 'org_1',
  name: 'Ìrè Events',
  countryCode: 'NG',
  contactAddress: 'hello@ire.events',
  locale: 'en',
  currency: 'NGN',
  timezone: 'Africa/Lagos',
  role: { id: 'role_1', seededAs: 'owner', name: null },
  permissions: ['organisation.manage'],
  withheldUntilTwoFactor: [],
  readOnlyUntilLinked: false,
  signInRules: {
    providerOnly: false,
    inactivityTimeoutDays: null,
    administratorsNeedTwoFactor: false,
    changedAt: null,
  },
};

function refusal(
  status: number,
  violations: { propertyPath: string; message: string; code: string }[] = [],
) {
  const code =
    status === 422 ? 'validation_failed' : status === 403 ? 'permission_required' : 'server_error';
  const problem = { type: `https://soirely.com/errors/${code}`, title: 'No.', status, violations };

  return new ApiError(problem, new Response(JSON.stringify(problem), { status }));
}

describe('saving the Organisation page', () => {
  it('sends only what changed, to the API the web’s General uses', async () => {
    const update = vi.fn(async () => ({ ...detailsOf(organisation), id: 'org_1', name: 'Ìrè' }));

    await saveOrganisation(update, organisation, { ...detailsOf(organisation), name: ' Ìrè ' });

    expect(update).toHaveBeenCalledWith('org_1', { name: 'Ìrè' });
  });

  it('sends a new language on the same PATCH as the other details', async () => {
    const update = vi.fn(async () => ({ ...detailsOf(organisation), id: 'org_1', locale: 'fr' }));

    const outcome = await saveOrganisation(update, organisation, {
      ...detailsOf(organisation),
      locale: 'fr',
    });

    expect(update).toHaveBeenCalledWith('org_1', { locale: 'fr' });
    expect(outcome).toEqual({ kind: 'saved', organisation: { ...organisation, locale: 'fr' } });
  });

  it('keeps the role, so the switcher and the page still know who may change it', async () => {
    const update = vi.fn(async () => ({ ...detailsOf(organisation), id: 'org_1', name: 'Ìrè' }));

    const outcome = await saveOrganisation(update, organisation, {
      ...detailsOf(organisation),
      name: 'Ìrè',
    });

    expect(outcome).toEqual({
      kind: 'saved',
      organisation: { ...organisation, name: 'Ìrè' },
    });
  });

  it('puts a refusal beside the fields it names', async () => {
    const update = vi.fn(async () => {
      throw refusal(422, [
        {
          propertyPath: 'contactAddress',
          message: 'Enter a contact email address.',
          code: 'blank',
        },
        { propertyPath: 'somethingElse', message: 'Not a field here.', code: 'other' },
      ]);
    });

    const outcome = await saveOrganisation(update, organisation, detailsOf(organisation));

    expect(outcome).toEqual({
      kind: 'refused',
      errors: { contactAddress: 'Enter a contact email address.' },
    });
  });

  it('says so when the role no longer holds the permission, and saves nothing', async () => {
    const update = vi.fn(async () => {
      throw refusal(403);
    });

    expect(
      await saveOrganisation(update, organisation, { ...detailsOf(organisation), locale: 'fr' }),
    ).toEqual({ kind: 'forbidden' });
  });

  it('fails whole on anything else', async () => {
    for (const status of [500]) {
      const update = vi.fn(async () => {
        throw refusal(status);
      });

      expect(await saveOrganisation(update, organisation, detailsOf(organisation))).toEqual({
        kind: 'failed',
      });
    }

    const offline = vi.fn(async () => {
      throw new TypeError('Network request failed');
    });

    expect(await saveOrganisation(offline, organisation, detailsOf(organisation))).toEqual({
      kind: 'failed',
    });
  });
});

describe('focus after a refused save', () => {
  it('asks for the first refused field the person can type in', () => {
    expect(refusalOf({ contactAddress: 'No.', name: 'No.' }).focus).toEqual({ field: 'name' });
    expect(refusalOf({ currency: 'No.', contactAddress: 'No.' }).focus).toEqual({
      field: 'contactAddress',
    });
    expect(refusalOf({ currency: 'No.' }).focus).toBeNull();
  });

  it('asks again on every refusal, even of the same field', () => {
    expect(refusalOf({ name: 'No.' }).focus).not.toBe(refusalOf({ name: 'No.' }).focus);
  });

  it('never moves focus as the person edits, whichever field they touch', () => {
    const refused = refusalOf({ name: 'No.', contactAddress: 'No.' });

    for (const field of ['name', 'currency', 'contactAddress'] as const) {
      const edited = afterEdit(refused, field);

      expect(edited.focus).toBe(refused.focus);
      expect(edited.errors[field]).toBeUndefined();
    }
  });
});
