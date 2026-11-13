import { type ReactNode, type Ref, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { useOrgOpener } from '../OrgSwitcher.tsx';
import { OrgPill as ProductOrgPill } from '../../components/OrgPill.tsx';
import { SETTINGS_ID, type Tab, TabBar, TABS, WhiteCapsule } from '../../components/TodayCover.tsx';
import type { Tell } from '../../components/TodayParts.tsx';
import type { GlyphName } from '../../components/Glyph.tsx';
import { DemoSidebar } from '../Sidebar.tsx';
import { SIDEBAR_EVENTS } from '../sideEvents.ts';
import { TodayShellProvider } from '../../components/todayShell.ts';
import { demoShell } from '../demoShell.ts';
import { openSearch } from '../search/SearchHeader.tsx';
import { viewerOfRole } from './sample.ts';
import { underSavedName, useSavedName } from './savedName.ts';
import {
  type Looking,
  ShellContext,
  useShell,
  type Viewer,
} from '../../components/settingsShell.ts';
import { Back } from '../../components/SettingsParts.tsx';
import { Bell as ProductBell } from '../../components/BellButton.tsx';
import { PortraitTop as ProductPortraitTop } from '../../components/ListTop.tsx';
import { useSideFrame } from '../../components/listFrame.ts';
import { usePillFit } from '../../components/usePillFit.tsx';

/** A page whose sample someone else sees: the Settings card, its rows and the sidebar's foot follow them. */
export function SeenBy({ looking, children }: { looking: Looking; children: ReactNode }) {
  const shell = useShell();
  const saved = useSavedName();
  const seen = useMemo(
    () => ({
      ...shell,
      looking: underSavedName(looking, saved),
      viewer: viewerOfRole(looking.role),
    }),
    [shell, looking, saved],
  );

  return <ShellContext.Provider value={seen}>{children}</ShellContext.Provider>;
}

/** On its side: the app's sidebar, or an area's own in its place, beside the main card. */
export function Landscape({
  column,
  children,
  overlay,
  at = 'Settings',
  sidebar,
}: {
  column: ReactNode;
  children: ReactNode;
  overlay?: ReactNode;
  at?: Tab;
  sidebar?: ReactNode;
}) {
  const shell = useShell();
  const side = useSideFrame();

  return (
    <View style={[styles.grow, side.chrome]}>
      {sidebar ?? (
        <TodayShellProvider
          value={{
            ...demoShell(shell.tell, { search: () => openSearch(shell.looking.role) }),
            person: shell.looking,
          }}
        >
          <DemoSidebar
            events={SIDEBAR_EVENTS}
            onTab={shell.onTab}
            at={at}
            onPerson={() => shell.openSection('account')}
            org={shell.viewer !== 'noOrg'}
          />
        </TodayShellProvider>
      )}
      <View style={[styles.main, side.card]}>
        {column != null && <View style={styles.column}>{column}</View>}
        <View style={styles.grow}>{children}</View>
      </View>
      {overlay}
    </View>
  );
}

/** Task screens stay white and calm, as the approved sign-in board keeps them: no Confetti, no tab bar. */
export function TaskPage({
  back,
  mark,
  title,
  sub,
  children,
}: {
  back?: { label: string; onPress: () => void } | null;
  mark?: ReactNode;
  title: string;
  sub?: string;
  children: ReactNode;
}) {
  const shell = useShell();
  const insets = useSafeAreaInsets();
  const tablet = shell.layout !== 'phone';

  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={[
          styles.task,
          tablet && styles.taskTablet,
          {
            paddingTop: insets.top + tokens.spaceXl,
            paddingBottom: insets.bottom + tokens.space6xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {back != null && <Back label={back.label} onPress={back.onPress} />}
        <View style={styles.taskHead}>
          {mark}
          <Text
            size={tablet ? 36 : 30}
            weight="bold"
            accessibilityRole="header"
            style={styles.title}
          >
            {title}
          </Text>
          {sub != null && (
            <Text size={16} weight="medium" style={styles.secondary}>
              {sub}
            </Text>
          )}
        </View>
        <View style={styles.cardsPhone}>{children}</View>
      </ScrollView>
    </View>
  );
}

/** The product's bell, with three unread. */
export function Bell({
  tell,
  onPress,
  ref,
}: {
  tell: Tell;
  onPress?: (() => void) | undefined;
  ref?: Ref<ViewInstance> | undefined;
}) {
  return (
    <ProductBell
      ref={ref}
      unread={3}
      onPress={onPress ?? (() => tell('Notifications have their own design.'))}
    />
  );
}

/** The product's pill, opening the demo's switcher. */
export function OrgPill({
  room,
  givesWay = false,
}: {
  /** The room beside an upright iPad's tabs, where the pill is cut or turns to its tile as the product's is (sc-38149). */
  room?: number | undefined;
  givesWay?: boolean;
}) {
  const { viewer } = useShell();
  const ref = useRef<ViewInstance>(null);
  const org = useOrgOpener(ref);
  const { tileAlone, measure } = usePillFit(org.name, org.waiting, room, false);

  if (viewer === 'noOrg') return null;

  const pill = (
    <ProductOrgPill
      ref={ref}
      id={org.id}
      name={org.name}
      waiting={org.waiting}
      label={org.label}
      expanded={org.expanded}
      onPress={org.onPress}
      tileAlone={givesWay || tileAlone}
      testID="org.switch"
    />
  );

  if (room == null) return pill;

  return (
    <View style={styles.pill}>
      {measure}
      {pill}
    </View>
  );
}

/** With no organisation the tabs are Today and Settings, as the product's (sc-29914). */
export function tabsFor(viewer: Viewer): readonly (typeof TABS)[number][] {
  return viewer === 'noOrg' ? TABS.filter(([tab]) => tab === 'Today' || tab === 'Settings') : TABS;
}

/** The phone's tab bar, holding only the tabs the viewer has. */
export function SettingsTabBar({ bottom }: { bottom: number }) {
  const { t } = useTranslation();
  const shell = useShell();

  return (
    <TabBar
      tabs={tabsFor(shell.viewer)}
      bottom={bottom}
      onTab={shell.onTab}
      at="Settings"
      say={(_, glyph) => t(`todayScreen.tab.${glyph}`)}
      ids={SETTINGS_ID}
    />
  );
}

/** The product's upright row: the pill, the tabs and the bell. */
export function PortraitTop({ at = 'Settings' }: { at?: Tab }) {
  const { t } = useTranslation();
  const shell = useShell();
  const tabs = tabsFor(shell.viewer);
  const say = (_: Tab, glyph: GlyphName) => t(`todayScreen.tab.${glyph}`);

  return (
    <ProductPortraitTop
      renderPill={(room, givesWay) => <OrgPill room={room} givesWay={givesWay} />}
      bell={<Bell tell={shell.tell} />}
      tabLabels={tabs.map(([tab, glyph]) => say(tab, glyph))}
      renderTabs={(labelSize) => (
        <WhiteCapsule tabs={tabs} at={at} onTab={shell.onTab} say={say} labelSize={labelSize} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', flexShrink: 1, minWidth: 0 },
  grow: { flex: 1, minWidth: 0 },
  page: { flex: 1, backgroundColor: tokens.colorCard },
  title: { letterSpacing: -0.5 },
  secondary: { color: tokens.colorInkSecondary },
  cardsPhone: { gap: tokens.spaceXl },
  main: { flex: 1, flexDirection: 'row' },
  column: { width: 360, borderRightWidth: 1, borderRightColor: tokens.colorBorder },
  task: { paddingHorizontal: tokens.space3xl, gap: tokens.spaceXl },
  taskTablet: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  taskHead: { gap: tokens.spaceMd, paddingTop: tokens.spaceMd, paddingBottom: tokens.spaceSm },
});
