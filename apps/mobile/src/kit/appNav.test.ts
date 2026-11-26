import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { landingFor } from '../landing.ts';
import {
  DESTINATION_HREF,
  INTERIM_HREF,
  SECTION_HREF,
  destinationOf,
  dataAndControlListed,
  destinations,
  listedFor,
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
    expect(launch).toMatch(
      /setLaunching\('signedIn'\);\s+for \(const screen of landingAfterRestart\(\)\)/u,
    );
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

  it('gives a Member Events and Calendar, and leaves them out with no organisation (sc-29914)', () => {
    expect(destinations({ permissions: [] })).toEqual(['home', 'events', 'calendar', 'settings']);
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

describe('Settings > Security holds every section', () => {
  it('through the page its demo draws', () => {
    expect(source(join(APP, 'settings', 'security.tsx'))).toMatch(/<SecurityPage\b/u);
  });

  it.each(['WaysSection', 'TwoFactorSection', 'DevicesSection'])('%s', (section) => {
    expect(source(join(SRC, 'components', 'SecurityPage.tsx'))).toMatch(
      new RegExp(`<${section}\\b`, 'u'),
    );
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
  it('lists the paused organisation’s Organisation and Sign-in rules alone, whatever the role in use (sc-86077)', () => {
    const owner = {
      name: 'Ìrè Events',
      permissions: ['members.read', 'members.manage', 'organisation.manage'],
    };
    const listed = listedFor(owner, { name: 'Casa Lumen Eventos' });

    expect(listed?.name).toBe('Casa Lumen Eventos');
    expect(settingsGroups(listed)[1]?.sections).toEqual(['organisation', 'signInRules']);
    expect(dataAndControlListed(listed)).toBe(false);
    expect(settingsGroups(listedFor(null, { name: 'Casa Lumen Eventos' }))).toHaveLength(2);
    expect(listedFor(owner, null)).toBe(owner);
  });

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

  it('shows no Roles, even to a role that changes members (sc-29914)', () => {
    expect(
      settingsGroups({ permissions: ['members.read', 'members.manage'] })[1]?.sections,
    ).toEqual(['organisation', 'members', 'signInRules']);
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

    expect(split).toMatch(/\{headingAbove && \(heading \|\| besideHeading\) && \(/u);
  });
});

describe("A phone's event page keeps its name out of the header (sc-22871)", () => {
  it('titles the header Events with an event open, and the name is the heading on the card', () => {
    const events = source(join(SRC, 'components', 'EventsScreen.tsx'));
    const page = source(join(SRC, 'components', 'Events.tsx'));

    expect(events).toMatch(
      /<AppFrame\s+current="events"\s+top="scrolls"\s+title=\{t\('eventsScreen\.title'\)\}/u,
    );
    expect(page).toMatch(/accessibilityRole="header">\s*\{event\.name\}/u);
  });
});

describe('A screen whose top scrolls places it, and the band is gone (sc-39471)', () => {
  const tsx = (dir: string): string[] =>
    readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .filter((path) => path.endsWith('.tsx') && !path.includes('.test.'))
      .map((path) => join(dir, path));
  const scrolling = [...tsx(APP), ...tsx(join(SRC, 'components'))].filter((path) =>
    /top=(?:"scrolls"|\{[^}]*'scrolls')/u.test(source(path)),
  );

  it('finds the screens it guards', () => {
    expect(scrolling.length).toBeGreaterThanOrEqual(8);
  });

  it.each(scrolling)('%s renders its top, directly or through the list that places it', (path) => {
    expect(source(path)).toMatch(/<(?:FrameTop|ListAndPage|SettingsList)\b/u);
  });

  it('has the list and the Settings column place the top', () => {
    expect(source(join(SRC, 'components', 'ListAndPage.tsx'))).toMatch(/<FrameTop\b/u);
    expect(source(join(SRC, 'components', 'SettingsList.tsx'))).toMatch(/<FrameTop\b/u);
  });

  it('leaves the body its foot room while a paused or overdue screen stands in for the list', () => {
    expect(source(join(SRC, 'components', 'AppFrame.tsx'))).toMatch(
      /const underTabs =\s*floatingTabs && listUnderTabs && standIn == null \?/u,
    );
  });

  it('draws no band behind the frame', () => {
    expect(source(join(SRC, 'components', 'AppFrame.tsx'))).not.toMatch(/colorHeader/u);
  });
});

describe('The bell titles itself once (sc-3980)', () => {
  it("gives the feed no heading of its own: the B frame titles it, or main's frame on a phone on its side", () => {
    const screen = source(join(APP, 'notifications.tsx'));
    const feed = source(join(SRC, 'components', 'NotificationsFeed.tsx'));
    const parts = source(join(SRC, 'components', 'BellParts.tsx'));

    expect(feed).not.toMatch(/notifications\.heading/u);
    expect(parts.match(/t\('notifications\.heading'\)/gu)).toHaveLength(2);
    expect(screen).toMatch(/title=\{t\('notifications\.heading'\)\}\s*titleRef=\{title\}/u);
    expect(screen).toMatch(/kind: 'framed', heading: title, onOffline: setOffline/u);
  });

  it('moves focus after the push ask to the title, which is a header', () => {
    const feed = source(join(SRC, 'components', 'NotificationsFeed.tsx'));

    expect(feed).toMatch(
      /async function answerPush\(turnOn: boolean\): Promise<void> \{[\s\S]*?moveScreenReaderFocus\(heading\.current\)/u,
    );
  });
});

describe('The bell in the B frame (sc-83081)', () => {
  const feed = (): string => source(join(SRC, 'components', 'NotificationsFeed.tsx'));
  const parts = (): string => source(join(SRC, 'components', 'BellParts.tsx'));

  it("opens Notifications as its own screen on an upright phone, and main's frame on its side", () => {
    expect(source(join(APP, 'notifications.tsx'))).toMatch(
      /if \(kind === 'phone' && height >= width\)\s*return <NotificationsFeed where=\{\{ kind: 'screen', onBack: back \}\} \/>;/u,
    );
  });

  it('puts Back and Mark all read on one row, the title under them, and no card', () => {
    const source = parts();

    expect(source).toMatch(
      /<Back label=\{where\.back\} onPress=\{where\.onBack\} \/>\s*<View style=\{styles\.grow\} \/>\s*\{markAll\}/u,
    );
    expect(source.indexOf('{markAll}\n      </View>')).toBeLessThan(
      source.indexOf('<PageTitle heading'),
    );
    expect(feed()).not.toMatch(/cardTop|cardFoot|radiusCardPhone/u);
  });

  it("opens a 380 popover under the bell on a tablet, its right edge in line with the bell's", () => {
    expect(parts()).toMatch(/<AnchoredMenu[\s\S]*?width=\{380\}\s*align="end"/u);
    expect(source(join(SRC, 'components', 'BellButton.tsx'))).toMatch(/useBellOpens\(\)/u);
  });

  it('marks each item with its category in a tinted 40 square, hidden from a screen reader', () => {
    const source = parts();

    expect(source).toMatch(
      /<View\s+style=\{styles\.tile\}\s+accessibilityElementsHidden\s+importantForAccessibility="no-hide-descendants"\s*>\s*<Glyph name=\{markOf\(row\.category\)\}/u,
    );
    expect(source).toMatch(
      /tile: \{\s*width: 40,\s*height: 40,[\s\S]*?backgroundColor: tokens\.colorInset,/u,
    );
  });

  it('opens Mute this event inline under the item, not in a sheet', () => {
    expect(feed()).not.toMatch(/<Sheet\b/u);
    expect(parts()).toMatch(
      /\{menu && row\.more != null && <View style=\{styles\.mute\}>\{row\.more\.mute\}<\/View>\}/u,
    );
  });

  it('shows Mark all read that did not save on screen, read out once by its line alone', () => {
    const source = feed();

    expect(source).toMatch(/notice=\{notSaved\}/u);
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
      /onMenu=\{\(id\) => \{\s*nextAction\(\);/u,
    ]) {
      expect(source).toMatch(action);
    }
  });

  it('draws the demo from the same parts', () => {
    const demo = source(join(SRC, 'demo', 'messages', 'BellPlace.tsx'));

    expect(demo).toMatch(
      /import \{ BellBody, BellFrame, BellMute \} from '\.\.\/\.\.\/components\/BellParts\.tsx';/u,
    );
    expect(demo).not.toMatch(/AnchoredMenu|RowList|Skeleton/u);
  });

  it('draws the bell as the demos do: a dot while anything is unread, the count in its name', () => {
    const button = source(join(SRC, 'components', 'BellButton.tsx'));

    expect(button).toMatch(/<RoundButton\s+ref=\{ref\}\s+glyph="bell"/u);
    expect(button).toMatch(/t\('notifications\.bellUnread', \{ count: unread \}\)/u);
    expect(button).toMatch(/dot=\{unread > 0\}/u);
  });
});

describe("iPad Sign in's scroll view stays out of the sheet's reach (sc-67589)", () => {
  it('is presented as the (sign-in) group, which renders a Stack of its own', () => {
    expect(source(join(APP, '_layout.tsx'))).toMatch(/<Stack\.Screen\s+name="\(sign-in\)"/u);
    expect(readdirSync(APP)).not.toContain('sign-in.tsx');
    expect(source(join(APP, '(sign-in)', '_layout.tsx'))).toMatch(
      /return \(\s*<SignInOver value=\{[^}]+\}>\s*<Stack\b/u,
    );
  });
});

describe('Sign in pushed over welcome knows welcome is under it (sc-67709)', () => {
  it('is opened only where its opener says what stays under it, wherever under app/ and src/ a push or a replace reaches it', () => {
    const SIGN_IN = /'\/sign-in[?']|timedOutSignIn\(|signInRoute\(/u;
    const openers = (text: string): number[] =>
      [...text.matchAll(/router\.(?:push|replace|navigate)\(\s*(\{[^}]*\}|[^,)]+)/gu)]
        .filter(([, to = '']) =>
          /^\w+$/u.test(to)
            ? new RegExp(`\\b${to}\\s*=[^;]*(?:${SIGN_IN.source})`, 'u').test(text)
            : SIGN_IN.test(to),
        )
        .map(({ index }) => text.slice(0, index).split('\n').length);
    const unsaid = (text: string): number[] =>
      openers(text).filter(
        (line) =>
          !/signInOver\(/u.test(
            text
              .split('\n')
              .slice(Math.max(0, line - 3), line - 1)
              .join('\n'),
          ),
      );
    const files = [APP, SRC].flatMap((root) =>
      readdirSync(root, { recursive: true, encoding: 'utf8' })
        .filter((path) => /\.tsx?$/u.test(path) && !/\.test\.tsx?$/u.test(path))
        .map((path) => join(root, path)),
    );
    const named = (file: string): string => file.slice(join(APP, '..').length + 1);

    expect(files.filter((file) => openers(source(file)).length > 0).map(named)).toEqual(
      expect.arrayContaining(['src/components/Welcome.tsx', 'src/steps/leaveTimedOutSignIn.ts']),
    );
    expect(
      files.flatMap((file) => unsaid(source(file)).map((line) => `${named(file)}:${line}`)),
    ).toEqual([]);
  });

  it('is not read from the stack while Sign in is drawn, which expo-router hands over as it was before the push', () => {
    expect(source(join(APP, '(sign-in)', 'sign-in.tsx'))).not.toMatch(/navigation\.canGoBack\(\)/u);
    expect(source(join(APP, '_layout.tsx'))).toMatch(/opensOver\(route\.key\)/u);
  });
});
