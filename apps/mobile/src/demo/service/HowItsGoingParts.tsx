import { type Ref, useId } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';

import { ReadOut } from '../../components/ReadOut.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Glyph } from '../queue/QueueParts.tsx';
import type { AlertKind } from './HowItsGoingModel.ts';

export const PATHS = {
  pause: ['M8 5v14', 'M16 5v14'],
  clock: ['M12 7v5l3 2'],
  hourglass: ['M6 2h12', 'M6 22h12', 'M6 2c0 6 6 6 6 10s-6 4-6 10', 'M18 2c0 6-6 6-6 10s6 4 6 10'],
  diamond: ['M12 3 21 12 12 21 3 12z'],
  check: ['M20 6 9 17l-5-5'],
  tray: ['M4 16h16', 'M6 16a6 6 0 0 1 12 0'],
  behind: ['M12 6v6l4 2', 'M20 12v5', 'M20 21h.01', 'M21.25 8.2A10 10 0 1 0 16 21.16'],
  nobody: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M13 7a4 4 0 1 1-8 0 4 4 0 1 1 8 0',
    'm17 8 5 5',
    'm22 8-5 5',
  ],
  person: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M16 7a4 4 0 1 1-8 0 4 4 0 1 1 8 0'],
  offline: [
    'M2 2l20 20',
    'M8.5 16.5a5 5 0 0 1 7 0',
    'M2 8.82a15 15 0 0 1 4.17-2.65',
    'M10.66 5c4.01-.36 8.14.9 11.34 3.76',
    'M16.85 11.25a10 10 0 0 1 2.22 1.68',
    'M5 13a10 10 0 0 1 5.24-2.76',
    'M12 20h.01',
  ],
  sentBack: ['M9 14 4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 0 11H11'],
  request: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  flag: ['M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z', 'M4 22v-7'],
  given: ['M5 12h14', 'm12 5 7 7-7 7'],
} as const;

export const ALERT_ICON: Record<AlertKind, { paths: readonly string[]; circle: boolean }> = {
  allergy: { paths: PATHS.sentBack, circle: false },
  paused: { paths: PATHS.pause, circle: false },
  leftBehind: { paths: PATHS.flag, circle: false },
  heldUp: { paths: PATHS.hourglass, circle: false },
  behind: { paths: PATHS.behind, circle: false },
  station: { paths: PATHS.nobody, circle: false },
  request: { paths: PATHS.request, circle: false },
  nobody: { paths: PATHS.nobody, circle: false },
};

export type ChipTone = 'plain' | 'outline' | 'accent' | 'paused' | 'attention' | 'broken';

const TONE: Record<ChipTone, { bg: string; ink: string }> = {
  plain: { bg: tokens.colorInset, ink: tokens.colorInk },
  outline: { bg: tokens.colorCard, ink: tokens.colorInk },
  accent: { bg: tokens.colorAccentTint, ink: tokens.colorAccentText },
  paused: { bg: tokens.colorPausedTint, ink: tokens.colorPausedText },
  attention: { bg: tokens.colorAttentionTint, ink: tokens.colorAttentionText },
  broken: { bg: tokens.colorBrokenTint, ink: tokens.colorBrokenText },
};

export function Chip({
  word,
  paths,
  tone = 'plain',
  circle = false,
}: {
  word: string;
  paths: readonly string[];
  tone?: ChipTone;
  circle?: boolean;
}) {
  const t = TONE[tone];
  return (
    <View style={[styles.chip, { backgroundColor: t.bg }, tone === 'outline' && styles.outline]}>
      <Glyph paths={paths} ink={t.ink} side={13} circle={circle} />
      <Text size={13} weight="semibold" style={{ color: t.ink }} numberOfLines={1}>
        {word}
      </Text>
    </View>
  );
}

export function TextAction({
  label,
  paths,
  onPress,
  ref,
  accessibilityLabel,
  testID,
}: {
  label: string;
  paths: readonly string[];
  onPress: () => void;
  ref?: Ref<ViewInstance> | undefined;
  accessibilityLabel?: string | undefined;
  testID: string;
}) {
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}
      testID={testID}
    >
      <Glyph paths={paths} ink={tokens.colorAccentText} side={16} />
      <Text size={15} weight="semibold" style={styles.accent}>
        {label}
      </Text>
    </Pressable>
  );
}

export type TabId = 'next' | 'floor' | 'service' | 'team';

const TAB_WORD: Record<TabId, string> = {
  next: 'Next',
  floor: 'Floor',
  service: 'Service',
  team: 'Team',
};

