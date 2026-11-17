import type { NotificationItem } from '@soirely/api-client';
import {
  feedAllRead,
  feedWithAllReadRefused,
  feedWithArrival,
  feedWithLiveRead,
  feedWithMissed,
  feedWithPage,
  feedWithRead,
  feedWithReadsUndone,
  readSettled,
  whenShown,
} from '@soirely/domain';
import { router } from 'expo-router';
import {
  type RefObject,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
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
import { markPushAsked, pushAskDue, turnOnAppPush } from '../appPush.ts';
import { currentLocale } from '../i18n/index.ts';
import { SECTION_HREF } from '../kit/appNav.ts';
import { markAllRead } from '../kit/notificationFeed.ts';
import { appPlace } from '../kit/notificationPlace.ts';
import { type ScreenOffline, keepsWhatLoaded, useOffline } from '../offline.ts';
import { arrivalsSeen, countedSince, setUnread, useArrivals } from '../notificationsUnread.ts';
import { useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { BellMark } from './BellMark.tsx';
import { PrimaryButton, QuietButton } from './Buttons.tsx';
import { MuteEventSwitch } from './MuteEventCard.tsx';
import { Notice } from './Notice.tsx';
import { useReadOut } from './ReadOut.tsx';
import { moveScreenReaderFocus } from './screenReaderFocus.ts';
import { Sheet } from './Sheet.tsx';
import { Text, type TextHandle } from './Text.tsx';
import { Skeleton } from './Skeleton.tsx';
import { rereadOrganisations } from '../signedIn.ts';

type Feed =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'loaded'; items: NotificationItem[]; unread: number; next: string | null };

/** `NotificationsBell-*` in the app (sc-3980): the feed, live, with its push ask, Mark all read and Show more; `heading` is the frame's title, and `onOffline` hands the screen the feed's band and Refreshing… (sc-27096). */
export function NotificationsFeed({
  heading,
  onOffline,
}: {
  heading: RefObject<TextHandle | null>;
  onOffline: (offline: ScreenOffline) => void;
}) {
  const { t } = useTranslation();
  const [feed, setFeed] = useState<Feed>({ status: 'loading' });
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [more, setMore] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [asking, setAsking] = useState(false);
  const [said, setSaid] = useState<{ words: string } | null>(null);
  const [notSaved, setNotSaved] = useState<string | null>(null);
  const { kind } = useLayout();
  const nextAction = useCallback((): void => setNotSaved(null), []);

  const refetch = useRef(() => {});
  const { watch, stale, refreshing } = useOffline({
    loaded: feed.status === 'loaded',
    reload: () => refetch.current(),
    focusTitle: () => moveScreenReaderFocus(heading.current),
  });

  useLayoutEffect(() => {
    onOffline({ stale, refreshing });
  }, [onOffline, stale, refreshing]);

  /** Only a load Soirely never answered keeps the rows; an error it answered with replaces them, and takes the band down. */
  const notLoaded = useCallback(
    (error: unknown): void =>
      setFeed((current) =>
        current.status === 'loaded' && keepsWhatLoaded(error) ? current : { status: 'failed' },
      ),
    [],
  );

  const fetchFeed = useCallback((): void => {
    watch(readSettled(() => api.notifications(), arrivalsSeen)).then((loaded) => {
      setFeed({
        status: 'loaded',
        items: loaded.items,
        unread: loaded.unreadCount,
        next: loaded.next,
      });
      setUnread(loaded.unreadCount);
    }, notLoaded);
  }, [watch, notLoaded]);

  useEffect(() => {
    refetch.current = fetchFeed;
  }, [fetchFeed]);

  function load(): void {
    nextAction();
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
    watch(readSettled(() => api.notifications(), arrivalsSeen)).then((page) => {
      setFeed((current) =>
        current.status === 'loaded'
          ? {
              ...feedWithMissed(current, { items: page.items, unread: page.unreadCount }),
              status: 'loaded',
            }
          : current,
      );
    }, notLoaded);
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
        ? { ...feedWithArrival(current, arrival), status: 'loaded' }
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
    nextAction();
    if (turnOn) await turnOnAppPush().catch(() => undefined);
    setAsking(false);
    moveScreenReaderFocus(heading.current);
  }

  function openItem(item: NotificationItem): void {
    nextAction();
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
        () =>
          setFeed((current) =>
            current.status === 'loaded'
              ? { ...feedWithReadsUndone(current, [item.id]), status: 'loaded' }
              : current,
          ),
      );
    }

    if (item.eventId != null && !item.eventAvailable) {
      setGone((shown) => new Set(shown).add(item.id));
      return;
    }

    const place = appPlace(item.place);
    if (place != null) router.push(place);
  }

  async function readAll(): Promise<void> {
    if (feed.status !== 'loaded' || feed.unread === 0) return;

    const before = feed;
    nextAction();
    setFeed({ ...feedAllRead(feed), status: 'loaded' });
    const seen = arrivalsSeen();
    const outcome = await markAllRead(api);
    if (!('left' in outcome)) {
      setNotSaved(t(outcome.said));
      setFeed((current) =>
        current.status === 'loaded'
          ? {
              ...feedWithAllReadRefused(current, before, arrivalsSeen() !== seen),
              status: 'loaded',
            }
          : current,
      );
      return;
    }

    setSaid({ words: t(outcome.said) });
    const { left } = outcome;
    if (!countedSince(seen, left)) return;
    setFeed((current) => (current.status === 'loaded' ? { ...current, unread: left } : current));
  }

  function showMore(after: string): void {
    nextAction();
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
  const rows = feed.status === 'loaded' ? feed.items : [];

  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.id}
      extraData={gone}
      renderItem={({ item, index }) => (
        <FeedRow
          item={item}
          gone={gone.has(item.id)}
          opensCard={index === 0 && !asking}
          onOpen={onOpen}
          onMore={nextAction}
        />
      )}
      contentContainerStyle={[styles.feed, kind !== 'phone' && styles.feedUnderBack]}
      ListHeaderComponent={
        <>
          <View style={styles.part}>
            <View style={styles.header}>
              <QuietButton
                label={t('notifications.markAllRead')}
                onPress={() => void readAll()}
                off={unread === 0}
                testID="notifications.markAllRead"
              />
            </View>

            {notSaved != null && (
              <Notice tone="attention" mark="!" body={notSaved} announce wordsInTone />
            )}
          </View>

          {(asking || rows.length === 0) && (
            <View style={[styles.card, styles.cardTop]}>
              {asking && (
                <View style={styles.cardPart}>
                  <View style={styles.ask} testID="notifications.pushAsk">
                    <Text size={tokens.typeRowTitle.size} weight="bold" accessibilityRole="header">
                      {t('notifications.pushAsk.title')}
                    </Text>
                    <Text size={tokens.typeBodyPhone.size}>
                      {t('notifications.pushAsk.reason')}
                    </Text>
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
                </View>
              )}

              {feed.status === 'loading' && (
                <View style={styles.loading}>
                  <Skeleton
                    words={t('notifications.loading')}
                    shape="rows"
                    rowHeight={64}
                    rows={3}
                    inCard
                    edgeToEdge
                  />
                </View>
              )}

              {feed.status === 'failed' && (
                <View style={styles.cardPart}>
                  <Notice
                    tone="broken"
                    mark={tokens.marks.broken.glyph}
                    body={t('notifications.couldNotLoad')}
                    announce
                    wordsInTone
                    action={{
                      label: t('notifications.tryAgain'),
                      onPress: () => {
                        void rereadOrganisations();
                        load();
                      },
                      testID: 'notifications.tryAgain',
                    }}
                  />
                </View>
              )}

              {feed.status === 'loaded' && rows.length === 0 && (
                <View style={styles.empty}>
                  <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <BellMark ink={tokens.colorInkSecondary} />
                  </View>
                  <Text size={tokens.typeBodyPhone.size} muted style={styles.centred}>
                    {t('notifications.empty')}
                  </Text>
                </View>
              )}
            </View>
          )}
        </>
      }
      ListFooterComponent={
        <View style={[styles.card, styles.cardFoot]}>
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
                <Notice
                  tone="attention"
                  mark="!"
                  body={t('notifications.moreFailed')}
                  announce
                  wordsInTone
                />
              )}
            </View>
          )}

          <Pressable
            style={styles.settings}
            onPress={() => {
              nextAction();
              router.push(SECTION_HREF.notifications);
            }}
            accessibilityRole="link"
            testID="notifications.settings"
          >
            <Text size={tokens.typeButton.size} weight="semibold" style={styles.accent}>
              {t('notifications.settings')}
            </Text>
          </Pressable>
        </View>
      }
    />
  );
}

