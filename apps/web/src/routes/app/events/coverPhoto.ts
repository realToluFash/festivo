import { ApiError } from '@soirely/api-client';
import { coverRefusalWords } from '@soirely/domain';

import { api } from '../../../api.ts';

/** The photo chosen and not used goes, so its original is not kept with its GPS; a closed tab's is expired by the store. */
export function discardCoverUpload(organisationId: string, key: string): void {
  void api.discardEventCoverUpload(organisationId, key).catch(() => undefined);
}

/** A refusal the API explained (a 422 on the photo or the description), otherwise the upload simply failed. */
export function refusalOf(error: unknown, t: (key: string) => string): string {
  return coverRefusalWords(
    error instanceof ApiError && error.status === 422 ? error.fieldErrors() : null,
    t,
  );
}
