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

  it('is drawn from the same parts as its demo', () => {
    for (const part of ['NoOrgPage', 'NoOrgWayOn', 'SignedInWays', 'StartYourOwn']) {
      expect(landing).toContain(`<${part}`);
      expect(demo).toContain(`<${part}`);
    }
  });
});

describe('Settings opened from no organisation (sc-75471)', () => {
  it('has no tab bar and no sidebar', () => {
    expect(frame).toMatch(
      /const floatingTabs = framed && kind === 'phone' && inEvent == null && !openedFromNone;/u,
    );
    expect(frame).toMatch(
      /const sidebar = framed && kind === 'tabletLandscape' && !openedFromNone;/u,
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
