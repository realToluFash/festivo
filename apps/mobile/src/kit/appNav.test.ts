import type { Membership } from '@soirely/api-client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { landingFor } from '../landing.ts';
import {
  DESTINATIONS,
  DESTINATION_HREF,
  INTERIM_HREF,
  SECTION_HREF,
  chooseOrganisation,
  destinationOf,
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

    expect(launch).toMatch(/if \(account != null\) return <SignedInHome \/>;/u);
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
  it('signs out with no confirmation, the same way as the "This device" row', () => {
    expect(source(join(SRC, 'components', 'SettingsList.tsx'))).toContain('onPress={signOutHere}');
    expect(source(join(APP, 'settings', 'security.tsx'))).toContain('onSignOutHere={signOutHere}');
  });

  it('ends the session and opens sign-in with no banner', () => {
    const signOut = /export function signOutHere\(\): void \{([\s\S]*?)\n\}/u.exec(
      source(join(SRC, 'signedIn.ts')),
    )?.[1];

    expect(signOut).toContain('api.signOut()');
    expect(signOut).toContain("router.replace('/sign-in')");
    expect(signOut).not.toContain('signedOut');
  });
});

describe('the organisation this device works in', () => {
  const membership = (id: string): Membership => ({
    id,
    name: id,
    countryCode: 'NG',
    currency: 'NGN',
    timezone: 'Africa/Lagos',
    contactAddress: '',
    role: { id: 'r', seededAs: 'owner', name: null },
  });

  it('is the one remembered here', () => {
    expect(chooseOrganisation([membership('a'), membership('b')], 'b')?.id).toBe('b');
  });

  it('is the first when the remembered one is gone or none was', () => {
    expect(chooseOrganisation([membership('a'), membership('b')], 'gone')?.id).toBe('a');
    expect(chooseOrganisation([membership('a')], null)?.id).toBe('a');
  });

  it('is none for an account in no organisation', () => {
    expect(chooseOrganisation([], 'a')).toBeNull();
  });
});
