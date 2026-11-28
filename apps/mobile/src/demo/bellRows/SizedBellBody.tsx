import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type StyleProp, Pressable, StyleSheet, type TextStyle, View } from 'react-native';

import { BellMute } from '../../components/BellParts.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { markOf } from '../../components/notificationMarks.ts';
import { RowList, TextAction } from '../../components/SummaryRows.tsx';
import { Text } from '../../components/Text.tsx';
import { MeasuredWords } from '../../components/Title.tsx';
import { atAccessibilitySizes } from '../../layout/textSize.ts';
import { tokens } from '../../theme/tokens.ts';
import { SettingsLink } from '../bellSize/BellSamples.tsx';
import { piecesOfLine } from '../todaySize/todaySizeRules.ts';
import { ROW_SETS, type RowSample, rowWords } from './bellRowSamples.ts';
import {
  type BellRows,
  MUTED_BESIDE,
  ROW_LINE,
  ROW_LINE_LINE,
  ROW_MARK,
  ROW_MARK_LINE,
  ROW_TITLE,
  ROW_TITLE_LINE,
  rowTextSize,
  rowTextStart,
  UNREAD_BESIDE,
} from './bellRowsRules.ts';

const SHOW_MORE = 15;
const IGNORE = () => undefined;

/** sc-102956: the bell's list at the stand-in size, each row's texts whole: every text grows with the size and steps down only for its own widest word, never under its default size, and no text under a title draws larger than it. Show more and Notification settings follow it, nothing sent. */
export function SizedBellBody({
  rows,
  scale,
  language,
  unread,
  onPick,
  onShowMore,
  onSettings,
  onReport,
}: {
  rows: Exclude<BellRows, 'main'>;
  scale: number;
  language: string;
  unread: ReadonlySet<string>;
  onPick: (id: string, title: string) => void;
  onShowMore: () => void;
  onSettings: () => void;
  onReport: (drawn: string) => void;
}) {
  const { t } = useTranslation();
  const [menu, setMenu] = useState<string | null>(null);
  const [muted, setMuted] = useState<ReadonlySet<string>>(
    () => new Set(ROW_SETS[rows].filter((one) => one.muted).map((one) => one.id)),
  );
  const [drawn, setDrawn] = useState<Readonly<Record<string, string>>>({});
  const samples = ROW_SETS[rows];
  const report = samples.every((one) => drawn[one.id] != null)
    ? samples.map((one) => drawn[one.id]).join(' ')
    : null;

  useEffect(() => {
    if (report != null) onReport(report);
  }, [report, onReport]);

  return (
    <View testID="demo.bellSize.rows">
      <RowList
        items={samples.map((one) => ({
          key: one.id,
          inset: 52,
          row: (
            <SizedItem
              sample={one}
              scale={scale}
              language={language}
              unread={unread.has(one.id)}
              muted={muted.has(one.id)}
              menu={menu === one.id}
              onPress={() => onPick(one.id, rowWords(one.title, language))}
              onMenu={(shown) => setMenu(shown ? one.id : null)}
              onMute={(on) =>
                setMuted((now) => {
                  const next = new Set(now);

                  if (on) next.add(one.id);
                  else next.delete(one.id);

                  return next;
                })
              }
              onDrawn={(said) =>
                setDrawn((now) => (now[one.id] === said ? now : { ...now, [one.id]: said }))
              }
            />
          ),
        }))}
      />
      <View style={styles.more}>
        <TextAction
          label={t('notifications.showMore')}
          wraps
          drawnAt={SHOW_MORE * scale}
          onPress={onShowMore}
          testID="demo.bellSize.rows.showMore"
        />
      </View>
      <SettingsLink scale={scale} onDrawn={IGNORE} onPress={onSettings} />
    </View>
  );
}

