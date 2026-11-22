import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfettiSwitch } from '../../components/ConfettiSwitch.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { OfflineBand } from '../../components/OfflineBand.tsx';
import { ReadOut, readOut } from '../../components/ReadOut.tsx';
import { Refreshing } from '../../components/Refreshing.tsx';
import { SETTLED_MS } from '../../components/Screen.tsx';
import {
  moveScreenReaderFocus,
  type ScreenReaderTarget,
} from '../../components/screenReaderFocus.ts';
import { Back, Pill } from '../../components/SettingsParts.tsx';
import { Skeleton } from '../../components/Skeleton.tsx';
import { type Anchor, AnchoredMenu, RowList, TextAction } from '../../components/Summary.tsx';
import { Text, type TextHandle } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { repliesUnread } from '../guests/ChangedSince.ts';
import {
  type BellStart,
  type BellState,
  type Category,
  BUSY_MS,
  BW,
  GONE_EVENT,
  OLDER_COUNT,
  bellStartOf,
  markOf,
} from './BellStates.ts';
import { BELL, EVENT, PARKING, PARKING_REACH } from './MessagesSample.ts';
import { W, say } from './MessagesWords.ts';
import type { RefObject } from 'react';

type Opener = RefObject<ScreenReaderTarget | null>;

interface BellItem {
  key: string;
  category: Category;
  title: string;
  line: string;
  unread: boolean;
  /** The event it belongs to, for its More; null when it has none or the event has gone. */
  event: string | null;
  gone?: boolean;
}

function itemsOf(start: BellStart, allRead: boolean, older: boolean): BellItem[] {
  if (start.empty) return [];

  const where = (event: string, when: string) => say.whereWhen(event, when);

  return [
    {
      key: 'replies',
      category: 'guest_replies',
      title: W.bellReplies,
      line: where(EVENT, say.atTime('09:31')),
      unread: repliesUnread(),
      event: EVENT,
    },
    {
      key: 'day',
      category: 'event_day',
      title: BW.paused,
      line: where(EVENT, say.atTime('08:15')),
      unread: false,
      event: EVENT,
    },
    {
      key: 'missed',
      category: 'messages',
      title: say.bellMissed(PARKING, PARKING_REACH.notReached),
      line: where(EVENT, 'Mon, Nov 2'),
      unread: !allRead,
      event: EVENT,
    },
    {
      key: 'change',
      category: 'event_changes',
      title: BELL.change,
      line: where(EVENT, 'Mon, Nov 2'),
      unread: false,
      event: EVENT,
    },
    {
      key: 'money',
      category: 'money',
      title: BW.overdue(EVENT),
      line: where(EVENT, 'Sun, Nov 1'),
      unread: false,
      event: EVENT,
    },
    {
      key: 'security',
      category: 'account_security',
      title: BW.signIn,
      line: 'Sat, Oct 31',
      unread: false,
      event: null,
    },
    ...(start.gone
      ? [
          {
            key: 'gone',
            category: 'event_changes' as const,
            title: BW.deleted,
            line: where(GONE_EVENT, 'Fri, Oct 30'),
            unread: false,
            event: null,
            gone: true,
          },
        ]
      : []),
    ...(older
      ? [
          {
            key: 'olderMoney',
            category: 'money' as const,
            title: BW.due(EVENT),
            line: where(EVENT, 'Thu, Oct 29'),
            unread: false,
            event: EVENT,
          },
          {
            key: 'olderLive',
            category: 'event_changes' as const,
            title: BW.live,
            line: where(EVENT, 'Tue, Oct 27'),
            unread: false,
            event: EVENT,
          },
        ]
      : []),
  ];
}

