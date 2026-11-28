import { type ReactNode, type RefObject, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { atAccessibilitySizes, piecesIn } from '../layout/textSize.ts';
import { tokens } from '../theme/tokens.ts';
import {
  BELL_BESIDE_GAP,
  BELL_HEADING,
  BELL_MARK_ALL,
  BELL_UNDER_GAP,
  markAllSize,
  markAllUnder,
  PHONE_TITLE,
  PHONE_TITLE_LINE,
  PHONE_TITLE_TRACKING,
} from './bellTop.ts';
import { BellEmptyLine, BellSettingsLink } from './BellEmpty.tsx';
import { ConfettiSwitch } from './ConfettiSwitch.tsx';
import { Glyph } from './Glyph.tsx';
import { markOf } from './notificationMarks.ts';
import { ReadOut } from './ReadOut.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { Back, Pill } from './SettingsParts.tsx';
import { Skeleton } from './Skeleton.tsx';
import { type Anchor, AnchoredMenu } from './SummaryOverlays.tsx';
import { RowList, TextAction } from './SummaryRows.tsx';
import { Text, type TextHandle } from './Text.tsx';
import { MeasuredWords, WholeWords } from './Title.tsx';

export interface BellRowData {
  id: string;
  category: string;
  title: string;
  lines: readonly string[];
  /** `{event} · {when}`, or the time alone for an item with no event. */
  where: string;
  unread: boolean;
  muted: boolean;
  /** Its More, for an item whose event is still there: Mute this event, inline under the item. */
  more: { label: string; mute: ReactNode } | null;
  goneShown: boolean;
  testID: string;
}

type Where =
  | { kind: 'screen'; open: boolean; back: string; onBack: () => void; over?: ReactNode }
  | {
      kind: 'popover';
      at: Anchor | null;
      opener: RefObject<ScreenReaderTarget | null>;
      onClose: () => void;
    };

/** The bell in the B frame (sc-83081): on a phone its own screen, Back and Mark all read on one row over the title; on a tablet a 380 popover under the bell, its right edge in line with the bell's. */
export function BellFrame({
  where,
  heading,
  refreshing,
  markAllRead,
  band,
  children,
  testID,
}: {
  where: Where;
  heading: RefObject<TextHandle | null>;
  refreshing: ReactNode;
  markAllRead: { off: boolean; onPress: () => void; testID: string };
  band: ReactNode;
  children: ReactNode;
  testID: string;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const markAll = (
    <TextAction
      label={t('notifications.markAllRead')}
      off={markAllRead.off}
      onPress={markAllRead.onPress}
      testID={markAllRead.testID}
    />
  );

  if (where.kind === 'popover')
    return (
      <AnchoredMenu
        at={where.at}
        onClose={where.onClose}
        opener={where.opener}
        width={380}
        align="end"
        head={
          <View style={styles.popoverHead}>
            <PanelTop heading={heading} refreshing={refreshing} markAllRead={markAllRead} />
            {band}
          </View>
        }
        testID={testID}
      >
        <View style={styles.popover}>{children}</View>
      </AnchoredMenu>
    );
  if (!where.open) return null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID={testID}>
      <View style={styles.bellTop}>
        <Back label={where.back} onPress={where.onBack} />
        <View style={styles.grow} />
        {markAll}
      </View>
      {band}
      <ScrollView
        contentContainerStyle={[
          styles.bellPage,
          { paddingBottom: insets.bottom + tokens.space6xl },
        ]}
      >
        <PageTitle heading={heading} refreshing={refreshing} />
        {children}
      </ScrollView>
      {where.over}
    </View>
  );
}

/** The phone screen's title: main's 30, grown with the text and, from AX1, stepped down only until its own word fits the page whole, never under 30; the refreshing mark wraps under it rather than shrinking it (sc-92959). */
function PageTitle({
  heading,
  refreshing,
}: {
  heading: RefObject<TextHandle | null>;
  refreshing: ReactNode;
}) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const [room, setRoom] = useState(0);

  return (
    <View
      style={styles.titleLine}
      onLayout={(event) => setRoom(Math.floor(event.nativeEvent.layout.width))}
    >
      <WholeWords
        ref={heading}
        size={PHONE_TITLE}
        start={PHONE_TITLE * fontScale}
        room={atAccessibilitySizes(fontScale) ? room : undefined}
        weight="bold"
        accessibilityRole="header"
        style={styles.pageTitle}
      >
        {t('notifications.heading')}
      </WholeWords>
      {refreshing}
    </View>
  );
}

