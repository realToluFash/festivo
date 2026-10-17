import type { Membership } from '@soirely/api-client';

export type Destination = 'home' | 'settings';

/** Only what a story has built: Calendar, Guests and Messages each add their own (sc-722, #727). */
export const DESTINATIONS: readonly Destination[] = ['home', 'settings'];

export const DESTINATION_HREF = { home: '/', settings: '/settings' } as const satisfies Record<
  Destination,
  string
>;

export type SettingsSection = 'account' | 'security';

export const SECTION_HREF = {
  account: '/settings/account',
  security: '/settings/security',
} as const satisfies Record<SettingsSection, string>;

/** The interim screens' old paths, kept so a link to one still lands on its Settings page. */
export const INTERIM_HREF = {
  '/security': SECTION_HREF.security,
  '/account': SECTION_HREF.account,
} as const;

export function destinationOf(pathname: string): Destination {
  return pathname === '/settings' || pathname.startsWith('/settings/') ? 'settings' : 'home';
}

/** The one remembered on this device while the account still belongs to it, else the first. */
export function chooseOrganisation(
  organisations: readonly Membership[],
  remembered: string | null,
): Membership | null {
  return organisations.find(({ id }) => id === remembered) ?? organisations[0] ?? null;
}
