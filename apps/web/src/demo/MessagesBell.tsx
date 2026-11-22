import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { Switch } from '../components/GeneralParts.tsx';
import { Glyph } from '../components/Glyph.tsx';
import { Refreshing, StaleBand } from '../components/OfflineBand.tsx';
import {
  type BellStart,
  type Category,
  GONE_EVENT,
  OLDER_COUNT,
  asOf,
  bellStartOf,
  markOf,
} from './bellFeed.ts';
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
import { MoreMark } from './MessagesTo.tsx';
import { BELL_WORDS as W } from './messagesWords.ts';
import '../components/GeneralParts.css';

const BUSY_MS = 900;

interface Item {
  key: string;
  category: Category | 'unknown';
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
  const firstOlder = useRef<HTMLButtonElement>(null);
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
    if (more === 'shown') firstOlder.current?.focus();
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

  const showsMore = feed === 'loaded' && !empty && more !== 'none' && more !== 'shown';

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
        <div ref={box} className="mg-pop mg-bell-pop" role="dialog" aria-labelledby={titleId}>
          <div className="mg-pop-head">
            <div className="mg-bell-heading">
              <h3 id={titleId} ref={heading} tabIndex={-1} className="mg-bell-title-h">
                {W.heading}
              </h3>
              {offline === 'refreshing' && <Refreshing />}
            </div>
            <button
              type="button"
              className="desk-text"
              aria-disabled={unread === 0}
              onClick={() => {
                if (unread === 0) return;
                markLooked(CLOCKS.rest);
                bell.markRead();
                say(W.allRead);
              }}
            >
              {W.markAllRead}
            </button>
          </div>
          <StaleBand
            stale={offline === 'none' ? null : { at: asOf(), retry: retryOffline, unanswered }}
            className="offline-band mg-bell-band"
          />
          {asking && (
            <section className="mg-bell-ask" aria-labelledby={`${titleId}-push`}>
              <h4 id={`${titleId}-push`}>{W.pushAsk.title}</h4>
              <p className="mg-bell-why">{W.pushAsk.reason}</p>
              <div className="mg-bell-ask-acts">
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => {
                    setAsking(false);
                    heading.current?.focus();
                  }}
                >
                  {W.pushAsk.turnOn}
                </button>
                <button
                  type="button"
                  className="desk-text"
                  onClick={() => {
                    setAsking(false);
                    heading.current?.focus();
                  }}
                >
                  {W.pushAsk.notNow}
                </button>
              </div>
            </section>
          )}
          <div className="mg-bell-body">
            {feed === 'loading' && (
              <ul className="mg-bell-items" aria-busy="true" aria-label={W.loading}>
                {[1, 2, 3].map((bar) => (
                  <li key={bar} className="mg-bell-bones" aria-hidden="true">
                    <span className="desk-sunk mg-bell-bone-mark" />
                    <span className="mg-bell-words">
                      <span className={`desk-sunk mg-bell-bone-title b${bar}`} />
                      <span className="desk-sunk mg-bell-bone-line" />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {feed === 'failed' && (
              <div className="mg-bell-failed" role="alert">
                <p className="desk-line is-ink">{W.couldNotLoad}</p>
                <button type="button" className="desk-text" onClick={tryAgain}>
                  {W.tryAgain}
                </button>
              </div>
            )}
            {feed === 'loaded' && items.length === 0 && (
              <div className="mg-bell-empty">
                <span className="mg-bell-glyph" aria-hidden="true">
                  <Glyph name="bell" size={20} />
                </span>
                <p>{W.empty}</p>
              </div>
            )}
            {feed === 'loaded' && items.length > 0 && (
              <ul className="mg-bell-items">
                {items.map((item) => {
                  const mark = markOf(item.category);
                  const isMuted = muted && item.event === EVENT_NAME;

                  return (
                    <li key={item.key} className="mg-bell-row">
                      <button
                        ref={item.key === 'older-money' ? firstOlder : undefined}
                        type="button"
                        className="mg-bell-item"
                        onClick={() => pick(item)}
                      >
                        {mark != null && (
                          <span className="mg-bell-glyph" aria-hidden="true">
                            <Glyph name={mark} size={20} />
                          </span>
                        )}
                        <span className="mg-bell-words">
                          <span
                            className={item.unread ? 'mg-bell-title is-unread' : 'mg-bell-title'}
                          >
                            {item.title}
                          </span>
                          <span className="mg-bell-line">{item.line}</span>
                          {(item.unread || isMuted) && (
                            <span className="mg-bell-marks">
                              {item.unread && (
                                <span className="mg-bell-unread">
                                  <span className="mg-dot" aria-hidden="true" />
                                  {W.unread}
                                </span>
                              )}
                              {isMuted && (
                                <span className="mg-bell-muted">
                                  <Glyph name="bellOff" size={14} weight={2.2} />
                                  {W.muted}
                                </span>
                              )}
                            </span>
                          )}
                        </span>
                      </button>
                      {item.event != null && (
                        <MuteMenu
                          label={filled(W.more, { title: item.title, event: item.event })}
                          open={menu === item.key}
                          muted={muted}
                          onOpen={(shown) => setMenu(shown ? item.key : null)}
                          onMute={setMuted}
                        />
                      )}
                      {item.gone === true && goneShown && (
                        <p className="mg-bell-gone" role="status">
                          {W.eventGone}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {showsMore && (
              <div className="mg-bell-more">
                <button
                  type="button"
                  className="desk-text"
                  aria-disabled={more === 'loading'}
                  aria-busy={more === 'loading'}
                  onClick={() => {
                    if (more !== 'loading') showMore();
                  }}
                >
                  {W.showMore}
                </button>
                {more === 'failed' && (
                  <p className="mg-bell-attention" role="alert">
                    <Glyph name="alert" size={16} weight={2.2} />
                    {W.moreFailed}
                  </p>
                )}
              </div>
            )}
          </div>
          <Link className="desk-text mg-bell-settings" to="/demo/settings/notifications">
            {W.settings}
          </Link>
        </div>
      )}
    </div>
  );
}

/** An item's More: Mute this event, the same switch as the event's own page, its word beside it. */
function MuteMenu({
  label,
  open,
  muted,
  onOpen,
  onMute,
}: {
  label: string;
  open: boolean;
  muted: boolean;
  onOpen: (open: boolean) => void;
  onMute: (muted: boolean) => void;
}) {
  const more = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    panel.current?.focus();
    const keys = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      onOpen(false);
      more.current?.focus();
    };

    document.addEventListener('keydown', keys);

    return () => document.removeEventListener('keydown', keys);
  }, [open, onOpen]);

  return (
    <>
      <button
        ref={more}
        type="button"
        className="mgt-more mg-bell-more-button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => onOpen(!open)}
      >
        <MoreMark />
      </button>
      {open && (
        <div ref={panel} className="mg-bell-mute" role="dialog" aria-label={label} tabIndex={-1}>
          <span className="mg-bell-mute-name">{W.muteEvent}</span>
          <Switch
            on={muted}
            label={W.muteEvent}
            words={{ on: W.on, off: W.off }}
            onChange={onMute}
          />
        </div>
      )}
    </>
  );
}
