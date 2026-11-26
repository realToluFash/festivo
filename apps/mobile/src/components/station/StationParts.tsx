import { READY_IN_MINUTES } from '@soirely/domain';
import { type Ref } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { tokens } from '../../theme/tokens.ts';
import { Glyph } from '../NightCards.tsx';
import { Text } from '../Text.tsx';

export const GLYPH = {
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  slash: ['M7 17L17 7'],
  pause: ['M9 6v12', 'M15 6v12'],
  flag: ['M5 21V4', 'M5 4h12l-2.5 4.5L17 13H5'],
  clock: ['M12 7v5l3 2'],
  chevron: ['m6 9 6 6 6-6'],
  send: ['M12 19V5', 'm6 11 6-6 6 6'],
  info: ['M12 11v6', 'M12 7.5h.01'],
  ban: ['M5.6 5.6l12.8 12.8'],
  offline: ['M2 2l20 20', 'M8.5 16.5a5 5 0 0 1 7 0', 'M5 13a10 10 0 0 1 5.24-2.76', 'M12 20h.01'],
} as const;

/** The house quiet action at this view's target: 44 px, and 48 on the phone (sc-4015). */
export function Quiet({
  label,
  side,
  onPress,
  testID,
  accessibilityLabel,
}: {
  label: string;
  side: number;
  onPress: () => void;
  testID: string;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.quiet, { minHeight: side, minWidth: side }]}
      testID={testID}
    >
      <Text size={tokens.typeButton.size} weight="semibold" style={styles.quietInk}>
        {label}
      </Text>
    </Pressable>
  );
}

export type Status = 'on' | 'off' | 'ready' | 'preparing' | 'heldUp' | 'runOut' | 'paused' | 'kept';

const STATUS_KEY: Record<Status, string> = {
  on: 'service.mark.on',
  off: 'service.mark.notOn',
  ready: 'service.item.ready',
  preparing: 'service.item.preparing',
  heldUp: 'station.heldUp',
  runOut: 'station.runOut',
  paused: 'station.paused',
  kept: 'service.waitingToSend',
};

const STATUS: Record<Status, { ink: string; fill: string; edge: string }> = {
  on: {
    ink: tokens.colorAccentText,
    fill: tokens.colorAccentTint,
    edge: tokens.colorAccentTintBorder,
  },
  off: { ink: tokens.colorInk, fill: tokens.colorCard, edge: tokens.colorControlBorder },
  ready: {
    ink: tokens.colorAccentText,
    fill: tokens.colorAccentTint,
    edge: tokens.colorAccentTintBorder,
  },
  preparing: {
    ink: tokens.colorAttentionText,
    fill: tokens.colorAttentionTint,
    edge: tokens.colorAttentionBorder,
  },
  heldUp: { ink: tokens.colorBrokenText, fill: tokens.colorBrokenTint, edge: tokens.colorBroken },
  runOut: { ink: tokens.colorInk, fill: tokens.colorNeutralFill, edge: tokens.colorInk },
  paused: {
    ink: tokens.colorPausedText,
    fill: tokens.colorPausedTint,
    edge: tokens.colorPausedTint,
  },
  kept: { ink: tokens.colorInkSecondary, fill: tokens.colorCard, edge: tokens.colorFieldBorder },
};

function Shape({ status, side }: { status: Status; side: number }) {
  const ink = STATUS[status].ink;
  switch (status) {
    case 'on':
    case 'ready':
      return <Glyph paths={GLYPH.check} ink={ink} side={side} circle />;
    case 'off':
      return <Glyph paths={GLYPH.slash} ink={ink} side={side} circle />;
    case 'preparing':
    case 'heldUp':
      return <Glyph paths={GLYPH.clock} ink={ink} side={side} circle />;
    case 'runOut':
      return <Glyph paths={GLYPH.ban} ink={ink} side={side} circle />;
    case 'paused':
      return <Glyph paths={GLYPH.pause} ink={ink} side={side} />;
    case 'kept':
      return <Glyph paths={GLYPH.send} ink={ink} side={side} />;
  }
}

/** Every status is a shape with its word, never colour alone (a kitchen prints in black and white). */
export function Chip({
  status,
  big = false,
  words,
}: {
  status: Status;
  big?: boolean;
  words?: string | undefined;
}) {
  const { t } = useTranslation();
  const st = STATUS[status];
  return (
    <View
      style={[
        styles.chip,
        big && styles.chipBig,
        { backgroundColor: st.fill, borderColor: st.edge },
        status === 'kept' && styles.dashed,
      ]}
    >
      <Shape status={status} side={big ? 18 : 15} />
      <Text size={big ? 15 : 13} weight="semibold" style={{ color: st.ink }}>
        {words ?? t(STATUS_KEY[status])}
      </Text>
    </View>
  );
}

export function FlagLine({ flags, size }: { flags: readonly string[]; size: number }) {
  const { t } = useTranslation();
  return (
    <View style={styles.flags}>
      <View style={styles.flagWords}>
        <Glyph paths={GLYPH.flag} ink={tokens.colorBrokenText} side={size} />
        <Text size={size} weight="bold" style={styles.broken}>
          {flags.join(' · ')}
        </Text>
      </View>
      <Text size={size - 2 < 15 ? 15 : size - 2} weight="semibold" style={styles.broken}>
        {t('station.dishFirst')}
      </Text>
    </View>
  );
}

export function FlaggedCount({ n }: { n: number }) {
  const { t } = useTranslation();
  return (
    <View style={styles.flagged}>
      <Glyph paths={GLYPH.flag} ink={tokens.colorBrokenText} side={14} />
      <Text size={14} weight="bold" style={styles.broken}>
        {t('station.flagged', { count: n })}
      </Text>
    </View>
  );
}

