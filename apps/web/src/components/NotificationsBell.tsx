import type { NotificationArrival, NotificationItem, NotificationRead } from '@soirely/api-client';
import {
  badgeOf,
  feedAllRead,
  feedWithAllReadRefused,
  feedWithArrival,
  feedWithLiveRead,
  feedWithMissed,
  feedWithPage,
  feedWithRead,
  feedWithReadsUndone,
  readSettled,
  readerZoneOf,
  whenShown,
} from '@soirely/domain';
import type { TFunction } from 'i18next';
import {
  type MouseEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';

import { api } from '../api.ts';
import { currentLocale } from '../i18n/index.ts';
import { useLiveNotifications } from '../liveNotifications.ts';
import { type Stale, keepsWhatLoaded, useStaleWatch } from '../offline.ts';
import { markPushAsked, pushAskDue } from '../pushAsk.ts';
import { subscribeWebPush } from '../webPush.ts';
import { stateFor } from '../routes/app/pageUnder.ts';
import { placeUnder } from './bellPlace.ts';
import { type BellRow, BellPanel } from './BellPanel.tsx';
import { MuteSwitch } from './MuteSwitch.tsx';
import { StaleBand } from './OfflineBand.tsx';
import { Bell } from './SettingsParts.tsx';
import { BannerBell } from './TodayBanner.tsx';
import './SettingsParts.css';
import './today.css';

type Feed =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'loaded'; items: NotificationItem[]; unread: number; next: string | null };

