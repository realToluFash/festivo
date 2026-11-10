import { ApiError } from '@soirely/api-client';
import { type NewOrganisation, createNewOrganisation } from '@soirely/domain';

import type { Walk, WalkAnswer } from './createWalk.ts';

/** sc-390's Create an organisation as the server answers it, in the walk's shape. */
export function createOrganisation<Made>(
  create: (organisation: NewOrganisation) => Promise<Made>,
  walk: Pick<Walk, 'name' | 'country' | 'device'>,
): Promise<WalkAnswer<Made>> {
  return createNewOrganisation(
    create,
    { name: walk.name, countryCode: walk.country ?? '', timezone: walk.device.zone },
    (error) => (error instanceof ApiError ? error : null),
  );
}