/** Ready or Preparing; each says its name and whether it is chosen. */
export function Segments({
  item,
  id,
  preparing,
  side,
  onReady,
  onPreparing,
}: {
  item: string;
  id: string;
  preparing: boolean;
  side: number;
  onReady: () => void;
  onPreparing: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.track}>
      {(['ready', 'preparing'] as const).map((w) => {
        const on = (w === 'preparing') === preparing;
        const word = t(`service.item.${w}`);
        return (
          <Pressable
            key={w}
            onPress={w === 'ready' ? onReady : onPreparing}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${item}, ${word}`}
            style={[styles.seg, { minHeight: side }, on && styles.segOn]}
            testID={`station.${w}.${id}`}
          >
            <Text
              size={16}
              weight={on ? 'bold' : 'semibold'}
              style={on ? styles.ink : styles.secondary}
            >
              {word}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export type Eta = (typeof READY_IN_MINUTES)[number] | null;

export const ETAS: readonly Eta[] = [...READY_IN_MINUTES, null];

export function Times({
  item,
  id,
  chosen,
  side,
  onPick,
}: {
  item: string;
  id: string;
  /** Undefined while none is chosen yet; null is "no time" chosen. */
  chosen: Eta | undefined;
  side: number;
  onPick: (eta: Eta) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.times}>
      <Text size={15} weight="semibold">
        {t('station.readyInAbout')}
      </Text>
      <View style={styles.track}>
        {ETAS.map((eta) => {
          const on = chosen !== undefined && chosen === eta;
          const word = eta == null ? t('station.noTime') : t('station.minutes', { count: eta });
          return (
            <Pressable
              key={eta ?? 'none'}
              onPress={() => onPick(eta)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={
                eta == null
                  ? t('station.noTimeSaid', { item })
                  : t('station.minutesSaid', { item, count: eta })
              }
              style={[styles.seg, { minHeight: side }, on && styles.segOn]}
              testID={`station.eta.${id}.${eta ?? 'none'}`}
            >
              <Text
                size={15}
                weight={on ? 'bold' : 'semibold'}
                style={on ? styles.ink : styles.secondary}
              >
                {word}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export interface ListedStation {
  id: string;
  name: string;
  /** Who is on it, the reader marked as "you", or null with nobody on it. */
  people: string | null;
}

/** The event's kitchen stations in the walking order, each with who is on it; opening one changes no roster. */
export function StationList({
  current,
  stations,
  side,
  onPick,
  firstRef,
}: {
  current: string | null;
  stations: readonly ListedStation[];
  side: number;
  onPick: (id: string) => void;
  firstRef?: Ref<ViewInstance>;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.list}>
      {stations.map((st, index) => {
        const on = st.id === current;
        const line = st.people ?? t('station.nobodyOn', { station: st.name });
        return (
          <Pressable
            key={st.id}
            ref={index === 0 ? firstRef : undefined}
            onPress={() => onPick(st.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${st.name}, ${line}`}
            style={[styles.station, { minHeight: side + 20 }, on && styles.stationOn]}
            testID={`station.pick.${st.id}`}
          >
            <View style={styles.grow}>
              <Text size={19} weight="bold">
                {st.name}
              </Text>
              <Text size={15} style={st.people == null ? styles.secondary : styles.ink}>
                {line}
              </Text>
            </View>
            {on ? (
              <View style={styles.openNow}>
                <Glyph paths={GLYPH.check} ink={tokens.colorAccentText} side={16} circle />
                <Text size={14} weight="semibold" style={styles.accent}>
                  {t('station.openNow')}
                </Text>
              </View>
            ) : (
              <View style={styles.radio} />
            )}
          </Pressable>
        );
      })}
      <Text size={14} style={styles.secondary}>
        {t('station.changesNobody')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ink: { color: tokens.colorInk },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  broken: { color: tokens.colorBrokenText },
  grow: { flex: 1, minWidth: 0, gap: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    minHeight: 28,
    paddingLeft: 8,
    paddingRight: 11,
    borderRadius: tokens.radiusPill,
    borderWidth: 1,
  },
  chipBig: { minHeight: 34, paddingLeft: 10, paddingRight: 14 },
  dashed: { borderStyle: 'dashed' },
  flags: {
    gap: 2,
    padding: tokens.spaceMd,
    borderRadius: tokens.radiusRow,
    backgroundColor: tokens.colorBrokenTint,
    borderWidth: 1,
    borderColor: tokens.colorBroken,
  },
  flagWords: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceXs },
  flagged: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: tokens.radiusPill,
    borderWidth: 1,
    borderColor: tokens.colorBroken,
    backgroundColor: tokens.colorBrokenTint,
  },
  track: {
    flexDirection: 'row',
    padding: 3,
    gap: 2,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorNeutralFill,
  },
  seg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXs,
    borderRadius: tokens.radiusPill,
  },
  segOn: {
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
  },
  times: { gap: tokens.spaceXs },
  list: { gap: tokens.spaceSm },
  station: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.spaceLg,
    paddingVertical: tokens.spaceMd,
    borderRadius: tokens.radiusRow,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  stationOn: {
    borderWidth: 2,
    borderColor: tokens.colorAccent,
    backgroundColor: tokens.colorAccentTint,
  },
  quiet: { alignItems: 'center', justifyContent: 'center' },
  quietInk: { color: tokens.colorAccentText },
  openNow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: tokens.colorFieldBorder,
  },
});
