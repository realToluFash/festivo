import { type ReactNode, type Ref, useState } from 'react';
import {
  Platform,
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
  type ViewInstance,
  type ViewStyle,
  useWindowDimensions,
} from 'react-native';

import { waitingRoomUnder, wholeTileAlone } from '../layout/pillFit.ts';
import { ROOMS, rowPad } from '../layout/sidebarSize.ts';
import { piecesIn, wholeLineHeight, wordsIn } from '../layout/textSize.ts';
import { tokens } from '../theme/tokens.ts';
import { Glyph } from './Glyph.tsx';
import { OrgMark } from './OrgMark.tsx';
import { Text } from './Text.tsx';
import { pressOnDoubleTap } from './screenReaderFocus.ts';
import { useSideFit } from './sideFit.tsx';
import { titleWithInkRoom } from './titleWidth.ts';
import { CappedWholeWords, useMeasuredAt } from './Title.tsx';

const NAME = 15;
const WAITING = 12.5;
const NAME_LINE = 1.25;
const WAITING_LINE = 1.3;

export const OPENER = { rest: tokens.sizeHit, waiting: 56 } as const;

/** The opener's words: the name, and under it a ring and how many invitations wait. */
export function OpenerWords({
  name,
  waiting,
  onDark = false,
  grow = false,
  wrap = false,
  lines,
  size,
  waitingSize,
}: {
  name: string;
  /** How many invitations wait, in words, or null when none do. */
  waiting: string | null;
  onDark?: boolean;
  grow?: boolean;
  wrap?: boolean;
  /** The most lines the name takes before its ellipsis; without it, one line, or no limit when it wraps. */
  lines?: number | undefined;
  /** The name's size as iPad landscape's sidebar fits it, which the text size no longer grows (sc-68441). */
  size?: number | undefined;
  /** The invitation line's size as the sidebar fits it on its own, apart from the name's (sc-79559). */
  waitingSize?: number | undefined;
}) {
  const ink = { color: onDark ? tokens.colorInkOnDark : tokens.colorInk };

  return (
    <OpenerColumn
      onDark={onDark}
      style={grow && styles.grow}
      name={
        <Text
          size={size ?? NAME}
          weight="semibold"
          numberOfLines={lines ?? (wrap ? undefined : 1)}
          allowFontScaling={size == null}
          accessible={false}
          style={[styles.name, size != null && { lineHeight: size * NAME_LINE }, ink]}
        >
          {titleWithInkRoom(name, Platform.OS)}
        </Text>
      }
      waiting={
        waiting == null ? null : (
          <Text
            size={waitingSize ?? WAITING}
            weight="semibold"
            numberOfLines={wrap ? undefined : 1}
            allowFontScaling={waitingSize == null}
            accessible={false}
            style={[
              styles.waitingWords,
              waitingSize != null && { lineHeight: waitingSize * WAITING_LINE },
              ink,
            ]}
          >
            {waiting}
          </Text>
        )
      }
    />
  );
}

/** The opener's column, whatever draws its words: the name, and under it the ring before the invitation line. */
export function OpenerColumn({
  name,
  waiting,
  onDark,
  ringLine,
  style,
}: {
  name: ReactNode;
  /** The invitation line, or null when no invitation waits. */
  waiting: ReactNode | null;
  onDark: boolean;
  /** The invitation line's own line height once drawn: the ring is centred on the first line, beside its first word, where the line wraps (sc-92912). */
  ringLine?: number | undefined;
  style?: StyleProp<ViewStyle>;
}) {
  const ring = (
    <View
      style={[
        styles.waitingRing,
        { borderColor: onDark ? tokens.colorInkOnDark : tokens.colorInk },
      ]}
    />
  );

  return (
    <View style={[styles.words, style]}>
      {name}
      {waiting != null && (
        <View style={[styles.waitingLine, ringLine != null && styles.waitingLineTop]}>
          {ringLine == null ? (
            ring
          ) : (
            <View style={[styles.ringBox, { height: ringLine }]}>{ring}</View>
          )}
          {waiting}
        </View>
      )}
    </View>
  );
}

