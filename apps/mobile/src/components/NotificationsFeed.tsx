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
import { router, usePathname } from 'expo-router';
import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { markPushAsked, pushAskDue, turnOnAppPush } from '../appPush.ts';
import { currentLocale } from '../i18n/index.ts';
import { SECTION_HREF } from '../kit/appNav.ts';
import { markAllRead } from '../kit/notificationFeed.ts';
import { appPlace, bellOpens } from '../kit/notificationPlace.ts';
import { type ScreenOffline, keepsWhatLoaded, useOffline } from '../offline.ts';
import { arrivalsSeen, countedSince, setUnread, useArrivals } from '../notificationsUnread.ts';
import { tokens } from '../theme/tokens.ts';
import { type BellRowData, BellBody, BellFrame, BellMute } from './BellParts.tsx';
import { useEventMute } from './MuteEventCard.tsx';
import { Notice } from './Notice.tsx';
import { OfflineBand } from './OfflineBand.tsx';
import { useReadOut } from './ReadOut.tsx';
import { Refreshing } from './Refreshing.tsx';
import { type ScreenReaderTarget, moveScreenReaderFocus } from './screenReaderFocus.ts';
import type { Anchor } from './SummaryOverlays.tsx';
import { TextAction } from './SummaryRows.tsx';
import { type TextHandle } from './Text.tsx';
import { rereadOrganisations } from '../signedIn.ts';

type Feed =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'loaded'; items: NotificationItem[]; unread: number; next: string | null };

export type FeedWhere =
  | { kind: 'screen'; onBack: () => void }
  | {
      kind: 'popover';
      open: boolean;
      at: Anchor | null;
      opener: RefObject<ScreenReaderTarget | null>;
      onClose: () => void;
    }
  | {
      kind: 'framed';
      heading: RefObject<TextHandle | null>;
      onOffline: (offline: ScreenOffline) => void;
    };

