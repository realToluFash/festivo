import type { Membership } from '@soirely/api-client';

/** A membership as GET /api/orgs answers it, for tests that only care about a few fields. */
export function membership(overrides: Partial<Membership> = {}): Membership {
  return {
    id: 'org_1',
    name: 'Ìrè Events',
    countryCode: 'NG',
    currency: 'NGN',
    timezone: 'Africa/Lagos',
    contactAddress: 'hello@ire.events',
    locale: 'en',
    role: { id: 'role_1', seededAs: 'owner', name: null },
    permissions: OWNER_PERMISSIONS,
    withheldUntilTwoFactor: [],
    readOnlyUntilLinked: false,
    twoFactorDue: null,
    signInRules: {
      providerOnly: false,
      inactivityTimeoutDays: null,
      administratorsNeedTwoFactor: false,
      everyoneNeedsTwoFactor: false,
      changedAt: null,
    },
    ...overrides,
  };
}

/** As the API answers for Owner, so a test's owner can do what the product's owner can. */
export const OWNER_PERMISSIONS = [
  'events.read',
  'events.manage',
  'guests.read',
  'guests.manage',
  'seating.read',
  'seating.manage',
  'menu.read',
  'menu.manage',
  'run_of_show.read',
  'run_of_show.manage',
  'staff.read',
  'staff.manage',
  'messages.read',
  'messages.manage',
  'reports.read',
  'reports.manage',
  'budget.read',
  'budget.manage',
  'budget.margin',
  'vendors.read',
  'vendors.manage',
  'members.read',
  'members.manage',
  'billing.read',
  'billing.manage',
  'organisation.manage',
];
