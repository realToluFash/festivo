import type { NotificationCategory } from '@soirely/api-client';
import { settingRows } from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { FieldError } from '../../components/Field.tsx';
import { Notice } from '../../components/Notice.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { Text } from '../../components/Text.tsx';
import { useShownAfter } from '../../components/useShownAfter.ts';
import { SKELETON_AFTER_MS } from '../../kit/skeleton.ts';
import {
  type Channel,
  isSaving,
  readSettings,
  saveSetting,
  type SettingsGrid,
  settingSaving,
} from '../../kit/notificationSettings.ts';
import { tokens } from '../../theme/tokens.ts';
import {
  CATEGORY_NAMES,
  CHANNEL_NAMES,
  CHANNELS,
  categoryNote,
  firstGrid,
  NOT_SAVED,
  type NotificationsState,
  quietHoursLine,
  sampleClient,
  switchName,
} from './NotificationsModel.ts';
import { ConfettiSwitch } from './NotificationsSwitch.tsx';
import { CARD_RADIUS, Pill, TYPE } from './parts.tsx';

const PUSH_BLOCKED =
  "Push is off on this device, so pushes won't reach you here. Turn it on in your device's settings.";
const LOADING = 'Loading…';
const CELL = { phone: 60, tablet: 100 } as const;

/** Push and Email against the six kinds, flush in one card, each switch saved as it changes, on the demo's own client. */
export function NotificationsGrid({
  state,
  phone,
  locale,
}: {
  state: NotificationsState | null;
  phone: boolean;
  locale: string;
}) {
  const [client] = useState(() => sampleClient(state));
  const [grid, setGrid] = useState<SettingsGrid>(() => firstGrid(state));
  const [attempt, setAttempt] = useState(state === 'loading' ? 1 : 0);
  const [tap, setTap] = useState<object | undefined>(undefined);
  const mounted = useRef(true);
  const cell = phone ? CELL.phone : CELL.tablet;
  const inset = phone ? styles.insetPhone : styles.insetTablet;

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (attempt === 0) return;
    let current = true;
    void readSettings(client).then((apply) => {
      if (current) setGrid(apply);
    });

    return () => {
      current = false;
    };
  }, [attempt, client]);

  useReadOut(grid.status === 'loaded' && grid.saved ? 'Saved.' : null, { answer: tap });

  if (grid.status === 'loading') return <Loading cell={cell} inset={inset} />;

  if (grid.status === 'failed')
    return (
      <Notice
        tone="broken"
        mark={tokens.marks.broken.glyph}
        body="Your notification settings did not load."
        button={
          <Pill
            label="Try again"
            kind="secondary"
            height={tokens.sizeHit}
            full={false}
            onPress={() => {
              setGrid({ status: 'loading' });
              setAttempt((tries) => tries + 1);
            }}
            testID="demo.notifications.tryAgain"
          />
        }
      />
    );

  const change = (category: NotificationCategory, channel: Channel, on: boolean): void => {
    setGrid((current) => settingSaving(current, category, channel, on));
    void saveSetting(client, category, channel, on).then((apply) => {
      if (!mounted.current) return;
      setGrid(apply);
      setTap({});
    });
  };

  return (
    <View style={styles.card} testID="demo.notifications">
      {state === 'pushBlocked' && (
        <View style={styles.blocked}>
          <BellOff />
          <Text size={TYPE.line} weight="medium" style={styles.grow}>
            {PUSH_BLOCKED}
          </Text>
        </View>
      )}
      <View
        style={[styles.heads, inset, state === 'pushBlocked' && styles.headsUnderBand]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.grow} />
        {CHANNELS.map((channel) => (
          <Text
            key={channel}
            size={12}
            weight="semibold"
            accessible={false}
            style={[styles.caps, { width: cell }]}
          >
            {CHANNEL_NAMES[channel].toUpperCase()}
          </Text>
        ))}
      </View>
      {settingRows(grid.settings).map((setting, index) => {
        const note = categoryNote(setting.category, locale);
        const failed = grid.unsaved?.category === setting.category ? grid.unsaved.channel : null;

        return (
          <View
            key={setting.category}
            style={[
              styles.row,
              inset,
              phone ? styles.rowPhone : styles.rowTablet,
              index > 0 && styles.divided,
            ]}
          >
            <View style={styles.line}>
              <View style={styles.names}>
                <Text size={TYPE.row} weight="semibold" accessibilityRole="header">
                  {CATEGORY_NAMES[setting.category]}
                </Text>
                <Text size={TYPE.small} weight="medium" muted>
                  {note}
                </Text>
              </View>
              {CHANNELS.map((channel) => (
                <ConfettiSwitch
                  key={channel}
                  on={setting[channel].on}
                  label={switchName(setting.category, channel)}
                  hint={note}
                  locked={!setting[channel].switchable}
                  busy={isSaving(grid, { category: setting.category, channel })}
                  stacked={phone}
                  width={cell}
                  onChange={(on) => change(setting.category, channel, on)}
                  testID={`demo.notifications.${setting.category}.${channel}`}
                />
              ))}
            </View>
            {failed != null && <FieldError message={NOT_SAVED[failed]} />}
          </View>
        );
      })}
      <View style={[styles.foot, inset]}>
        <Text size={TYPE.small} weight="medium" muted>
          {quietHoursLine(locale)}
        </Text>
      </View>
    </View>
  );
}

