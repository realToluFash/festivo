import type { NotificationItem } from '@soirely/api-client';
import {
  feedAllRead,
  feedWithArrival,
  feedWithLiveRead,
  feedWithMissed,
  feedWithMute,
  feedWithPage,
  feedWithRead,
  whenShown,
} from '@soirely/domain';
import { router } from 'expo-router';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type ViewInstance,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { useMutes } from '../eventMutes.ts';
import { markPushAsked, pushAskDue, turnOnAppPush } from '../appPush.ts';
import { currentLocale } from '../i18n/index.ts';
import { SECTION_HREF } from '../kit/appNav.ts';
import { appPlace } from '../kit/notificationPlace.ts';
import { arrivalsSeen, countedSince, setUnread, useArrivals } from '../notificationsUnread.ts';
import { tokens } from '../theme/tokens.ts';
import { Footnote, PrimaryButton, QuietButton } from './Buttons.tsx';
import { MuteEventSwitch } from './MuteEventCard.tsx';
import { Notice } from './Notice.tsx';
import { useReadOut } from './ReadOut.tsx';
import { moveScreenReaderFocus } from './screenReaderFocus.ts';
import { Sheet } from './Sheet.tsx';
import { Text } from './Text.tsx';

type Feed =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'loaded'; items: NotificationItem[]; unread: number; next: string | null };