/** One item of the feed, drawing its share of the one card so the list stays virtualised; a page or a live arrival renders only the rows that changed. */
const FeedRow = memo(function FeedRow({
  item,
  gone,
  opensCard,
  onOpen,
  onMore,
}: {
  item: NotificationItem;
  gone: boolean;
  opensCard: boolean;
  onOpen: (item: NotificationItem) => void;
  onMore: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={[styles.card, opensCard && styles.cardTop]}>
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
                    <Text size={tokens.typeSmall.size} weight="semibold" style={styles.accent}>
                      {t('notifications.unread')}
                    </Text>
                  </View>
                )}
                {item.muted && (
                  <View style={styles.mark}>
                    <View
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    >
                      <BellMark ink={tokens.colorInkSecondary} slashed side={MUTED_MARK_SIDE} />
                    </View>
                    <Text size={tokens.typeSmall.size} muted>
                      {t('notifications.muted')}
                    </Text>
                  </View>
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
              onOpened={onMore}
            />
          )}
        </View>
        {gone && (
          <View style={styles.goneLine}>
            <Notice
              tone="quiet"
              mark={tokens.marks.info.glyph}
              body={t('notifications.eventGone')}
              announce
            />
          </View>
        )}
      </View>
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
  onOpened,
}: {
  eventId: string;
  eventName: string;
  label: string;
  testID: string;
  onOpened: () => void;
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
        onPress={() => {
          onOpened();
          setOpen(true);
        }}
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

const MUTED_MARK_SIDE = 14;

const styles = StyleSheet.create({
  feed: {
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.spaceXl,
    paddingBottom: tokens.space3xl,
  },
  feedUnderBack: { paddingTop: tokens.spaceXxs },
  part: { gap: tokens.spaceLg, paddingVertical: tokens.spaceSm },
  card: {
    overflow: 'hidden',
    backgroundColor: tokens.colorCard,
    borderColor: tokens.colorBorder,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  cardTop: {
    paddingTop: tokens.spaceXxs,
    borderTopWidth: 1,
    borderTopLeftRadius: tokens.radiusCardPhone,
    borderTopRightRadius: tokens.radiusCardPhone,
  },
  cardFoot: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: tokens.radiusCardPhone,
    borderBottomRightRadius: tokens.radiusCardPhone,
  },
  cardPart: {
    paddingTop: tokens.spaceSm,
    paddingBottom: tokens.spaceLg,
    paddingHorizontal: tokens.spaceXl,
  },
  loading: { paddingVertical: tokens.spaceSm },
  empty: {
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingVertical: tokens.space3xl,
    paddingHorizontal: tokens.spaceXl,
  },
  centred: { textAlign: 'center' },
  header: { flexDirection: 'row', justifyContent: 'flex-end' },
  fill: { flex: 1 },
  textButton: {
    minHeight: tokens.sizeHit,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
  },
  accent: { color: tokens.colorAccentText },
  ask: {
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInset,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
  },
  askActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceLg },
  row: {
    borderTopWidth: 1,
    borderTopColor: tokens.colorInsetBorder,
  },
  goneLine: { marginHorizontal: tokens.spaceXl, marginBottom: tokens.spaceLg },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start' },
  moreButton: {
    marginTop: tokens.spaceSm,
    marginRight: tokens.spaceSm,
    minWidth: tokens.sizeHit,
    minHeight: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: { gap: tokens.spaceLg, padding: tokens.space3xl },
  item: {
    gap: tokens.spaceXxs,
    minHeight: tokens.sizeHit,
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: tokens.spaceXl,
  },
  marks: { flexDirection: 'row', gap: tokens.spaceLg },
  mark: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXxs },
  dot: {
    width: tokens.spaceSm,
    height: tokens.spaceSm,
    borderRadius: tokens.spaceSm / 2,
    backgroundColor: tokens.colorAccent,
  },
  more: {
    gap: tokens.spaceSm,
    paddingVertical: tokens.spaceSm,
    paddingHorizontal: tokens.spaceXl,
    borderTopWidth: 1,
    borderTopColor: tokens.colorInsetBorder,
  },
  settings: {
    minHeight: tokens.sizeHit,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXl,
    borderTopWidth: 1,
    borderTopColor: tokens.colorInsetBorder,
  },
});