/** From AX1, where the pill is given its name's line: the name and the invitation line each step down alone rather than break a word, never under their default sizes, the invitation line never larger than the name; hidden until measured (sc-92247, sc-92464). */
export function WholeOpenerWords({
  name,
  waiting,
  room,
  hidden,
  onDark = false,
}: {
  name: string;
  waiting: string | null;
  room: number;
  hidden: boolean;
  onDark?: boolean;
}) {
  const [named, setNamed] = useState<number>();
  const [line, setLine] = useState<number>();
  const given = room > 0 ? room : undefined;
  const ink = { color: onDark ? tokens.colorInkOnDark : tokens.colorInk };

  return (
    <OpenerColumn
      onDark={onDark}
      ringLine={line == null ? undefined : Math.ceil(line * WAITING_LINE)}
      style={hidden && styles.hidden}
      name={
        <CappedWholeWords
          size={NAME}
          weight="semibold"
          accessible={false}
          room={given}
          breakAfterHyphens
          onDrawn={setNamed}
          style={[ink, named != null && { lineHeight: wholeLineHeight(NAME, named, NAME_LINE) }]}
        >
          {titleWithInkRoom(name, Platform.OS)}
        </CappedWholeWords>
      }
      waiting={
        waiting == null ? null : (
          <View style={styles.grow}>
            <CappedWholeWords
              size={WAITING}
              weight="semibold"
              accessible={false}
              under={named}
              room={given == null ? undefined : waitingRoomUnder(given)}
              onDrawn={setLine}
              style={[
                ink,
                line != null && { lineHeight: wholeLineHeight(WAITING, line, WAITING_LINE) },
              ]}
            >
              {waiting}
            </CappedWholeWords>
          </View>
        )
      }
    />
  );
}

/** Whether the whole-words pill is its tile alone, its name's widest word at the default size wider than its line, or the invitation line's at its own wider than the room under the name, and whether that is known yet; `room` undefined where the pill is not given its name's line (sc-38149, sc-92247, sc-92464, sc-92314). */
export function useWholeTile(name: string, waiting: string | null, room: number | undefined) {
  const whole = room != null;
  const named = useMeasuredAt(NAME, whole ? piecesIn([name]) : []);
  const line = useMeasuredAt(WAITING, whole && waiting != null ? wordsIn([waiting]) : []);
  const widths = [...named.widths, ...line.widths];
  const known = named.widths.length > 0 && widths.every((width) => width != null);
  const tileAlone =
    whole &&
    known &&
    wholeTileAlone(
      Math.max(...named.widths.map(Number)),
      room,
      Math.max(0, ...line.widths.map(Number)),
    );

  return {
    whole,
    known,
    tileAlone,
    measure: whole && (
      <>
        {named.measure}
        {line.measure}
      </>
    ),
  };
}

/** The opener's words at the head of iPad landscape's sidebar: the name and the invitation line each on one line, each stepped down alone until it fits whole there (sc-68441, sc-79559). */
function SidebarOpenerWords({
  name,
  waiting,
  wrap,
  lines,
}: {
  name: string;
  waiting: string | null;
  wrap: boolean;
  lines?: number | undefined;
}) {
  const { fontScale } = useWindowDimensions();
  const { size, measure } = useSideFit(name, ROOMS.org, fontScale, 'semibold', 'line');
  const line = useSideFit(waiting ?? '', ROOMS.waiting, fontScale, 'semibold', 'line');

  return (
    <>
      {measure}
      {waiting != null && line.measure}
      <OpenerWords
        name={name}
        waiting={waiting}
        wrap={wrap}
        lines={lines}
        size={size}
        waitingSize={waiting == null ? undefined : line.size}
        grow
      />
    </>
  );
}

