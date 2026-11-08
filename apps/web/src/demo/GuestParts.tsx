import { type KeyboardEvent, type ReactNode, useEffect, useRef } from 'react';

import { offButton } from '../offButton.ts';
import { Glyph } from '../components/Glyph.tsx';
import {
  ANSWERS,
  type Answer,
  EVENT,
  GUEST,
  LANGUAGES,
  type Lang,
  MESSAGES,
  MESSAGE_COUNT_FROM,
  MESSAGE_MOST,
  type Mine,
  THANK_YOU,
  type Visit,
  type Words,
  characters,
  eventDay,
  eventTime,
  mapsLink,
  sentWhen,
  shortDay,
  codePath,
} from './guest.ts';

const LINES = {
  map: [
    'M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z',
    'M15 5.764v15',
    'M9 3.236v15',
  ],
  out: ['M15 3h6v6', 'M10 14 21 3', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'],
  broken: [
    'm18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71',
    'm5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71',
    'M8 2v3',
    'M2 8h3',
    'M16 22v-3',
    'M22 16h-3',
  ],
  pencil: [
    'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z',
  ],
  send: ['M12 19V5', 'm5 12 7-7 7 7'],
} as const;

/** The boards' strokes Today's set lacks, drawn the same way: beside words, so hidden. */
export function Line({
  name,
  size,
  weight = 2,
}: {
  name: keyof typeof LINES;
  size: number;
  weight?: number;
}) {
  return (
    <svg
      className="gp-line"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      strokeWidth={weight}
    >
      {LINES[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export function Spinner({ size, on = 'card' }: { size: number; on?: 'card' | 'fill' }) {
  return <span className={`gp-spin is-${on} is-${size}`} aria-hidden="true" />;
}

const KEBAB: Record<Answer, string> = {
  coming: 'coming',
  notComing: 'not-coming',
  notSure: 'not-sure',
};

/** The answer's mark (replyStates): a tick on a disc, a bar on a grey disc, a question in a ring. */
export function Mark({
  answer,
  size = 28,
  cover = false,
}: {
  answer: Answer;
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
      {answer === 'notSure' && '?'}
    </span>
  );
}

const PIECES = [1, 2, 3, 4, 5, 6, 7];

export function Cover({ visit, words, ended }: { visit: Visit; words: Words; ended: boolean }) {
  const tagged = visit.recorded != null && !ended && visit.view.kind !== 'check';
  const shown = visit.recorded?.answer;
  const zoned = visit.readerZone !== EVENT.timeZone;
  const time = eventTime(visit.lang);
  const day = shortDay(EVENT.startsAt, visit.lang, EVENT.timeZone);
  const when = zoned ? words.timeInZone(time, EVENT.timeZone) : time;
  const look = visit.photo ? 'is-photo' : `today-cover is-${EVENT.mesh}`;

  return (
    <section
      className={`gp-cover gp-left ev-card ${look}${visit.phase === 'calledOff' ? ' is-grey' : ''}`}
      aria-labelledby="gp-h1"
    >
      <span className="ev-scrim" aria-hidden="true" />
      {visit.photo ? (
        <span className="ev-card-photo" aria-hidden="true">
          <Glyph name="photo" size={64} weight={1.6} />
        </span>
      ) : (
        PIECES.map((piece) => (
          <span key={piece} className={`gp-piece p${piece}`} aria-hidden="true" />
        ))
      )}
      <div className={tagged ? 'gp-cover-inner has-tag' : 'gp-cover-inner'}>
        {tagged && shown != null && (
          <p className="gp-tag">
            <Mark answer={shown} size={20} cover />
            {words.answerWord(shown)}
          </p>
        )}
        {ended ? (
          <h1 id="gp-h1" className="gp-cover-name" tabIndex={-1} data-focus="h1">
            {EVENT.name}
          </h1>
        ) : (
          <>
            <h1 id="gp-h1" className="gp-cover-h1" tabIndex={-1} data-focus="h1">
              {words.invited}
            </h1>
            <p className="gp-cover-guest">{GUEST}</p>
            <p className="gp-cover-name">{EVENT.name}</p>
          </>
        )}
        <p className="gp-cover-line">{`${day} · ${when} · ${EVENT.venue?.name ?? ''}`}</p>
      </div>
    </section>
  );
}

export function TextAction({
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

export function Filled({
  children,
  busy = false,
  focus,
  narrow = false,
  onClick,
}: {
  children: ReactNode;
  busy?: boolean;
  focus?: string;
  narrow?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`gp-filled${narrow ? ' is-narrow' : ''}`}
      type="button"
      data-focus={focus}
      aria-busy={busy}
      {...offButton(busy, { dim: false })}
      onClick={onClick}
    >
      {busy && <Spinner size={16} on="fill" />}
      {children}
    </button>
  );
}

export function Notice({
  kind,
  alert = kind === 'broken',
  action,
  children,
}: {
  kind: 'broken' | 'attention';
  alert?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`gp-notice is-${kind}`} role={alert ? 'alert' : 'status'}>
      <span className="gp-notice-mark" aria-hidden="true">
        {kind === 'broken' && <Glyph name="clear" size={14} weight={3} />}
      </span>
      {action == null ? (
        <p>{children}</p>
      ) : (
        <div className="gp-unsaved-words">
          <p>{children}</p>
          {action}
        </div>
      )}
    </div>
  );
}

/** sc-3790: the page switched, but the guest's record did not take the choice; said once, in the new language, with Try again. */
export function LanguageUnsaved({
  words,
  busy,
  onRetry,
}: {
  words: Words;
  busy: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="gp-notice is-attention gp-unsaved" role="alert">
      <span className="gp-notice-mark" aria-hidden="true" />
      <div className="gp-unsaved-words">
        <p>{words.notSaved}</p>
        <TextAction off={busy} focus="saveAgain" onClick={onRetry}>
          {busy ? words.retrying : words.retry}
        </TextAction>
      </div>
    </div>
  );
}

/** sc-3591: one notice, a polite status region with its chip and its sentence. */
export function PhaseNotice({ phase, words }: { phase: Visit['phase']; words: Words }) {
  if (phase === 'live') return null;

  const paused = phase === 'paused';
  const chip = paused ? words.paused : phase === 'calledOff' ? words.calledOff : words.finished;
  const sentence = paused
    ? words.pausedNotice
    : phase === 'calledOff'
      ? words.calledOffNotice
      : words.finishedNotice;

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

/** The three answers, full-width rows of 56: Yes leads on; the other two record in one tap. */
export function AnswerRows({
  words,
  current = null,
  busy = null,
  onAnswer,
}: {
  words: Words;
  current?: Answer | null;
  busy?: Answer | null;
  onAnswer: (answer: Answer) => void;
}) {
  const changing = current != null;

  return (
    <div className="gp-answers">
      {ANSWERS.map((answer) => (
        <button
          key={answer}
          className={`gp-answer${current === answer ? ' is-lit' : ''}`}
          type="button"
          data-focus={`row-${answer}`}
          aria-pressed={changing ? current === answer : undefined}
          aria-busy={busy === answer || undefined}
          {...offButton(busy != null, { dim: false })}
          onClick={() => onAnswer(answer)}
        >
          <span className="gp-lead">
            {busy === answer ? <Spinner size={20} /> : <Mark answer={answer} />}
          </span>
          <span className="gp-answer-words">{words.choice(answer)}</span>
          {current === answer ? (
            <span className="gp-now">
              <Glyph name="tick" size={14} weight={3} />
              {words.answerNow}
            </span>
          ) : (
            answer === 'coming' && (
              <span className="gp-chev">
                <Glyph name="chevron" size={18} weight={2.2} />
              </span>
            )
          )}
        </button>
      ))}
    </div>
  );
}

function Row({ lead, title, line }: { lead: ReactNode; title: ReactNode; line: ReactNode }) {
  return (
    <div className="gp-row">
      <span className="gp-lead">{lead}</span>
      <span className="gp-row-words">
        <span className="gp-row-title">{title}</span>
        <span className="gp-row-line">{line}</span>
      </span>
    </div>
  );
}

/** When, where and who, as Events A writes them: the value as the title, the label as its line. */
export function Details({ visit, words, hosts }: { visit: Visit; words: Words; hosts: boolean }) {
  const time = eventTime(visit.lang);
  const zoned = visit.readerZone !== EVENT.timeZone;

  return (
    <div className="gp-details gp-left-after">
      <Row
        lead={<Glyph name="calendar" size={22} />}
        title={eventDay(visit.lang)}
        line={zoned ? words.timeInZone(time, EVENT.timeZone) : time}
      />
      <div className={hosts ? 'gp-where has-rule' : 'gp-where'}>
        <Row
          lead={<Glyph name="pin" size={22} />}
          title={EVENT.venue?.name}
          line={EVENT.venue?.address}
        />
        <a className="gp-text gp-maps" href={mapsLink()} target="_blank" rel="noopener noreferrer">
          <Line name="map" size={18} weight={2.2} />
          <span>{words.openInMaps}</span>
        </a>
      </div>
      {hosts && (
        <Row lead={<Glyph name="users" size={22} />} title={words.hosts} line={words.hostedBy} />
      )}
    </div>
  );
}

export function Foot({ words, onTell }: { words: Words; onTell: () => void }) {
  return (
    <div className="gp-foot">
      <p>{words.noAccount}</p>
      <hr />
      <p>{words.closing}</p>
      <TextAction focus="tell" onClick={onTell}>
        {words.tell}
      </TextAction>
    </div>
  );
}

const CODE = codePath();

export function DoorCode({ words, companions }: { words: Words; companions: number }) {
  return (
    <section className="gp-block" aria-labelledby="gp-door">
      <h2 id="gp-door" className="gp-h2 is-19">
        {words.doorTitle}
      </h2>
      <p className="gp-sub">{words.doorLine(companions)}</p>
      <div className="gp-code">
        <svg role="img" aria-label={words.doorCode} width="196" height="196" viewBox="0 0 29 29">
          <path d={CODE} />
        </svg>
      </div>
    </section>
  );
}

export function AddToCalendar({ words }: { words: Words }) {
  const row = (name: string) => (
    <a className="gp-row gp-cal" href="/demo/later?screen=calendar" target="_blank" rel="noopener">
      <span className="gp-lead">
        <Glyph name="calendar" size={22} />
      </span>
      <span className="gp-row-title">{name}</span>
      <span className="gp-out">
        <Line name="out" size={18} />
      </span>
    </a>
  );

  return (
    <section className="gp-block" aria-labelledby="gp-calendar">
      <h2 id="gp-calendar" className="gp-h2 is-19">
        {words.calendarTitle}
      </h2>
      <p className="gp-sub">{words.calendarLine}</p>
      <div className="gp-cal-rows">
        {row(words.calendarApple)}
        {row(words.calendarGoogle)}
      </div>
    </section>
  );
}

/** sc-6476: the hosts' own words, never translated or linked, signed with their names, outside the notice. */
export function Thanks({ words }: { words: Words }) {
  return (
    <figure className="gp-thanks">
      <blockquote dir="auto">{THANK_YOU}</blockquote>
      <figcaption>{words.hosts}</figcaption>
    </figure>
  );
}

export function Messages({
  visit,
  words,
  onDraft,
  onSend,
}: {
  visit: Visit;
  words: Words;
  onDraft: (words: string) => void;
  onSend: () => void;
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  const shown = MESSAGES.slice(-visit.messages);
  const live = visit.draft.trim() !== '';
  const length = characters(visit.draft);
  const tooLong = visit.draftTried && length > MESSAGE_MOST;
  const counting = length >= MESSAGE_COUNT_FROM;

  useEffect(() => {
    const field = box.current;
    if (field == null) return;
    field.style.height = 'auto';
    field.style.height = `${Math.max(48, field.scrollHeight)}px`;
  }, [visit.draft]);

  useEffect(() => {
    const field = box.current;
    const toCaret = () => {
      if (field != null) field.scrollTop = field.scrollHeight;
    };
    toCaret();
    void document.fonts.ready.then(toCaret);
  }, []);

  return (
    <section id="messages" className="gp-messages" aria-labelledby="gp-messages-h">
      <h2 id="gp-messages-h" className="gp-h2">
        {words.messages}
      </h2>
      {shown.map((message) => (
        <article key={message.id} id={message.id} className="gp-message">
          <p className="gp-meta">
            {`${words.hosts} · ${sentWhen(message.at, visit.lang, visit.readerZone)}`}
          </p>
          <p className="gp-bubble" dir="auto">
            {message.words}
          </p>
        </article>
      ))}
      {visit.mine.map((mine: Mine, index) => (
        <article key={index} className="gp-message is-mine">
          <p className="gp-bubble" dir="auto">
            {mine.words}
          </p>
          <p className="gp-meta" role="status" aria-live="polite">
            {mine.sent ? (
              <>
                <Glyph name="tick" size={13} weight={3} className="gp-sent" />
                {`${words.sent} · ${sentWhen(mine.at, visit.lang, visit.readerZone)}`}
              </>
            ) : (
              <>
                <Spinner size={13} />
                {words.sending}
              </>
            )}
          </p>
        </article>
      ))}
      <div className="gp-compose">
        <label htmlFor="gp-box">{words.writeTo}</label>
        {visit.draftFailed && <Notice kind="broken">{words.messageFailed}</Notice>}
        <div className={tooLong ? 'gp-compose-row is-wrong' : 'gp-compose-row'}>
          <textarea
            ref={box}
            id="gp-box"
            className="gp-box"
            rows={1}
            value={visit.draft}
            data-focus="box"
            aria-invalid={tooLong}
            aria-describedby={
              tooLong ? 'gp-box-error gp-box-count' : counting ? 'gp-box-count' : undefined
            }
            onChange={(event) => onDraft(event.target.value)}
          />
          <button
            className={live ? 'gp-send is-live' : 'gp-send'}
            type="button"
            aria-label={words.sendMessage}
            data-focus="sendMessage"
            {...offButton(!live, { dim: false })}
            onClick={onSend}
          >
            <Line name="send" size={20} weight={2.6} />
          </button>
        </div>
        {counting && (
          <p id="gp-box-count" className={tooLong ? 'gp-count is-over' : 'gp-count'}>
            {tooLong && <Glyph name="alert" size={14} weight={2.4} />}
            {words.messageCount(length)}
          </p>
        )}
        {tooLong && (
          <p id="gp-box-error" className="gp-error">
            <Glyph name="alert" size={15} weight={2.2} />
            {words.messageTooLong}
          </p>
        )}
      </div>
    </section>
  );
}

export function Gone({ words }: { words: Words }) {
  return (
    <div className="gp-alone" role="alert">
      <span className="gp-alone-mark" aria-hidden="true">
        <Line name="broken" size={26} />
      </span>
      <h1 className="gp-alone-title">{words.gone}</h1>
      <p>{words.goneBody}</p>
    </div>
  );
}

export function Unreachable({
  words,
  busy,
  onRetry,
}: {
  words: Words;
  busy: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="gp-alone">
      <span className="gp-alone-mark" aria-hidden="true">
        <Glyph name="alert" size={26} />
      </span>
      <h1 className="gp-alone-title" tabIndex={-1} data-focus="h1">
        {words.unreachable}
      </h1>
      <p>{words.unreachableBody}</p>
      <Filled narrow busy={busy} onClick={onRetry}>
        {busy ? words.retrying : words.retry}
      </Filled>
    </div>
  );
}

export function Waiting({ part }: { part: 'cover' | 'under' | 'details' }) {
  if (part === 'cover') return <span className="gp-skel gp-skel-cover gp-left" />;
  if (part === 'details') return <span className="gp-skel gp-skel-details gp-left-after" />;

  return (
    <div className="gp-skel-under">
      <span className="gp-skel is-head" />
      <span className="gp-skel is-line" />
      <span className="gp-skel is-short" />
      {[1, 2, 3].map((row) => (
        <span key={row} className="gp-skel-row">
          <span className="gp-skel is-dot" />
          <span className="gp-skel is-bar" />
        </span>
      ))}
    </div>
  );
}

/** The header's language button and its menu: the four in their own names, each with its lang (sc-3790). */
export function LanguageMenu({
  lang,
  open,
  words,
  onOpen,
  onClose,
  onChoose,
}: {
  lang: Lang;
  open: boolean;
  words: Words;
  onOpen: () => void;
  onClose: () => void;
  onChoose: (lang: Lang) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const chosen = Math.max(
    0,
    LANGUAGES.findIndex((one) => one.code === lang),
  );
  const name = LANGUAGES[chosen]?.name ?? '';

  useEffect(() => {
    if (!open) return;

    items.current[chosen]?.focus();
    const outside = (event: MouseEvent) => {
      if (!wrap.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener('mousedown', outside);

    return () => document.removeEventListener('mousedown', outside);
  }, [open, chosen, onClose]);

  function onKey(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    const count = LANGUAGES.length;
    const to = (at: number) => {
      event.preventDefault();
      items.current[(at + count) % count]?.focus();
    };

    if (event.key === 'ArrowDown') to(index + 1);
    else if (event.key === 'ArrowUp') to(index - 1);
    else if (event.key === 'Home') to(0);
    else if (event.key === 'End') to(count - 1);
    else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      wrap.current?.querySelector<HTMLButtonElement>('.gp-lang')?.focus();
    } else if (event.key === 'Tab') onClose();
  }

  return (
    <div ref={wrap} className="gp-lang-wrap">
      <button
        className={open ? 'gp-lang is-open' : 'gp-lang'}
        type="button"
        data-focus="lang"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? 'gp-lang-menu' : undefined}
        aria-label={words.languageCurrent(name)}
        onClick={() => (open ? onClose() : onOpen())}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown') return;
          event.preventDefault();
          onOpen();
        }}
      >
        <Glyph name="globe" size={18} weight={1.9} className="gp-lang-globe" />
        <span>{name}</span>
        <Glyph name="chevdown" size={14} weight={2.2} className="gp-lang-chev" />
      </button>
      {open && (
        <div className="gp-menu">
          <p id="gp-lang-title" className="gp-menu-title">
            {words.languageLabel}
          </p>
          <div id="gp-lang-menu" role="menu" aria-labelledby="gp-lang-title">
            {LANGUAGES.map((one, index) => (
              <button
                key={one.code}
                ref={(item) => {
                  items.current[index] = item;
                }}
                className="gp-menu-item"
                type="button"
                role="menuitemradio"
                aria-checked={one.code === lang}
                lang={one.code}
                tabIndex={-1}
                onClick={() => onChoose(one.code)}
                onKeyDown={(event) => onKey(event, index)}
              >
                <span>{one.name}</span>
                {one.code === lang && <Glyph name="tick" size={18} weight={2.6} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