/** The bell's feed in the app (sc-3980), live, with its push ask, Mark all read and Show more, in the B frame (sc-83081): a phone's own screen, a tablet's popover under the bell, or the body of main's frame for a phone on its side (sc-62023). */
export function NotificationsFeed({ where }: { where: FeedWhere }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [feed, setFeed] = useState<Feed>({ status: 'loading' });
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [more, setMore] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [asking, setAsking] = useState(false);
  const [said, setSaid] = useState<{ words: string } | null>(null);
  const [notSaved, setNotSaved] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const ownHeading = useRef<TextHandle>(null);
  const heading = where.kind === 'framed' ? where.heading : ownHeading;
  const onOffline = where.kind === 'framed' ? where.onOffline : null;
  const opened = where.kind === 'popover' ? where.open : true;
  const nextAction = useCallback((): void => setNotSaved(null), []);

  const refetch = useRef(() => {});
  const { watch, stale, refreshing } = useOffline({
    loaded: feed.status === 'loaded',
    reload: () => refetch.current(),
    focusTitle: () => moveScreenReaderFocus(heading.current),
  });

  useLayoutEffect(() => {
    onOffline?.({ stale, refreshing });
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

  const wasOpen = useRef(opened);
  useEffect(() => {
    if (opened && !wasOpen.current) {
      setMenu(null);
      setNotSaved(null);
      setFeed({ status: 'loading' });
      fetchFeed();
    }
    wasOpen.current = opened;
  }, [opened, fetchFeed]);

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
    if (place == null) return;
    if (where.kind === 'popover') where.onClose();
    const opens = bellOpens(place, pathname, where.kind);
    if ('push' in opens) router.push(opens.push);
    else router.setParams(opens.setParams);
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

  const unread = feed.status === 'loaded' ? feed.unread : 0;

  function rowOf(item: NotificationItem): BellRowData {
    return {
      id: item.id,
      category: item.category,
      title: item.title,
      lines: item.lines,
      where:
        item.eventName == null
          ? when(item.createdAt)
          : t('notifications.whereWhen', { event: item.eventName, when: when(item.createdAt) }),
      unread: !item.read,
      muted: item.muted,
      more:
        item.eventId != null && item.eventAvailable && item.eventName != null
          ? {
              label: t('notifications.more', { title: item.title, event: item.eventName }),
              mute: (
                <FeedMute eventId={item.eventId} testID={`notifications.item.${item.id}.mute`} />
              ),
            }
          : null,
      goneShown: gone.has(item.id),
      testID: `notifications.item.${item.id}`,
    };
  }

  function when(createdAt: string): string {
    const shown = whenShown(createdAt, new Date(), currentLocale());

    return shown.today ? t('notifications.atTime', { time: shown.time }) : shown.date;
  }

  const body = (
    <BellBody
      ask={asking ? { onAnswer: (turnOn) => void answerPush(turnOn) } : null}
      feed={feed.status}
      rows={feed.status === 'loaded' ? feed.items.map(rowOf) : []}
      menu={menu}
      onMenu={(id) => {
        nextAction();
        setMenu(id);
      }}
      onPick={(row) => {
        const item =
          feed.status === 'loaded' ? feed.items.find((one) => one.id === row.id) : undefined;
        if (item != null) openItem(item);
      }}
      onTryAgain={() => {
        void rereadOrganisations();
        load();
      }}
      more={
        feed.status === 'loaded' && feed.next != null
          ? {
              busy: more === 'loading',
              failed: more === 'failed',
              onMore: () => feed.next != null && showMore(feed.next),
            }
          : null
      }
      notice={notSaved}
      onSettings={() => {
        nextAction();
        if (where.kind === 'popover') where.onClose();
        router.push(SECTION_HREF.notifications);
      }}
      testID="notifications"
    />
  );

  if (where.kind === 'framed')
    return (
      <ScrollView contentContainerStyle={styles.framed}>
        <View style={styles.header}>
          <TextAction
            label={t('notifications.markAllRead')}
            off={unread === 0}
            onPress={() => void readAll()}
            testID="notifications.markAllRead"
          />
        </View>
        {body}
      </ScrollView>
    );

  return (
    <BellFrame
      where={
        where.kind === 'screen'
          ? { kind: 'screen', open: true, back: t('notifications.back'), onBack: where.onBack }
          : {
              kind: 'popover',
              at: where.open ? where.at : null,
              opener: where.opener,
              onClose: where.onClose,
            }
      }
      heading={ownHeading}
      refreshing={refreshing ? <Refreshing testID="notifications.refreshing" /> : null}
      markAllRead={{
        off: unread === 0,
        onPress: () => void readAll(),
        testID: 'notifications.markAllRead',
      }}
      band={<OfflineBand stale={stale} inFront={opened} />}
      testID={where.kind === 'screen' ? 'notifications.screen' : 'notifications.popover'}
    >
      {body}
    </BellFrame>
  );
}

/** Mute this event in an item's More (sc-3980), the same mute as the event's own page, inline under the item (sc-83081). */
function FeedMute({ eventId, testID }: { eventId: string; testID: string }) {
  const { t } = useTranslation();
  const { mute, loaded, muted, busy, change, retry, tap } = useEventMute(eventId);

  return (
    <BellMute on={loaded && muted} busy={busy || !loaded} onChange={change} testID={testID}>
      {mute.status === 'failed' && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          body={t('eventMute.notLoaded')}
          announce
          action={{ label: t('eventMute.tryAgain'), onPress: retry, testID: `${testID}.tryAgain` }}
        />
      )}
      {mute.status === 'loaded' && mute.unsaved && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          body={t('eventMute.notSaved')}
          answer={tap}
        />
      )}
    </BellMute>
  );
}

const styles = StyleSheet.create({
  framed: {
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.spaceXl,
    paddingBottom: tokens.space3xl,
  },
  header: { flexDirection: 'row', justifyContent: 'flex-end' },
});
