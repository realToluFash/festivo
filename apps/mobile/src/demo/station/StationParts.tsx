import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Glyph } from '../queue/QueueParts.tsx';
import { type Eta, ETAS, type StationId, STATIONS, ROSTER, whoLine } from './stationModel.ts';

export const GLYPH = {
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  slash: ['M7 17L17 7'],
  pause: ['M9 6v12', 'M15 6v12'],
  flag: ['M5 21V4', 'M5 4h12l-2.5 4.5L17 13H5'],
  clock: ['M12 7v5l3 2'],
  chevron: ['m6 9 6 6 6-6'],
  send: ['M12 19V5', 'm6 11 6-6 6 6'],
  info: ['M12 11v6', 'M12 7.5h.01'],
} as const;

export type Status = 'on' | 'off' | 'ready' | 'preparing' | 'heldUp' | 'paused' | 'kept';

const STATUS: Record<Status, { word: string; ink: string; fill: string; edge: string }> = {
  on: {
    word: 'On',
    ink: tokens.colorAccentText,
    fill: tokens.colorAccentTint,
    edge: tokens.colorAccentTintBorder,
  },
  off: {
    word: 'Not on',
    ink: tokens.colorInk,
    fill: tokens.colorCard,
    edge: tokens.colorControlBorder,
  },
  ready: {
    word: 'Ready',
    ink: tokens.colorAccentText,
    fill: tokens.colorAccentTint,
    edge: tokens.colorAccentTintBorder,
  },
  preparing: {
    word: 'Preparing',
    ink: tokens.colorAttentionText,
    fill: tokens.colorAttentionTint,
    edge: tokens.colorAttentionBorder,
  },
  heldUp: {
    word: 'Held up',
    ink: tokens.colorBrokenText,
    fill: tokens.colorBrokenTint,
    edge: tokens.colorBroken,
  },
  paused: {
    word: 'Paused',
    ink: tokens.colorPausedText,
    fill: tokens.colorPausedTint,
    edge: tokens.colorPausedTint,
  },
  kept: {
    word: 'Waiting to send',
    ink: tokens.colorInkSecondary,
    fill: tokens.colorCard,
    edge: tokens.colorFieldBorder,
  },
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
    case 'paused':
      return <Glyph paths={GLYPH.pause} ink={ink} side={side} />;
    case 'kept':
      return <Glyph paths={GLYPH.send} ink={ink} side={side} />;
  }
}

/** Every status is a shape with its word, never colour alone (a kitchen prints in black and white). */
export function Chip({ status, big = false }: { status: Status; big?: boolean }) {
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
        {st.word}
      </Text>
    </View>
  );
}

export function FlagLine({ flags, size }: { flags: readonly string[]; size: number }) {
  return (
    <View style={styles.flags}>
      <View style={styles.flagWords}>
        <Glyph paths={GLYPH.flag} ink={tokens.colorBrokenText} side={size} />
        <Text size={size} weight="bold" style={styles.broken}>
          {flags.join(' · ')}
        </Text>
      </View>
      <Text size={size - 2 < 15 ? 15 : size - 2} weight="semibold" style={styles.broken}>
        Dish first · clean tools
      </Text>
    </View>
  );
}

export function FlaggedCount({ n }: { n: number }) {
  return (
    <View style={styles.flagged}>
      <Glyph paths={GLYPH.flag} ink={tokens.colorBrokenText} side={14} />
      <Text size={14} weight="bold" style={styles.broken}>
        {n} flagged
      </Text>
    </View>
  );
}

/** Ready or Preparing, then the times; each says its name and whether it is chosen. */
export function Segments({
  item,
  preparing,
  side,
  onReady,
  onPreparing,
}: {
  item: string;
  preparing: boolean;
  side: number;
  onReady: () => void;
  onPreparing: () => void;
}) {
  return (
    <View style={styles.track}>
      {(['Ready', 'Preparing'] as const).map((w) => {
        const on = (w === 'Preparing') === preparing;
        return (
          <Pressable
            key={w}
            onPress={w === 'Ready' ? onReady : onPreparing}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${item}, ${w}`}
            style={[styles.seg, { minHeight: side }, on && styles.segOn]}
            testID={`station.${w === 'Ready' ? 'ready' : 'preparing'}.${item}`}
          >
            <Text
              size={16}
              weight={on ? 'bold' : 'semibold'}
              style={on ? styles.ink : styles.secondary}
            >
              {w}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Times({
  item,
  chosen,
  side,
  onPick,
}: {
  item: string;
  chosen: Eta | undefined;
  side: number;
  onPick: (eta: Eta) => void;
}) {
  return (
    <View style={styles.times}>
      <Text size={15} weight="semibold">
        Ready in about
      </Text>
      <View style={styles.track}>
        {ETAS.map((eta) => {
          const on = chosen !== undefined && chosen === eta;
          const word = eta == null ? 'No time' : `${eta} min`;
          return (
            <Pressable
              key={word}
              onPress={() => onPick(eta)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${item}, ready in about ${eta == null ? 'no time' : `${eta} minutes`}`}
              style={[styles.seg, { minHeight: side }, on && styles.segOn]}
              testID={`station.eta.${item}.${eta ?? 'none'}`}
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

/** PickStation: the event's kitchen stations in the walking order, each with who is on it; opening one changes no roster. */
export function StationList({
  current,
  you,
  side,
  onPick,
}: {
  current: StationId | null;
  you: string;
  side: number;
  onPick: (id: StationId) => void;
}) {
  return (
    <View style={styles.list}>
      {STATIONS.map((st) => {
        const on = st.id === current;
        const who = ROSTER[st.id].map((n) => (n === you ? `${n} · you` : n));
        const line = who.length === 0 ? whoLine(st.id) : who.join(', ');
        return (
          <Pressable
            key={st.id}
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
              <Text size={15} style={who.length === 0 ? styles.secondary : styles.ink}>
                {line}
              </Text>
            </View>
            {on ? (
              <View style={styles.openNow}>
                <Glyph paths={GLYPH.check} ink={tokens.colorAccentText} side={16} circle />
                <Text size={14} weight="semibold" style={styles.accent}>
                  Open now
                </Text>
              </View>
            ) : (
              <View style={styles.radio} />
            )}
          </Pressable>
        );
      })}
      <Text size={14} style={styles.secondary}>
        Opening a station changes nobody’s station. Team does that.
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
  openNow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: tokens.colorFieldBorder,
  },
});