/** One row as main's BellItem draws it, its texts at the stand-in size: the title first, then what sits under it, each no larger than the title. */
function SizedItem({
  sample,
  scale,
  language,
  unread,
  muted,
  menu,
  onPress,
  onMenu,
  onMute,
  onDrawn,
}: {
  sample: RowSample;
  scale: number;
  language: string;
  unread: boolean;
  muted: boolean;
  menu: boolean;
  onPress: () => void;
  onMenu: (open: boolean) => void;
  onMute: (on: boolean) => void;
  onDrawn: (said: string) => void;
}) {
  const { t } = useTranslation();
  const [room, setRoom] = useState(0);
  const [titleAt, setTitleAt] = useState<number | null>(null);
  const [underAt, setUnderAt] = useState<Readonly<Record<string, number>>>({});
  const title = rowWords(sample.title, language);
  const lines = sample.lines.map((line) => rowWords(line, language));
  const when = t('notifications.atTime', { time: sample.time });
  const where =
    sample.event == null
      ? when
      : t('notifications.whereWhen', { event: rowWords(sample.event, language), when });
  // Under a title not yet fitted, the texts wait at the accessibility sizes; below them they start under its grown size.
  const accessible = atAccessibilitySizes(scale);
  const cap = titleAt ?? ROW_TITLE * scale;
  const wait = accessible && titleAt == null;
  const under = (key: string) => (size: number) =>
    setUnderAt((now) => (now[key] === size ? now : { ...now, [key]: size }));
  const sizes = [
    titleAt,
    ...lines.map((_, index) => underAt[`line${index}`]),
    underAt.where,
    unread ? underAt.unread : 0,
    muted ? underAt.muted : 0,
  ];
  const said = sizes.every((size) => size != null)
    ? `${title}: its title at ${tenths(titleAt ?? 0)}, ${lines.length > 0 ? `its line at ${tenths(underAt.line0 ?? 0)}, ` : ''}${sample.event == null ? 'its time' : 'its event and time'} at ${tenths(underAt.where ?? 0)}.`
    : null;

  useEffect(() => {
    if (said != null) onDrawn(said);
  }, [said, onDrawn]);

  const more =
    sample.event == null
      ? null
      : t('notifications.more', { title, event: rowWords(sample.event, language) });

  return (
    <View>
      <View style={styles.rowLine}>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [styles.item, styles.grow, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={[
            title,
            ...lines,
            where,
            unread ? t('notifications.unread') : null,
            muted ? t('notifications.muted') : null,
          ]
            .filter(Boolean)
            .join(', ')}
          testID={`demo.bellSize.item.${sample.id}`}
        >
          <View
            style={styles.tile}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Glyph name={markOf(sample.category)} size={20} ink={tokens.colorInkSecondary} />
          </View>
          <View
            style={styles.grow}
            onLayout={(event) => setRoom(Math.floor(event.nativeEvent.layout.width))}
          >
            <RowText
              // The title's weight changes when it is read, so it is measured again.
              key={unread ? 'bold' : 'medium'}
              text={title}
              size={ROW_TITLE}
              scale={scale}
              cap={Number.POSITIVE_INFINITY}
              room={room}
              weight={unread ? 'bold' : 'medium'}
              line={ROW_TITLE_LINE}
              onDrawn={setTitleAt}
              testID={`demo.bellSize.item.${sample.id}.title`}
            />
            {lines.map((line, index) => (
              <RowText
                key={index}
                text={line}
                size={ROW_LINE}
                scale={scale}
                cap={cap}
                room={room}
                wait={wait}
                weight="medium"
                line={ROW_LINE_LINE}
                style={styles.line}
                onDrawn={under(`line${index}`)}
              />
            ))}
            <RowText
              text={where}
              size={ROW_LINE}
              scale={scale}
              cap={cap}
              room={room}
              wait={wait}
              weight="medium"
              line={ROW_LINE_LINE}
              style={[styles.line, styles.secondary]}
              onDrawn={under('where')}
              testID={`demo.bellSize.item.${sample.id}.where`}
            />
            {(unread || muted) && (
              <View style={styles.marks}>
                {unread && (
                  <View style={styles.mark}>
                    <View style={styles.dot} />
                    <RowText
                      text={t('notifications.unread')}
                      size={ROW_MARK}
                      scale={scale}
                      cap={cap}
                      room={Math.max(room - UNREAD_BESIDE, 0)}
                      wait={wait}
                      weight="semibold"
                      line={ROW_MARK_LINE}
                      style={[styles.accent, styles.shrink]}
                      onDrawn={under('unread')}
                    />
                  </View>
                )}
                {muted && (
                  <View style={styles.mark}>
                    <Glyph name="bellOff" size={14} ink={tokens.colorInkSecondary} weight={2.2} />
                    <RowText
                      text={t('notifications.muted')}
                      size={ROW_MARK}
                      scale={scale}
                      cap={cap}
                      room={Math.max(room - MUTED_BESIDE, 0)}
                      wait={wait}
                      weight="semibold"
                      line={ROW_MARK_LINE}
                      style={[styles.secondary, styles.shrink]}
                      onDrawn={under('muted')}
                    />
                  </View>
                )}
              </View>
            )}
          </View>
        </Pressable>
        {more != null && (
          <Pressable
            onPress={() => onMenu(!menu)}
            style={({ pressed }) => [styles.moreButton, (pressed || menu) && styles.moreOn]}
            accessibilityRole="button"
            accessibilityLabel={more}
            accessibilityState={{ expanded: menu }}
            testID={`demo.bellSize.item.${sample.id}.more`}
          >
            <Glyph name="dots" size={20} ink={tokens.colorInkSecondary} weight={3} />
          </Pressable>
        )}
      </View>
      {menu && more != null && (
        <View style={styles.mute}>
          <BellMute on={muted} onChange={onMute} testID={`demo.bellSize.item.${sample.id}.mute`} />
        </View>
      )}
    </View>
  );
}

/** One of a row's texts at the stand-in size, breaking only between its words and all of it one size; a word wider than its line even at the default size breaks at the line's end. */
function RowText({
  text,
  size,
  scale,
  cap,
  room,
  wait = false,
  weight,
  line,
  style,
  onDrawn,
  testID,
}: {
  text: string;
  size: number;
  scale: number;
  cap: number;
  room: number;
  wait?: boolean;
  weight: 'medium' | 'semibold' | 'bold';
  line: number;
  style?: StyleProp<TextStyle>;
  onDrawn: (size: number) => void;
  testID?: string;
}) {
  const start = rowTextStart(size, scale, cap);
  const key = `${start}|${weight}|${text}`;
  const pieces = piecesOfLine(text);
  const [measured, setMeasured] = useState<{ key: string; widths: Record<string, number> }>({
    key: '',
    widths: {},
  });
  const widths = measured.key === key ? measured.widths : {};
  const widest = pieces.every((piece) => widths[piece] != null)
    ? Math.max(...pieces.map((piece) => widths[piece] ?? 0))
    : null;
  const known = !wait && widest != null && room > 0;
  // Below AX1 a text draws at its start at once and changes only where its widest word does not fit; from AX1 it is hidden until fitted.
  const pending = atAccessibilitySizes(scale) && !known;
  const drawn = known ? rowTextSize(size, start, widest, room) : start;

  useEffect(() => {
    if (known) onDrawn(drawn);
  }, [known, drawn, onDrawn]);

  return (
    <>
      <MeasuredWords
        words={pieces}
        size={start}
        weight={weight}
        allowFontScaling={false}
        onWidth={(piece, width) =>
          setMeasured((now) => {
            const kept = now.key === key ? now.widths : {};

            return kept[piece] === width ? now : { key, widths: { ...kept, [piece]: width } };
          })
        }
      />
      <Text
        // A new size mounts a new Text, so iOS never draws one size in the box laid out for another (sc-69816).
        key={drawn}
        size={drawn}
        weight={weight}
        allowFontScaling={false}
        accessible={false}
        style={[{ lineHeight: Math.ceil(drawn * line) }, style, pending && styles.waiting]}
        testID={testID}
      >
        {text}
      </Text>
    </>
  );
}

function tenths(size: number): string {
  return String(Math.round(size * 10) / 10);
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  pressed: { opacity: tokens.opacityPressed },
  rowLine: { flexDirection: 'row', alignItems: 'flex-start' },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceLg,
    paddingVertical: tokens.spaceLg,
  },
  tile: {
    width: 40,
    height: 40,
    borderRadius: tokens.spaceLg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInset,
  },
  line: { marginTop: 3 },
  marks: { flexDirection: 'row', flexWrap: 'wrap', columnGap: tokens.spaceLg },
  mark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    marginTop: tokens.spaceXs,
    maxWidth: '100%',
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.colorAccent },
  moreButton: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    marginTop: tokens.spaceSm,
    marginRight: -tokens.spaceSm,
    borderRadius: tokens.sizeHit / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreOn: { backgroundColor: tokens.colorInset },
  mute: {
    marginLeft: 56,
    marginBottom: tokens.spaceLg,
    paddingVertical: tokens.spaceXs,
    paddingLeft: tokens.spaceLg,
    paddingRight: tokens.spaceXs,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInset,
  },
  more: { alignItems: 'flex-start', paddingBottom: tokens.spaceXs },
  waiting: { opacity: 0 },
});
