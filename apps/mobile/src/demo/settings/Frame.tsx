import { type ReactNode, type Ref, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { useOrgOpener } from '../OrgSwitcher.tsx';
import { OrgPill as ProductOrgPill } from '../../components/OrgPill.tsx';
import type { EventKey } from '../today.ts';
import { type Tab, TABS, WhiteCapsule } from '../../components/TodayCover.tsx';
import type { Tell } from '../../components/TodayParts.tsx';
import { DemoSidebar } from '../Sidebar.tsx';
import { SIDEBAR_EVENTS } from '../sideEvents.ts';
import { TodayShellProvider } from '../../components/todayShell.ts';
import { demoShell } from '../demoShell.ts';
import { viewerOfRole } from './sample.ts';
import { underSavedName, useSavedName } from './savedName.ts';
import { type Looking, ShellContext, useShell } from '../../components/settingsShell.ts';
import { Back, RoundButton } from '../../components/SettingsParts.tsx';

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
  onEvent,
}: {
  column: ReactNode;
  children: ReactNode;
  overlay?: ReactNode;
  at?: Tab;
  sidebar?: ReactNode;
  onEvent?: (key: EventKey) => void;
}) {
  const shell = useShell();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.chrome, { paddingTop: insets.top }]}>
      {sidebar ?? (
        <TodayShellProvider
          value={{ ...demoShell(shell.tell, { event: onEvent }), person: shell.looking }}
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
      <View style={[styles.main, { marginBottom: Math.max(insets.bottom, tokens.spaceMd) }]}>
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

export function Bell({
  tell,
  onPress,
  ref,
}: {
  tell: Tell;
  onPress?: (() => void) | undefined;
  ref?: Ref<ViewInstance> | undefined;
}) {
  const { t } = useTranslation();

  return (
    <RoundButton
      ref={ref}
      glyph="bell"
      label={t('notifications.bellUnread', { count: 3 })}
      dot
      onPress={onPress ?? (() => tell('Notifications have their own design.'))}
    />
  );
}

/** The product's pill, opening the demo's switcher. */
export function OrgPill() {
  const { viewer } = useShell();
  const ref = useRef<ViewInstance>(null);
  const org = useOrgOpener(ref);

  if (viewer === 'noOrg') return null;

  return (
    <ProductOrgPill
      ref={ref}
      id={org.id}
      name={org.name}
      waiting={org.waiting}
      label={org.label}
      expanded={org.expanded}
      onPress={org.onPress}
      testID="org.switch"
    />
  );
}

export function PortraitTop({ at = 'Settings' }: { at?: Tab }) {
  const shell = useShell();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.portraitTop, { paddingTop: insets.top + tokens.spaceMd }]}>
      <OrgPill />
      <View style={styles.grow} />
      <Bell tell={shell.tell} />
      <View style={[styles.capsuleAt, { top: insets.top + 7 }]} pointerEvents="box-none">
        <WhiteCapsule tabs={TABS} at={at} onTab={shell.onTab} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  page: { flex: 1, backgroundColor: tokens.colorCard },
  title: { letterSpacing: -0.5 },
  secondary: { color: tokens.colorInkSecondary },
  cardsPhone: { gap: tokens.spaceXl },
  chrome: { flex: 1, flexDirection: 'row', backgroundColor: tokens.colorNeutralFill },
  main: {
    flex: 1,
    flexDirection: 'row',
    marginRight: tokens.spaceMd,
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    overflow: 'hidden',
  },
  column: { width: 360, borderRightWidth: 1, borderRightColor: tokens.colorBorder },
  task: { paddingHorizontal: tokens.space3xl, gap: tokens.spaceXl },
  taskTablet: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  taskHead: { gap: tokens.spaceMd, paddingTop: tokens.spaceMd, paddingBottom: tokens.spaceSm },
  portraitTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.space3xl,
    paddingBottom: tokens.spaceXxs,
  },
  capsuleAt: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
