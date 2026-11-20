import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (...path: string[]) => readFileSync(join(...path), 'utf8');
const home = read('src', 'components', 'Home.tsx');
const frame = read('src', 'components', 'AppFrame.tsx');
const bell = read('src', 'components', 'BellButton.tsx');
const landing = read('src', 'components', 'NoOrganisation.tsx');
const demo = read('src', 'demo', 'createOrg', 'NoOrganisation.tsx');

describe('You are not in an organisation, alone (sc-75471)', () => {
  it('lands with no Home title, bell or tab bar: the screen draws its own top', () => {
    expect(home).toMatch(
      /const alone = account != null && organisation == null && signedIn\.pausedIn == null;/u,
    );
    expect(home).toMatch(/ownChrome=\{today != null \|\| alone\}/u);
    expect(home).toMatch(/\{alone \? \(\s*<AloneBody \/>/u);
  });

  it('opens Settings’ own list from Your account, and signs out beside it', () => {
    expect(landing).toMatch(
      /onAccount=\{\(\) => router\.navigate\(DESTINATION_HREF\.settings\)\}/u,
    );
    expect(landing).toMatch(/onSignOut=\{signOutHere\}/u);
  });

  it('opens a joined organisation with "Now working in …" focused, as the demo does', () => {
    expect(landing).toMatch(
      /if \(outcome\?\.kind === 'accepted'\) openJoined\?\.\(outcome\.organisationId\);/u,
    );
    expect(frame).toMatch(
      /const openJoined = useCallback\([^]*?setCreated\(\{ name, takesFocus: true \}\)/u,
    );
    expect(frame).toMatch(/<OpenJoined\.Provider value=\{openJoined\}>/u);
  });

  it('is drawn from the same parts as its demo', () => {
    for (const part of ['NoOrgPage', 'NoOrgWayOn', 'SignedInWays', 'StartYourOwn']) {
      expect(landing).toContain(`<${part}`);
      expect(demo).toContain(`<${part}`);
    }
  });
});

describe('Settings opened from no organisation (sc-75471)', () => {
  it('keeps today’s frame for an account holding an event from outside, which lands in that event', () => {
    expect(frame).toMatch(
      /const openedFromNone =[^;]*\(signedIn\.account\?\.outsideEvents\.length \?\? 0\) === 0 &&/u,
    );
  });

  it('shares its way back with the demo, in the app’s words', () => {
    const demoSettings = read('src', 'demo', 'settings', 'SettingsHome.tsx');
    expect(demoSettings).toContain("from '../../components/wayBackToNone.ts'");
    expect(demoSettings).toContain("label={t('noOrganisation.wayBack')}");
    expect(read('src', 'demo', 'settings', 'fromNone.ts')).not.toMatch(/createContext|WAY_BACK/u);
  });

  it('has no tab bar and no sidebar', () => {
    expect(frame).toMatch(
      /const floatingTabs = framed && kind === 'phone' && inEvent == null && !openedFromNone;/u,
    );
    expect(frame).toMatch(/const sideCard = framed && kind === 'tabletLandscape';/u);
    expect(frame).toMatch(/const sidebar = sideCard && !openedFromNone;/u);
  });

  it('sits on its side in its card on the grey ground, alone there as the demo draws it', () => {
    expect(frame).toMatch(/style=\{\[styles\.root, sideCard && side\.chrome\]\}/u);
    expect(frame).toMatch(
      /styles\.column, sideCard && side\.card, sideCard && !sidebar && styles\.alone\]/u,
    );
    expect(frame).toMatch(/alone: \{ marginLeft: tokens\.spaceMd \}/u);
    expect(read('src', 'demo', 'settings', 'Frame.tsx')).toMatch(
      /alone: \{ marginLeft: tokens\.spaceMd \}/u,
    );
  });

  it('has no bell', () => {
    expect(bell).toMatch(/if \(fromNone != null\) return null;/u);
  });

  it('heads the list with Join or start an organisation, back to the landing', () => {
    expect(frame).toMatch(/label: t\('noOrganisation\.wayBack'\)/u);
    expect(frame).toMatch(/router\.navigate\(DESTINATION_HREF\.home\)/u);
  });

  it('reads the way back in the web’s words, in all four locales', () => {
    for (const locale of ['en', 'es', 'fr', 'pt']) {
      const app = JSON.parse(read('src', 'i18n', 'locales', `${locale}.json`)) as {
        noOrganisation: { wayBack: string };
      };
      const web = JSON.parse(
        read('..', 'web', 'src', 'i18n', 'locales', `${locale}.json`),
      ) as typeof app;

      expect(app.noOrganisation.wayBack).toBe(web.noOrganisation.wayBack);
    }
  });
});