/** `NotificationsBell-*` in the app (sc-3980): the feed, live, with its push ask, Mark all read and Show more. */
export function NotificationsFeed() {
  const { t } = useTranslation();
  const [feed, setFeed] = useState<Feed>({ status: 'loading' });
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [more, setMore] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [asking, setAsking] = useState(false);
  const [said, setSaid] = useState<{ words: string } | null>(null);
  const heading = useRef<ViewInstance>(null);

  const fetchFeed = useCallback((): void => {
    api.notifications().then(
      (loaded) => {
        setFeed({
          status: 'loaded',
          items: loaded.items,
          unread: loaded.unreadCount,
          next: loaded.next,
        });
        setUnread(loaded.unreadCount);
      },
      () => setFeed({ status: 'failed' }),
    );
  }, []);

  function load(): void {
    setFeed({ status: 'loading' });
    fetchFeed();
  }

  useEffect(() => {
    fetchFeed();
    void pushAskDue().then(
      (due) => {
        if (!due) return;
        setAsking(true);
        void markPushAsked();
      },
      () => undefined,
    );
  }, [fetchFeed]);

  const reread = (): void => {
    const seen = arrivalsSeen();
    api.notifications().then(
      (page) => {
        if (arrivalsSeen() !== seen) {
          reread();
          return;
        }
        setFeed((current) =>
          current.status === 'loaded'
            ? {
                ...feedWithMissed(current, { items: page.items, unread: page.unreadCount }),
                status: 'loaded',
              }
            : current,
        );
      },
      () => undefined,
    );
  };

  useArrivals((arrival) => {
    if (arrival === 'reread') {
      reread();
      return;
    }
    if ('read' in arrival) {
      const { read } = arrival;
      setFeed((current) =>
        current.status === 'loaded'
          ? { ...feedWithLiveRead(current, read), status: 'loaded' }
          : current,
      );
      return;
    }
    const { item } = arrival;
    setFeed((current) =>
      current.status === 'loaded'
        ? { ...feedWithArrival(current, item), status: 'loaded' }
        : current,
    );
    setSaid({
      words:
        item.eventName == null
          ? t('notifications.arrived', { title: item.title })
          : t('notifications.arrivedAt', { title: item.title, event: item.eventName }),
    });
  });

  useReadOut(said?.words ?? null, { answer: said });

  useEffect(() => {
    if (feed.status === 'loaded') setUnread(feed.unread);
  }, [feed]);

  async function answerPush(turnOn: boolean): Promise<void> {
    if (turnOn) await turnOnAppPush().catch(() => undefined);
    setAsking(false);
    moveScreenReaderFocus(heading.current);
  }

  function openItem(item: NotificationItem): void {
    if (!item.read) {
      setFeed((current) =>
        current.status === 'loaded'
          ? { ...feedWithRead(current, item.id), status: 'loaded' }
          : current,
      );
      const seen = arrivalsSeen();
      void api.readNotification(item.id).then(
        (answer) => {
          if (!countedSince(seen, answer.unreadCount)) return;
          setFeed((current) =>
            current.status === 'loaded' ? { ...current, unread: answer.unreadCount } : current,
          );
        },
        () => undefined,
      );
    }

    if (item.eventId != null && !item.eventAvailable) {
      setGone((shown) => new Set(shown).add(item.id));
      return;
    }

    const place = appPlace(item.place);
    if (place != null) router.push(place);
  }

  useMutes((eventId, mute) =>
    setFeed((current) =>
      current.status === 'loaded'
        ? { ...feedWithMute(current, eventId, mute), status: 'loaded' }
        : current,
    ),
  );

  async function readAll(): Promise<void> {
    if (feed.status !== 'loaded' || feed.unread === 0) return;

    setFeed({ ...feedAllRead(feed), status: 'loaded' });
    setSaid({ words: t('notifications.allRead') });
    const seen = arrivalsSeen();
    try {
      const left = await api.readAllNotifications();
      if (!countedSince(seen, left)) return;
      setFeed((current) => (current.status === 'loaded' ? { ...current, unread: left } : current));
    } catch {
      load();
    }
  }

  function showMore(after: string): void {
    setMore('loading');
    api.notifications(after).then(
      (page) => {
        setFeed((current) =>
          current.status === 'loaded'
            ? { ...feedWithPage(current, page).feed, status: 'loaded' }
            : current,
        );
        setSaid({ words: t('notifications.moreShown', { count: page.items.length }) });
        setMore('idle');
      },
      () => setMore('failed'),
    );
  }

  const opening = useRef(openItem);
  useEffect(() => {
    opening.current = openItem;
  });
  const onOpen = useCallback((item: NotificationItem) => opening.current(item), []);

  const unread = feed.status === 'loaded' ? feed.unread : 0;

  return (
    <FlatList
      data={feed.status === 'loaded' ? feed.items : []}
      keyExtractor={(item) => item.id}
      extraData={gone}
      renderItem={({ item }) => <FeedRow item={item} gone={gone.has(item.id)} onOpen={onOpen} />}
      ItemSeparatorComponent={Between}
      contentContainerStyle={styles.feed}
      ListHeaderComponentStyle={styles.part}
      ListFooterComponentStyle={styles.part}
      ListHeaderComponent={
        <>
          <View style={styles.header}>
            <View ref={heading} accessible focusable style={styles.fill}>
              <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
                {t('notifications.heading')}
              </Text>
            </View>
            <Pressable
              style={styles.textButton}
              onPress={() => void readAll()}
              accessibilityRole="button"
              accessibilityState={{ disabled: unread === 0 }}
              testID="notifications.markAllRead"
            >
              <Text
                size={tokens.typeButton.size}
                weight="semibold"
                style={unread === 0 ? styles.secondaryInk : styles.accent}
              >
                {t('notifications.markAllRead')}
              </Text>
            </Pressable>
          </View>

          {asking && (
            <View style={styles.ask} testID="notifications.pushAsk">
              <Text size={tokens.typeRowTitle.size} weight="bold" accessibilityRole="header">
                {t('notifications.pushAsk.title')}
              </Text>
              <Text size={tokens.typeBodyPhone.size}>{t('notifications.pushAsk.reason')}</Text>
              <View style={styles.askActions}>
                <PrimaryButton
                  label={t('notifications.pushAsk.turnOn')}
                  onPress={() => void answerPush(true)}
                  testID="notifications.pushAsk.turnOn"
                />
                <QuietButton
                  label={t('notifications.pushAsk.notNow')}
                  onPress={() => void answerPush(false)}
                  testID="notifications.pushAsk.notNow"
                />
              </View>
            </View>
          )}

          {feed.status === 'loading' && (
            <View
              accessibilityState={{ busy: true }}
              accessible
              accessibilityLabel={t('notifications.loading')}
            >
              {[0, 1, 2].map((row) => (
                <View key={row} style={styles.skeleton} />
              ))}
            </View>
          )}

          {feed.status === 'failed' && (
            <Notice
              tone="broken"
              mark={tokens.marks.broken.glyph}
              body={t('notifications.couldNotLoad')}
              announce
              action={{
                label: t('notifications.tryAgain'),
                onPress: load,
                testID: 'notifications.tryAgain',
              }}
            />
          )}

          {feed.status === 'loaded' && feed.items.length === 0 && (
            <View style={styles.empty}>
              <Text size={tokens.typeBodyPhone.size} muted>
                {t('notifications.empty')}
              </Text>
            </View>
          )}
        </>
      }
      ListFooterComponent={
        <>
          {feed.status === 'loaded' && feed.next != null && (
            <View style={styles.more}>
              <Pressable
                style={styles.textButton}
                onPress={() => more !== 'loading' && feed.next != null && showMore(feed.next)}
                accessibilityRole="button"
                accessibilityState={{ busy: more === 'loading' }}
                testID="notifications.showMore"
              >
                {more === 'loading' && <ActivityIndicator color={tokens.colorAccent} />}
                <Text size={tokens.typeButton.size} weight="semibold" style={styles.accent}>
                  {t('notifications.showMore')}
                </Text>
              </Pressable>
              {more === 'failed' && (
                <Notice tone="attention" mark="!" body={t('notifications.moreFailed')} announce />
              )}
            </View>
          )}

          <Footnote
            action={t('notifications.settings')}
            role="link"
            onPress={() => router.push(SECTION_HREF.notifications)}
            testID="notifications.settings"
          />
        </>
      }
    />
  );
}

