import { ApiError, ApiUnreachableError } from '@soirely/api-client';

/** What a failed search shows (sc-39534): a refusal is a search that found nothing, never an error. */
export type SearchFailure = 'refused' | 'offline' | 'failed';

export function searchFailure(error: unknown): SearchFailure {
  if (error instanceof ApiError && error.status === 403) return 'refused';

  return error instanceof ApiUnreachableError ? 'offline' : 'failed';
}
