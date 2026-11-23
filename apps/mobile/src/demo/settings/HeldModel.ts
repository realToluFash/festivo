import type { Membership } from '@soirely/api-client';

import type { ShellSection } from '../../components/settingsShell.ts';
import { switcherStateOf } from '../OrgSwitcherModel.ts';

/** What stands in place of Settings while the organisation holds the account: paused access (sc-564) or two-factor overdue (sc-609). */
export type Held = 'paused' | 'overdue';

export function heldOf(value: string | undefined): Held | null {
  return value === 'paused' || value === 'overdue' ? value : null;
}

/** `?switcher=one`: the switcher lists no organisation besides this one, as for a member of it alone or whose others are paused too (sc-85006). */
export function aloneOf(switcher: string | undefined): boolean {
  return switcherStateOf(switcher) === 'one';
}

// AccessPaused reads only how many others there are, to choose between switching and the switcher.
const OTHERS = [
  { id: 'org-casa-lumen', name: 'Casa Lumen Eventos' },
  { id: 'org-harbourlight', name: 'Harbour Light Weddings' },
] as unknown as Membership[];

export function othersOf(alone: boolean): readonly Membership[] {
  return alone ? [] : OTHERS;
}

const YOURS: readonly ShellSection[] = ['account', 'security', 'notifications', 'personalisation'];

/** Your account's four sections stay open while the organisation is paused, as the product's do. */
export function opensWhilePaused(section: ShellSection | null): boolean {
  return section != null && YOURS.includes(section);
}

/** A paused membership holds no role, so its group lists the two sections that need no permission (sc-86077). */
export function pausedGroups<Group extends { heading: string; sections: readonly ShellSection[] }>(
  groups: readonly Group[],
): Group[] {
  return groups.map((group) =>
    group.heading === 'organisationHeading'
      ? {
          ...group,
          sections: group.sections.filter(
            (section) => section === 'organisation' || section === 'signInRules',
          ),
        }
      : group,
  );
}
