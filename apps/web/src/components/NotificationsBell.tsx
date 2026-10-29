import type { NotificationItem, NotificationRead } from '@soirely/api-client';
import {
  badgeOf,
  feedAllRead,
  feedWithArrival,
  feedWithLiveRead,
  feedWithMissed,
  feedWithMute,
  feedWithPage,
  feedWithRead,
  whenShown,
} from '@soirely/domain';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { api } from '../api.ts';
import { useMutes } from '../eventMutes.ts';
import { currentLocale } from '../i18n/index.ts';
import { useLiveNotifications } from '../liveNotifications.ts';
import { offButton } from '../offButton.ts';
import { markPushAsked, pushAskDue } from '../pushAsk.ts';
import { subscribeWebPush } from '../webPush.ts';
import { MuteSwitch } from './MuteSwitch.tsx';

type Feed =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'loaded'; items: NotificationItem[]; unread: number; next: string | null };

/** The bell and its feed (sc-3980): a popover from the sidebar on the web, at every width. */
export function NotificationsBell({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [feed, setFeed] = useState<Feed>({ status: 'loading' });
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [said, setSaid] = useState('');
  const [more, setMore] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [asking, setAsking] = useState(false);
  const firstAdded = useRef<string | null>(null);
  const arrivals = useRef(0);
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const headingId = useId();

  const load = useCallback(function load(): Promise<void> {
    const seen = arrivals.current;

    return api.notifications().then(
      (loaded) => {
        if (arrivals.current !== seen) return load();
        setFeed({
          status: 'loaded',
          items: loaded.items,
          unread: loaded.unreadCount,
          next: loaded.next,
        });
      },
      () => setFeed({ status: 'failed' }),
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useLiveNotifications(userId, { onItem: arrived, onRead: readElsewhere, onGap: reread });

  function arrived(item: NotificationItem): void {
    arrivals.current += 1;
    setFeed((current) =>
      current.status === 'loaded'
        ? { ...feedWithArrival(current, item), status: 'loaded' }
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
    const seen = arrivals.current;
    api.notifications().then(
      (page) => {
        if (arrivals.current !== seen) {
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
    setOpen(!open);
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

  useEffect(() => {
    if (!open) return;

    const close = (event: MouseEvent | KeyboardEvent): void => {
      if (event instanceof KeyboardEvent) {
        if (
          event.key !== 'Escape' ||
          document.activeElement?.closest('.notification-mute') != null
        ) {
          return;
        }
        setOpen(false);
        button.current?.focus();
        return;
      }
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);

    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

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
        () => undefined,
      );
    }

    if (item.eventId != null && !item.eventAvailable) {
      setGone((shown) => new Set(shown).add(item.id));
      return;
    }

    if (item.place != null) {
      setOpen(false);
      await navigate(item.place);
    }
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

    const before = feed;
    setFeed({ ...feedAllRead(feed), status: 'loaded' });
    setSaid('');
    const seen = arrivals.current;
    try {
      countedSince(seen, await api.readAllNotifications());
      setSaid(t('notifications.allRead'));
    } catch {
      setSaid(t('notifications.allReadNotSaved'));
      if (arrivals.current === seen) setFeed(before);
      else void load();
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

  return (
    <div className="notifications" ref={container}>
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

      <div className="visually-hidden" aria-live="polite">
        {said}
      </div>

      {open && (
        <section className="notifications-panel" aria-labelledby={headingId}>
          <header className="notifications-header">
            <h2 id={headingId} ref={heading} tabIndex={-1}>
              {t('notifications.heading')}
            </h2>
            <button
              type="button"
              className="link-button"
              aria-disabled={unread === 0}
              onClick={() => void readAll()}
            >
              {t('notifications.markAllRead')}
            </button>
          </header>

          {asking && (
            <section className="notifications-push-ask" aria-labelledby={`${headingId}-push`}>
              <h3 id={`${headingId}-push`}>{t('notifications.pushAsk.title')}</h3>
              <p>{t('notifications.pushAsk.reason')}</p>
              <div className="notifications-push-ask-actions">
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => void answerPush(true)}
                >
                  {t('notifications.pushAsk.turnOn')}
                </button>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => void answerPush(false)}
                >
                  {t('notifications.pushAsk.notNow')}
                </button>
              </div>
            </section>
          )}

          {feed.status === 'loading' && (
            <ul className="notifications-list" aria-busy="true">
              <li className="visually-hidden">{t('notifications.loading')}</li>
              {[0, 1, 2].map((row) => (
                <li key={row} className="notifications-skeleton" aria-hidden="true" />
              ))}
            </ul>
          )}

          {feed.status === 'failed' && (
            <div className="notifications-failed" role="alert">
              <p>{t('notifications.couldNotLoad')}</p>
              <button type="button" className="link-button" onClick={() => void load()}>
                {t('notifications.tryAgain')}
              </button>
            </div>
          )}

          {feed.status === 'loaded' && feed.items.length === 0 && (
            <div className="notifications-empty">
              <BellMark />
              <p>{t('notifications.empty')}</p>
            </div>
          )}

          {feed.status === 'loaded' && feed.items.length > 0 && (
            <ul className="notifications-list">
              {feed.items.map((item) => (
                <li key={item.id} className="notification-row">
                  <button
                    type="button"
                    data-notification={item.id}
                    className={item.read ? 'notification-item' : 'notification-item unread'}
                    onClick={() => void openItem(item)}
                  >
                    <span className="notification-title">{item.title}</span>
                    {item.lines.map((line, index) => (
                      <span key={index} className="notification-line">
                        {line}
                      </span>
                    ))}
                    <span className="notification-where">
                      {item.eventName == null
                        ? when(item.createdAt, t)
                        : t('notifications.whereWhen', {
                            event: item.eventName,
                            when: when(item.createdAt, t),
                          })}
                    </span>
                    {(!item.read || item.muted) && (
                      <span className="notification-marks">
                        {!item.read && (
                          <span className="notification-unread">
                            <span className="notification-dot" aria-hidden="true" />
                            {t('notifications.unread')}
                          </span>
                        )}
                        {item.muted && (
                          <span className="notification-muted">
                            <BellMark slashed />
                            {t('notifications.muted')}
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                  {item.eventId != null && item.eventAvailable && item.eventName != null && (
                    <MuteMenu
                      eventId={item.eventId}
                      label={t('notifications.more', { title: item.title, event: item.eventName })}
                    />
                  )}
                  {gone.has(item.id) && (
                    <p className="notification-gone" role="status">
                      {t('notifications.eventGone')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {feed.status === 'loaded' && feed.next != null && (
            <div className="notifications-more">
              <button
                type="button"
                className="link-button"
                {...offButton(more === 'loading', { dim: false })}
                aria-busy={more === 'loading'}
                onClick={() => feed.next != null && showMore(feed.next, feed.items)}
              >
                {t('notifications.showMore')}
              </button>
              {more === 'failed' && (
                <div className="notice notice-attention" role="alert">
                  <span className="mark mark-attention" aria-hidden="true">
                    !
                  </span>
                  <p className="notice-title">{t('notifications.moreFailed')}</p>
                </div>
              )}
            </div>
          )}

          <Link
            className="notifications-settings"
            to="/app/account/notifications"
            onClick={() => setOpen(false)}
          >
            {t('notifications.settings')}
          </Link>
        </section>
      )}
    </div>
  );
}

function when(createdAt: string, t: TFunction): string {
  const shown = whenShown(createdAt, new Date(), currentLocale());

  return shown.today ? t('notifications.atTime', { time: shown.time }) : shown.date;
}

function BellMark({ slashed = false }: { slashed?: boolean }) {
  return (
    <svg className="bell-mark" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
      {slashed && <path d="M4 4l16 16" />}
    </svg>
  );
}

/** The item's More: the same Mute this event switch as the event's own page, per person. */
function MuteMenu({ eventId, label }: { eventId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const more = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    dialog.current?.focus();
    const close = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || !dialog.current?.contains(document.activeElement)) return;
      setOpen(false);
      more.current?.focus();
    };

    document.addEventListener('keydown', close);

    return () => document.removeEventListener('keydown', close);
  }, [open]);

  return (
    <>
      <button
        ref={more}
        type="button"
        className="notification-more"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((shown) => !shown)}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <div
          ref={dialog}
          className="notification-mute"
          role="dialog"
          aria-label={label}
          tabIndex={-1}
        >
          <MuteSwitch eventId={eventId} />
        </div>
      )}
    </>
  );
}
