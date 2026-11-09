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
    expect(launch).toMatch(/else setLaunching\('signedIn'\);/u);
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
    expect(source(join(SRC, 'components', 'SettingsList.tsx'))).toContain(
      'onSignOut={signOutHere}',
    );
    expect(source(join(APP, 'settings', 'security.tsx'))).toContain('onSignOutHere={signOutHere}');
  });
});

describe('the Settings list', () => {
  it('has Organisation, Members and Sign-in rules rows below Security, under their own heading', () => {
    expect(settingsGroups({ permissions: ['members.read'] })).toEqual([
      {
        heading: 'yourAccount',
        sections: ['account', 'security', 'notifications', 'personalisation'],
      },
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
      {
        heading: 'yourAccount',
        sections: ['account', 'security', 'notifications', 'personalisation'],
      },
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

describe('The bell in [fd] (sc-23233)', () => {
  const feed = (): string => source(join(SRC, 'components', 'NotificationsFeed.tsx'));
  const skeleton = (): string => source(join(SRC, 'components', 'Skeleton.tsx'));

  it('draws Muted with the slashed bell beside the word, hidden from a screen reader', () => {
    expect(feed()).toMatch(
      /accessibilityElementsHidden\s+importantForAccessibility="no-hide-descendants"\s*>\s*<BellMark [^>]*slashed[^>]*\/>\s*<\/View>\s*<Text[^>]*>\s*\{t\('notifications\.muted'\)\}/u,
    );
  });

  it('shows Mark all read that did not save on screen, read out once by the notice alone', () => {
    const source = feed();

    expect(source).toMatch(
      /<Notice tone="attention" mark="!" body=\{notSaved\} announce wordsInTone \/>/u,
    );
    expect(source).toMatch(/setNotSaved\(t\(outcome\.said\)\)/u);
    expect(source.indexOf('setNotSaved(t(outcome.said))')).toBeLessThan(
      source.indexOf('setSaid({ words: t(outcome.said) })'),
    );
    expect(source).toMatch(/if \(!\('left' in outcome\)\) \{[\s\S]*?return;\s*\}\s*setSaid/u);
  });

  it('takes the line down at each next action in the feed', () => {
    const source = feed();

    for (const action of [
      /function load\(\): void \{\s*nextAction\(\);/u,
      /async function answerPush\(turnOn: boolean\): Promise<void> \{\s*nextAction\(\);/u,
      /function openItem\(item: NotificationItem\): void \{\s*nextAction\(\);/u,
      /function showMore\(after: string\): void \{\s*nextAction\(\);/u,
      /onPress=\{\(\) => \{\s*onOpened\(\);\s*setOpen\(true\);/u,
    ]) {
      expect(source).toMatch(action);
    }
  });

  it('draws the rows in one card, its top on whichever row or block is first, its foot in the footer', () => {
    const source = feed();

    expect(source).toMatch(/opensCard=\{index === 0 && !asking\}/u);
    expect(source).toMatch(/\[styles\.card, opensCard && styles\.cardTop\]/u);
    expect(source).toMatch(
      /\(asking \|\| rows\.length === 0\) && \(\s*<View style=\{\[styles\.card, styles\.cardTop\]\}>/u,
    );
    expect(source).toMatch(
      /ListFooterComponent=\{\s*<View style=\{\[styles\.card, styles\.cardFoot\]\}>/u,
    );
    expect(source.match(/styles\.cardFoot/gu)).toHaveLength(1);
    expect(source).toMatch(/cardTop: \{\s*paddingTop: tokens\.spaceXxs,/u);
    expect(source).toMatch(/borderTopLeftRadius: tokens\.radiusCardPhone/u);
    expect(source).not.toMatch(/ItemSeparatorComponent/u);
  });

  it('keeps Mark all read and its line above the card, the push ask and the states inside it', () => {
    const source = feed();
    const card = source.indexOf('(asking || rows.length === 0) && (');

    expect(source.indexOf("t('notifications.markAllRead')")).toBeLessThan(card);
    expect(source.indexOf('body={notSaved}')).toBeLessThan(card);
    for (const state of [
      'notifications.pushAsk.title',
      'notifications.loading',
      'notifications.couldNotLoad',
      'notifications.empty',
    ]) {
      expect(source.indexOf(state)).toBeGreaterThan(card);
    }
    expect(source).toMatch(/rowHeight=\{64\}\s+rows=\{3\}\s+inCard/u);
  });

  it('closes the card on Show more and Notification settings, each under a rule', () => {
    const source = feed();
    const foot = source.indexOf('ListFooterComponent={');

    expect(source.indexOf("t('notifications.showMore')")).toBeGreaterThan(foot);
    expect(source.indexOf("t('notifications.settings')")).toBeGreaterThan(foot);
    expect(source).toMatch(
      /more: \{\s*gap: tokens\.spaceSm,\s*paddingVertical: tokens\.spaceSm,\s*paddingHorizontal: tokens\.spaceXl,\s*borderTopWidth: 1,\s*borderTopColor: tokens\.colorInsetBorder,/u,
    );
    expect(source).toMatch(
      /settings: \{\s*minHeight: tokens\.sizeHit,\s*justifyContent: 'center',\s*paddingHorizontal: tokens\.spaceXl,\s*borderTopWidth: 1,\s*borderTopColor: tokens\.colorInsetBorder,/u,
    );
    expect(source).toMatch(/accessibilityRole="link"\s+testID="notifications\.settings"/u);
  });

  it('centres the empty line under the bell', () => {
    const source = feed();

    expect(source).toMatch(
      /<BellMark ink=\{tokens\.colorInkSecondary\} \/>\s*<\/View>\s*<Text[^>]*style=\{styles\.centred\}>\s*\{t\('notifications\.empty'\)\}/u,
    );
    expect(source).toMatch(
      /empty: \{\s*alignItems: 'center',\s*gap: tokens\.spaceSm,\s*paddingVertical: tokens\.space3xl,\s*paddingHorizontal: tokens\.spaceXl,/u,
    );
  });

  it("insets More's sheet as the app's other sheets", () => {
    expect(feed()).toMatch(/sheet: \{ gap: tokens\.spaceLg, padding: tokens\.space3xl \}/u);
  });

  it('draws Unread in the accent, its mark 4 from the word', () => {
    const source = feed();

    expect(source).toMatch(
      /<Text[^>]*style=\{styles\.accent\}>\s*\{t\('notifications\.unread'\)\}/u,
    );
    expect(source).toMatch(
      /mark: \{ flexDirection: 'row', alignItems: 'center', gap: tokens\.spaceXxs \}/u,
    );
  });

  it('insets a row 12 by 16 under a rule, with no gap to the next, and More 8 from the edge', () => {
    const source = feed();

    expect(source).toMatch(
      /row: \{\s*borderTopWidth: 1,\s*borderTopColor: tokens\.colorInsetBorder,\s*\}/u,
    );
    expect(source).toMatch(
      /minHeight: tokens\.sizeHit,\s*paddingVertical: tokens\.spaceLg,\s*paddingHorizontal: tokens\.spaceXl,/u,
    );
    expect(source).toMatch(
      /moreButton: \{\s*marginTop: tokens\.spaceSm,\s*marginRight: tokens\.spaceSm,/u,
    );
    expect(source).toMatch(
      /goneLine: \{ marginHorizontal: tokens\.spaceXl, marginBottom: tokens\.spaceLg \}/u,
    );
  });

  it('draws the bell as the demos do: a dot while anything is unread, the count in its name', () => {
    const button = source(join(SRC, 'components', 'BellButton.tsx'));

    expect(button).toMatch(/<RoundButton\s+glyph="bell"/u);
    expect(button).toMatch(/t\('notifications\.bellUnread', \{ count: unread \}\)/u);
    expect(button).toMatch(/dot=\{unread > 0\}/u);
  });

  it('insets the skeleton once, its rules running to the card edge and its words with its rows', () => {
    const source = feed();

    expect(source).toMatch(/<View style=\{styles\.loading\}>\s*<Skeleton[^>]*inCard\s+edgeToEdge/u);
    expect(source).toMatch(/loading: \{ paddingVertical: tokens\.spaceSm \}/u);
    expect(skeleton()).toMatch(/wordsInset: \{ paddingHorizontal: tokens\.spaceXl \}/u);
    expect(skeleton()).toMatch(/row: \{[^}]*paddingHorizontal: tokens\.spaceXl,/u);
  });

  it('starts Mark all read 12pt under the tablet Back, with no gap from the route body, and leaves the phone as it was', () => {
    const source = feed();

    expect(source).toMatch(/\[styles\.feed, kind !== 'phone' && styles\.feedUnderBack\]/u);
    expect(source).toMatch(/feedUnderBack: \{ paddingTop: tokens\.spaceXxs \}/u);
    expect(source).toMatch(/part: \{ gap: tokens\.spaceLg, paddingVertical: tokens\.spaceSm \}/u);
    expect(source).toMatch(/feed: \{\s*paddingTop: tokens\.spaceXl,/u);
    expect(readFileSync(join(APP, 'notifications.tsx'), 'utf8')).toMatch(
      /body: \{ padding: 0, gap: 0 \}/u,
    );
  });
});
