import { type Href, router, useLocalSearchParams } from 'expo-router';
import { type ComponentType, useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Toast } from '../../components/Toast.tsx';
import { SECTION_HREF, type SettingsSection } from '../../kit/appNav.ts';
import { useLayout } from '../../layout/useLayout.ts';
import { tokens } from '../../theme/tokens.ts';
import { OrgSwitcherProvider } from '../OrgSwitcher.tsx';
import { switcherStateOf } from '../OrgSwitcherModel.ts';
import type { Tab } from '../../components/TodayCover.tsx';
import type { Tell } from '../../components/TodayParts.tsx';
import { useCoverStatusBar } from '../Welcome.tsx';
import { AccountSection } from './Account.tsx';
import { PHONE_TAB_BAR, type Shell, ShellContext } from './Frame.tsx';
import { MembersSection } from './Members.tsx';
import { NotificationsSection } from './Notifications.tsx';
import { OrganisationSection } from './Organisation.tsx';
import {
  type DemoSection,
  lookingAs,
  SECTIONS,
  type SettingsLayout,
  type Viewer,
  viewerOf,
} from './sample.ts';
import { SecuritySection } from './Security.tsx';
import { SettingsColumn, SettingsHome, sectionsFor } from './SettingsHome.tsx';
import { SignInRulesSection } from './SignInRules.tsx';

const PAGES: Record<DemoSection, ComponentType> = {
  account: AccountSection,
  security: SecuritySection,
  notifications: NotificationsSection,
  organisation: OrganisationSection,
  members: MembersSection,
  signInRules: SignInRulesSection,
};

/** The demo's paths are the app's own under /demo: /demo/settings/sign-in-rules. */
export function slugOf(section: SettingsSection): string {
  return SECTION_HREF[section].slice('/settings/'.length);
}

export function sectionOfSlug(slug: string | undefined): DemoSection | null {
  return SECTIONS.find((section) => slugOf(section) === slug) ?? null;
}

export function settingsHref(
  viewer: Viewer,
  section: SettingsSection | null,
  state?: string,
): Href {
  const query = [state == null ? '' : `state=${state}`, viewer === 'owner' ? '' : `as=${viewer}`]
    .filter((part) => part !== '')
    .join('&');
  const path = section == null ? '/demo/settings' : `/demo/settings/${slugOf(section)}`;

  return `${path}${query === '' ? '' : `?${query}`}` as Href;
}

export function layoutOf(kind: ReturnType<typeof useLayout>['kind']): SettingsLayout {
  return kind === 'phone' ? 'phone' : kind === 'tabletPortrait' ? 'portrait' : 'landscape';
}

/** Settings in B, on sample data: the list, and each section's page under it. */
export function SettingsRoute({ section }: { section: DemoSection | null }) {
  const params = useLocalSearchParams<{ as?: string; switcher?: string }>();
  const layout = layoutOf(useLayout().kind);
  const [told, setTold] = useState<string>();
  const tell = useCallback<Tell>((words) => setTold(words), []);
  const viewer = viewerOf(params.as);
  const shown = section != null && sectionsFor(viewer).includes(section) ? section : null;

  useCoverStatusBar('dark', false);

  const openSection = useCallback(
    (next: SettingsSection, state?: string) => {
      if (next === shown && state == null) return;
      // On its side the list stays put, so a row changes the page beside it rather than stacking one.
      if (layout === 'landscape') router.replace(settingsHref(viewer, next, state));
      else router.push(settingsHref(viewer, next, state));
    },
    [layout, shown, viewer],
  );
  const toSettings = useCallback(() => {
    if (layout === 'landscape') router.replace(settingsHref(viewer, null));
    else router.dismissTo(settingsHref(viewer, null));
  }, [layout, viewer]);
  const onTab = useCallback(
    (tab: Tab) => {
      if (tab === 'Today') router.replace('/demo/today');
      else if (tab === 'Settings') {
        if (shown != null) toSettings();
      } else if (tab === 'Events') router.replace('/demo/events');
      else router.replace('/demo/calendar');
    },
    [shown, toSettings],
  );
  const handlers = useMemo(
    () => ({
      onSignOut: () => router.replace('/demo/welcome?notice=signedOut'),
      onDemo: () => router.dismissTo('/demo'),
    }),
    [],
  );
  const shell = useMemo<Shell>(
    () => ({
      layout,
      viewer,
      looking: lookingAs(viewer),
      open: shown,
      openSection,
      toSettings,
      tell,
      onTab,
      listColumn: <SettingsColumn {...handlers} />,
    }),
    [layout, viewer, shown, openSection, toSettings, tell, onTab, handlers],
  );
  const Page = shown == null ? null : PAGES[shown];

  return (
    <ShellContext.Provider value={shell}>
      <OrgSwitcherProvider state={switcherStateOf(params.switcher)} tell={tell}>
        <View style={styles.fill}>
          {Page == null ? <SettingsHome {...handlers} /> : <Page />}
          {told != null && (
            <Told words={told} phone={layout === 'phone'} onClose={() => setTold(undefined)} />
          )}
        </View>
      </OrgSwitcherProvider>
    </ShellContext.Provider>
  );
}

function Told({ words, phone, onClose }: { words: string; phone: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const bottom =
    Math.max(insets.bottom, tokens.spaceLg) + (phone ? PHONE_TAB_BAR + tokens.spaceLg : 0);

  return (
    <View style={[styles.toast, { bottom }]}>
      <Toast key={words} words={words} onClose={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: tokens.colorCard },
  toast: { position: 'absolute', left: tokens.spaceXl, right: tokens.spaceXl },
});
