import { ApiError, type Membership } from '@soirely/api-client';
import { describe, expect, it, vi } from 'vitest';

import { detailsOf, saveOrganisation } from './organisationSave.ts';

const organisation: Membership = {
  id: 'org_1',
  name: 'Ìrè Events',
  countryCode: 'NG',
  contactAddress: 'hello@ire.events',
  currency: 'NGN',
  timezone: 'Africa/Lagos',
  role: { id: 'role_1', seededAs: 'owner', name: null },
};

function refusal(
  status: number,
  violations: { propertyPath: string; message: string; code: string }[] = [],
) {
  const code = status === 422 ? 'validation_failed' : 'server_error';
  const problem = { type: `https://soirely.com/errors/${code}`, title: 'No.', status, violations };

  return new ApiError(problem, new Response(JSON.stringify(problem), { status }));
}

describe('saving the Organisation page', () => {
  it('sends only what changed, to the API the web’s General uses', async () => {
    const update = vi.fn(async () => ({ ...detailsOf(organisation), id: 'org_1', name: 'Ìrè' }));

    await saveOrganisation(update, organisation, { ...detailsOf(organisation), name: ' Ìrè ' });

    expect(update).toHaveBeenCalledWith('org_1', { name: 'Ìrè' });
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

  it('fails whole on anything else, and a 403 is one of those', async () => {
    for (const status of [403, 500]) {
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
