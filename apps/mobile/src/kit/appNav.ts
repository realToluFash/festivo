import { roleHolds } from '@soirely/domain';

export type Destination = 'home' | 'events' | 'settings';

export const DESTINATION_HREF = {
  home: '/',
  events: '/events',
  settings: '/settings',
} as const satisfies Record<Destination, string>;

/** Only what a story has built (sc-722, #727), and Events only for a role that can read them (sc-1593). */
export function destinations(
  organisation: { permissions: readonly string[] } | null,
): readonly Destination[] {
  return [
    'home',
    ...(organisation != null && roleHolds(organisation, 'events.read')
      ? (['events'] as const)
      : []),
    'settings',
  ];
}

export type SettingsSection =
  'account' | 'security' | 'notifications' | 'organisation' | 'members' | 'roles' | 'signInRules';

export const SECTION_HREF = {
  account: '/settings/account',
  security: '/settings/security',
  notifications: '/settings/notifications',
  organisation: '/settings/organisation',
  members: '/settings/members',
  roles: '/settings/roles',
  signInRules: '/settings/sign-in-rules',
} as const satisfies Record<SettingsSection, string>;

/** The interim screens' old paths, kept so a link to one still lands on its Settings page. */
export const INTERIM_HREF = {
  '/security': SECTION_HREF.security,
  '/account': SECTION_HREF.account,
} as const;

export function destinationOf(pathname: string): Destination {
  const under = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return under(DESTINATION_HREF.settings)
    ? 'settings'
    : under(DESTINATION_HREF.events)
      ? 'events'
      : 'home';
}

export interface SettingsGroup {
  heading: 'yourAccount' | 'organisationHeading';
  sections: readonly SettingsSection[];
}

/** Members only for a role that can read them, as on the web; Roles only for one that can change them (sc-1931). */
export function settingsGroups(
  organisation: { permissions: readonly string[] } | null,
): readonly SettingsGroup[] {
  const yours: SettingsGroup = {
    heading: 'yourAccount',
    sections: ['account', 'security', 'notifications'],
  };
  if (organisation == null) return [yours];

  return [
    yours,
    {
      heading: 'organisationHeading',
      sections: [
        'organisation',
        ...(roleHolds(organisation, 'members.read') ? (['members'] as const) : []),
        ...(roleHolds(organisation, 'members.manage') ? (['roles'] as const) : []),
        'signInRules',
      ],
    },
  ];
}
