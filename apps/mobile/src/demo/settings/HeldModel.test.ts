import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { pausedSwitch } from '@soirely/domain';
import { describe, expect, it } from 'vitest';

import {
  aloneOf,
  heldOf,
  inAnOrganisation,
  opensWhilePaused,
  othersOf,
  pausedGroups,
  pausedStandsIn,
} from './HeldModel.ts';
import { demoGroups } from './sample.ts';

const held = readFileSync(join(import.meta.dirname, 'Held.tsx'), 'utf8');
const route = readFileSync(join(import.meta.dirname, 'Route.tsx'), 'utf8');
const home = readFileSync(join(import.meta.dirname, 'SettingsHome.tsx'), 'utf8');
const frame = readFileSync(join(import.meta.dirname, 'Frame.tsx'), 'utf8');
const sidebar = readFileSync(join(import.meta.dirname, '..', 'Sidebar.tsx'), 'utf8');

/** The body of a top-level function in Frame.tsx, up to the next one. */
function body(name: string): string {
  const start = frame.indexOf(`function ${name}(`);
  const next = frame.indexOf('\nexport function ', start + 1);
  const other = frame.indexOf('\nfunction ', start + 1);
  const ends = [next, other].filter((at) => at > start);
  return frame.slice(start, ends.length > 0 ? Math.min(...ends) : undefined);
}

describe('sc-85006: the held pages for a member of one organisation', () => {
  it('reads the held page and ?switcher=one from the address', () => {
    expect(heldOf('paused')).toBe('paused');
    expect(heldOf('overdue')).toBe('overdue');
    expect(heldOf('other')).toBeNull();
    expect(aloneOf('one')).toBe(true);
    expect(aloneOf(undefined)).toBe(false);
    expect(aloneOf('populated')).toBe(false);
  });

  it('draws no Switch organisation on the paused page when there is no other organisation', () => {
    expect(pausedSwitch(othersOf(true))).toBeNull();
    expect(pausedSwitch(othersOf(false))).toBe('switcher');
  });

  it('holds Today and Settings only while paused in the only organisation, as the product (sc-39471)', () => {
    expect(inAnOrganisation(false, 'paused', true)).toBe(false);
    expect(inAnOrganisation(false, 'paused', false)).toBe(true);
    expect(inAnOrganisation(false, 'overdue', true)).toBe(true);
    expect(inAnOrganisation(false, null, false)).toBe(true);
    expect(inAnOrganisation(true, null, false)).toBe(false);
  });

  it('feeds the tab bar, the upright row and the sidebar on its side from it, not from the viewer alone (sc-39471)', () => {
    expect(body('SettingsTabBar')).toMatch(
      /const org = useInAnOrganisation\(\);[\s\S]*tabs=\{tabsFor\(org\)\}/u,
    );
    expect(body('usePortraitRow')).toContain('tabsFor(useInAnOrganisation())');
    const landscape = body('Landscape');
    expect(landscape).toContain('const org = useInAnOrganisation();');
    expect(landscape).toMatch(
      /<DemoSidebar(?:(?!\/>)[\s\S])*org=\{shell\.viewer !== 'noOrg'\}\s*places=\{org\}/u,
    );
  });

  it('lists Today alone in the sidebar on its side, keeping its pill, when places is false (sc-39471)', () => {
    const alone = sidebar.slice(
      sidebar.indexOf('if (org && !places)'),
      sidebar.indexOf('<TodaySidebar'),
    );
    expect(alone).toContain('<SidebarHead org />');
    expect(alone.match(/<SidebarPlace\b/gu)).toHaveLength(1);
    expect(alone).toContain("onPress={() => onTab('Today')}");
    expect(alone).not.toMatch(/'Events'|'Calendar'/u);
  });

  it('feeds both cards their others', () => {
    expect(held).toContain('others={othersOf(alone)}');
    expect(held.match(/others=\{othersOf\(alone\)\}/g)).toHaveLength(2);
  });
});

describe('sc-86077: Settings while the organisation is paused', () => {
  it('lists Organisation then Sign-in rules, whatever the role elsewhere', () => {
    expect(pausedGroups(demoGroups('owner'))).toEqual([
      {
        heading: 'yourAccount',
        sections: ['account', 'security', 'notifications', 'personalisation'],
      },
      { heading: 'organisationHeading', sections: ['organisation', 'signInRules'] },
    ]);
    expect(pausedGroups(demoGroups('member'))[1]?.sections).toEqual([
      'organisation',
      'signInRules',
    ]);
  });

  it('keeps your account’s four sections open, and stands the paused page in for the organisation’s', () => {
    expect(
      ['account', 'security', 'notifications', 'personalisation'].every((one) =>
        opensWhilePaused(one as never),
      ),
    ).toBe(true);
    expect(opensWhilePaused('organisation')).toBe(false);
    expect(opensWhilePaused('members')).toBe(false);
    expect(opensWhilePaused('signInRules')).toBe(false);
    expect(opensWhilePaused(null)).toBe(false);
  });

  it('sends Organisation, Sign-in rules and the data pages to the paused page, and your account’s four to their own', () => {
    for (const one of ['account', 'security', 'notifications', 'personalisation'] as const)
      expect(pausedStandsIn('paused', one, false)).toBe(false);
    expect(pausedStandsIn('paused', 'organisation', false)).toBe(true);
    expect(pausedStandsIn('paused', 'signInRules', false)).toBe(true);
    expect(pausedStandsIn('paused', null, true)).toBe(true);
    expect(pausedStandsIn('paused', null, false)).toBe(false);
    expect(pausedStandsIn(null, 'organisation', false)).toBe(false);
    expect(pausedStandsIn('overdue', 'organisation', false)).toBe(false);
  });

  it('has Route choose the paused page by it, ahead of the open page', () => {
    expect(route).toMatch(
      /const pausedOver = Page != null &&\s*pausedStandsIn\(held, shown, dataShown != null\) && \(\s*<SettingsHome[^>]*\bover\b/u,
    );
    expect(route).toMatch(
      /pausedOver !== false \? \(\s*pausedOver\s*\) : Page != null \? \(\s*<Page \/>/u,
    );
    expect(route).toContain('const home = <SettingsHome {...handlers} held={held} />;');
  });

  it('opens the list as Settings’ home on a phone and upright, the paused page only over it or on its side', () => {
    expect(home).toContain(
      "if (held === 'overdue' || (paused && (over || shell.layout === 'landscape')))",
    );
    expect(home).toContain('return (paused ? pausedGroups(groups) : groups).map(');
  });
});