/** The bell (sc-83081): its own screen on the phone with Back and Mark all read on one row, a 380 popover under the bell on a tablet, every state the product has, and sc-4331's push above. */
export function BellPlace({
  open,
  phone,
  at,
  opener,
  push,
  state,
  allRead,
  onAllRead,
  onItem,
  onSettings,
  onClose,
}: {
  open: boolean;
  phone: boolean;
  at: Anchor | null;
  opener: Opener;
  push: boolean;
  state: BellState;
  /** Mark all read, kept with the event so it outlives Messages; the replies item reads the look instead (sc-4331). */
  allRead: boolean;
  onAllRead: () => void;
  onItem: (key: string) => void;
  onSettings: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [pushing, setPushing] = useState(push);
  const [start] = useState(() => bellStartOf(state));
  const [feed, setFeed] = useState(start.feed);
  const [more, setMore] = useState(start.more);
  const [asking, setAsking] = useState(start.asking);
  const heading = useRef<TextHandle>(null);
  const [menu, setMenu] = useState(start.menu);
  const [muted, setMuted] = useState(start.muted);
  const [goneShown, setGoneShown] = useState(start.gone);
  const [offline, setOffline] = useState(start.offline);
  const [unanswered, setUnanswered] = useState(0);
  const [asOf] = useState(() => {
    const day = new Date();
    day.setHours(9, 40, 0, 0);

    return day;
  });
  const items = itemsOf(start, allRead, more === 'shown');
  const read = feed !== 'loaded' || items.every((item) => !item.unread);
  const later = (then: () => void) => setTimeout(then, BUSY_MS);
  const answered = () => {
    setAsking(false);
    setTimeout(() => moveScreenReaderFocus(heading.current), SETTLED_MS);
  };

  const markAllRead = (
    <TextAction
      label={W.markAllRead}
      off={read}
      onPress={() => {
        onAllRead();
        readOut(W.allRead);
      }}
      testID="messages.bell.markAll"
    />
  );
  const band = (
    <OfflineBand
      stale={
        offline === 'none'
          ? null
          : {
              at: asOf,
              unanswered,
              retry: () => {
                setOffline('refreshing');
                later(() => {
                  setOffline('band');
                  setUnanswered((was) => was + 1);
                });
              },
            }
      }
      inFront={open}
    />
  );
  const refreshing = offline === 'refreshing' && <Refreshing testID="messages.bell.refreshing" />;
  const ask = asking && (
    <View style={styles.ask} testID="messages.bell.pushAsk">
      <Text size={16} weight="bold" accessibilityRole="header">
        {BW.pushTitle}
      </Text>
      <Text size={14} style={styles.secondary}>
        {BW.pushReason}
      </Text>
      <View style={styles.askActs}>
        <Pill
          label={BW.turnOn}
          full={false}
          height={tokens.sizeHit}
          onPress={answered}
          testID="messages.bell.turnOn"
        />
        <TextAction label={BW.notNow} onPress={answered} testID="messages.bell.notNow" />
      </View>
    </View>
  );
  const body = (
    <View>
      {ask}
      {feed === 'loading' && (
        <Skeleton shape="rows" rowHeight={64} picture rows={3} inCard words={BW.loading} />
      )}
      {feed === 'failed' && (
        <View style={styles.failed} accessibilityRole="alert">
          <Text size={15}>{BW.couldNotLoad}</Text>
          <TextAction
            label={BW.tryAgain}
            onPress={() => {
              setFeed('loading');
              later(() => setFeed('loaded'));
            }}
            testID="messages.bell.tryAgain"
          />
        </View>
      )}
      {feed === 'loaded' && items.length === 0 && (
        <View style={styles.empty}>
          <View style={styles.bellTile}>
            <Glyph name="bell" size={20} ink={tokens.colorInkSecondary} />
          </View>
          <Text size={15} style={[styles.grow, styles.secondary]}>
            {BW.empty}
          </Text>
        </View>
      )}
      {feed === 'loaded' && items.length > 0 && (
        <RowList
          items={items.map((item) => ({
            key: item.key,
            inset: 52,
            row: (
              <BellRow
                item={item}
                muted={muted && item.event === EVENT}
                menu={menu === item.key}
                goneShown={goneShown}
                onPress={() => {
                  if (item.gone === true) setGoneShown(true);
                  else onItem(item.key);
                }}
                onMenu={(shown) => setMenu(shown ? item.key : null)}
                onMute={setMuted}
              />
            ),
          }))}
        />
      )}
      {feed === 'loaded' && items.length > 0 && more !== 'none' && more !== 'shown' && (
        <View style={styles.more}>
          <TextAction
            label={BW.showMore}
            off={more === 'loading'}
            onPress={() => {
              setMore('loading');
              later(() => {
                if (start.more === 'failed') {
                  setMore('failed');
                  return;
                }
                setMore('shown');
                readOut(BW.moreShown(OLDER_COUNT));
              });
            }}
            testID="messages.bell.showMore"
          />
          {more === 'failed' && (
            <View style={styles.attention} accessibilityRole="alert">
              <Glyph name="alert" size={16} ink={tokens.colorAttentionText} weight={2.2} />
              <Text size={14} weight="semibold" style={[styles.grow, styles.attentionInk]}>
                {BW.moreFailed}
              </Text>
            </View>
          )}
        </View>
      )}
      <TextAction
        label={W.notificationSettings}
        onPress={onSettings}
        testID="messages.bell.settings"
      />
    </View>
  );

  if (!phone)
    return (
      <AnchoredMenu
        at={open ? at : null}
        onClose={onClose}
        opener={opener}
        width={380}
        align="end"
        head={
          <View style={styles.popoverHead}>
            <View style={styles.bellHead}>
              <View style={styles.titleLine}>
                <Text ref={heading} size={18} weight="bold" accessibilityRole="header">
                  {W.notifications}
                </Text>
                {refreshing}
              </View>
              {markAllRead}
            </View>
            {band}
          </View>
        }
        testID="messages.bellPopover"
      >
        <View style={styles.popover}>{body}</View>
      </AnchoredMenu>
    );
  if (!open) return null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.bellTop}>
        <Back label={W.back} onPress={onClose} />
        <View style={styles.grow} />
        {markAllRead}
      </View>
      {band}
      <ScrollView
        contentContainerStyle={[
          styles.bellPage,
          { paddingBottom: insets.bottom + tokens.space6xl },
        ]}
      >
        <View style={styles.titleLine}>
          <Text
            ref={heading}
            size={30}
            weight="bold"
            accessibilityRole="header"
            style={styles.pageTitle}
          >
            {W.notifications}
          </Text>
          {refreshing}
        </View>
        {body}
      </ScrollView>
      {pushing && (
        <View style={[styles.pushAt, { top: insets.top + tokens.spaceXxs }]}>
          <Pressable
            onPress={() => {
              setPushing(false);
              onItem('replies');
            }}
            style={styles.push}
            accessibilityRole="button"
            accessibilityLabel={BELL.push}
            testID="messages.push"
          >
            <View style={styles.pushTile}>
              <Glyph name="bell" size={18} ink={tokens.colorInkOnDark} weight={2.2} />
            </View>
            <View style={styles.grow}>
              <View style={styles.pushHead}>
                <Text
                  size={13}
                  weight="semibold"
                  accessible={false}
                  style={[styles.grow, styles.secondary]}
                >
                  SOIRELY
                </Text>
                <Text size={13} weight="semibold" accessible={false} style={styles.secondary}>
                  now
                </Text>
              </View>
              <Text size={15} weight="semibold" accessible={false}>
                {BELL.push}
              </Text>
            </View>
          </Pressable>
          <PushTimer onGone={() => setPushing(false)} />
        </View>
      )}
    </View>
  );
}

