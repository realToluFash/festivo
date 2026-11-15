import { ApiError, ApiUnreachableError } from '@soirely/api-client';

export type DeadLink = 'used' | 'expired' | 'invalid';

/** Only the API's refusal of the link makes it dead (sc-29071). */
export function deadFrom(error: unknown): DeadLink | null {
  if (!(error instanceof ApiError)) return null;
  if (error.is('reset_link_used')) return 'used';
  if (error.is('reset_link_expired')) return 'expired';
  if (error.is('reset_link_invalid')) return 'invalid';

  return null;
}

/** What a failed read of the reset link shows: its dead-link screen, Cannot reach Soirely, or That did not work (sc-35770). */
export function readFailure(error: unknown): DeadLink | 'unreachable' | 'unread' {
  if (error instanceof ApiUnreachableError) return 'unreachable';

  return deadFrom(error) ?? 'unread';
}
