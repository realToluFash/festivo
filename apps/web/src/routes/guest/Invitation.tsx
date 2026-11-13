import {
  ApiError,
  type EventCover,
  GUEST_ANSWERS,
  type GuestAnswer,
  type GuestPage,
  type GuestPagePhase,
} from '@soirely/api-client';
import { formatEventClock, hostsLine } from '@soirely/domain';
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router';

import { api } from '../../api.ts';
import { Glyph } from '../../components/Glyph.tsx';
import { currentLocale, dateLocale } from '../../i18n/index.ts';
import { meshFor } from '../../mesh.ts';
import { offButton } from '../../offButton.ts';
import { useWideWidth } from '../../phoneWidth.ts';
import { InvalidInvitation } from './InvalidInvitation.tsx';
import { forgetStarted, markStarted, wasStarted } from './started.ts';

type Load =
  | { kind: 'loading' }
  | { kind: 'gone' }
  | { kind: 'unreachable' }
  | { kind: 'loaded'; page: GuestPage };

type View =
  | { kind: 'answer'; busy: GuestAnswer | null; note: 'unsent' | 'notSentTap' | null }
  | {
      kind: 'check';
      busy: boolean;
      failed: boolean;
      refused?: boolean;
      from: 'answer' | 'changing';
    }
  | { kind: 'recorded'; same: boolean }
  | { kind: 'changing'; busy: GuestAnswer | null; failed: boolean }
  | { kind: 'closed' };

type Tell =
  | { kind: 'card' }
  | { kind: 'asking'; busy: boolean; result: 'failed' | 'limited' | null }
  | { kind: 'told' };

const CHOICE = { coming: 'guest.yes', notComing: 'guest.no', maybe: 'guest.maybe' } as const;
const WORD = {
  coming: 'guest.coming',
  notComing: 'guest.notComing',
  maybe: 'guest.notSure',
} as const;
const ANSWERED = {
  coming: 'guest.answeredComing',
  notComing: 'guest.answeredNotComing',
  maybe: 'guest.answeredNotSure',
} as const;
const GREETING = {
  coming: 'guest.greetComing',
  notComing: 'guest.greetNotComing',
  maybe: 'guest.greetNotSure',
} as const;
const KEBAB = { coming: 'coming', notComing: 'not-coming', maybe: 'not-sure' } as const;

const PIECES = [1, 2, 3, 4, 5, 6, 7];

/** A page left open hears a pause, a resume or the end within a minute (sc-3591). */
const REFRESH_MS = 30_000;

const REFUSED = ['event_paused', 'event_concluded'] as const;

function ended(phase: GuestPagePhase): boolean {
  return phase === 'calledOff' || phase === 'finished';
}

function standing(page: GuestPage): string {
  return `${page.phase}:${String(page.started)}:${String(page.answersOpen)}`;
}

/** The control that had focus before an update, so focus can follow it or fall to the h1 (sc-3591). */
function focused(): { on: string | null; was: Element } | null {
  const was = document.activeElement;
  if (was == null || was.closest('.gp-columns') == null) return null;

  return { on: was.getAttribute('data-focus'), was };
}