function Between() {
  return <View style={styles.between} />;
}

/** One item of the feed; a page or a live arrival renders only the rows that changed. */
const FeedRow = memo(function FeedRow({
  item,
  gone,
  onOpen,
}: {
  item: NotificationItem;
  gone: boolean;
  onOpen: (item: NotificationItem) => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      <View style={styles.itemRow}>
        <Pressable
          style={[styles.item, styles.fill]}
          onPress={() => onOpen(item)}
          accessibilityRole="button"
          testID={`notifications.item.${item.id}`}
        >
          <Text size={tokens.typeBodyPhone.size} weight={item.read ? 'regular' : 'bold'}>
            {item.title}
          </Text>
          {item.lines.map((line, index) => (
            <Text key={index} size={tokens.typeBodyPhone.size}>
              {line}
            </Text>
          ))}
          <Text size={tokens.typeSmall.size} muted>
            {item.eventName == null
              ? when(item.createdAt)
              : t('notifications.whereWhen', {
                  event: item.eventName,
                  when: when(item.createdAt),
                })}
          </Text>
          {(!item.read || item.muted) && (
            <View style={styles.marks}>
              {!item.read && (
                <View style={styles.mark}>
                  <View style={styles.dot} />
                  <Text size={tokens.typeSmall.size} weight="semibold">
                    {t('notifications.unread')}
                  </Text>
                </View>
              )}
              {item.muted && (
                <Text size={tokens.typeSmall.size} muted>
                  {t('notifications.muted')}
                </Text>
              )}
            </View>
          )}
        </Pressable>
        {item.eventId != null && item.eventAvailable && item.eventName != null && (
          <MuteMore
            eventId={item.eventId}
            eventName={item.eventName}
            label={t('notifications.more', { title: item.title, event: item.eventName })}
            testID={`notifications.item.${item.id}.more`}
          />
        )}
      </View>
      {gone && (
        <Notice
          tone="quiet"
          mark={tokens.marks.info.glyph}
          body={t('notifications.eventGone')}
          announce
        />
      )}
    </View>
  );

  function when(createdAt: string): string {
    const shown = whenShown(createdAt, new Date(), currentLocale());

    return shown.today ? t('notifications.atTime', { time: shown.time }) : shown.date;
  }
});

/** The item's More (sc-3980): the event's own Mute this event switch, in the app's sheet. */
function MuteMore({
  eventId,
  eventName,
  label,
  testID,
}: {
  eventId: string;
  eventName: string;
  label: string;
  testID: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const opener = useRef<ViewInstance>(null);
  const close = (): void => setOpen(false);

  return (
    <>
      <Pressable
        ref={opener}
        style={styles.moreButton}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        testID={testID}
      >
        <Text size={tokens.typeRowTitle.size} weight="bold">
          ⋯
        </Text>
      </Pressable>
      <Sheet
        open={open}
        onClose={close}
        scrimLabel={t('notifications.moreDone')}
        opener={opener}
        testID={`${testID}.sheet`}
      >
        {open && (
          <View style={styles.sheet}>
            <Text size={tokens.typeRowTitle.size} weight="bold" accessibilityRole="header">
              {eventName}
            </Text>
            <MuteEventSwitch eventId={eventId} testID={`${testID}.mute`} />
            <QuietButton
              label={t('notifications.moreDone')}
              onPress={close}
              testID={`${testID}.done`}
            />
          </View>
        )}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  feed: {
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.spaceXl,
    paddingBottom: tokens.space3xl,
  },
  part: { gap: tokens.spaceLg, paddingVertical: tokens.spaceSm },
  between: { height: tokens.spaceLg },
  header: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  fill: { flex: 1 },
  textButton: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
  },
  accent: { color: tokens.colorAccentText },
  secondaryInk: { color: tokens.colorInkSecondary },
  ask: {
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInset,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
  },
  askActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceLg },
  skeleton: {
    height: tokens.sizeHitPhonePrimary,
    marginBottom: tokens.spaceSm,
    borderRadius: tokens.radiusSmall,
    backgroundColor: tokens.colorInset,
  },
  empty: { paddingVertical: tokens.spaceXl },
  row: { gap: tokens.spaceXs },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  moreButton: {
    minWidth: tokens.sizeHit,
    minHeight: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: { gap: tokens.spaceLg },
  item: {
    gap: tokens.spaceXxs,
    minHeight: tokens.sizeHit,
    paddingVertical: tokens.spaceSm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorInsetBorder,
  },
  marks: { flexDirection: 'row', gap: tokens.spaceLg },
  mark: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  dot: {
    width: tokens.spaceSm,
    height: tokens.spaceSm,
    borderRadius: tokens.spaceSm / 2,
    backgroundColor: tokens.colorAccent,
  },
  more: { gap: tokens.spaceSm },
});
