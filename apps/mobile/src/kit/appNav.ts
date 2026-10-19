import { roleHolds } from '@soirely/domain';

export type Destination = 'home' | 'settings';

/** Only what a story has built: Calendar, Guests and Messages each add their own (sc-722, #727). */
export const DESTINATIONS: readonly Destination[] = ['home', 'settings'];

export const DESTINATION_HREF = { home: '/', settings: '/settings' } as const satisfies Record<
  Destination,
  string
>;

export type SettingsSection = 'account' | 'security' | 'organisation' | 'members' | 'signInRules';

export const SECTION_HREF = {
  account: '/settings/account',
  security: '/settings/security',
  organisation: '/settings/organisation',
  members: '/settings/members',
  signInRules: '/settings/sign-in-rules',
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

/** Members only for a role that can read them, as on the web. */
export function settingsGroups(
  organisation: { permissions: readonly string[] } | null,
): readonly SettingsGroup[] {
  const yours: SettingsGroup = { heading: 'yourAccount', sections: ['account', 'security'] };
  if (organisation == null) return [yours];

  const members = roleHolds(organisation, 'members.read');

  return [
    yours,
    {
      heading: 'organisationHeading',
      sections: members
        ? ['organisation', 'members', 'signInRules']
        : ['organisation', 'signInRules'],
    },
  ];
}