/** The guest's own page in A · The cover card (sc-1526). Opening it records nothing; only an answer sent does (sc-1439). */
export function Invitation() {
  const { t } = useTranslation();
  const token = useOutletContext<string>();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let current = true;

    api.guestPage(token).then(
      (page) => current && setLoad({ kind: 'loaded', page }),
      (error: unknown) => {
        if (!current) return;
        setRetrying(false);
        setLoad(
          error instanceof ApiError && error.status === 404
            ? { kind: 'gone' }
            : { kind: 'unreachable' },
        );
      },
    );

    return () => {
      current = false;
    };
  }, [token, attempt]);

  if (load.kind === 'gone') return <InvalidInvitation />;

  if (load.kind === 'unreachable') {
    return (
      <div className="gp-alone-wrap">
        <div className="gp-alone">
          <span className="gp-alone-mark" aria-hidden="true">
            <Glyph name="alert" size={26} />
          </span>
          <h1 className="gp-alone-title">{t('session.unreachableTitle')}</h1>
          <p>{t('session.unreachableBodySignedOut')}</p>
          <button
            className="gp-filled is-narrow"
            type="button"
            aria-busy={retrying}
            {...offButton(retrying, { dim: false })}
            onClick={() => {
              setRetrying(true);
              setAttempt((n) => n + 1);
            }}
          >
            {retrying && <span className="gp-spinner" aria-hidden="true" />}
            {retrying ? t('session.retrying') : t('error.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (load.kind === 'loading') {
    return (
      <div className="gp-columns" aria-busy="true">
        <p className="visually-hidden" role="status">
          {t('pending.loading')}
        </p>
        <span className="gp-waiting" aria-hidden="true" />
      </div>
    );
  }

  return <Card token={token} first={load.page} />;
}

function opening(page: GuestPage, token: string): View {
  if (!page.answersOpen) return { kind: 'closed' };
  if (page.guest.reply != null) {
    forgetStarted(token);
    return { kind: 'recorded', same: false };
  }

  return { kind: 'answer', busy: null, note: wasStarted(token) ? 'unsent' : null };
}

function Card({ token, first }: { token: string; first: GuestPage }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(first);
  const [view, setView] = useState<View>(() => opening(first, token));
  const [tell, setTell] = useState<Tell>({ kind: 'card' });
  const [want, setWant] = useState<{ on: string } | null>(null);
  const [gone, setGone] = useState(false);
  const [held, setHeld] = useState<ReturnType<typeof focused>>(null);
  const seen = useRef(standing(first));
  const sends = useRef(0);
  const wide = useWideWidth();
  const { guest, event } = page;
  const hosts = hostsLine(event.hosts, currentLocale());
  const count = Math.max(event.hosts.length, 1);

  useEffect(() => {
    if (want == null) return;
    document.querySelector<HTMLElement>(`.gp [data-focus="${want.on}"]`)?.focus();
  }, [want]);

  useEffect(() => {
    if (held == null || held.was.isConnected) return;
    const same =
      held.on == null ? null : document.querySelector<HTMLElement>(`.gp [data-focus="${held.on}"]`);
    (same ?? document.querySelector<HTMLElement>('.gp [data-focus="h1"]'))?.focus();
  }, [held]);

  const focus = (on: string) => setWant({ on });

  function refreshed(next: GuestPage): void {
    const had = focused();
    setPage(next);
    if (standing(next) === seen.current) return;

    seen.current = standing(next);
    setView(opening(next, token));
    setHeld(had);
  }

  useEffect(() => {
    const timer = setInterval(() => {
      const asked = sends.current;
      api.guestPage(token).then(
        (next) => {
          if (asked === sends.current) refreshed(next);
        },
        (error: unknown) => {
          if (error instanceof ApiError && error.status === 404) setGone(true);
        },
      );
    }, REFRESH_MS);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshed reads only setters and refs
  }, [token]);

  function send(answer: GuestAnswer, onFail: () => void): void {
    sends.current += 1;
    api.sendGuestAnswer(token, answer).then(
      (next) => {
        forgetStarted(token);
        const same =
          page.guest.reply?.answer === answer && next.guest.reply?.at === page.guest.reply.at;
        setPage(next);
        setView({ kind: 'recorded', same });
        focus('greeting');
      },
      (error: unknown) => {
        if (error instanceof ApiError && REFUSED.some((code) => error.is(code))) {
          refuse();
        } else if (error instanceof ApiError && error.is('replies_closed')) {
          setPage((was) => ({ ...was, answersOpen: false }));
          setView({ kind: 'closed' });
          focus('closedHead');
        } else if (error instanceof ApiError && error.status === 404) setGone(true);
        else onFail();
      },
    );
  }

  /** Paused or over while sending: Check and send stays with what was chosen; a one-tap answer gives way to the page as it now stands. */
  function refuse(): void {
    const had = focused();
    const checking = view.kind === 'check';
    api.guestPage(token).then(
      (next) => {
        seen.current = standing(next);
        setPage(next);
        if (checking) {
          setView({ kind: 'check', busy: false, failed: false, refused: true, from: 'answer' });
          focus('checkHead');
        } else {
          setView(opening(next, token));
          setHeld(had);
        }
      },
      (error: unknown) => {
        if (error instanceof ApiError && error.status === 404) setGone(true);
        else setView({ kind: 'closed' });
      },
    );
  }

  function choose(answer: GuestAnswer): void {
    if (view.kind !== 'answer' && view.kind !== 'changing') return;
    if (view.busy != null) return;
    const from = view.kind;

    if (answer === 'coming') {
      if (from === 'answer') markStarted(token);
      setView({ kind: 'check', busy: false, failed: false, from });
      focus('checkHead');
      return;
    }

    setView(
      from === 'answer'
        ? { kind: 'answer', busy: answer, note: null }
        : { kind: 'changing', busy: answer, failed: false },
    );
    send(answer, () => {
      setView(
        from === 'answer'
          ? { kind: 'answer', busy: null, note: 'notSentTap' }
          : { kind: 'changing', busy: null, failed: true },
      );
      focus(`row-${answer}`);
    });
  }

  function sendComing(): void {
    if (view.kind !== 'check' || view.busy) return;
    setView({ ...view, busy: true, failed: false });
    send('coming', () => {
      setView({ ...view, busy: false, failed: true });
      focus('send');
    });
  }

  function back(): void {
    if (view.kind !== 'check') return;
    setView(
      view.from === 'changing'
        ? { kind: 'changing', busy: null, failed: false }
        : { kind: 'answer', busy: null, note: null },
    );
    focus('row-coming');
  }

  function tellThem(): void {
    setTell({ kind: 'asking', busy: true, result: null });
    api.tellWrongPerson(token).then(
      () => {
        setTell({ kind: 'told' });
        focus('thanks');
      },
      (error: unknown) =>
        setTell({
          kind: 'asking',
          busy: false,
          result: error instanceof ApiError && error.is('too_many_attempts') ? 'limited' : 'failed',
        }),
    );
  }

  if (gone) return <InvalidInvitation />;

  const alone = tell.kind !== 'card' || view.kind === 'check';
  const tagged = guest.reply != null && view.kind !== 'check';

  return (
    <div className="gp-columns">
      {!wide && <PhaseNotice phase={page.phase} />}
      <Cover page={page} tagged={tagged && !ended(page.phase)} />
      <div className="gp-under">
        {wide && <PhaseNotice phase={page.phase} />}
        {tell.kind === 'card' && (
          <Shown
            view={view}
            page={page}
            onChoose={choose}
            onSend={sendComing}
            onBack={back}
            onChange={() => {
              setView({ kind: 'changing', busy: null, failed: false });
              focus('newHead');
            }}
            onKeep={() => {
              setView({ kind: 'recorded', same: false });
              focus('change');
            }}
          />
        )}
        {tell.kind === 'asking' && (
          <section className="gp-tell" aria-labelledby="gp-tell-h">
            <h2 id="gp-tell-h" className="gp-h2" tabIndex={-1} data-focus="tellHead">
              {t('guest.tellQuestion', { hosts })}
            </h2>
            <p className="gp-sub">{t('guest.tellLine', { name: guest.fullName, count })}</p>
            {tell.result === 'failed' && <Notice kind="broken">{t('guest.tellFailed')}</Notice>}
            {tell.result === 'limited' && (
              <Notice kind="attention" alert>
                {t('guest.tellLimited')}
              </Notice>
            )}
            <Filled busy={tell.busy} onClick={tellThem}>
              {t('guest.tellThem')}
            </Filled>
            <button
              className="gp-outlined"
              type="button"
              onClick={() => {
                setTell({ kind: 'card' });
                focus('tell');
              }}
            >
              {t('guest.goBack')}
            </button>
          </section>
        )}
        {tell.kind === 'told' && (
          <div className="gp-told" role="status" aria-live="polite">
            <span className="gp-mark is-coming" aria-hidden="true">
              <Glyph name="tick" size={17} weight={3} />
            </span>
            <p tabIndex={-1} data-focus="thanks">
              {t('guest.tellThanks', { hosts, count })}
            </p>
          </div>
        )}
        {!alone && (
          <div className="gp-foot">
            <p>{t('guest.noAccountNeeded')}</p>
            <hr />
            <p>{t('guest.closing')}</p>
            <button
              className="gp-text"
              type="button"
              data-focus="tell"
              onClick={() => {
                setTell({ kind: 'asking', busy: false, result: null });
                focus('tellHead');
              }}
            >
              <span>{t('guest.tell', { name: guest.fullName })}</span>
            </button>
          </div>
        )}
      </div>
      {!alone && <Details page={page} hosts={hosts} />}
    </div>
  );
}

function Shown({
  view,
  page,
  onChoose,
  onSend,
  onBack,
  onChange,
  onKeep,
}: {
  view: View;
  page: GuestPage;
  onChoose: (answer: GuestAnswer) => void;
  onSend: () => void;
  onBack: () => void;
  onChange: () => void;
  onKeep: () => void;
}) {
  const { t } = useTranslation();
  const { reply, fullName, companions } = page.guest;
  const day = reply == null ? '' : dayOf(reply.at, page.event.timeZone);

  switch (view.kind) {
    case 'answer':
      return (
        <section className="gp-ask" aria-labelledby="gp-answer-h">
          <h2 id="gp-answer-h" className="gp-h2">
            {t('guest.yourAnswer')}
          </h2>
          {view.note === 'unsent' && <Notice kind="attention">{t('guest.unsent')}</Notice>}
          {view.note === 'notSentTap' && <Notice kind="broken">{t('guest.notSentTap')}</Notice>}
          <AnswerRows busy={view.busy} onChoose={onChoose} />
        </section>
      );
    case 'check':
      return (
        <section className="gp-check" aria-labelledby="gp-check-h">
          {view.refused === true ? (
            <Notice kind="broken">{t('guest.refused')}</Notice>
          ) : (
            <TextAction ink icon={<Glyph name="back" size={18} weight={2.2} />} onClick={onBack}>
              {t('guest.back')}
            </TextAction>
          )}
          <h2 id="gp-check-h" className="gp-h2 is-24" tabIndex={-1} data-focus="checkHead">
            {t('guest.check')}
          </h2>
          <div className="gp-row gp-check-row">
            <span className="gp-lead">
              <Mark answer="coming" />
            </span>
            <span className="gp-answer-words">
              {t('guest.answerLine', { answer: t(WORD.coming) })}
            </span>
            {view.refused !== true && (
              <TextAction onClick={onBack}>{t('guest.changeShort')}</TextAction>
            )}
          </div>
          {view.failed && <Notice kind="broken">{t('guest.notSent')}</Notice>}
          {view.refused !== true && (
            <>
              <Filled busy={view.busy} focus="send" onClick={onSend}>
                {t('guest.send')}
              </Filled>
              <p className="gp-small">{t('guest.nothingSent')}</p>
            </>
          )}
        </section>
      );
    case 'recorded':
      if (reply == null) return null;

      return (
        <section className="gp-recorded" aria-labelledby="gp-greeting">
          <div className="gp-greet">
            <Mark answer={reply.answer} />
            <h2 id="gp-greeting" className="gp-h2" tabIndex={-1} data-focus="greeting">
              {t(GREETING[reply.answer], { name: fullName })}
            </h2>
          </div>
          <div className="gp-indent">
            <p className="gp-sub">{t(ANSWERED[reply.answer], { date: day })}</p>
            {view.same && (
              <p className="gp-sub is-ink">{t('guest.same', { answer: t(WORD[reply.answer]) })}</p>
            )}
            {companions > 0 && reply.answer === 'notComing' && (
              <p className="gp-sub">{t('guest.companionsNotComing')}</p>
            )}
            {companions > 0 && reply.answer === 'maybe' && (
              <p className="gp-sub">{t('guest.companionsOnHold')}</p>
            )}
            <TextAction focus="change" onClick={onChange}>
              {t('guest.change')}
            </TextAction>
          </div>
        </section>
      );
    case 'changing':
      return (
        <section className="gp-changing" aria-labelledby="gp-new-h">
          {reply != null && <p className="gp-sub">{t(ANSWERED[reply.answer], { date: day })}</p>}
          <h2 id="gp-new-h" className="gp-h2" tabIndex={-1} data-focus="newHead">
            {t('guest.newAnswer')}
          </h2>
          {view.failed && <Notice kind="broken">{t('guest.notSentTap')}</Notice>}
          <AnswerRows current={reply?.answer ?? null} busy={view.busy} onChoose={onChoose} />
          <TextAction focus="keep" onClick={onKeep}>
            {t('guest.keep')}
          </TextAction>
        </section>
      );
    case 'closed': {
      const said =
        reply == null ? t('guest.didNotAnswer') : t(ANSWERED[reply.answer], { date: day });

      if (page.phase === 'calledOff') return null;
      if (page.phase === 'finished') {
        return (
          <div className="gp-ended">
            <p className="gp-sub">{said}</p>
          </div>
        );
      }

      return (
        <section className="gp-closed" aria-labelledby="gp-closed-h">
          <h2 id="gp-closed-h" className="gp-h2 is-19" tabIndex={-1} data-focus="closedHead">
            {said}
          </h2>
          {page.phase === 'live' && <p className="gp-sub">{t('guest.closed')}</p>}
          {page.phase === 'paused' && !page.started && (
            <>
              <TextAction off focus="change" describedBy="gp-reason">
                {t('guest.change')}
              </TextAction>
              <p id="gp-reason" className="gp-sub">
                {t('guest.pausedReason')}
              </p>
            </>
          )}
        </section>
      );
    }
  }
}

/** The three answers, full-width rows of 56: Yes leads on to Check and send; the other two record in one tap. */
function AnswerRows({
  current = null,
  busy,
  onChoose,
}: {
  current?: GuestAnswer | null;
  busy: GuestAnswer | null;
  onChoose: (answer: GuestAnswer) => void;
}) {
  const { t } = useTranslation();
  const changing = current != null;

  return (
    <div className="gp-answers">
      {GUEST_ANSWERS.map((answer) => (
        <button
          key={answer}
          className={`gp-answer${current === answer ? ' is-lit' : ''}`}
          type="button"
          data-focus={`row-${answer}`}
          aria-pressed={changing ? current === answer : undefined}
          aria-busy={busy === answer || undefined}
          {...offButton(busy != null, { dim: false })}
          onClick={() => onChoose(answer)}
        >
          <span className="gp-lead">
            {busy === answer ? (
              <span className="gp-spin" aria-hidden="true" />
            ) : (
              <Mark answer={answer} />
            )}
          </span>
          <span className="gp-answer-words">{t(CHOICE[answer])}</span>
          {current === answer ? (
            <span className="gp-now">
              <Glyph name="tick" size={14} weight={3} />
              {t('guest.answerNow')}
            </span>
          ) : (
            answer === 'coming' && (
              <span className="gp-chev" aria-hidden="true">
                <Glyph name="chevron" size={18} weight={2.2} />
              </span>
            )
          )}
        </button>
      ))}
    </div>
  );
}

/** The answer's mark (replyStates): a tick on a disc, a bar on a grey disc, a question in a ring; beside its words, so hidden. */
function Mark({
  answer,
  size = 28,
  cover = false,
}: {
  answer: GuestAnswer;
  size?: 20 | 28;
  cover?: boolean;
}) {
  return (
    <span
      className={`gp-mark is-${KEBAB[answer]} is-${size}${cover ? ' on-cover' : ''}`}
      aria-hidden="true"
    >
      {answer === 'coming' && <Glyph name="tick" size={Math.round(size * 0.6)} weight={3} />}
      {answer === 'notComing' && <span className="gp-bar" />}
      {answer === 'maybe' && '?'}
    </span>
  );
}

function TextAction({
  children,
  off = false,
  ink = false,
  icon,
  focus,
  describedBy,
  onClick,
}: {
  children: ReactNode;
  off?: boolean;
  ink?: boolean;
  icon?: ReactNode;
  focus?: string;
  describedBy?: string;
  onClick?: () => void;
}) {
  return (
    <button
      className={`gp-text${ink ? ' is-ink' : ''}${off ? ' is-off' : ''}`}
      type="button"
      data-focus={focus}
      aria-describedby={describedBy}
      {...offButton(off, { dim: false })}
      onClick={onClick}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

function Filled({
  children,
  busy,
  focus,
  onClick,
}: {
  children: ReactNode;
  busy: boolean;
  focus?: string;
  onClick: () => void;
}) {
  return (
    <button
      className="gp-filled"
      type="button"
      data-focus={focus}
      aria-busy={busy}
      {...offButton(busy, { dim: false })}
      onClick={onClick}
    >
      {busy && <span className="gp-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

/** One notice at the top, a status region, told apart by its chip's shape as well as its colour (WCAG 2.2 §1.4.1, §4.1.3). */
function PhaseNotice({ phase }: { phase: GuestPagePhase }) {
  const { t } = useTranslation();
  if (phase === 'live') return null;

  const paused = phase === 'paused';
  const chip = paused
    ? t('events.paused')
    : phase === 'calledOff'
      ? t('events.calledOff')
      : t('events.finished');
  const sentence = paused
    ? t('guest.pausedNotice')
    : phase === 'calledOff'
      ? t('guest.calledOffNotice')
      : t('guest.finishedNotice');

  return (
    <div className="gp-phase" role="status" aria-live="polite" aria-atomic="true">
      <span className={`gp-chip is-${paused ? 'paused' : 'ended'}`}>
        <span className="gp-chip-mark" aria-hidden="true">
          {paused ? (
            <>
              <span />
              <span />
            </>
          ) : (
            <Glyph name="tick" size={9} weight={3.2} />
          )}
        </span>
        {chip}
      </span>
      <p>{sentence}</p>
    </div>
  );
}

function Notice({
  kind,
  alert = kind === 'broken',
  children,
}: {
  kind: 'broken' | 'attention';
  alert?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`gp-notice is-${kind}`} role={alert ? 'alert' : 'status'}>
      <span className="gp-notice-mark" aria-hidden="true">
        {kind === 'broken' && <Glyph name="clear" size={14} weight={3} />}
      </span>
      <p>{children}</p>
    </div>
  );
}

function readerZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

function format(at: string, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(dateLocale(), { timeZone, ...options }).format(new Date(at));
}

/** The day an answer was given, in the event's zone, written for the reader's locale. */
function dayOf(at: string, timeZone: string): string {
  return format(at, timeZone, { weekday: 'long', month: 'long', day: 'numeric' });
}

/** The start's time in the event's zone, naming the zone when the reader's browser is in another. */
function useWhen(event: GuestPage['event']): string {
  const { t } = useTranslation();
  const time = formatEventClock(event.startsAt, event.timeZone, dateLocale());

  return readerZone() === event.timeZone
    ? time
    : t('calendar.timeInZone', { time, timeZone: event.timeZone });
}

/** When, where and who, as Events A writes them. */
function Details({ page, hosts }: { page: GuestPage; hosts: string }) {
  const { t } = useTranslation();
  const { event } = page;
  const when = useWhen(event);
  const name = event.venue?.name ?? null;
  const address = event.venue?.address ?? null;
  const where = name != null || address != null;
  const named = event.hosts.length > 0 && page.phase !== 'calledOff';

  return (
    <div className="gp-details">
      <Row
        lead={<Glyph name="calendar" size={22} />}
        title={format(event.startsAt, event.timeZone, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })}
        line={when}
      />
      {where && (
        <div className={named ? 'gp-where has-rule' : 'gp-where'}>
          <Row
            lead={<Glyph name="pin" size={22} />}
            title={name ?? address}
            line={name == null ? null : address}
          />
          {address != null && (
            <a
              className="gp-text gp-maps"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Glyph name="map" weight={2.2} />
              <span>{t('eventPage.openInMaps')}</span>
            </a>
          )}
        </div>
      )}
      {named && (
        <Row lead={<Glyph name="users" size={22} />} title={hosts} line={t('eventHosts.heading')} />
      )}
    </div>
  );
}

function Row({ lead, title, line }: { lead: ReactNode; title: ReactNode; line?: ReactNode }) {
  return (
    <div className="gp-row">
      <span className="gp-lead">{lead}</span>
      <span className="gp-row-words">
        <span className="gp-row-title">{title}</span>
        {line != null && <span className="gp-row-line">{line}</span>}
      </span>
    </div>
  );
}

/** The cover the event's page shows: the organiser's photo, or its colour from meshFor, under the scrim; the answer as a tag once given. */
function Cover({ page, tagged }: { page: GuestPage; tagged: boolean }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const { event, guest } = page;
  const over = ended(page.phase);
  const photo = event.cover != null && !failed ? event.cover : null;
  const when = useWhen(event);
  const line = [
    format(event.startsAt, event.timeZone, { weekday: 'short', month: 'short', day: 'numeric' }),
    when,
    event.venue?.name,
  ]
    .filter((part) => part != null)
    .join(' · ');

  return (
    <section
      className={`gp-cover ev-card today-cover ${photo == null ? `is-${meshFor(event.id)}` : 'is-photo'}${page.phase === 'calledOff' ? ' is-grey' : ''}`}
      aria-labelledby="gp-h1"
    >
      {photo != null && <Photo cover={photo} onFail={() => setFailed(true)} />}
      <span className="ev-scrim" aria-hidden="true" />
      {photo == null &&
        PIECES.map((piece) => (
          <span key={piece} className={`gp-piece p${piece}`} aria-hidden="true" />
        ))}
      <div className={tagged ? 'gp-cover-inner has-tag' : 'gp-cover-inner'}>
        {tagged && guest.reply != null && (
          <p className="gp-tag">
            <Mark answer={guest.reply.answer} size={20} cover />
            {t(WORD[guest.reply.answer])}
          </p>
        )}
        {over ? (
          <h1 id="gp-h1" className="gp-cover-name" tabIndex={-1} data-focus="h1">
            {event.name}
          </h1>
        ) : (
          <>
            <h1 id="gp-h1" className="gp-cover-h1" tabIndex={-1} data-focus="h1">
              {t('guest.invitationTitle')}
            </h1>
            <p className="gp-cover-guest">{guest.fullName}</p>
            <p className="gp-cover-name">{event.name}</p>
          </>
        )}
        <p className="gp-cover-line">{line}</p>
      </div>
    </section>
  );
}

/** Its description is its text alternative; one without is decorative (WCAG 2.2 §1.1.1). */
function Photo({ cover, onFail }: { cover: EventCover; onFail: () => void }) {
  const image = useRef<HTMLImageElement>(null);
  const { position } = cover;

  // Through the CSSOM: the CSP has no 'unsafe-inline', which governs a style attribute too.
  useLayoutEffect(() => {
    if (image.current != null) image.current.style.objectPosition = `50% ${position}%`;
  }, [position]);

  return (
    <img
      ref={image}
      className="ev-photo"
      src={cover.sizes[0]?.url}
      srcSet={
        cover.sizes.length > 1
          ? cover.sizes.map(({ width, url }) => `${url} ${width}w`).join(', ')
          : undefined
      }
      sizes={cover.sizes.length > 1 ? '(min-width: 64rem) 560px, 100vw' : undefined}
      alt={cover.description ?? ''}
      draggable={false}
      onError={onFail}
    />
  );
}