export function TabBar({
  tabs,
  current,
  onPick,
  bottom,
}: {
  tabs: readonly TabId[];
  current: TabId;
  onPick: (t: TabId) => void;
  bottom: number;
}) {
  return (
    <View style={[styles.tabs, { paddingBottom: bottom }]} accessibilityRole="tablist">
      {tabs.map((t) => (
        <Pressable
          key={t}
          onPress={() => onPick(t)}
          accessibilityRole="tab"
          accessibilityState={{ selected: current === t }}
          style={[styles.tab, current === t && styles.tabOn]}
          testID={`service.tab.${t}`}
        >
          <Text
            size={15}
            weight={current === t ? 'bold' : 'semibold'}
            style={current === t ? styles.accent : styles.secondary}
            numberOfLines={1}
          >
            {TAB_WORD[t]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Strip({ online, refused }: { online: boolean; refused: string }) {
  const status = online ? 'Connected · up to date 20:24' : 'No connection · as of 20:22';
  return (
    <View style={styles.stripWrap}>
      <ReadOut words={status} style={styles.strip} accessibilityRole="text">
        {online ? (
          <View style={styles.dot} />
        ) : (
          <Glyph paths={PATHS.offline} ink={tokens.colorInk} side={16} />
        )}
        <Text
          size={14}
          weight={online ? 'medium' : 'semibold'}
          style={online ? styles.secondary : styles.ink}
        >
          {status}
        </Text>
      </ReadOut>
      {refused !== '' && (
        <View accessibilityRole="alert" style={styles.notice}>
          <Glyph paths={PATHS.offline} ink={tokens.colorInk} side={18} />
          <Text size={15} weight="semibold" style={styles.grow}>
            {refused}
          </Text>
        </View>
      )}
    </View>
  );
}

export type CountKey = 'served' | 'onTray' | 'kitchen' | 'toServe';

/** The board's non-colour cue for each count: Served a filled square, On a tray a dot, Waiting on the kitchen a hatched square, To serve a ring. */
export function CountShape({ kind }: { kind: CountKey }) {
  return (
    <View
      style={[styles.shape, SHAPE[kind]]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {kind === 'kitchen' && <Hatch />}
    </View>
  );
}

export function Hatch() {
  const id = `hatch${useId().replace(/:/g, '')}`;
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern
          id={id}
          width={4}
          height={4}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <Rect width={4} height={4} fill={tokens.colorTrack} />
          <Path d="M0 0v4" stroke={tokens.colorInkTertiary} strokeWidth={2} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

export function Initials({ name }: { name: string }) {
  const ini = name
    .split(' ')
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2);
  return (
    <View
      style={styles.initials}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text size={12} weight="bold" accessible={false}>
        {ini}
      </Text>
    </View>
  );
}

export const shared = StyleSheet.create({
  card: {
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    gap: tokens.spaceSm,
  },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  sep: { borderTopWidth: 1, borderTopColor: tokens.colorBorder },
  grow: { flex: 1, minWidth: 0 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
});

const SHAPE = StyleSheet.create({
  served: { borderRadius: 3, backgroundColor: tokens.colorAccent },
  onTray: { borderRadius: 7, backgroundColor: tokens.colorAccentTintBorder },
  kitchen: { borderRadius: 3, borderWidth: 1.5, borderColor: tokens.colorInkTertiary },
  toServe: { borderRadius: 7, borderWidth: 2, borderColor: tokens.colorInkSecondary },
});

const styles = StyleSheet.create({
  shape: { width: 14, height: 14, overflow: 'hidden' },
  outline: { borderWidth: 1, borderColor: tokens.colorControlBorder },
  chip: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
  },
  textAction: {
    minHeight: tokens.sizeHitPhonePrimary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  pressed: { opacity: tokens.opacityPressed },
  accent: { color: tokens.colorAccentText },
  secondary: { color: tokens.colorInkSecondary },
  ink: { color: tokens.colorInk },
  grow: { flex: 1, minWidth: 0 },
  tabs: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: tokens.spaceSm,
    paddingTop: tokens.spaceSm,
    backgroundColor: tokens.colorCard,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabOn: { backgroundColor: tokens.colorAccentTint },
  stripWrap: { gap: tokens.spaceSm },
  strip: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.colorAccent },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: tokens.spaceMd,
    borderRadius: 12,
    backgroundColor: tokens.colorInset,
  },
  initials: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: tokens.colorInset,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
