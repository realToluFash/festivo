import { type ReactNode, type Ref, useMemo, useRef } from 'react';
import {
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  View,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { useOrgOpener } from '../OrgSwitcher.tsx';
import { SW } from '../OrgSwitcherModel.ts';
import { OrgPill as ProductOrgPill } from '../../components/OrgPill.tsx';
import { type EventKey, sample } from '../today.ts';
import {
  PHONE_TAB_BAR,
  PhoneTabBar,
  type Tab,
  TABS,
  TabBarFade,
  WhiteCapsule,
} from '../../components/TodayCover.tsx';
import type { Tell } from '../../components/TodayParts.tsx';
import { TodaySidebar } from '../../components/TodaySidebar.tsx';
import { TodayShellProvider } from '../../components/todayShell.ts';
import { demoShell } from '../demoShell.ts';
import { viewerOfRole } from './sample.ts';
import { type Looking, ShellContext, useShell } from '../../components/settingsShell.ts';
import { Back, RoundButton, TYPE } from '../../components/SettingsParts.tsx';

/** A page whose sample someone else sees: the Settings card, its rows and the sidebar's foot follow them. */
export function SeenBy({ looking, children }: { looking: Looking; children: ReactNode }) {
  const shell = useShell();
  const seen = useMemo(
    () => ({ ...shell, looking, viewer: viewerOfRole(looking.role) }),
    [shell, looking],
  );

  return <ShellContext.Provider value={seen}>{children}</ShellContext.Provider>;
}

const SIDEBAR_EVENTS = (['wed', 'ireti', 'party', 'draft'] as const).map(sample);

/** A Settings page in B: on its side, `column` takes the Settings list's place, as givesWay does in the app. */
export function SettingsPage({
  title,
  back,
  right,
  children,
  dock,
  overlay,
  column,
  scrollRef,
}: {
  title: string;
  back?: { label?: string; onPress: () => void } | null;
  right?: ReactNode;
  children: ReactNode;
  dock?: ReactNode;
  overlay?: ReactNode;
  column?: ReactNode;
  scrollRef?: Ref<ScrollViewInstance>;
}) {
  const shell = useShell();
  const insets = useSafeAreaInsets();
  const backTo = back === undefined ? { onPress: shell.toSettings } : back;

  if (shell.layout === 'landscape')
    return (
      <Landscape column={column ?? shell.listColumn} overlay={overlay}>
        <ScrollView
          ref={scrollRef}
          style={styles.grow}
          contentContainerStyle={styles.pane}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleRow}>
            <Text
              size={TYPE.titlePane}
              weight="bold"
              accessibilityRole="header"
              style={[styles.grow, styles.title]}
            >
              {title}
            </Text>
            {right}
          </View>
          <View style={styles.cardsPane}>{children}</View>
        </ScrollView>
        {dock != null && <View style={styles.dockTablet}>{dock}</View>}
      </Landscape>
    );

  const phone = shell.layout === 'phone';
  const foot = Math.max(insets.bottom - tokens.spaceXxs, tokens.spaceLg);

  return (
    <View style={styles.page}>
      {!phone && <PortraitTop />}
      <ScrollView
        ref={scrollRef}
        style={styles.grow}
        contentContainerStyle={
          phone
            ? {
                paddingTop: insets.top + tokens.spaceXxs,
                paddingHorizontal: tokens.spaceXxl,
                paddingBottom: foot + PHONE_TAB_BAR + tokens.space6xl * 2,
              }
            : {
                paddingHorizontal: tokens.space5xl,
                paddingBottom: insets.bottom + tokens.space6xl * 2,
              }
        }
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <View style={phone ? styles.headPhone : styles.headPortrait}>
          {backTo != null && <Back {...backTo} />}
          <View style={styles.titleRow}>
            <Text
              size={phone ? TYPE.titlePhone : TYPE.titlePortrait}
              weight="bold"
              accessibilityRole="header"
              style={[styles.grow, styles.title]}
            >
              {title}
            </Text>
            {right}
            {phone && <Bell tell={shell.tell} />}
          </View>
        </View>
        <View style={phone ? styles.cardsPhone : styles.cardsPortrait}>{children}</View>
      </ScrollView>
      {phone ? (
        <>
          <TabBarFade />
          {dock != null && (
            <View style={[styles.dockPhone, { bottom: foot + PHONE_TAB_BAR + tokens.spaceMd }]}>
              {dock}
            </View>
          )}
          <PhoneTabBar bottom={foot} onTab={shell.onTab} at="Settings" />
        </>
      ) : (
        dock != null && (
          <View style={[styles.dockTablet, { bottom: Math.max(insets.bottom, tokens.spaceXl) }]}>
            {dock}
          </View>
        )
      )}
      {overlay}
    </View>
  );
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
          <TodaySidebar
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

export function SectionColumn({
  title,
  sub,
  right,
  children,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  const shell = useShell();

  return (
    <ScrollView
      contentContainerStyle={styles.sectionColumn}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Back onPress={() => shell.toSettings()} />
      <View style={styles.columnHead}>
        <View style={styles.titleRow}>
          <Text
            size={26}
            weight="bold"
            accessibilityRole="header"
            style={[styles.grow, styles.title]}
          >
            {title}
          </Text>
          {right}
        </View>
        {sub != null && (
          <Text size={TYPE.line} weight="medium" style={styles.secondary}>
            {sub}
          </Text>
        )}
      </View>
      {children}
    </ScrollView>
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
  return (
    <RoundButton
      ref={ref}
      glyph="bell"
      label="Notifications, 3 unread"
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
      id={org.place.id}
      name={org.place.name}
      waiting={org.waiting > 0 ? SW.count(org.waiting) : null}
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  headPhone: { gap: tokens.spaceMd, paddingBottom: tokens.spaceXxl },
  headPortrait: { gap: tokens.spaceLg, paddingTop: 26, paddingBottom: tokens.space3xl },
  cardsPhone: { gap: tokens.spaceXl },
  cardsPortrait: { gap: 18 },
  cardsPane: { gap: tokens.spaceXl, marginTop: tokens.spaceXl },
  pane: {
    paddingTop: 26,
    paddingHorizontal: 30,
    paddingBottom: tokens.space6xl * 2,
    gap: tokens.spaceXs,
  },
  dockPhone: { position: 'absolute', left: tokens.spaceLg, right: tokens.spaceLg },
  dockTablet: {
    position: 'absolute',
    left: tokens.space3xl,
    right: tokens.space3xl,
    bottom: tokens.space3xl,
  },
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
  sectionColumn: {
    paddingTop: tokens.spaceXl,
    paddingLeft: tokens.spaceXl,
    paddingRight: 14,
    paddingBottom: tokens.space6xl,
    gap: 14,
  },
  columnHead: { gap: tokens.spaceXxs },
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
