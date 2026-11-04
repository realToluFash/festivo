import { describe, expect, it } from 'vitest';

import { VIEWERS, groupsFor, settingsPath, settingsSayIn, viewerOf } from './settings.ts';

describe('the Settings list at a desk (sc-29708)', () => {
  it('lists your account’s three sections, then the organisation’s four', () => {
    expect(groupsFor(VIEWERS.folake)).toEqual([
      { name: 'Your account', sections: ['account', 'security', 'notifications'] },
      {
        name: 'Organisation settings',
        sections: ['general', 'members', 'roles', 'signInRules'],
      },
    ]);
  });

  it('lists Members and Roles only for a role that reads them', () => {
    expect(groupsFor(VIEWERS.tom)[1]?.sections).toContain('members');
    expect(groupsFor(VIEWERS.ana)[1]?.sections).toEqual(['general', 'signInRules']);
  });

  it('is Folake, the owner, unless the link names somebody it knows', () => {
    expect(viewerOf(null).name).toBe('Folake Adeyemi');
    expect(viewerOf('nobody').key).toBe('folake');
    expect(viewerOf('tom')).toMatchObject({ role: 'Door staff', manages: false, reads: true });
  });

  it('names who is looking and the state in the link, and leaves the owner out', () => {
    expect(settingsPath('members', VIEWERS.folake)).toBe('/demo/settings/members');
    expect(settingsPath('roles', VIEWERS.julien, 'locked')).toBe(
      '/demo/settings/roles?as=julien&state=locked',
    );
  });

  it('writes dates in the reader’s region, and deadlines in Lagos time', () => {
    const say = settingsSayIn('en-US');

    expect(say.date('2026-11-02')).toBe('Nov 2, 2026');
    expect(say.day('2026-11-02')).toBe('Nov 2');
    expect(say.deadline('2026-11-16T09:12')).toBe('Monday, Nov 16 at 9:12 AM WAT');
    expect(settingsSayIn('en-GB').date('2026-11-02')).toBe('2 Nov 2026');
  });
});
