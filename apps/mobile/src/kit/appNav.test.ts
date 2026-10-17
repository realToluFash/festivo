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
