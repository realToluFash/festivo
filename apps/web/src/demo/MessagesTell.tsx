import { type RefObject, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { Glyph, type GlyphName } from '../components/Glyph.tsx';
import {
  type Told,
  EVENT_NAME,
  MW,
  PARKING,
  SAMPLE_EVENT,
  changeId,
  channelWord,
  filled,
  many,
  reachedOfThread,
} from './messages.ts';
import { useInbox } from './messagesContext.ts';
import {
  type Figures,
  type Flow,
  FIGURES_MS,
  READY,
  byName,
  changeFor,
  figuresArrive,
  lineWords,
  pressSend,
  sentWords,
  sheetOf,
  titleOf,
} from './messagesTell.ts';
import { lastLooked, markLooked, repliesUnread } from './changedSince.ts';
import { CLOCKS } from './events.ts';
import { guestsAt } from './guests.ts';
import { WhereGlyph } from './MessagesParts.tsx';
import { BELL_WORDS } from './messagesWords.ts';
import { Dialog } from '../components/SettingsParts.tsx';
import type { Tell } from '../components/SettingsParts.tsx';

const NOTIFICATIONS = BELL_WORDS;

export interface Sent {
  allTold: boolean;
  note: string;
  figures: Figures;
}

/** Tell guests (sc-4330): Soirely's prepared line goes by every channel; the hosts' note goes on their page only. */
export function TellDialog({
  tell,
  changes,
  figures = null,
  flow: flowFirst = READY,
  note: noteFirst = '',
  onNotNow,
  onSent,
  before = null,
}: {
  tell: Tell;
  changes: readonly Told[];
  figures?: Figures | null;
  flow?: Flow;
  note?: string;
  onNotNow: () => void;
  onSent: (sent: Sent) => void;
  /** A change the save made beside the guests' message (sc-3780: Reply by moved with the start). */
  before?: string | null;
}) {
  const noteId = useId();
  const hintId = useId();
  const peopleId = useId();
  const [note, setNote] = useState(noteFirst);
  const [flow, setFlow] = useState(flowFirst);
  const [seeing, setSeeing] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const send = useMemo<RefObject<HTMLElement | null>>(
    () => ({
      get current() {
        return (
          body.current?.closest('.desk-dialog')?.querySelector<HTMLElement>('.desk-nav-verb') ??
          null
        );
      },
    }),
    [],
  );
  const sheet = sheetOf(changes, figures);
  const shown = flow.figures === 'shown';
  const of = sheet.figures;
  const after = of.balance - of.credits;

  useEffect(() => {
    if (flow.figures !== 'loading') return;

    const timer = window.setTimeout(() => setFlow(figuresArrive), FIGURES_MS);

    return () => window.clearTimeout(timer);
  }, [flow.figures]);

  return (
    <Dialog
      title={shown ? titleOf(sheet.figures) : MW.tellGuests}
      verb={MW.send}
      dismiss={MW.notNow}
      {...(flowFirst === READY ? {} : { first: send })}
      onDismiss={onNotNow}
      onConfirm={() => {
        const pressed = pressSend(flow);

        setFlow(pressed.flow);
        if (pressed.result === 'none') return;
        tell(pressed.result === 'allTold' ? MW.allTold : sentWords(sheet.figures));
        onSent({ allTold: pressed.result === 'allTold', note, figures: sheet.figures });
      }}
    >
      <div ref={body} className="mg-tell">
        {sheet.who != null && <p className="mg-tell-who">{sheet.who}</p>}
        <div className="mg-tell-figures" aria-busy={!shown}>
          <p className="mg-tell-label">{MW.sentBy}</p>
          {shown ? (
            <ul className="mg-pills">
              {of.pills.map((pill) => (
                <li key={pill.channel}>
                  <WhereGlyph where={pill.channel} size={15} />
                  {channelWord(pill.channel)} · {pill.count}
                </li>
              ))}
            </ul>
          ) : (
            <span className="mg-tell-shapes">
              <span className="skeleton-bar mg-tell-shape" />
              <span className="skeleton-bar mg-tell-shape" />
              <span className="skeleton-bar mg-tell-shape" />
            </span>
          )}
        </div>
        {!shown ? (
          <span className="skeleton-bar mg-tell-shape is-line" aria-hidden="true" />
        ) : (
          of.unreachable.length > 0 && (
            <div>
              <p className="mg-info">
                <Glyph name="info" size={15} weight={2.1} />
                {many('cannotBeReached', of.unreachable.length)}
              </p>
              <button
                type="button"
                className="desk-text"
                aria-expanded={seeing}
                aria-controls={peopleId}
                onClick={() => setSeeing((now) => !now)}
              >
                {MW.seeWho}
              </button>
              <ul id={peopleId} className="mg-tell-people" hidden={!seeing}>
                {byName(of.unreachable).map((person) => (
                  <li key={person.name}>
                    <span className="mg-tell-name">{person.name}</span>
                    <span className="mg-tell-hint">{person.why.join(' · ')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        )}
        {before != null && <p className="mg-tell-who">{before}</p>}
        <div className="mg-tell-part">
          <p className="mg-tell-label">{MW.message}</p>
          {sheet.parts == null ? (
            <TellBox lines={sheet.lines} />
          ) : (
            sheet.parts.map((part) => (
              <div key={part.heading} className="mg-tell-change">
                <p className="mg-tell-head">{part.heading}</p>
                <TellBox lines={part.lines} />
                <p className="mg-tell-hint">{part.who}</p>
              </div>
            ))
          )}
          {sheet.hints.map((hint) => (
            <p key={hint} className="mg-tell-hint">
              {hint}
            </p>
          ))}
        </div>
        <div className="mg-tell-part">
          <label htmlFor={noteId} className="mg-tell-label">
            {MW.noteForGuests}
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
        <div className="mg-tell-cost" aria-busy={!shown}>
          {!shown ? (
            <span className="skeleton-bar mg-tell-shape is-line" />
          ) : (
            of.credits > 0 && (
              <p className="mg-tell-credits">
                {many('textsAndWhatsAppUse', of.credits)}
                <br />
                {many('balanceAfter', after)}
              </p>
            )
          )}
          {shown && of.held != null && <p className="mg-tell-hint">{many('held', of.held)}</p>}
          {shown && of.quiet != null && (
            <p className="mg-tell-hint">{many('quiet', of.quiet.count, { time: of.quiet.time })}</p>
          )}
          {flow.line === 'early' && (
            <p key={flow.presses} className="mg-tell-hint" role="status">
              {lineWords(flow.line)}
            </p>
          )}
          {flow.line != null && flow.line !== 'early' && (
            <p key={flow.presses} className="mg-tell-hint is-wrong" role="alert">
              <Glyph name="alert" size={15} weight={2.2} />
              {lineWords(flow.line)}
            </p>
          )}
        </div>
      </div>
    </Dialog>
  );
}

/** Guests have not been told yet: on the event's Overview under the cover, and at the head of Messages' list. */
export function UntoldCard({
  items,
  onTell,
  onDismiss,
}: {
  items: readonly Told[];
  onTell: () => void;
  onDismiss: () => void;
}) {
  const titleId = useId();

  return (
    <section className="mg-untold" aria-labelledby={titleId}>
      <h2 id={titleId} className="mg-untold-title">
        <Glyph name="alert" size={16} weight={2.2} />
        {MW.notTold}
      </h2>
      <ul className="mg-untold-list">
        {items.map((change) => (
          <li key={change.item}>{change.item}</li>
        ))}
      </ul>
      <div className="mg-acts">
        <button type="button" className="desk-text" onClick={onTell}>
          {MW.tellThem}
        </button>
        <button type="button" className="desk-text is-quiet" onClick={onDismiss}>
          {MW.dismiss}
        </button>
      </div>
    </section>
  );
}

export function UntoldBanner() {
  const { act, focus, tell, inbox } = useInbox();
  const [telling, setTelling] = useState(false);

  return (
    <>
      <UntoldCard
        items={inbox.untold}
        onTell={() => setTelling(true)}
        onDismiss={() => {
          act({ kind: 'untold', untold: [] });
          tell(MW.dismissed);
          focus('title');
        }}
      />
      {telling && (
        <TellDialog
          tell={tell}
          changes={inbox.untold}
          onNotNow={() => setTelling(false)}
          onSent={(sent) => {
            setTelling(false);
            act({
              kind: 'tellSent',
              untold: [],
              out: sent.allTold
                ? null
                : changeFor(inbox.untold, sent.figures, sent.note, changeId(inbox)),
            });
            focus('title');
          }}
        />
      )}
    </>
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
  const { act, focus, say, bell, inbox } = useInbox();
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
      unread: repliesUnread(),
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
      act({ kind: 'reached', of: reachedOfThread('parking', inbox), thread: 'parking' });
      focus('heading');
    } else if (key === 'replies') {
      const since = lastLooked();

      markLooked(CLOCKS.rest);
      void navigate(
        guestsAt(SAMPLE_EVENT, { filter: 'changed', ...(since == null ? {} : { since }) }),
      );
    } else void navigate(`/demo/events/${SAMPLE_EVENT}`);
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
                markLooked(CLOCKS.rest);
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

function TellBox({ lines }: { lines: readonly string[] }) {
  return (
    <p className="mg-tell-box">
      {lines.map((line, index) => (
        <span key={line}>
          {index > 0 && <br />}
          {line}
        </span>
      ))}
    </p>
  );
}
