import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import type { NotificationCategory } from '@soirely/api-client';

import { BellMute, BellPanel } from '../components/BellPanel.tsx';
import { Glyph } from '../components/Glyph.tsx';
import { StaleBand } from '../components/OfflineBand.tsx';
import { type BellStart, GONE_EVENT, OLDER_COUNT, asOf, bellStartOf } from './bellFeed.ts';
import { lastLooked, markLooked, repliesUnread } from './changedSince.ts';
import { CLOCKS } from './events.ts';
import { guestsAt } from './guests.ts';
import {
  EVENT_NAME,
  MW,
  PARKING,
  SAMPLE_EVENT,
  filled,
  many,
  reachedOfThread,
} from './messages.ts';
import { useInbox } from './messagesContext.ts';
import { BELL_WORDS as W } from './messagesWords.ts';

const BUSY_MS = 900;

interface Item {
  key: string;
  category: NotificationCategory;
  title: string;
  line: string;
  unread: boolean;
  /** The event it belongs to, open for its More; null when it has none or the event has gone. */
  event: string | null;
  gone?: boolean;
}

/** The bell at a desk (sc-83081): each item with its category's mark, and every state the product has, in the B frame. */
export function MessagesBell() {
  const { act, focus, say, bell, inbox } = useInbox();
  const navigate = useNavigate();
  const [open, setOpen] = useState(bell.takeFirst);
  const [start] = useState<BellStart>(() => bellStartOf(bell.state));
  const [feed, setFeed] = useState(start.feed);
  const [empty] = useState(start.empty);
  const [more, setMore] = useState(start.more);
  const [asking, setAsking] = useState(start.asking);
  const [menu, setMenu] = useState(start.menu);
  const [muted, setMuted] = useState(start.muted);
  const [goneShown, setGoneShown] = useState(start.gone);
  const [offline, setOffline] = useState(start.offline);
  const [unanswered, setUnanswered] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const where = (event: string, when: string) => filled(W.whereWhen, { event, when });
  const today = (time: string) => filled(W.atTime, { time });
  const items: Item[] = empty
    ? []
    : [
        {
          key: 'replies',
          category: 'guest_replies',
          title: filled(MW.repliesBatch, { coming: 3, notComing: 1, changed: 1 }),
          line: where(EVENT_NAME, today('09:31')),
          unread: repliesUnread(),
          event: EVENT_NAME,
        },
        {
          key: 'day',
          category: 'event_day',
          title: W.samples.paused,
          line: where(EVENT_NAME, today('08:15')),
          unread: false,
          event: EVENT_NAME,
        },
        {
          key: 'missed',
          category: 'messages',
          title: `${PARKING.subject}: ${many('didntGetIt', 11)}`,
          line: where(EVENT_NAME, 'Mon, Nov 2'),
          unread: !bell.read,
          event: EVENT_NAME,
        },
        {
          key: 'changed',
          category: 'event_changes',
          title: W.samples.changed,
          line: where(EVENT_NAME, 'Mon, Nov 2'),
          unread: false,
          event: EVENT_NAME,
        },
        {
          key: 'money',
          category: 'money',
          title: filled(W.samples.overdue, { event: EVENT_NAME }),
          line: where(EVENT_NAME, 'Sun, Nov 1'),
          unread: false,
          event: EVENT_NAME,
        },
        {
          key: 'security',
          category: 'account_security',
          title: W.samples.signIn,
          line: 'Sat, Oct 31',
          unread: false,
          event: null,
        },
        ...(start.gone
          ? [
              {
                key: 'gone',
                category: 'event_changes' as const,
                title: W.samples.deleted,
                line: where(GONE_EVENT, 'Fri, Oct 30'),
                unread: false,
                event: null,
                gone: true,
              },
            ]
          : []),
        ...(more === 'shown'
          ? [
              {
                key: 'older-money',
                category: 'money' as const,
                title: filled(W.samples.due, { event: EVENT_NAME }),
                line: where(EVENT_NAME, 'Thu, Oct 29'),
                unread: false,
                event: EVENT_NAME,
              },
              {
                key: 'older-live',
                category: 'event_changes' as const,
                title: W.samples.live,
                line: where(EVENT_NAME, 'Tue, Oct 27'),
                unread: false,
                event: EVENT_NAME,
              },
            ]
          : []),
      ];
  const unread = feed === 'loaded' ? items.filter((item) => item.unread).length : 0;

  useEffect(() => {
    if (!open) return;

    const keys = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (menu != null) return;
      setOpen(false);
      button.current?.focus();
    };
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;

      if (!box.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };

    document.addEventListener('keydown', keys);
    document.addEventListener('pointerdown', outside);

    return () => {
      document.removeEventListener('keydown', keys);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open, menu]);

  useEffect(() => {
    if (more !== 'shown') return;
    box.current?.querySelector<HTMLElement>('[data-notification="older-money"]')?.focus();
  }, [more]);

  function later(then: () => void): void {
    window.setTimeout(then, BUSY_MS);
  }

  function pick(item: Item): void {
    if (item.gone === true) {
      setGoneShown(true);
      return;
    }
    setOpen(false);
    if (item.key === 'missed') {
      act({ kind: 'reached', of: reachedOfThread('parking', inbox), thread: 'parking' });
      focus('heading');
    } else if (item.key === 'replies') {
      const since = lastLooked();

      markLooked(CLOCKS.rest);
      void navigate(
        guestsAt(SAMPLE_EVENT, { filter: 'changed', ...(since == null ? {} : { since }) }),
      );
    } else if (item.key === 'security') void navigate('/demo/settings/security');
    else void navigate(`/demo/events/${SAMPLE_EVENT}`);
  }

  function tryAgain(): void {
    setFeed('loading');
    heading.current?.focus();
    later(() => setFeed('loaded'));
  }

  function showMore(): void {
    setMore('loading');
    later(() => {
      if (start.more === 'failed') {
        setMore('failed');
        return;
      }
      setMore('shown');
      say(filled(W.moreShown_other, { count: OLDER_COUNT }));
    });
  }

  function retryOffline(): void {
    setOffline('refreshing');
    later(() => {
      setOffline('band');
      setUnanswered((was) => was + 1);
    });
  }

  const showsMore = !empty && more !== 'none' && more !== 'shown';

  return (
    <div className="mg-bell-at">
      <button
        ref={button}
        type="button"
        className="desk-bell"
        aria-label={unread > 0 ? filled(W.bellUnread_other, { count: unread }) : W.bell}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((now) => !now)}
      >
        <Glyph name="bell" size={19} />
        {unread > 0 && <span className="today-unread" aria-hidden="true" />}
      </button>
      {open && (
        <div ref={box}>
          <BellPanel
            titleId={titleId}
            heading={heading}
            refreshing={offline === 'refreshing'}
            unread={unread}
            onReadAll={() => {
              if (unread === 0) return;
              markLooked(CLOCKS.rest);
              bell.markRead();
              say(W.allRead);
            }}
            band={
              <StaleBand
                stale={offline === 'none' ? null : { at: asOf(), retry: retryOffline, unanswered }}
                className="offline-band bell-band"
              />
            }
            notice={null}
            ask={
              asking
                ? {
                    onAnswer: () => {
                      setAsking(false);
                      heading.current?.focus();
                    },
                  }
                : null
            }
            feed={feed}
            rows={items.map((item) => ({
              id: item.key,
              category: item.category,
              title: item.title,
              lines: [],
              where: item.line,
              unread: item.unread,
              muted: start.marked.includes(item.key),
              more:
                item.event == null
                  ? null
                  : {
                      label: filled(W.more, { title: item.title, event: item.event }),
                      mute: <BellMute on={muted} onChange={setMuted} />,
                    },
              goneShown: item.gone === true && goneShown,
            }))}
            onPick={(row) => {
              const item = items.find((one) => one.key === row.id);
              if (item != null) pick(item);
            }}
            onTryAgain={tryAgain}
            more={
              showsMore
                ? { busy: more === 'loading', failed: more === 'failed', onMore: showMore }
                : null
            }
            menu={menu}
            onMenu={setMenu}
            settings={
              <Link className="desk-text bell-settings" to="/demo/settings/notifications">
                {W.settings}
              </Link>
            }
          />
        </div>
      )}
    </div>
  );
}
