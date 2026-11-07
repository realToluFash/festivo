import { describe, expect, it } from 'vitest';

import { DETAILS_WORDS, OWNERSHIP_WORDS } from './OrganisationWords.ts';
import {
  demoGroups,
  lookingAs,
  managesOrganisation,
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

  it('shows a member her own sections, Organisation to read and leave, and Sign-in rules, but no Members', () => {
    expect(demoGroups('member')).toEqual([
      {
        heading: 'yourAccount',
        sections: ['account', 'security', 'notifications', 'personalisation'],
      },
      { heading: 'organisationHeading', sections: ['organisation', 'signInRules'] },
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

  it('opens Organisation for a member, and for the old planner link, as the same page', () => {
    const listed = (name: string) => demoGroups(viewerOf(name)).flatMap(({ sections }) => sections);

    expect(listed('member')).toContain('organisation');
    expect(listed('planner')).toEqual(listed('member'));
    expect(listed('noOrg')).not.toContain('organisation');
    expect(listed('member')).not.toContain('members');
  });

  it('lets only whoever manages the organisation edit it, ask people in and hand it over', () => {
    expect(managesOrganisation('owner')).toBe(true);
    expect(managesOrganisation('member')).toBe(false);
    expect(managesOrganisation('noOrg')).toBe(false);
  });

  it('tells a member why the page is read only, and offers her Leave alone in the Ask’s words', () => {
    expect(DETAILS_WORDS.readOnly('Member')).toBe(
      'Your role, Member, can see these but not change them. Owners and admins can.',
    );
    expect(OWNERSHIP_WORDS.leaveOpener).toBe('Leave Ire Events…');
    expect([OWNERSHIP_WORDS.leaveTitle, OWNERSHIP_WORDS.stay, OWNERSHIP_WORDS.leave]).toEqual([
      'Leave Ire Events?',
      'Stay',
      'Leave Ire Events',
    ]);
  });

  it('gives an admin the sections an owner sees, and a member hers', () => {
    expect(viewerOfRole('Owner')).toBe('owner');
    expect(viewerOfRole('Admin')).toBe('owner');
    expect(viewerOfRole('Member')).toBe('member');
    expect(viewerOfRole(null)).toBe('noOrg');
  });
});