/** The tablet panel's top: the heading whole on one line, stepped down only for its own word, and Mark all read whole beside it or, where the two cannot share the row, on its own line under it (sc-92580). */
function PanelTop({
  heading,
  refreshing,
  markAllRead,
}: {
  heading: RefObject<TextHandle | null>;
  refreshing: ReactNode;
  markAllRead: { off: boolean; onPress: () => void; testID: string };
}) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const name = t('notifications.heading');
  const label = t('notifications.markAllRead');
  const [room, setRoom] = useState(0);
  const [headingAt, setHeadingAt] = useState(BELL_HEADING * fontScale);
  const [widths, setWidths] = useState<Readonly<Record<string, number>>>({});
  const markStart = BELL_MARK_ALL * fontScale;
  const pieces = piecesIn([label]);
  const measuredAt = (size: number, text: string) => widths[`${size}|${text}`];
  const pieceWidths = pieces.map((piece) => measuredAt(markStart, piece));
  const widest = pieceWidths.every((width) => width != null)
    ? Math.max(...pieceWidths.map((width) => width ?? 0))
    : null;
  const markAt = widest == null || room === 0 ? markStart : markAllSize(fontScale, widest, room);
  const headingWidth = measuredAt(headingAt, name);
  const markAllWidth = measuredAt(markAt, label);
  const under = markAllUnder({
    room,
    heading: headingWidth ?? 0,
    markAll: markAllWidth ?? 0,
  });
  const pending = room === 0 || widest == null || headingWidth == null || markAllWidth == null;
  const keep = (size: number) => (text: string, width: number) => {
    const key = `${size}|${text}`;
    setWidths((now) => (now[key] === width ? now : { ...now, [key]: width }));
  };

  return (
    <>
      <MeasuredWords
        words={pieces}
        size={markStart}
        weight="semibold"
        allowFontScaling={false}
        onWidth={keep(markStart)}
      />
      <MeasuredWords
        words={[label]}
        size={markAt}
        weight="semibold"
        allowFontScaling={false}
        onWidth={keep(markAt)}
      />
      <MeasuredWords
        words={[name]}
        size={headingAt}
        weight="bold"
        allowFontScaling={false}
        onWidth={keep(headingAt)}
      />
      <View
        style={[styles.bellHead, under && styles.bellHeadUnder, pending && styles.waiting]}
        onLayout={(event) => setRoom(Math.floor(event.nativeEvent.layout.width))}
      >
        <View style={[styles.titleLine, under && styles.titleLineUnder]}>
          <WholeWords
            ref={heading}
            size={BELL_HEADING}
            start={BELL_HEADING * fontScale}
            room={room}
            weight="bold"
            accessibilityRole="header"
            onDrawn={setHeadingAt}
          >
            {name}
          </WholeWords>
          {refreshing}
        </View>
        <TextAction
          label={label}
          off={markAllRead.off}
          wraps={under}
          drawnAt={atAccessibilitySizes(fontScale) ? markAt : undefined}
          onPress={markAllRead.onPress}
          testID={markAllRead.testID}
        />
      </View>
    </>
  );
}

