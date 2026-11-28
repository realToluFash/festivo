import type { StaffEntry } from '@soirely/api-client';
import type { Translate } from '@soirely/domain';

/** The removal question's added line: only a person whose briefing went (sent, read, or changed since), whom a push reaches, before the event is Finished. */
export function removalLine(one: StaffEntry, finished: boolean, t: Translate): string | null {
  if (finished || !one.inApp || one.briefing === 'none') return null;

  return t('notices.removal', { name: one.fullName });
}
