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
import { tokens } from '../../theme/tokens.ts';
import { useOrgOpener } from '../OrgSwitcher.tsx';
import { openerLabel } from '../OrgSwitcherModel.ts';
import { SearchGlass } from '../SearchGlass.tsx';
import { atAccessibilitySizes, wordsIn } from '../../layout/textSize.ts';
import { FitWords } from './FitWords.tsx';
import { useSizeSwitcher } from './TodaySizeSwitcher.tsx';
import {
  PILL_NAME,
  PILL_WAITING,
  PILL_WAITING_LINE,
  piecesOfLine,
  pillNameRoom,
  pillTileAlone,
  pillWaitingRoom,
  waitingFirstLine,
} from './todaySizeRules.ts';

/** sc-92247: the phone cover's top row, the pill's name and invitation line each whole at the stand-in size, then Search and the bell. */
export function PillRow({ scale, cap, waiting }: { scale: number; cap: number; waiting: number }) {
  const [row, setRow] = useState(0);

  return (
    <View
      style={styles.row}
      onLayout={(event: LayoutChangeEvent) => setRow(event.nativeEvent.layout.width)}
    >
      <Pill
        scale={scale}
        cap={cap}
        waiting={waiting}
        room={pillNameRoom(row)}
        waitingRoom={pillWaitingRoom(row)}
        standIn
      />
      <View style={styles.grow} />
      <View style={styles.ends}>
        <SearchGlass />
        <BellButton />
      </View>
    </View>
  );
}

/** The pill: its name and invitation line each whole in `room` and `waitingRoom`, or its tile where its widest word at its default size is wider than `room`, or where `tile` says so. */
export function Pill({
  scale,
  cap,
  waiting,
  room,
  waitingRoom,
  tile = false,
  lines,
  standIn = false,
}: {
  scale: number;
  cap: number;
  waiting: number;
  room: number;
  waitingRoom: number;
  tile?: boolean;
  /** Main's line limit for the name below AX1 beside the tabs (`nameLines`). */
  lines?: number | undefined;
  /** On the phone from AX1, one tap opens the switcher drawn at the size chosen (sc-92465). */
  standIn?: boolean;
}) {
  const { t } = useTranslation();
  const ref = useRef<ViewInstance>(null);
  const org = useOrgOpener(ref);
  const line = waiting > 0 ? t('invitations.count', { count: waiting }) : null;
  const pieces = useMemo(() => piecesOfLine(org.name), [org.name]);
  const [widths, setWidths] = useState<Readonly<Record<string, number>>>({});
  const known = pieces.every((piece) => widths[piece] != null);
  const widest = known ? Math.max(...pieces.map((piece) => widths[piece] ?? 0)) : null;
  const lineWords = useMemo(() => (line == null ? [] : wordsIn([line])), [line]);
  const [lineWidths, setLineWidths] = useState<Readonly<Record<string, number>>>({});
  const lineWidest = lineWords.every((word) => lineWidths[word] != null)
    ? Math.max(0, ...lineWords.map((word) => lineWidths[word] ?? 0))
    : null;
  const [nameAt, setNameAt] = useState<number | null>(null);
  const [waitingAt, setWaitingAt] = useState<number | null>(null);
  const alone = tile || pillTileAlone(scale, widest, room, lineWidest);
  const ours = standIn && atAccessibilitySizes(scale);
  const switcher = useSizeSwitcher(ref, scale, ours);
  const onPress = ours ? switcher.show : org.onPress;
  const expanded = ours ? switcher.open : org.expanded;
  const shared = {
    ref,
    onPress,
    accessibilityRole: 'button',
    accessibilityLabel: openerLabel({ id: org.id, name: org.name, role: 'Owner' }, waiting),
    accessibilityState: { expanded },
    ...quietTap(onPress, expanded),
    hitSlop: tokens.spaceXxs,
    testID: 'demo.todaySize.pill',
  } as const;
  const measure = (
    <>
      <MeasuredWords
        words={pieces}
        size={PILL_NAME}
        weight="semibold"
        allowFontScaling={false}
        onWidth={(piece, width) =>
          setWidths((now) => (now[piece] === width ? now : { ...now, [piece]: width }))
        }
      />
      <MeasuredWords
        words={lineWords}
        size={PILL_WAITING}
        weight="semibold"
        allowFontScaling={false}
        onWidth={(word, width) =>
          setLineWidths((now) => (now[word] === width ? now : { ...now, [word]: width }))
        }
      />
    </>
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
        {switcher.drawn}
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
              lines={lines}
              style={styles.white}
              onDrawn={setNameAt}
              testID="demo.todaySize.pillName"
            />
            {line != null && (
              <View style={styles.waitingLine}>
                <View
                  style={[
                    styles.ringLine,
                    waitingAt != null && { height: waitingFirstLine(waitingAt) },
                  ]}
                >
                  <View style={styles.ring} />
                </View>
                <View style={styles.grow}>
                  <FitWords
                    text={line}
                    size={PILL_WAITING}
                    scale={scale}
                    cap={Math.min(cap, nameAt ?? Infinity)}
                    room={waitingRoom}
                    weight="semibold"
                    line={PILL_WAITING_LINE}
                    style={styles.white}
                    onDrawn={setWaitingAt}
                    testID="demo.todaySize.pillWaiting"
                  />
                </View>
              </View>
            )}
          </View>
          <Glyph name="updown" size={14} ink={tokens.colorInkOnDark} />
        </Glass>
      </Pressable>
      {switcher.drawn}
    </View>
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
  waitingLine: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceXs },
  ringLine: { justifyContent: 'center' },
  ring: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 2,
    borderColor: tokens.colorInkOnDark,
  },
  white: { color: tokens.colorInkOnDark },
});
