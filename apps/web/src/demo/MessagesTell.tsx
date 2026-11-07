import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import en from '../i18n/locales/en.json';
import { Glyph, type GlyphName } from './Glyph.tsx';
import {
  type Told,
  EVENT_NAME,
  MW,
  PARKING,
  SAMPLE_EVENT,
  TELL,
  channelWord,
  filled,
  many,
} from './messages.ts';
import { useInbox } from './messagesContext.ts';
import { WhereGlyph } from './MessagesParts.tsx';
import { Dialog } from './SettingsParts.tsx';
import type { Tell } from './TodayParts.tsx';

const NOTIFICATIONS = en.notifications;

/** Tell guests (sc-4330): Soirely's prepared line goes by every channel; the hosts' note goes on their page only. */
export function TellDialog({
  tell,
  changes,
  onNotNow,
  onSent,
}: {
  tell: Tell;
  changes: readonly Told[];
  onNotNow: () => void;
  onSent: () => void;
}) {
  const noteId = useId();
  const hintId = useId();
  const [note, setNote] = useState('');

  return (
    <Dialog
      title={many('tellTitle', TELL.count)}
      verb={MW.send}
      dismiss={MW.notNow}
      onDismiss={onNotNow}
      onConfirm={() => {
        tell(many('queued', TELL.count));
        onSent();
      }}
    >
      <div className="mg-tell">
        <p className="mg-tell-who">{MW.tellWho}</p>
        <div>
          <p className="mg-tell-label">{MW.sentBy}</p>
          <ul className="mg-pills">
            {TELL.pills.map((pill) => (
              <li key={pill.channel}>
                <WhereGlyph where={pill.channel} size={15} />
                {channelWord(pill.channel)} · {pill.count}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mg-info">
            <Glyph name="info" size={15} weight={2.1} />
            {many('cannotBeReached', TELL.cannot)}
          </p>
          <button
            type="button"
            className="desk-text"
            onClick={() => tell(`${MW.seeWho} has its own design.`)}
          >
            {MW.seeWho}
          </button>
        </div>
        <div className="mg-tell-part">
          <p className="mg-tell-label">{MW.message}</p>
          <p className="mg-tell-box">
            {changes.map((change, index) => (
              <span key={change.item}>
                {index > 0 && <br />}
                {change.line}
              </span>
            ))}
          </p>
          <p className="mg-tell-hint">{MW.eachLanguage}</p>
          {changes.some((change) => change.venue === true) && (
            <p className="mg-tell-hint">{MW.addressAdded}</p>
          )}
        </div>
        <div className="mg-tell-part">
          <label htmlFor={noteId} className="mg-tell-label">
            {MW.addNote}
            <span className="mg-optional">{MW.optional}</span>
          </label>
          <textarea
            id={noteId}
            className="mg-tell-note"
            rows={1}
            value={note}
            aria-describedby={hintId}
            onChange={(event) => setNote(event.target.value)}
          />
          <p id={hintId} className="mg-tell-hint">
            {MW.noteHint}
          </p>
        </div>
        <p className="mg-tell-credits">
          {many('textsAndWhatsAppUse', TELL.credits)}
          <br />
          {many('balanceAfter', 1500 - TELL.credits)}
        </p>
      </div>
    </Dialog>
  );
}

export function UntoldBanner() {
  const { act, focus, tell, inbox } = useInbox();
  const [telling, setTelling] = useState(false);
  const titleId = useId();

  return (
    <section className="mg-untold" aria-labelledby={titleId}>
      <h2 id={titleId} className="mg-untold-title">
        <Glyph name="alert" size={16} weight={2.2} />
        {MW.notTold}
      </h2>
      <ul className="mg-untold-list">
        {inbox.untold.map((change) => (
          <li key={change.item}>{change.item}</li>
        ))}
      </ul>
      <div className="mg-acts">
        <button type="button" className="desk-text" onClick={() => setTelling(true)}>
          {MW.tellThem}
        </button>
        <button
          type="button"
          className="desk-text is-quiet"
          onClick={() => {
            act({ kind: 'untold', untold: [] });
            focus('title');
          }}
        >
          {MW.dismiss}
        </button>
      </div>
      {telling && (
        <TellDialog
          tell={tell}
          changes={inbox.untold}
          onNotNow={() => setTelling(false)}
          onSent={() => {
            setTelling(false);
            act({ kind: 'untold', untold: [] });
            focus('title');
          }}
        />
      )}
    </section>
  );
}

interface Item {
  key: string;
  title: string;
  line: string;
  glyph: GlyphName;
  unread: boolean;
}

/** The bell at a desk: sc-4331's batched replies, a message that missed people, and a change. */
export function MessagesBell() {
  const { act, focus, say, bell } = useInbox();
  const navigate = useNavigate();
  const [open, setOpen] = useState(bell.takeFirst);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const where = (when: string) => filled(NOTIFICATIONS.whereWhen, { event: EVENT_NAME, when });
  const items: Item[] = [
    {
      key: 'replies',
      title: filled(MW.repliesBatch, { coming: 3, notComing: 1, changed: 1 }),
      line: where(filled(NOTIFICATIONS.atTime, { time: '09:31' })),
      glyph: 'users',
      unread: !bell.read,
    },
    {
      key: 'missed',
      title: `${PARKING.subject}: ${many('didntGetIt', 11)}`,
      line: where('Mon, Nov 2'),
      glyph: 'messages',
      unread: !bell.read,
    },
    {
      key: 'changed',
      title: 'Ana Souza changed the event',
      line: where('Mon, Nov 2'),
      glyph: 'events',
      unread: false,
    },
  ];
  const unread = items.filter((item) => item.unread).length;

  useEffect(() => {
    if (!open) return;

    const keys = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
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
  }, [open]);

  function pick(key: string): void {
    setOpen(false);
    if (key === 'missed') {
      act({ kind: 'reached', of: 'parking', thread: 'parking' });
      focus('heading');
    } else if (key === 'replies') void navigate(`/demo/events/${SAMPLE_EVENT}?area=guests`);
    else void navigate(`/demo/events/${SAMPLE_EVENT}`);
  }

  return (
    <div className="mg-bell-at">
      <button
        ref={button}
        type="button"
        className="desk-bell"
        aria-label={
          unread > 0
            ? filled(NOTIFICATIONS.bellUnread_other, { count: unread })
            : NOTIFICATIONS.bell
        }
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
            <h3 id={titleId}>{NOTIFICATIONS.heading}</h3>
            <button
              type="button"
              className="desk-text"
              onClick={() => {
                bell.markRead();
                say(NOTIFICATIONS.allRead);
              }}
            >
              {NOTIFICATIONS.markAllRead}
            </button>
          </div>
          <ul className="mg-bell-items">
            {items.map((item) => (
              <li key={item.key}>
                <button type="button" className="mg-bell-item" onClick={() => pick(item.key)}>
                  <span className="mg-bell-glyph" aria-hidden="true">
                    <Glyph name={item.glyph} size={20} />
                  </span>
                  <span className="mg-bell-words">
                    <span className={item.unread ? 'mg-bell-title is-unread' : 'mg-bell-title'}>
                      {item.title}
                    </span>
                    <span className="mg-bell-line">{item.line}</span>
                    {item.unread && (
                      <span className="mg-bell-unread">
                        <span className="mg-dot" aria-hidden="true" />
                        {NOTIFICATIONS.unread}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Link className="desk-text mg-bell-settings" to="/demo/settings/notifications">
            {NOTIFICATIONS.settings}
          </Link>
        </div>
      )}
    </div>
  );
}
