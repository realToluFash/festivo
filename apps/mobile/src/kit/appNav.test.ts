import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { landingFor } from '../landing.ts';
import {
  DESTINATION_HREF,
  INTERIM_HREF,
  SECTION_HREF,
  destinationOf,
  destinations,
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
  it('has Home, Events, Calendar and Settings, in that order, for a role that can read events', () => {
    expect(destinations({ permissions: ['events.read'] })).toEqual([
      'home',
      'events',
      'calendar',
      'settings',
    ]);
  });

  it('leaves Events out for a role whose Events level is Nothing, and with no organisation (sc-1593)', () => {
    expect(destinations({ permissions: ['members.read'] })).toEqual(['home', 'settings']);
    expect(destinations(null)).toEqual(['home', 'settings']);
  });

  it('marks Settings and Events for every page under each', () => {
    expect(destinationOf('/')).toBe('home');
    expect(destinationOf('/settings')).toBe('settings');
    expect(destinationOf('/settings/security')).toBe('settings');
    expect(destinationOf('/settingsx')).toBe('home');
    expect(destinationOf('/events')).toBe('events');
    expect(destinationOf('/events/evt_gala')).toBe('events');
    expect(destinationOf('/calendar')).toBe('calendar');
  });

  it('opens a route that exists for each destination and section', () => {
    expect(DESTINATION_HREF.settings).toBe('/settings');
    for (const href of [DESTINATION_HREF.events, DESTINATION_HREF.settings]) {
      expect(() => source(join(APP, href, 'index.tsx')), href).not.toThrow();
    }
    for (const route of ['[id]/index.tsx', '[id]/edit.tsx', 'new.tsx'])
      expect(() => source(join(APP, 'events', route)), route).not.toThrow();
    for (const href of Object.values(SECTION_HREF)) {
      expect(() => source(join(APP, `${href}.tsx`)), href).not.toThrow();
    }
  });
});

describe('Settings > Security holds every card', () => {
  it.each(['WaysCard', 'TwoFactorCard', 'DevicesCard'])('%s', (card) => {
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
      { heading: 'yourAccount', sections: ['account', 'security', 'notifications'] },
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
      { heading: 'yourAccount', sections: ['account', 'security', 'notifications'] },
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

describe('Events titles itself once, in the frame header (sc-17559)', () => {
  it('gives the body no heading of its own on any layout', () => {
    const events = source(join(SRC, 'components', 'EventsScreen.tsx'));

    expect(events).not.toMatch(/heading=/u);
    expect(events).not.toMatch(/accessibilityRole="header">\s*\{t\('eventsScreen\.title'\)\}/u);
  });

  it('leaves no head row on a tablet on its side when there is nothing to put in it', () => {
    const split = source(join(SRC, 'components', 'ListAndPage.tsx'));

    expect(split).toMatch(/\{landscape && \(heading \|\| besideHeading\) && \(/u);
  });
});

describe("A phone's event page keeps its name out of the header (sc-22871)", () => {
  it('titles the header Events with an event open, and the name is the heading on the card', () => {
    const events = source(join(SRC, 'components', 'EventsScreen.tsx'));
    const page = source(join(SRC, 'components', 'Events.tsx'));

    expect(events).toMatch(/<AppFrame\s+current="events"\s+title=\{t\('eventsScreen\.title'\)\}/u);
    expect(page).toMatch(/accessibilityRole="header">\s*\{event\.name\}/u);
  });
});

describe('The bell titles itself once, in the frame header (sc-3980)', () => {
  it('gives the feed no heading of its own on any layout', () => {
    const feed = source(join(SRC, 'components', 'NotificationsFeed.tsx'));

    expect(feed).not.toMatch(/notifications\.heading/u);
  });

  it('moves focus after the push ask to the frame title, which is a header', () => {
    const screen = source(join(APP, 'notifications.tsx'));
    const feed = source(join(SRC, 'components', 'NotificationsFeed.tsx'));

    expect(screen).toMatch(/title=\{t\('notifications\.heading'\)\}\s*titleRef=\{title\}/u);
    expect(screen).toMatch(/<NotificationsFeed heading=\{title\} onOffline=\{setOffline\} \/>/u);
    expect(feed).toMatch(/moveScreenReaderFocus\(heading\.current\)/u);
  });
});
