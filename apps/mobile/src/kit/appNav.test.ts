import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { landingFor } from '../landing.ts';
import {
  DESTINATIONS,
  DESTINATION_HREF,
  INTERIM_HREF,
  SECTION_HREF,
  destinationOf,
  settingsGroups,
} from './appNav.ts';

const APP = join(import.meta.dirname, '..', '..', 'app');
const SRC = join(import.meta.dirname, '..');
const source = (path: string): string => readFileSync(path, 'utf8');

describe('sign-in lands on the signed-in home', () => {
  it('sends an account past every gate to the launch route', () => {
    expect(landingFor(null)).toBe('/');
  });

  it('renders the home there once the account is known, in place of the health placeholder', () => {
    const launch = source(join(APP, 'index.tsx'));

    expect(launch).toMatch(/if \(launching === 'signedIn'\) return <SignedInHome \/>;/u);
    expect(launch).toMatch(/if \(live && loaded\) setLaunching\('signedIn'\);/u);
    expect(launch).not.toMatch(/href="\/security"|href="\/account"/u);
  });
});

describe('the frame shows only what is built', () => {
  it('has Home and Settings and nothing else', () => {
    expect(DESTINATIONS).toEqual(['home', 'settings']);
  });

  it('marks Settings for every page under it', () => {
    expect(destinationOf('/')).toBe('home');
    expect(destinationOf('/settings')).toBe('settings');
    expect(destinationOf('/settings/security')).toBe('settings');
    expect(destinationOf('/settingsx')).toBe('home');
  });

  it('opens a route that exists for each destination and section', () => {
    expect(DESTINATION_HREF.settings).toBe('/settings');
    for (const href of Object.values(SECTION_HREF)) {
      expect(() => source(join(APP, `${href}.tsx`)), href).not.toThrow();
    }
  });
});

describe('Settings > Security holds every card', () => {
  it.each(['PasswordCard', 'WaysCard', 'TwoFactorCard', 'DevicesCard'])('%s', (card) => {
    expect(source(join(APP, 'settings', 'security.tsx'))).toMatch(new RegExp(`<${card}\\b`, 'u'));
  });
});

describe('the interim screens open their Settings page', () => {
  it.each(Object.entries(INTERIM_HREF))('%s', (old, next) => {
    const screen = source(join(APP, `${old.slice(1)}.tsx`));

    expect(next.startsWith('/settings/')).toBe(true);
    expect(screen).toContain(`<Redirect href={INTERIM_HREF['${old}']} />`);
  });
});

describe('"Sign out" on the Settings list', () => {
  it('is wired to the same sign-out as the "This device" row, whose outcome signedIn.test.ts checks', () => {
    expect(source(join(SRC, 'components', 'SettingsList.tsx'))).toContain('onPress={signOutHere}');
    expect(source(join(APP, 'settings', 'security.tsx'))).toContain('onSignOutHere={signOutHere}');
  });
});

describe('the Settings list', () => {
  it('has Organisation, Members and Sign-in rules rows below Security, under their own heading', () => {
    expect(settingsGroups({ permissions: ['members.read'] })).toEqual([
      { heading: 'yourAccount', sections: ['account', 'security'] },
      { heading: 'organisationHeading', sections: ['organisation', 'members', 'signInRules'] },
    ]);
  });

  it('leaves Members out for a role that cannot read them (sc-3404)', () => {
    expect(settingsGroups({ permissions: ['events.read'] })[1]?.sections).toEqual([
      'organisation',
      'signInRules',
    ]);
  });

  it('shows Roles only to a role that can change them (sc-1931)', () => {
    expect(
      settingsGroups({ permissions: ['members.read', 'members.manage'] })[1]?.sections,
    ).toEqual(['organisation', 'members', 'roles', 'signInRules']);
    expect(settingsGroups({ permissions: ['members.read'] })[1]?.sections).not.toContain('roles');
  });

  it('leaves the Organisation rows out while the account is in no organisation', () => {
    expect(settingsGroups(null)).toEqual([
      { heading: 'yourAccount', sections: ['account', 'security'] },
    ]);
  });

  it('opens the Organisation page under Settings', () => {
    expect(SECTION_HREF.organisation).toBe('/settings/organisation');
    expect(destinationOf(SECTION_HREF.organisation)).toBe('settings');
  });

  it('opens Roles under Settings (sc-1931)', () => {
    expect(SECTION_HREF.roles).toBe('/settings/roles');
    expect(destinationOf(SECTION_HREF.roles)).toBe('settings');
  });

  it('opens Members under Settings (sc-3404)', () => {
    expect(SECTION_HREF.members).toBe('/settings/members');
    expect(destinationOf(SECTION_HREF.members)).toBe('settings');
  });

  it('opens the organisation’s sign-in rules under Settings (sc-69)', () => {
    expect(SECTION_HREF.signInRules).toBe('/settings/sign-in-rules');
    expect(destinationOf(SECTION_HREF.signInRules)).toBe('settings');
  });
});
