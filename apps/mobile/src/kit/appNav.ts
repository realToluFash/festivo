export type Destination = 'home' | 'settings';

/** Only what a story has built: Calendar, Guests and Messages each add their own (sc-722, #727). */
export const DESTINATIONS: readonly Destination[] = ['home', 'settings'];

export const DESTINATION_HREF = { home: '/', settings: '/settings' } as const satisfies Record<
  Destination,
  string
>;

export type SettingsSection = 'account' | 'security' | 'organisation';

export const SECTION_HREF = {
  account: '/settings/account',
  security: '/settings/security',
  organisation: '/settings/organisation',
} as const satisfies Record<SettingsSection, string>;

/** The interim screens' old paths, kept so a link to one still lands on its Settings page. */
export const INTERIM_HREF = {
  '/security': SECTION_HREF.security,
  '/account': SECTION_HREF.account,
} as const;

export function destinationOf(pathname: string): Destination {
  return pathname === '/settings' || pathname.startsWith('/settings/') ? 'settings' : 'home';
}

export interface SettingsGroup {
  heading: 'yourAccount' | 'organisationHeading';
  sections: readonly SettingsSection[];
}

export function settingsGroups(inOrganisation: boolean): readonly SettingsGroup[] {
  const yours: SettingsGroup = { heading: 'yourAccount', sections: ['account', 'security'] };

  return inOrganisation
    ? [yours, { heading: 'organisationHeading', sections: ['organisation'] }]
    : [yours];
}