/** Loading… over the grid's shape, after a second, as the app's Skeleton waits: a bar pair and two switch shapes a row. */
function Loading({ cell, inset }: { cell: number; inset: StyleProp<ViewStyle> }) {
  const shown = useShownAfter(SKELETON_AFTER_MS);
  useReadOut(shown ? LOADING : null);

  return (
    <View accessibilityState={{ busy: true }} style={styles.loading}>
      {shown && (
        <Text size={TYPE.body} weight="medium" muted>
          {LOADING}
        </Text>
      )}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.card, styles.loadingCard, !shown && styles.unseen]}
      >
        {BARS.map(([first, second], index) => (
          <View
            key={first}
            style={[styles.line, styles.rowLoading, inset, index > 0 && styles.divided]}
          >
            <View style={styles.names}>
              <View style={[styles.bar, styles.barFirst, { width: first }]} />
              <View style={[styles.bar, styles.barSecond, { width: second }]} />
              <View style={[styles.bar, styles.barSecond, styles.barLast]} />
            </View>
            {CHANNELS.map((channel) => (
              <View key={channel} style={[styles.cellLoading, { width: cell }]}>
                <View style={styles.trackLoading} />
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const BARS = [
  ['46%', '86%'],
  ['38%', '92%'],
  ['42%', '78%'],
  ['50%', '88%'],
  ['34%', '80%'],
  ['56%', '90%'],
] as const;

const BELL_OFF = [
  'M10.268 21a2 2 0 0 0 3.464 0',
  'M17 17H4a1 1 0 0 1-.74-1.673C4.59 13.956 6 12.499 6 8a6 6 0 0 1 .258-1.742',
  'm2 2 20 20',
  'M8.668 3.01A6 6 0 0 1 18 8c0 2.687.77 4.653 1.707 6.05',
];

function BellOff() {
  return (
    <View
      style={styles.disc}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg
        width={15}
        height={15}
        viewBox="0 0 24 24"
        fill="none"
        stroke={tokens.colorInkOnDark}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {BELL_OFF.map((d) => (
          <Path key={d} d={d} />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  card: { borderRadius: CARD_RADIUS, backgroundColor: tokens.colorInset, overflow: 'hidden' },
  insetPhone: { paddingHorizontal: tokens.spaceXl },
  insetTablet: { paddingHorizontal: tokens.spaceXxl },
  blocked: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceLg,
    marginTop: tokens.spaceLg,
    marginHorizontal: tokens.spaceLg,
    paddingVertical: 14,
    paddingHorizontal: tokens.spaceXl,
    borderRadius: 18,
    backgroundColor: tokens.colorAccentTint,
  },
  disc: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorAccentText,
  },
  heads: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: tokens.spaceSm,
    paddingTop: tokens.spaceXl,
    paddingBottom: tokens.spaceHair,
  },
  headsUnderBand: { paddingTop: 14 },
  caps: { textAlign: 'center', letterSpacing: 12 * 0.08, color: tokens.colorInkSecondary },
  row: { gap: 10 },
  rowPhone: { paddingVertical: 14 },
  rowTablet: { paddingVertical: 13 },
  divided: { borderTopWidth: 1, borderTopColor: tokens.colorBorder },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  names: { flex: 1, minWidth: 0, gap: 3 },
  foot: {
    paddingTop: 14,
    paddingBottom: tokens.spaceXl,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  loading: { gap: tokens.spaceLg },
  loadingCard: { paddingVertical: tokens.spaceXxs },
  unseen: { opacity: 0 },
  rowLoading: { paddingVertical: tokens.spaceXl },
  bar: { borderRadius: 7, backgroundColor: tokens.colorInsetBorder },
  barFirst: { height: 15 },
  barSecond: { height: 12, marginTop: tokens.spaceXxs },
  barLast: { width: '62%' },
  cellLoading: { alignItems: 'center' },
  trackLoading: {
    width: 51,
    height: 31,
    borderRadius: 16,
    backgroundColor: tokens.colorInsetBorder,
  },
});
