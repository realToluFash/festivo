import type { NotificationCategory } from '@soirely/api-client';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BellBody, BellFrame, BellMute } from '../../components/BellParts.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { OfflineBand } from '../../components/OfflineBand.tsx';
import { readOut } from '../../components/ReadOut.tsx';
import { Refreshing } from '../../components/Refreshing.tsx';
import { SETTLED_MS } from '../../components/Screen.tsx';
import {
  moveScreenReaderFocus,
  type ScreenReaderTarget,
} from '../../components/screenReaderFocus.ts';
import { type Anchor } from '../../components/Summary.tsx';
import { Text, type TextHandle } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { repliesUnread } from '../guests/ChangedSince.ts';
import {
  type BellStart,
  type BellState,
  BUSY_MS,
  BW,
  GONE_EVENT,
  OLDER_COUNT,
  UNKNOWN_CATEGORY,
  bellStartOf,
  mutedOf,
} from './BellStates.ts';
import { BELL, EVENT, PARKING, PARKING_REACH } from './MessagesSample.ts';
import { W, say } from './MessagesWords.ts';
import type { RefObject } from 'react';

type Opener = RefObject<ScreenReaderTarget | null>;

interface BellItem {
  key: string;
  category: NotificationCategory | typeof UNKNOWN_CATEGORY;
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
    ...(start.unknown
      ? [
          {
            key: 'unknown',
            category: UNKNOWN_CATEGORY,
            title: BW.unknown,
            line: where(EVENT, say.atTime('08:40')),
            unread: !allRead,
            event: EVENT,
          },
        ]
      : []),
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
  const body = (
    <BellBody
      ask={asking ? { onAnswer: answered } : null}
      feed={feed}
      rows={items.map((item) => ({
        id: item.key,
        category: item.category,
        title: item.title,
        lines: [],
        where: item.line,
        unread: item.unread,
        muted: mutedOf(start, item),
        more:
          item.event == null
            ? null
            : {
                label: BW.more(item.title, item.event),
                mute: (
                  <BellMute
                    on={muted}
                    onChange={setMuted}
                    testID={`messages.bell.${item.key}.mute`}
                  />
                ),
              },
        goneShown: item.gone === true && goneShown,
        testID: `messages.bell.${item.key}`,
      }))}
      menu={menu}
      onMenu={setMenu}
      onPick={(row) => {
        if (row.id === 'gone') setGoneShown(true);
        else onItem(row.id);
      }}
      onTryAgain={() => {
        setFeed('loading');
        later(() => setFeed('loaded'));
      }}
      more={
        more !== 'none' && more !== 'shown'
          ? {
              busy: more === 'loading',
              failed: more === 'failed',
              onMore: () => {
                setMore('loading');
                later(() => {
                  if (start.more === 'failed') {
                    setMore('failed');
                    return;
                  }
                  setMore('shown');
                  readOut(BW.moreShown(OLDER_COUNT));
                });
              },
            }
          : null
      }
      onSettings={onSettings}
      testID="messages.bell"
    />
  );
  const markAllRead = {
    off: read,
    onPress: () => {
      onAllRead();
      readOut(W.allRead);
    },
    testID: 'messages.bell.markAll',
  };

  return (
    <BellFrame
      where={
        phone
          ? {
              kind: 'screen',
              open,
              back: W.back,
              onBack: onClose,
              over: pushing && (
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
                        <Text
                          size={13}
                          weight="semibold"
                          accessible={false}
                          style={styles.secondary}
                        >
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
              ),
            }
          : { kind: 'popover', at: open ? at : null, opener, onClose }
      }
      heading={heading}
      refreshing={refreshing}
      markAllRead={markAllRead}
      band={band}
      testID={phone ? 'messages.bellScreen' : 'messages.bellPopover'}
    >
      {body}
    </BellFrame>
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
