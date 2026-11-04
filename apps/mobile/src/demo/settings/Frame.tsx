import { createContext, type ReactNode, type Ref, useContext } from 'react';
import { Pressable, ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Text } from '../../components/Text.tsx';
import type { SettingsSection } from '../../kit/appNav.ts';
import { tokens } from '../../theme/tokens.ts';
import { Glyph } from '../Glyph.tsx';
import { SAMPLE } from '../samples.ts';
import type { EventKey } from '../today.ts';
import { PhoneTabBar, TABS, type Tab } from '../TodayCover.tsx';
import type { Tell } from '../TodayParts.tsx';
import { TodaySidebar } from '../TodaySidebar.tsx';
import { Back, RoundButton, Tile, TYPE } from './parts.tsx';
import type { SettingsLayout, Viewer } from './sample.ts';

export interface Shell {
  layout: SettingsLayout;
  viewer: Viewer;
  open: SettingsSection | null;
  openSection: (section: SettingsSection) => void;
  toSettings: () => void;
  tell: Tell;
  onTab: (tab: Tab) => void;
  listColumn: ReactNode;
}

export const ShellContext = createContext<Shell | null>(null);

export function useShell(): Shell {
  const shell = useContext(ShellContext);
  if (shell == null) throw new Error('A Settings page is drawn inside the demo’s Settings route.');

  return shell;
}

export const PHONE_TAB_BAR = 64;
const SIDEBAR_EVENTS: readonly EventKey[] = ['wed', 'ireti', 'party', 'draft'];

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
  back?: { label: string; onPress: () => void } | null;
  right?: ReactNode;
  children: ReactNode;
  dock?: ReactNode;
  overlay?: ReactNode;
  column?: ReactNode;
  scrollRef?: Ref<ScrollViewInstance>;
}) {
  const shell = useShell();
  const insets = useSafeAreaInsets();
  const backTo = back === undefined ? { label: 'Settings', onPress: shell.toSettings } : back;

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
          {backTo != null && <Back label={backTo.label} onPress={backTo.onPress} />}
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
          <Fade />
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

export function Landscape({
  column,
  children,
  overlay,
}: {
  column: ReactNode;
  children: ReactNode;
  overlay?: ReactNode;
}) {
  const shell = useShell();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.chrome, { paddingTop: insets.top }]}>
      <TodaySidebar
        events={SIDEBAR_EVENTS}
        onTab={shell.onTab}
        tell={shell.tell}
        at="Settings"
        onPerson={() => shell.openSection('account')}
      />
      <View style={[styles.main, { marginBottom: Math.max(insets.bottom, tokens.spaceMd) }]}>
        <View style={styles.column}>{column}</View>
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
      <Back label="Settings" onPress={() => shell.toSettings()} />
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

export function Bell({ tell }: { tell: Tell }) {
  return (
    <RoundButton
      glyph="bell"
      label="Notifications, 3 unread"
      dot
      onPress={() => tell('Notifications have their own design.')}
    />
  );
}

export function PortraitTop() {
  const shell = useShell();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.portraitTop, { paddingTop: insets.top + tokens.spaceMd }]}>
      <Pressable
        onPress={() => shell.tell('Switching organisation has its own design.')}
        style={styles.org}
        accessibilityRole="button"
        accessibilityLabel={`${SAMPLE.organisation}. Switch organisation`}
      >
        <Tile of="organisation" side={28} initials="IE" />
        <Text size={TYPE.body} weight="semibold" accessible={false}>
          {SAMPLE.organisation}
        </Text>
        <Glyph name="updown" size={14} ink={tokens.colorInkSecondary} />
      </Pressable>
      <View style={styles.grow} />
      <Bell tell={shell.tell} />
      <View style={[styles.capsuleAt, { top: insets.top + 7 }]} pointerEvents="box-none">
        <View style={styles.capsule} accessibilityRole="tablist">
          {TABS.map(([label, glyph]) => {
            const on = label === 'Settings';
            const ink = on ? tokens.colorAccent : tokens.colorInkSecondary;

            return (
              <Pressable
                key={label}
                onPress={() => shell.onTab(label)}
                hitSlop={tokens.spaceXxs}
                style={[styles.capsuleTab, on && styles.capsuleOn]}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={label}
              >
                <Glyph name={glyph} ink={ink} />
                <Text size={TYPE.body} weight="semibold" accessible={false} style={{ color: ink }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export function Fade() {
  return (
    <View style={styles.fade} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="settingsFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={tokens.colorCard} stopOpacity={0} />
            <Stop offset="0.62" stopColor={tokens.colorCard} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#settingsFade)" />
      </Svg>
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
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 150 },
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
  org: {
    height: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingLeft: tokens.spaceXs,
    paddingRight: tokens.spaceLg,
    borderRadius: tokens.sizeHit / 2,
    backgroundColor: tokens.colorInset,
  },
  capsuleAt: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  capsule: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceHair,
    paddingHorizontal: tokens.spaceXxs,
    borderRadius: 23,
    backgroundColor: tokens.colorInset,
  },
  capsuleTab: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingLeft: 13,
    paddingRight: tokens.spaceXl,
    borderRadius: 19,
  },
  capsuleOn: { backgroundColor: tokens.colorCard, ...tokens.elevationNative.raised.ios },
});
