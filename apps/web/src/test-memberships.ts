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
    role: { id: 'role_1', seededAs: 'owner', name: null },
    ...overrides,
  };
}