/** One item: its mark, its words, Unread and Muted, its More with Mute this event under it, and the line for an event that has gone. */
function BellRow({
  item,
  muted,
  menu,
  goneShown,
  onPress,
  onMenu,
  onMute,
}: {
  item: BellItem;
  muted: boolean;
  menu: boolean;
  goneShown: boolean;
  onPress: () => void;
  onMenu: (open: boolean) => void;
  onMute: (muted: boolean) => void;
}) {
  const mark = markOf(item.category);

  return (
    <View>
      <View style={styles.rowLine}>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [styles.bellItem, styles.grow, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={[
            item.title,
            item.line,
            item.unread ? W.unread : null,
            muted ? BW.muted : null,
          ]
            .filter(Boolean)
            .join(', ')}
          testID={`messages.bell.${item.key}`}
        >
          {mark != null && (
            <View style={styles.bellTile}>
              <Glyph name={mark} size={20} ink={tokens.colorInkSecondary} />
            </View>
          )}
          <View style={styles.grow}>
            <Text
              size={16}
              weight={item.unread ? 'bold' : 'medium'}
              accessible={false}
              style={styles.bellTitle}
            >
              {item.title}
            </Text>
            <Text
              size={13.5}
              weight="medium"
              accessible={false}
              style={[styles.secondary, styles.bellLine]}
            >
              {item.line}
            </Text>
            {(item.unread || muted) && (
              <View style={styles.marks}>
                {item.unread && (
                  <View style={styles.mark}>
                    <View style={styles.dot} />
                    <Text size={12.5} weight="semibold" accessible={false} style={styles.accent}>
                      {W.unread}
                    </Text>
                  </View>
                )}
                {muted && (
                  <View style={styles.mark}>
                    <Glyph name="bellOff" size={14} ink={tokens.colorInkSecondary} weight={2.2} />
                    <Text size={12.5} weight="semibold" accessible={false} style={styles.secondary}>
                      {BW.muted}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </Pressable>
        {item.event != null && (
          <Pressable
            onPress={() => onMenu(!menu)}
            style={({ pressed }) => [styles.moreButton, (pressed || menu) && styles.moreOn]}
            accessibilityRole="button"
            accessibilityLabel={BW.more(item.title, item.event)}
            accessibilityState={{ expanded: menu }}
            testID={`messages.bell.${item.key}.more`}
          >
            <Glyph name="dots" size={20} ink={tokens.colorInkSecondary} weight={3} />
          </Pressable>
        )}
      </View>
      {menu && item.event != null && (
        <View style={styles.mute} testID={`messages.bell.${item.key}.mute`}>
          <Text size={15} weight="semibold" style={styles.grow}>
            {BW.muteEvent}
          </Text>
          <ConfettiSwitch
            on={muted}
            label={BW.muteEvent}
            words={{ on: 'On', off: 'Off' }}
            onChange={onMute}
            testID={`messages.bell.${item.key}.muteSwitch`}
          />
        </View>
      )}
      {item.gone === true && goneShown && (
        <View style={styles.gone}>
          <ReadOut words={BW.eventGone} />
          <Text size={14}>{BW.eventGone}</Text>
        </View>
      )}
    </View>
  );
}

function PushTimer({ onGone }: { onGone: () => void }) {
  useEffect(() => {
    const gone = setTimeout(onGone, 6000);

    return () => clearTimeout(gone);
  }, [onGone]);

  return null;
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  pressed: { opacity: tokens.opacityPressed },
  rowLine: { flexDirection: 'row', alignItems: 'flex-start' },
  bellItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceLg,
    paddingVertical: tokens.spaceLg,
  },
  bellTile: {
    width: 40,
    height: 40,
    borderRadius: tokens.spaceLg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInset,
  },
  bellTitle: { lineHeight: 16 * 1.35 },
  bellLine: { marginTop: 3, lineHeight: 13.5 * 1.4 },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    marginLeft: 56,
    marginBottom: tokens.spaceLg,
    paddingVertical: tokens.spaceXs,
    paddingLeft: tokens.spaceLg,
    paddingRight: tokens.spaceXs,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInset,
  },
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
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingVertical: tokens.spaceLg,
  },
  more: { alignItems: 'flex-start', gap: tokens.spaceXs, paddingBottom: tokens.spaceXs },
  attention: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceXs },
  attentionInk: { color: tokens.colorAttentionText },
  popoverHead: { paddingTop: tokens.spaceSm, paddingHorizontal: tokens.spaceXl },
  popover: { paddingHorizontal: tokens.spaceXl, paddingBottom: tokens.spaceXs },
  bellHead: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
  },
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
    letterSpacing: -0.6,
    lineHeight: 30 * 1.12,
  },
  pushAt: { position: 'absolute', left: tokens.spaceMd, right: tokens.spaceMd },
  push: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: tokens.colorInset,
    ...tokens.elevationNative.popover.ios,
    elevation: tokens.elevationNative.popover.android.elevation,
  },
  pushTile: {
    width: 38,
    height: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorAccent,
  },
  pushHead: { flexDirection: 'row', gap: tokens.spaceXs },
});