/** What the bell holds under its top: Turn on push?, the loading rows, the failure, the empty line or the items, Show more, and Notification settings at the foot. */
export function BellBody({
  ask,
  feed,
  rows,
  menu,
  onMenu,
  onPick,
  onTryAgain,
  more,
  notice,
  onSettings,
  testID,
}: {
  ask: { onAnswer: (turnOn: boolean) => void } | null;
  feed: 'loading' | 'failed' | 'loaded';
  rows: readonly BellRowData[];
  menu: string | null;
  onMenu: (id: string | null) => void;
  onPick: (row: BellRowData) => void;
  onTryAgain: () => void;
  more: { busy: boolean; failed: boolean; onMore: () => void } | null;
  /** Mark all read's failure, until the next thing done in the bell. */
  notice?: string | null;
  onSettings: () => void;
  testID: string;
}) {
  const { t } = useTranslation();

  return (
    <View>
      {notice != null && <BellAttention words={notice} />}
      {ask != null && (
        <View style={styles.ask} testID={`${testID}.pushAsk`}>
          <Text size={16} weight="bold" accessibilityRole="header">
            {t('notifications.pushAsk.title')}
          </Text>
          <Text size={14} style={styles.secondary}>
            {t('notifications.pushAsk.reason')}
          </Text>
          <View style={styles.askActs}>
            <Pill
              label={t('notifications.pushAsk.turnOn')}
              full={false}
              height={tokens.sizeHit}
              onPress={() => ask.onAnswer(true)}
              testID={`${testID}.pushAsk.turnOn`}
            />
            <TextAction
              label={t('notifications.pushAsk.notNow')}
              onPress={() => ask.onAnswer(false)}
              testID={`${testID}.pushAsk.notNow`}
            />
          </View>
        </View>
      )}
      {feed === 'loading' && (
        <Skeleton
          shape="rows"
          rowHeight={64}
          picture
          rows={3}
          inCard
          words={t('notifications.loading')}
        />
      )}
      {feed === 'failed' && (
        <View style={styles.failed} accessibilityRole="alert">
          <Text size={15}>{t('notifications.couldNotLoad')}</Text>
          <TextAction
            label={t('notifications.tryAgain')}
            onPress={onTryAgain}
            testID={`${testID}.tryAgain`}
          />
        </View>
      )}
      {feed === 'loaded' && rows.length === 0 && <BellEmptyLine />}
      {feed === 'loaded' && rows.length > 0 && (
        <RowList
          items={rows.map((row) => ({
            key: row.id,
            inset: 52,
            row: (
              <BellItem
                row={row}
                menu={menu === row.id}
                onPress={() => onPick(row)}
                onMenu={(shown) => onMenu(shown ? row.id : null)}
              />
            ),
          }))}
        />
      )}
      {feed === 'loaded' && rows.length > 0 && more != null && (
        <View style={styles.more}>
          <TextAction
            label={t('notifications.showMore')}
            off={more.busy}
            onPress={() => {
              if (!more.busy) more.onMore();
            }}
            testID={`${testID}.showMore`}
          />
          {more.failed && <BellAttention words={t('notifications.moreFailed')} />}
        </View>
      )}
      <BellSettingsLink onPress={onSettings} testID={`${testID}.settings`} />
    </View>
  );
}

