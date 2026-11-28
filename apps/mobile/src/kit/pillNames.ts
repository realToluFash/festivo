import type { Membership } from '@soirely/api-client';
import { roleName } from '@soirely/domain';
import type { TFunction } from 'i18next';

import type { SignedIn } from '../signedIn.ts';

/** An organisation a pill names, with no role while its access is paused: the API returns none for a paused membership. */
export interface Named {
  id: string;
  name: string;
  role: Membership['role'] | null;
}

/** While the organisation in use is paused, the pill names that one, the organisation the paused page is about (sc-83881). */
export function pillNames({
  organisation,
  pausedIn,
}: Pick<SignedIn, 'organisation' | 'pausedIn'>): Named | null {
  if (pausedIn != null) return { id: pausedIn.id, name: pausedIn.name, role: null };

  return organisation;
}

/** The pill's screen-reader label; a paused one says so in place of the role, and always switches, as the pill opens the switcher there (sc-83881). */
export function openerLabel(
  t: TFunction,
  named: Named,
  waiting: number,
  switches: boolean,
): string {
  const name = named.name;

  if (named.role == null) {
    return waiting > 0
      ? t('switcher.labelPausedWaiting', { name, count: waiting })
      : t('switcher.labelPaused', { name });
  }

  const role = roleName(t, named.role);
  if (!switches) return t('switcher.label', { name, role });
  if (waiting > 0) return t('switcher.labelSwitchWaiting', { name, role, count: waiting });

  return t('switcher.labelSwitch', { name, role });
}