/** The organisation switcher on white, at the top of every top-level page, or at the head of iPad landscape's sidebar; without `onPress` it only names the organisation. */
export function OrgPill({
  id,
  name,
  waiting,
  label,
  expanded,
  onPress,
  bare = false,
  wrap = false,
  sidebar = false,
  tileAlone = false,
  nameRoom,
  lines,
  testID,
  ref,
}: {
  id: string;
  name: string;
  waiting: string | null;
  label: string;
  expanded?: boolean;
  onPress?: (() => void) | undefined;
  /** At the largest text sizes the tile gives its room to the name. */
  bare?: boolean;
  wrap?: boolean;
  sidebar?: boolean;
  /** Where the room runs out the pill is its tile, its name kept for the screen reader and the switcher. */
  tileAlone?: boolean;
  /** On a phone from AX1, the name's line, 0 until the row is measured: the words stay whole and the pill is its tile only where a word cannot fit at its default size (sc-92464). */
  nameRoom?: number | undefined;
  lines?: number | undefined;
  testID?: string;
  ref?: Ref<ViewInstance> | undefined;
}) {
  const { fontScale } = useWindowDimensions();
  const whole = useWholeTile(name, waiting, sidebar ? undefined : nameRoom);
  const tile = tileAlone || whole.tileAlone;

  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      disabled={onPress == null}
      style={({ pressed }) =>
        sidebar
          ? [
              styles.side,
              { paddingVertical: rowPad(fontScale) },
              (waiting != null || wrap) && styles.sideWaiting,
              (expanded === true || pressed) && styles.sideOpen,
            ]
          : [
              styles.org,
              (waiting != null || wrap) && styles.orgWaiting,
              tile && styles.orgTile,
              pressed && styles.orgPressed,
            ]
      }
      accessibilityRole={onPress == null ? 'text' : 'button'}
      accessibilityLabel={label}
      accessibilityState={onPress == null || expanded == null ? undefined : { expanded }}
      {...quietTap(onPress, expanded)}
      testID={testID}
    >
      {whole.measure}
      {tile ? (
        <View>
          <OrgMark id={id} name={name} side={28} />
          {waiting != null && (
            <View style={styles.tileRingHalo}>
              <View style={[styles.waitingRing, { borderColor: tokens.colorInk }]} />
            </View>
          )}
        </View>
      ) : (
        !bare && <OrgMark id={id} name={name} side={28} />
      )}
      {!tile &&
        (sidebar ? (
          <SidebarOpenerWords name={name} waiting={waiting} wrap={wrap} lines={lines} />
        ) : whole.whole ? (
          <WholeOpenerWords
            name={name}
            waiting={waiting}
            room={nameRoom ?? 0}
            hidden={!whole.known || !nameRoom}
          />
        ) : (
          <OpenerWords name={name} waiting={waiting} wrap={wrap} lines={lines} />
        ))}
      {onPress != null && !tile && <Glyph name="updown" size={14} ink={tokens.colorInkSecondary} />}
    </Pressable>
  );
}

/** On Android, TalkBack's double tap opens the switcher without the click that had TalkBack say the opener's state, "collapsed", before the switcher's title (sc-42690). Every switcher opener takes it. */
export function quietTap(onPress: (() => void) | undefined, expanded: boolean | undefined) {
  if (Platform.OS !== 'android' || expanded == null) return {};

  return pressOnDoubleTap(onPress);
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  hidden: { opacity: 0 },
  words: { flexShrink: 1, minWidth: 0, gap: tokens.spaceHair },
  name: { lineHeight: 15 * NAME_LINE },
  waitingLine: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  waitingLineTop: { alignItems: 'flex-start' },
  ringBox: { justifyContent: 'center' },
  waitingRing: { width: 11, height: 11, borderRadius: 5.5, borderWidth: 2 },
  tileRingHalo: {
    position: 'absolute',
    top: -10,
    end: -10,
    padding: 2,
    borderRadius: 7.5,
    backgroundColor: tokens.colorInset,
  },
  waitingWords: { lineHeight: 12.5 * WAITING_LINE },
  org: {
    minHeight: OPENER.rest,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingLeft: tokens.spaceSm,
    paddingRight: tokens.spacePillEnd,
    borderRadius: OPENER.rest / 2,
    backgroundColor: tokens.colorInset,
  },
  orgWaiting: { minHeight: OPENER.waiting, borderRadius: OPENER.waiting / 2 },
  orgTile: { minHeight: OPENER.rest, paddingRight: tokens.spaceSm, borderRadius: OPENER.rest / 2 },
  orgPressed: { backgroundColor: tokens.colorNeutralFill },
  side: {
    minHeight: OPENER.rest,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingLeft: tokens.spaceSm,
    paddingRight: tokens.spaceMd,
    borderRadius: tokens.radiusRow,
  },
  sideWaiting: { minHeight: OPENER.waiting },
  sideOpen: {
    backgroundColor: tokens.colorCard,
    ...tokens.elevationNative.card.ios,
    elevation: tokens.elevationNative.card.android.elevation,
  },
});