/** One item: its mark, its words, Unread and Muted, its More with Mute this event under it, and the line for an event that has gone. */
function BellItem({
  row,
  menu,
  onPress,
  onMenu,
}: {
  row: BellRowData;
  menu: boolean;
  onPress: () => void;
  onMenu: (open: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <View>
      <View style={styles.rowLine}>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [styles.item, styles.grow, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={[
            row.title,
            ...row.lines,
            row.where,
            row.unread ? t('notifications.unread') : null,
            row.muted ? t('notifications.muted') : null,
          ]
            .filter(Boolean)
            .join(', ')}
          testID={row.testID}
        >
          <View
            style={styles.tile}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Glyph name={markOf(row.category)} size={20} ink={tokens.colorInkSecondary} />
          </View>
          <View style={styles.grow}>
            <Text
              size={16}
              weight={row.unread ? 'bold' : 'medium'}
              accessible={false}
              style={styles.title}
            >
              {row.title}
            </Text>
            {row.lines.map((line, index) => (
              <Text key={index} size={13.5} weight="medium" accessible={false} style={styles.line}>
                {line}
              </Text>
            ))}
            <Text
              size={13.5}
              weight="medium"
              accessible={false}
              style={[styles.secondary, styles.line]}
            >
              {row.where}
            </Text>
            {(row.unread || row.muted) && (
              <View style={styles.marks}>
                {row.unread && (
                  <View style={styles.mark}>
                    <View style={styles.dot} />
                    <Text size={12.5} weight="semibold" accessible={false} style={styles.accent}>
                      {t('notifications.unread')}
                    </Text>
                  </View>
                )}
                {row.muted && (
                  <View style={styles.mark}>
                    <Glyph name="bellOff" size={14} ink={tokens.colorInkSecondary} weight={2.2} />
                    <Text size={12.5} weight="semibold" accessible={false} style={styles.secondary}>
                      {t('notifications.muted')}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </Pressable>
        {row.more != null && (
          <Pressable
            onPress={() => onMenu(!menu)}
            style={({ pressed }) => [styles.moreButton, (pressed || menu) && styles.moreOn]}
            accessibilityRole="button"
            accessibilityLabel={row.more.label}
            accessibilityState={{ expanded: menu }}
            testID={`${row.testID}.more`}
          >
            <Glyph name="dots" size={20} ink={tokens.colorInkSecondary} weight={3} />
          </Pressable>
        )}
      </View>
      {menu && row.more != null && <View style={styles.mute}>{row.more.mute}</View>}
      {row.goneShown && (
        <View style={styles.gone}>
          <ReadOut words={t('notifications.eventGone')} />
          <Text size={14}>{t('notifications.eventGone')}</Text>
        </View>
      )}
    </View>
  );
}

/** Mute this event inside an item's More: its name, then the switch with its On/Off word, and under them anything the switch has to say. */
export function BellMute({
  on,
  busy = false,
  onChange,
  testID,
  children,
}: {
  on: boolean;
  busy?: boolean;
  onChange: (next: boolean) => void;
  testID: string;
  children?: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.muteParts} testID={testID}>
      <View style={styles.muteRow}>
        <Text size={15} weight="semibold" style={styles.grow}>
          {t('eventMute.switch')}
        </Text>
        <ConfettiSwitch
          on={on}
          label={t('eventMute.switch')}
          words={{ on: t('eventMute.on'), off: t('eventMute.off') }}
          busy={busy}
          onChange={onChange}
          testID={`${testID}.switch`}
        />
      </View>
      {children}
    </View>
  );
}

/** An amber line with the alert mark: Show more's failure, and Mark all read's. */
function BellAttention({ words }: { words: string }) {
  return (
    <View style={styles.attention} accessibilityRole="alert">
      <Glyph name="alert" size={16} ink={tokens.colorAttentionText} weight={2.2} />
      <Text size={14} weight="semibold" style={[styles.grow, styles.attentionInk]}>
        {words}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
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
  title: { lineHeight: 16 * 1.35 },
  line: { marginTop: 3, lineHeight: 13.5 * 1.4 },
  marks: { flexDirection: 'row', flexWrap: 'wrap', columnGap: tokens.spaceLg },
  mark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    marginTop: tokens.spaceXs,
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
  muteParts: { gap: tokens.spaceXs },
  muteRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  gone: { marginLeft: 56, marginTop: -tokens.spaceSm, marginBottom: tokens.spaceLg },
  ask: {
    gap: tokens.spaceXs,
    marginTop: tokens.spaceXs,
    marginBottom: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInset,
  },
  askActs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceLg,
    marginTop: tokens.spaceXs,
  },
  failed: { alignItems: 'flex-start', gap: tokens.spaceXs, paddingVertical: tokens.spaceLg },
  more: { alignItems: 'flex-start', gap: tokens.spaceXs, paddingBottom: tokens.spaceXs },
  attention: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceXs },
  attentionInk: { color: tokens.colorAttentionText },
  popoverHead: { paddingTop: tokens.spaceSm, paddingHorizontal: tokens.spaceXl },
  popover: { paddingHorizontal: tokens.spaceXl, paddingBottom: tokens.spaceXs },
  bellHead: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: BELL_BESIDE_GAP,
  },
  bellHeadUnder: { flexDirection: 'column', alignItems: 'flex-start', gap: BELL_UNDER_GAP },
  waiting: { opacity: 0 },
  titleLineUnder: { flex: 0 },
  titleLine: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.spaceMd,
  },
  screen: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: tokens.colorCard,
  },
  bellTop: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spaceXxl,
  },
  bellPage: { paddingHorizontal: tokens.spaceXxl, gap: tokens.spaceSm },
  pageTitle: {
    paddingTop: 14,
    paddingBottom: tokens.spaceXs,
    letterSpacing: PHONE_TITLE * PHONE_TITLE_TRACKING,
    lineHeight: PHONE_TITLE * PHONE_TITLE_LINE,
  },
});
