import { describe, expect, it } from 'vitest';

import {
  demoGroups,
  lookingAs,
  memberLooking,
  SECTIONS,
  VIEWER_PERSON,
  viewerOf,
  viewerOfRole,
} from './sample.ts';

describe('Settings home in the demo, with three roles', () => {
  it('shows an owner or an admin Organisation, Members and Sign-in rules, and no Roles', () => {
    expect(demoGroups('owner')).toEqual([
      {
        heading: 'yourAccount',
        sections: ['account', 'security', 'notifications', 'personalisation'],
      },
      { heading: 'organisationHeading', sections: ['organisation', 'members', 'signInRules'] },
    ]);
  });

  it('shows a member her own sections and Sign-in rules alone', () => {
    expect(demoGroups('member')).toEqual([
      {
        heading: 'yourAccount',
        sections: ['account', 'security', 'notifications', 'personalisation'],
      },
      { heading: 'organisationHeading', sections: ['signInRules'] },
    ]);
    expect(VIEWER_PERSON.member.name).toBe('Priya Shah');
  });

  it('shows somebody with no organisation only their own', () => {
    expect(demoGroups('noOrg')).toEqual([
      {
        heading: 'yourAccount',
        sections: ['account', 'security', 'notifications', 'personalisation'],
      },
    ]);
  });

  it('reads the old planner link as the member, and anything else as the owner', () => {
    expect(viewerOf('planner')).toBe('member');
    expect(viewerOf('member')).toBe('member');
    expect(viewerOf('noOrg')).toBe('noOrg');
    expect(viewerOf(undefined)).toBe('owner');
    expect(SECTIONS).not.toContain('roles');
  });

  it('shows who is looking with their role, and no role outside an organisation', () => {
    expect(lookingAs('owner')).toMatchObject({ name: 'Folake Adeyemi', role: 'Owner' });
    expect(lookingAs('member')).toMatchObject({ name: 'Priya Shah', role: 'Member' });
    expect(lookingAs('noOrg')).toMatchObject({ name: 'Folake Adeyemi', role: null });
    expect(memberLooking('julien@ire.events')).toEqual({
      name: 'Julien Moreau',
      initials: 'JM',
      email: 'julien@ire.events',
      role: 'Admin',
    });
    expect(() => memberLooking('nobody@ire.events')).toThrow();
  });

  it('gives an admin the sections an owner sees, and a member hers', () => {
    expect(viewerOfRole('Owner')).toBe('owner');
    expect(viewerOfRole('Admin')).toBe('owner');
    expect(viewerOfRole('Member')).toBe('member');
    expect(viewerOfRole(null)).toBe('noOrg');
  });
});