/** The bell and its feed (sc-3980), a popover at every width. `desk` is the title row's bell, as the desk demos draw it: round and grey, a red dot for unread, the panel reaching back across the page; `banner` is Today's, glass on its banner. */
export function NotificationsBell({
  userId,
  accountZone = null,
  look = 'band',
}: {
  userId: string;
  accountZone?: string | null;
  look?: 'band' | 'desk' | 'banner';
}) {
  const { t } = useTranslation();
  const zone = readerZoneOf(accountZone);
  const navigate = useNavigate();
  const location = useLocation();
  const [feed, setFeed] = useState<Feed>({ status: 'loading' });
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [said, setSaid] = useState('');
  const [more, setMore] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [asking, setAsking] = useState(false);
  const [notSaved, setNotSaved] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const bellOpen = useRef(false);
  const firstAdded = useRef<string | null>(null);
  const arrivals = useRef(0);
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const headingId = useId();

  const reload = useRef(() => {});
  const { watch, stale, refreshing } = useStaleWatch({
    loaded: feed.status === 'loaded',
    reload: () => reload.current(),
    title: heading,
  });

  /** Only a load Soirely never answered keeps the rows; an error it answered with replaces them, and takes the band down. */
  const notLoaded = useCallback(
    (error: unknown): void =>
      setFeed((current) =>
        current.status === 'loaded' && keepsWhatLoaded(error) ? current : { status: 'failed' },
      ),
    [],
  );

  /** The feed's band is its own (sc-27096): every read of page one goes through `watch`, and one Soirely never answered keeps what the feed showed. */
  const load = useCallback((): Promise<void> => {
    return watch(
      readSettled(
        () => api.notifications(),
        () => arrivals.current,
      ),
    ).then(
      (loaded) =>
        setFeed({
          status: 'loaded',
          items: loaded.items,
          unread: loaded.unreadCount,
          next: loaded.next,
        }),
      notLoaded,
    );
  }, [watch, notLoaded]);

  useEffect(() => {
    reload.current = () => void load();
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  useLiveNotifications(userId, { onItem: arrived, onRead: readElsewhere, onGap: reread });

  function arrived(arrival: NotificationArrival): void {
    const { item } = arrival;
    arrivals.current += 1;
    setFeed((current) =>
      current.status === 'loaded'
        ? { ...feedWithArrival(current, arrival), status: 'loaded' }
        : current,
    );
    setSaid(
      item.eventName == null
        ? t('notifications.arrived', { title: item.title })
        : t('notifications.arrivedAt', { title: item.title, event: item.eventName }),
    );
  }

  function readElsewhere(read: NotificationRead): void {
    arrivals.current += 1;
    setFeed((current) =>
      current.status === 'loaded'
        ? { ...feedWithLiveRead(current, read), status: 'loaded' }
        : current,
    );
  }

  /** A page worked out before the latest arrival misses it, so it is read again rather than taken. */
  function reread(): void {
    watch(
      readSettled(
        () => api.notifications(),
        () => arrivals.current,
      ),
    ).then((page) => {
      setFeed((current) =>
        current.status === 'loaded'
          ? {
              ...feedWithMissed(current, { items: page.items, unread: page.unreadCount }),
              status: 'loaded',
            }
          : current,
      );
    }, notLoaded);
  }

  /** A count the server worked out before the latest arrival is one short, so it is dropped and the local count stands. */
  function countedSince(seen: number, count: number): void {
    if (arrivals.current !== seen) return;
    setFeed((current) => (current.status === 'loaded' ? { ...current, unread: count } : current));
  }

  useEffect(() => {
    void subscribeWebPush().catch(() => undefined);
  }, [userId]);

  useEffect(() => {
    if (open) heading.current?.focus();
  }, [open]);

  function openBell(): void {
    const due = !open && pushAskDue();
    if (due) markPushAsked();
    setAsking(due);
    bellOpen.current = !open;
    setOpen(!open);
    setNotSaved(false);
    setMenu(null);
  }

  const closeBell = useCallback((): void => {
    bellOpen.current = false;
    setOpen(false);
    setNotSaved(false);
    setMenu(null);
  }, []);

  /** Mark all read's failure stays until the next thing done in the bell (sc-23233). */
  function nextAction(event: MouseEvent<HTMLElement>): void {
    if ((event.target as Element).closest('button, input') != null) setNotSaved(false);
  }

  function tryAgain(): void {
    setFeed({ status: 'loading' });
    heading.current?.focus();
    void load();
  }

  async function answerPush(turnOn: boolean): Promise<void> {
    if (turnOn) {
      const answer = await Notification.requestPermission().catch(() => undefined);
      if (answer === 'granted') void subscribeWebPush().catch(() => undefined);
    }
    setAsking(false);
    heading.current?.focus();
  }

  useEffect(() => {
    if (firstAdded.current == null) return;

    Array.from(container.current?.querySelectorAll<HTMLElement>('[data-notification]') ?? [])
      .find((shown) => shown.dataset.notification === firstAdded.current)
      ?.focus();
    firstAdded.current = null;
  }, [feed]);

  useLayoutEffect(() => {
    if (!open) return;

    const placeIt = (): void => {
      const pop = container.current?.querySelector<HTMLElement>('.bell-pop');
      if (button.current != null && pop != null) placeUnder(button.current, pop);
    };
    const afterScroll = (event: Event): void => {
      if (!container.current?.contains(event.target as Node)) placeIt();
    };
    const pageChanges = new MutationObserver(placeIt);
    placeIt();
    window.addEventListener('resize', placeIt);
    window.addEventListener('scroll', afterScroll, true);
    pageChanges.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributeFilter: ['class'],
    });

    return () => {
      window.removeEventListener('resize', placeIt);
      window.removeEventListener('scroll', afterScroll, true);
      pageChanges.disconnect();
    };
  }, [open, stale]);

  useEffect(() => {
    if (!open) return;

    const close = (event: globalThis.MouseEvent | KeyboardEvent): void => {
      if (event instanceof KeyboardEvent) {
        if (event.key !== 'Escape' || document.activeElement?.closest('.bell-mute') != null) {
          return;
        }
        closeBell();
        button.current?.focus();
        return;
      }
      if (!container.current?.contains(event.target as Node)) closeBell();
    };

    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);

    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open, closeBell]);

  const unread = feed.status === 'loaded' ? feed.unread : 0;
  const badge = badgeOf(unread, t('notifications.overNinetyNine'));

  async function openItem(item: NotificationItem): Promise<void> {
    if (!item.read) {
      setFeed((current) =>
        current.status === 'loaded'
          ? { ...feedWithRead(current, item.id), status: 'loaded' }
          : current,
      );
      const seen = arrivals.current;
      void api.readNotification(item.id).then(
        (answer) => countedSince(seen, answer.unreadCount),
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

    if (item.place != null) {
      closeBell();
      await navigate(item.place, { state: stateFor(item.place, location) });
    }
  }

  async function readAll(): Promise<void> {
    if (feed.status !== 'loaded' || feed.unread === 0) return;

    const before = feed;
    setFeed({ ...feedAllRead(feed), status: 'loaded' });
    setSaid('');
    const seen = arrivals.current;
    try {
      countedSince(seen, await api.readAllNotifications());
      setSaid(t('notifications.allRead'));
    } catch {
      if (bellOpen.current) setNotSaved(true);
      else setSaid(t('notifications.allReadNotSaved'));
      setFeed((current) =>
        current.status === 'loaded'
          ? {
              ...feedWithAllReadRefused(current, before, arrivals.current !== seen),
              status: 'loaded',
            }
          : current,
      );
    }
  }

  function showMore(after: string, shown: NotificationItem[]): void {
    setMore('loading');
    api.notifications(after).then(
      (page) => {
        const { added } = feedWithPage({ items: shown, unread: 0, next: after }, page);

        setFeed((current) =>
          current.status === 'loaded'
            ? { ...feedWithPage(current, page).feed, status: 'loaded' }
            : current,
        );
        const first = added[0];
        if (page.next == null && first != null) firstAdded.current = first.id;
        setSaid(t('notifications.moreShown', { count: page.items.length }));
        setMore('idle');
      },
      () => setMore('failed'),
    );
  }

  function rowOf(item: NotificationItem): BellRow {
    return {
      id: item.id,
      category: item.category,
      title: item.title,
      lines: item.lines,
      where:
        item.eventName == null
          ? when(item.createdAt, zone, t)
          : t('notifications.whereWhen', {
              event: item.eventName,
              when: when(item.createdAt, zone, t),
            }),
      unread: !item.read,
      muted: item.muted,
      more:
        item.eventId != null && item.eventAvailable && item.eventName != null
          ? {
              label: t('notifications.more', { title: item.title, event: item.eventName }),
              mute: <MuteSwitch eventId={item.eventId} />,
            }
          : null,
      goneShown: gone.has(item.id),
    };
  }

  return (
    <div className={look === 'band' ? 'notifications' : 'notifications is-desk'} ref={container}>
      {look === 'desk' ? (
        <Bell ref={button} unread={unread} expanded={open} onOpen={openBell} />
      ) : look === 'banner' ? (
        <BannerBell ref={button} unread={unread} expanded={open} onOpen={openBell} />
      ) : (
        <button
          ref={button}
          type="button"
          className="notifications-bell"
          aria-expanded={open}
          aria-label={
            unread > 0 ? t('notifications.bellUnread', { count: unread }) : t('notifications.bell')
          }
          onClick={openBell}
        >
          <BellMark />
          {badge != null && (
            <span className="notifications-badge" aria-hidden="true">
              {badge}
            </span>
          )}
        </button>
      )}

      <div className="visually-hidden" aria-live="polite">
        {said}
      </div>

      {open && (
        <BellPanel
          titleId={headingId}
          heading={heading}
          refreshing={refreshing}
          unread={unread}
          onReadAll={() => void readAll()}
          band={<FeedBand stale={stale} />}
          notice={notSaved ? t('notifications.allReadNotSaved') : null}
          ask={asking ? { onAnswer: (turnOn) => void answerPush(turnOn) } : null}
          feed={feed.status}
          rows={feed.status === 'loaded' ? feed.items.map((item) => rowOf(item)) : []}
          onPick={(row) => {
            const item =
              feed.status === 'loaded' ? feed.items.find((one) => one.id === row.id) : undefined;
            if (item != null) void openItem(item);
          }}
          onTryAgain={tryAgain}
          more={
            feed.status === 'loaded' && feed.next != null
              ? {
                  busy: more === 'loading',
                  failed: more === 'failed',
                  onMore: () => feed.next != null && showMore(feed.next, feed.items),
                }
              : null
          }
          menu={menu}
          onMenu={setMenu}
          settings={
            <Link
              className="desk-text bell-settings"
              to="/app/account/notifications"
              onClick={closeBell}
            >
              {t('notifications.settings')}
            </Link>
          }
          onClickCapture={nextAction}
        />
      )}
    </div>
  );
}

/** Already there when the bell opens on a stale feed, with no motion of its own; it moves only when it comes or goes with the popover open. */
function FeedBand({ stale }: { stale: Stale | null }) {
  const [still, setStill] = useState(stale != null);

  if (still && stale == null) setStill(false);

  return (
    <StaleBand
      stale={stale}
      className={still ? 'offline-band bell-band still' : 'offline-band bell-band'}
    />
  );
}

function when(createdAt: string, zone: string, t: TFunction): string {
  const shown = whenShown(createdAt, new Date(), currentLocale(), zone);

  return shown.today ? t('notifications.atTime', { time: shown.time }) : shown.date;
}

function BellMark() {
  return (
    <svg className="bell-mark" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </svg>
  );
}
