import { describe, expect, it } from 'vitest';

import { demoGroups, SECTIONS, VIEWER_PERSON, viewerOf } from './sample.ts';

describe('Settings home in the demo, with three roles', () => {
  it('shows an owner or an admin Organisation, Members and Sign-in rules, and no Roles', () => {
    expect(demoGroups('owner')).toEqual([
      { heading: 'yourAccount', sections: ['account', 'security', 'notifications'] },
      { heading: 'organisationHeading', sections: ['organisation', 'members', 'signInRules'] },
    ]);
  });

  it('shows a member her own sections and Sign-in rules alone', () => {
    expect(demoGroups('member')).toEqual([
      { heading: 'yourAccount', sections: ['account', 'security', 'notifications'] },
      { heading: 'organisationHeading', sections: ['signInRules'] },
    ]);
    expect(VIEWER_PERSON.member.name).toBe('Priya Shah');
  });

  it('shows somebody with no organisation only their own', () => {
    expect(demoGroups('noOrg')).toEqual([
      { heading: 'yourAccount', sections: ['account', 'security', 'notifications'] },
    ]);
  });

  it('reads the old planner link as the member, and anything else as the owner', () => {
    expect(viewerOf('planner')).toBe('member');
    expect(viewerOf('member')).toBe('member');
    expect(viewerOf('noOrg')).toBe('noOrg');
    expect(viewerOf(undefined)).toBe('owner');
    expect(SECTIONS).not.toContain('roles');
  });
});
