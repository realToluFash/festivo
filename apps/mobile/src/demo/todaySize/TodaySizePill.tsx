import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
  type ViewInstance,
} from 'react-native';

import { Glass } from '../../components/Glass.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { OrgMark } from '../../components/OrgMark.tsx';
import { MeasuredWords } from '../../components/Title.tsx';
import { OPENER, quietTap } from '../../components/OrgPill.tsx';
import { BellButton } from '../../components/TodayCover.tsx';
import { useTodayShell } from '../../components/todayShell.ts';
import { tokens } from '../../theme/tokens.ts';
import { useOrgOpener } from '../OrgSwitcher.tsx';
import { openerLabel } from '../OrgSwitcherModel.ts';
import { FitWords } from './FitWords.tsx';
import {
  PILL_NAME,
  PILL_WAITING,
  piecesOfLine,
  pillNameRoom,
  pillTileAlone,
  pillWaitingRoom,
} from './todaySizeRules.ts';

/** sc-92247: the phone cover's top row, the pill's name and invitation line each whole at the stand-in size, then Search and the bell. */
export function PillRow({ scale, cap, waiting }: { scale: number; cap: number; waiting: number }) {
  const [row, setRow] = useState(0);

  return (
    <View
      style={styles.row}
      onLayout={(event: LayoutChangeEvent) => setRow(event.nativeEvent.layout.width)}
    >
      <Pill scale={scale} cap={cap} waiting={waiting} row={row} />
      <View style={styles.grow} />
      <View style={styles.ends}>
        <SearchGlass />
        <BellButton />
      </View>
    </View>
  );
}

function Pill({
  scale,
  cap,
  waiting,
  row,
}: {
  scale: number;
  cap: number;
  waiting: number;
  row: number;
}) {
  const { t } = useTranslation();
  const ref = useRef<ViewInstance>(null);
  const org = useOrgOpener(ref);
  const line = waiting > 0 ? t('invitations.count', { count: waiting }) : null;
  const room = pillNameRoom(row);
  const pieces = useMemo(() => piecesOfLine(org.name), [org.name]);
  const [widths, setWidths] = useState<Readonly<Record<string, number>>>({});
  const known = pieces.every((piece) => widths[piece] != null);
  const widest = known ? Math.max(...pieces.map((piece) => widths[piece] ?? 0)) : null;
  const [nameAt, setNameAt] = useState<number | null>(null);
  const alone = pillTileAlone(scale, widest, room);
  const shared = {
    ref,
    onPress: org.onPress,
    accessibilityRole: 'button',
    accessibilityLabel: openerLabel({ id: org.id, name: org.name, role: 'Owner' }, waiting),
    accessibilityState: { expanded: org.expanded },
    ...quietTap(org.onPress, org.expanded),
    hitSlop: tokens.spaceXxs,
    testID: 'demo.todaySize.pill',
  } as const;
  const measure = (
    <MeasuredWords
      words={pieces}
      size={PILL_NAME}
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
        <Pressable {...shared}>
          <Glass style={styles.compact}>
            <OrgMark id={org.id} name={org.name} side={30} glass />
          </Glass>
          {line != null && <View style={styles.tileRing} />}
        </Pressable>
      </View>
    );

  const tall = line != null ? OPENER.waiting : 40;

  return (
    <View style={styles.fit}>
      {measure}
      <Pressable {...shared} style={styles.wide}>
        <Glass height={tall} style={[styles.glass, { height: undefined, minHeight: tall }]}>
          <OrgMark id={org.id} name={org.name} side={28} glass />
          <View style={styles.words}>
            <FitWords
              text={org.name}
              size={PILL_NAME}
              scale={scale}
              cap={cap}
              room={room}
              weight="semibold"
              line={1.25}
              style={styles.white}
              onDrawn={setNameAt}
              testID="demo.todaySize.pillName"
            />
            {line != null && (
              <View style={styles.waitingLine}>
                <View style={styles.ring} />
                <View style={styles.grow}>
                  <FitWords
                    text={line}
                    size={PILL_WAITING}
                    scale={scale}
                    cap={Math.min(cap, nameAt ?? Infinity)}
                    room={pillWaitingRoom(row)}
                    weight="semibold"
                    line={1.3}
                    style={styles.white}
                    testID="demo.todaySize.pillWaiting"
                  />
                </View>
              </View>
            )}
          </View>
          <Glyph name="updown" size={14} ink={tokens.colorInkOnDark} />
        </Glass>
      </Pressable>
    </View>
  );
}

function SearchGlass() {
  const { t } = useTranslation();
  const { open } = useTodayShell();

  return (
    <Pressable
      onPress={() => open({ to: 'search' })}
      accessibilityRole="button"
      accessibilityLabel={t('search.row')}
      hitSlop={tokens.spaceXxs}
    >
      <Glass style={styles.round}>
        <Glyph name="search" size={19} ink={tokens.colorInkOnDark} />
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    marginHorizontal: tokens.spaceXl - tokens.spaceXxl,
  },
  grow: { flex: 1, minWidth: 0 },
  ends: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  fit: { flexDirection: 'row', flexShrink: 1, minWidth: 0 },
  wide: { flexShrink: 1 },
  glass: {
    flexShrink: 1,
    gap: tokens.spaceSm,
    paddingVertical: tokens.spaceXs,
    paddingLeft: tokens.spaceSm,
    paddingRight: tokens.spacePillEnd,
  },
  compact: { paddingHorizontal: 5 },
  tileRing: {
    position: 'absolute',
    top: -4,
    end: -4,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 2,
    borderColor: tokens.colorInkOnDark,
  },
  words: { flexShrink: 1, minWidth: 0, gap: tokens.spaceHair },
  waitingLine: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  ring: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 2,
    borderColor: tokens.colorInkOnDark,
  },
  white: { color: tokens.colorInkOnDark },
  round: { width: 40, justifyContent: 'center' },
});
