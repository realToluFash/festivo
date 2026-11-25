import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
  type ViewInstance,
} from 'react-native';

import { Bell } from '../../components/BellButton.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { OrgMark } from '../../components/OrgMark.tsx';
import { OPENER, quietTap } from '../../components/OrgPill.tsx';
import type { Tell } from '../../components/TodayParts.tsx';
import { MeasuredWords } from '../../components/Title.tsx';
import { atAccessibilitySizes } from '../../layout/textSize.ts';
import { tokens } from '../../theme/tokens.ts';
import { useOrgOpener } from '../OrgSwitcher.tsx';
import { openerLabel } from '../OrgSwitcherModel.ts';
import { SearchButton } from '../search/SearchHeader.tsx';
import { FitWords } from '../todaySize/FitWords.tsx';
import { piecesOfLine, pillTileAlone } from '../todaySize/todaySizeRules.ts';
import {
  TOP_PILL_NAME,
  TOP_PILL_WAITING,
  topPillNameRoom,
  topPillWaitingRoom,
} from './topSizeRules.ts';

/** sc-92464: the phone's row above Settings', Events' and the Calendar's titles, the white pill's name and invitation line each whole at the stand-in size, then Search and the bell. */
export function TopPillRow({
  scale,
  waiting,
  tell,
}: {
  scale: number;
  waiting: number;
  tell: Tell;
}) {
  const [row, setRow] = useState(0);

  return (
    <View
      style={styles.row}
      onLayout={(event: LayoutChangeEvent) => setRow(event.nativeEvent.layout.width)}
    >
      <TopPill scale={scale} waiting={waiting} row={row} />
      <View style={styles.grow} />
      <View style={styles.ends}>
        <SearchButton />
        <Bell unread={3} onPress={() => tell('Notifications have their own design.')} />
      </View>
    </View>
  );
}

function TopPill({ scale, waiting, row }: { scale: number; waiting: number; row: number }) {
  const { t } = useTranslation();
  const ref = useRef<ViewInstance>(null);
  const org = useOrgOpener(ref);
  const large = atAccessibilitySizes(scale);
  const line = waiting > 0 ? t('invitations.count', { count: waiting }) : null;
  const room = topPillNameRoom(row, scale);
  const pieces = useMemo(() => piecesOfLine(org.name), [org.name]);
  const [widths, setWidths] = useState<Readonly<Record<string, number>>>({});
  const widest = pieces.every((piece) => widths[piece] != null)
    ? Math.max(...pieces.map((piece) => widths[piece] ?? 0))
    : null;
  const [nameAt, setNameAt] = useState<number | null>(null);
  const alone = pillTileAlone(scale, widest, room);
  const shared = {
    ref,
    onPress: org.onPress,
    accessibilityRole: 'button',
    accessibilityLabel: openerLabel({ id: org.id, name: org.name, role: 'Owner' }, waiting),
    accessibilityState: { expanded: org.expanded },
    ...quietTap(org.onPress, org.expanded),
    testID: 'demo.topSize.pill',
  } as const;
  const measure = (
    <MeasuredWords
      words={pieces}
      size={TOP_PILL_NAME}
      weight="semibold"
      allowFontScaling={false}
      onWidth={(piece, width) =>
        setWidths((now) => (now[piece] === width ? now : { ...now, [piece]: width }))
      }
    />
  );

  if (alone)
    return (
      <View style={styles.fit}>
        {measure}
        <Pressable
          {...shared}
          style={({ pressed }) => [styles.pill, styles.tile, pressed && styles.pressed]}
        >
          <View>
            <OrgMark id={org.id} name={org.name} side={28} />
            {line != null && (
              <View style={styles.tileRingHalo}>
                <View style={styles.ring} />
              </View>
            )}
          </View>
        </Pressable>
      </View>
    );

  return (
    <View style={styles.fit}>
      {measure}
      <Pressable
        {...shared}
        style={({ pressed }) => [
          styles.pill,
          line != null && styles.waiting,
          pressed && styles.pressed,
        ]}
      >
        {!large && <OrgMark id={org.id} name={org.name} side={28} />}
        <View style={styles.words}>
          <FitWords
            text={org.name}
            size={TOP_PILL_NAME}
            scale={scale}
            cap={Infinity}
            room={room}
            weight="semibold"
            line={1.25}
            lines={large ? undefined : 1}
            style={styles.ink}
            onDrawn={setNameAt}
            testID="demo.topSize.pillName"
          />
          {line != null && (
            <View style={styles.waitingLine}>
              <View style={styles.ring} />
              <View style={styles.grow}>
                <FitWords
                  text={line}
                  size={TOP_PILL_WAITING}
                  scale={scale}
                  cap={nameAt ?? Infinity}
                  room={topPillWaitingRoom(row, scale)}
                  weight="semibold"
                  line={1.3}
                  lines={large ? undefined : 1}
                  style={styles.ink}
                  testID="demo.topSize.pillWaiting"
                />
              </View>
            </View>
          )}
        </View>
        <Glyph name="updown" size={14} ink={tokens.colorInkSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    marginBottom: tokens.spaceSm,
  },
  grow: { flex: 1, minWidth: 0 },
  ends: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  fit: { flexDirection: 'row', flexShrink: 1, minWidth: 0 },
  pill: {
    minHeight: OPENER.rest,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingVertical: tokens.spaceXs,
    paddingLeft: tokens.spaceSm,
    paddingRight: tokens.spacePillEnd,
    borderRadius: OPENER.rest / 2,
    backgroundColor: tokens.colorInset,
  },
  waiting: { minHeight: OPENER.waiting, borderRadius: OPENER.waiting / 2 },
  tile: { paddingRight: tokens.spaceSm },
  pressed: { backgroundColor: tokens.colorNeutralFill },
  words: { flexShrink: 1, minWidth: 0, gap: tokens.spaceHair },
  waitingLine: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  ring: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 2,
    borderColor: tokens.colorInk,
  },
  tileRingHalo: {
    position: 'absolute',
    top: -10,
    end: -10,
    padding: 2,
    borderRadius: 7.5,
    backgroundColor: tokens.colorInset,
  },
  ink: { color: tokens.colorInk },
});
