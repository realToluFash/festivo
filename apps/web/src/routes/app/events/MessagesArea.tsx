import {
  ApiError,
  type GuestMessageCheck,
  type GuestMessageDelivery,
  type GuestMessageDetails,
  type GuestMessageRow,
  type GuestMessageSummary,
  type NotSentReason,
  type OrganisationEvent,
  type PickableGuest,
  guestMessageTitle,
  realtimeTopic,
} from '@soirely/api-client';
import type { TFunction } from 'i18next';
import {
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { SearchField } from '../../../components/SearchField.tsx';
import { currentLocale } from '../../../i18n/index.ts';
import { offButton } from '../../../offButton.ts';
import { pageTitle, usePageTitle } from '../../../pageTitle.ts';
import { useServerNow } from '../../../serverNow.ts';
import { canOn } from '../../../session.ts';
import {
  type Field,
  type Refusals,
  type Who,
  MESSAGE_MAXIMUM,
  SUBJECT_MAXIMUM,
  closedOf,
  fieldOfPath,
  firstRefused,
  matching,
  refusalsOf,
  shortTitle,
} from './messagesArea.ts';
import { useHubTopics } from './useHubTopics.ts';
import './messages.css';

const CHIPS_SHOWN = 6;
const CANT_SHOWN = 2;

type Pane =
  | { kind: 'idle' }
  | { kind: 'compose'; who: Who; openTo: boolean }
  | { kind: 'message'; id: string }
  | { kind: 'reached'; id: string };

type ListLoad =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; messages: GuestMessageRow[] };

interface Desk {
  event: OrganisationEvent;
  manage: boolean;
  addresses: boolean;
  whyOff: string | undefined;
  focus: (key: string) => void;
  say: (words: string) => void;
}

/** An event's Messages at a desk (sc-3942), as the web demo's B · Conversations draws it: the list, and the pane with the composer, a message, or who it reached. */
export function MessagesArea({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();
  const now = useServerNow();
  const closed = closedOf(event, now);
  const manage = canOn(event, 'messages.manage');
  const addresses = canOn(event, 'guests.manage');
  const [list, setList] = useState<ListLoad>({ kind: 'loading' });
  const [pane, setPane] = useState<Pane>({ kind: 'idle' });
  const [ask, setAsk] = useState(0);
  const [said, setSaid] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const pending = useRef<string | null>(null);
  const [, setFocusTick] = useState(0);
  const whyId = useId();
  const titleId = useId();

  usePageTitle(pageTitle(t, [t('eventNav.messages'), event.name]));

  useEffect(() => {
    let current = true;

    api.guestMessages(event.id).then(
      (messages) => current && setList({ kind: 'loaded', messages }),
      () => current && setList((was) => (was.kind === 'loaded' ? was : { kind: 'failed' })),
    );

    return () => {
      current = false;
    };
  }, [event.id, ask]);

  const topics = useMemo(() => [realtimeTopic('EventMessages', event.id)], [event.id]);
  const again = useCallback(() => setAsk((n) => n + 1), []);
  useHubTopics(topics, () => api.guestMessagesSubscription(event.id), again, again);

  const focus = useCallback((key: string) => {
    pending.current = key;
    setFocusTick((n) => n + 1);
  }, []);

  useEffect(() => {
    const key = pending.current;
    if (key == null) return;

    const target = root.current?.querySelector<HTMLElement>(`[data-focus="${key}"]`);
    if (target == null) return;
    pending.current = null;
    target.focus();
  });

  const say = useCallback((words: string) => {
    setSaid('');
    window.setTimeout(() => setSaid(words), 60);
  }, []);

  const desk: Desk = {
    event,
    manage,
    addresses,
    whyOff: closed == null ? undefined : whyId,
    focus,
    say,
  };

  function startNew(): void {
    if (closed != null || !manage) return;
    if (pane.kind !== 'compose') setPane({ kind: 'compose', who: { kind: 'all' }, openTo: false });
    focus('subject');
  }

  const lit = pane.kind === 'message' || pane.kind === 'reached' ? pane.id : null;

  return (
    <div ref={root} className="desk ev desk-page ev-msgs">
      <div className="mg">
        <section className="mg-list" aria-labelledby={titleId}>
          <div className="mg-list-top">
            <h1 id={titleId} className="mg-title" tabIndex={-1} data-focus="title">
              {t('eventNav.messages')}
            </h1>
            {manage && (
              <button
                type="button"
                className="mg-new"
                aria-describedby={desk.whyOff}
                onClick={startNew}
                {...offButton(closed != null)}
              >
                <Glyph name="plus" size={18} weight={2.4} />
                {t('eventMessages.new')}
              </button>
            )}
          </div>
          {closed != null && <WhyNot id={whyId} words={t(`eventMessages.${closed}`)} />}
          <div className="mg-list-body">
            {list.kind === 'loading' ? (
              <p className="mg-loading" role="status">
                {t('eventMessages.loading')}
              </p>
            ) : list.kind === 'failed' ? (
              <div className="mg-empty" role="alert">
                <p>{t('eventMessages.loadFailed')}</p>
                <button type="button" className="desk-text" onClick={again}>
                  {t('eventMessages.tryAgain')}
                </button>
              </div>
            ) : list.messages.length === 0 ? (
              <div className="mg-empty">
                <h2>{t('eventMessages.noneYet')}</h2>
                <p>{t('eventMessages.noneLine')}</p>
              </div>
            ) : (
              <Rows
                messages={list.messages}
                lit={lit}
                onOpen={(id) => {
                  setPane({ kind: 'message', id });
                  focus('heading');
                }}
              />
            )}
          </div>
        </section>
        <section className="mg-pane">
          {pane.kind === 'compose' ? (
            <ComposePane
              key="compose"
              desk={desk}
              first={pane}
              onSent={(id, count) => {
                say(t('eventMessages.queued', { count }));
                setPane({ kind: 'message', id });
                again();
                focus('heading');
              }}
            />
          ) : pane.kind === 'message' ? (
            <MessagePane
              key={pane.id}
              desk={desk}
              id={pane.id}
              ask={ask}
              onWho={() => {
                setPane({ kind: 'reached', id: pane.id });
                focus('heading');
              }}
              onFollow={(who) => {
                setPane({ kind: 'compose', who, openTo: false });
                focus('body');
              }}
            />
          ) : pane.kind === 'reached' ? (
            <ReachedPane
              key={pane.id}
              desk={desk}
              id={pane.id}
              ask={ask}
              onBack={() => {
                setPane({ kind: 'message', id: pane.id });
                focus('heading');
              }}
            />
          ) : (
            <Idle
              desk={desk}
              empty={list.kind === 'loaded' && list.messages.length === 0}
              onWrite={(openTo) => {
                setPane({ kind: 'compose', who: { kind: 'all' }, openTo });
                if (!openTo) focus('body');
              }}
            />
          )}
        </section>
        <p className="desk-unseen" role="status">
          {said}
        </p>
      </div>
    </div>
  );
}

function WhyNot({ id, words }: { id?: string; words: string }) {
  return (
    <p id={id} className="mg-why" data-testid="messages-closed">
      <Glyph name="info" size={16} weight={2.2} />
      <span>{words}</span>
    </p>
  );
}

function GroupMark({ size = 40 }: { size?: 40 | 44 }) {
  return (
    <span className={`mg-group today-cover is-${size}`} aria-hidden="true">
      <Glyph name="group" size={size / 2} weight={2.1} />
    </span>
  );
}

function whenWords(at: string): string {
  return new Intl.DateTimeFormat(currentLocale(), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(at));
}

function audienceWords(message: Pick<GuestMessageSummary, 'audience'>, t: TFunction): string {
  return message.audience === 'all'
    ? t('eventMessages.toAll')
    : t('eventMessages.toChosen', { audience: t('eventMessages.chooseGuests') });
}

function titleOf(message: Pick<GuestMessageSummary, 'subject' | 'firstLine'>): string {
  return message.subject?.trim() ? guestMessageTitle(message) : shortTitle(message.firstLine);
}

function Rows({
  messages,
  lit,
  onOpen,
}: {
  messages: readonly GuestMessageRow[];
  lit: string | null;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  const sending = messages.filter((message) => message.sending);
  const done = messages.filter((message) => !message.sending);

  const rows = (some: readonly GuestMessageRow[]) => (
    <ul className="mg-rows">
      {some.map((message) => {
        const on = message.id === lit;
        const title = titleOf(message);
        const line = [
          audienceWords(message, t),
          message.sentBy,
          t('eventMessages.email'),
          message.sending
            ? t('eventMessages.sending')
            : t('eventMessages.reached', { count: message.reached, total: message.deliveries }),
        ].join(' · ');
        const when = whenWords(message.sentAt);

        return (
          <li key={message.id}>
            <button
              type="button"
              className={on ? 'mg-row is-on' : 'mg-row'}
              aria-label={[title, line, when].join(', ')}
              aria-current={on ? 'true' : undefined}
              data-focus={`row:${message.id}`}
              onClick={() => onOpen(message.id)}
            >
              <GroupMark />
              <span className="desk-row-words">
                <span className="desk-row-title">
                  <span className="desk-row-name">{title}</span>
                </span>
                <span className="desk-row-line">{line}</span>
              </span>
              <span className="mg-when">{when}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      {sending.length > 0 && rows(sending)}
      {done.length > 0 && (
        <section className="mg-section" aria-label={t('eventMessages.done')}>
          <h2 className="mg-section-head">{t('eventMessages.done')}</h2>
          {rows(done)}
        </section>
      )}
    </>
  );
}

function Idle({
  desk,
  empty,
  onWrite,
}: {
  desk: Desk;
  empty: boolean;
  onWrite: (openTo: boolean) => void;
}) {
  const { t } = useTranslation();
  const line = empty
    ? t('eventMessages.noneLine')
    : desk.whyOff == null
      ? t('eventMessages.pickOne')
      : t('eventMessages.pickOneClosed');

  return (
    <div className="mg-in is-idle">
      <h2 className="desk-unseen">{t('eventMessages.newMessage')}</h2>
      <p className="mg-idle-line">{line}</p>
      {desk.manage && (
        <MiniComposer
          desk={desk}
          chip={t('eventMessages.allGuests')}
          placeholder={t('eventMessages.writeToGuests')}
          onWrite={onWrite}
        />
      )}
    </div>
  );
}

function MiniComposer({
  desk,
  chip,
  placeholder,
  onWrite,
}: {
  desk: Desk;
  chip: string;
  placeholder: string;
  onWrite: (openTo: boolean) => void;
}) {
  const { t } = useTranslation();
  const off = desk.whyOff != null;

  return (
    <div className="mg-mini">
      <div className="mg-mini-to">
        <span>{t('eventMessages.to')}</span>
        <button
          type="button"
          className="mg-to-chip"
          aria-haspopup="dialog"
          aria-expanded="false"
          aria-describedby={desk.whyOff}
          onClick={() => onWrite(true)}
          {...offButton(off)}
        >
          {chip}
          <Glyph name="chevdown" size={14} weight={2.6} />
        </button>
      </div>
      <div className="mg-mini-row">
        <input
          className="mg-mini-field"
          placeholder={placeholder}
          aria-label={placeholder}
          aria-describedby={desk.whyOff}
          data-focus="follow"
          disabled={off}
          value=""
          onChange={() => onWrite(false)}
          onFocus={() => {
            if (!off) onWrite(false);
          }}
        />
        <button
          type="button"
          className="mg-send is-off"
          aria-label={t('eventMessages.send')}
          aria-describedby={desk.whyOff}
          {...offButton(true, { dim: false })}
        >
          <Glyph name="send" size={20} weight={2.4} />
        </button>
      </div>
    </div>
  );
}

type Step =
  | { kind: 'write' }
  | { kind: 'checking' }
  | { kind: 'check'; check: GuestMessageCheck; seeAll: boolean }
  | { kind: 'sending'; check: GuestMessageCheck };

function refusalWords(refusals: Refusals, t: TFunction): Partial<Record<Field, string>> {
  const words: Partial<Record<Field, string>> = {};

  for (const [field, refusal] of Object.entries(refusals) as [Field, string][]) {
    words[field] =
      refusal === 'subjectTooLong'
        ? t('eventMessages.subjectTooLong', { count: SUBJECT_MAXIMUM })
        : refusal === 'messageTooLong'
          ? t('eventMessages.messageTooLong', { count: MESSAGE_MAXIMUM })
          : t(`eventMessages.${refusal}`);
  }

  return words;
}

function failureWords(error: unknown, t: TFunction): string {
  if (!(error instanceof ApiError)) return t('eventMessages.failOffline');
  if (error.status === 403) return t('eventMessages.failRole');
  if (error.status === 404) return t('eventMessages.failDeleted');
  if (error.status === 409) return error.problem.title;

  return t('eventMessages.failRefused');
}

/** Writing to many: To at the head, the check as a card, the composer at the foot. Send stays lit with a blank Message, and a press says why (Messaging-B-Web-More-6, state 19). */
function ComposePane({
  desk,
  first,
  onSent,
}: {
  desk: Desk;
  first: { who: Who; openTo: boolean };
  onSent: (id: string, count: number) => void;
}) {
  const { t } = useTranslation();
  const [who, setWho] = useState<Who>(first.who);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [toOpen, setToOpen] = useState(first.openTo);
  const [choosing, setChoosing] = useState(false);
  const [wrong, setWrong] = useState<Partial<Record<Field, string>>>({});
  const [refused, setRefused] = useState<string | null>(null);
  const [step, setStep] = useState<Step>({ kind: 'write' });
  const [guests, setGuests] = useState<PickableGuest[] | null>(null);
  const chip = useRef<HTMLButtonElement>(null);
  const ids = useId();
  const off = desk.whyOff != null;

  useEffect(() => {
    let current = true;

    api.guestMessageGuests(desk.event.id).then(
      (all) => current && setGuests(all),
      () => current && setGuests([]),
    );

    return () => {
      current = false;
    };
  }, [desk.event.id]);

  function refuse(words: Partial<Record<Field, string>>): void {
    setWrong(words);
    const field = (['who', 'subject', 'message'] as const).find((one) => words[one] != null);
    if (field != null)
      desk.focus(field === 'who' ? 'to-chip' : field === 'subject' ? 'subject' : 'body');
  }

  function fromApi(error: unknown): void {
    if (error instanceof ApiError && error.status === 422) {
      const words: Partial<Record<Field, string>> = {};

      for (const [path, said] of Object.entries(error.fieldErrors())) {
        const field = fieldOfPath(path);
        if (field != null) words[field] ??= said;
      }
      setStep({ kind: 'write' });
      refuse(words);
      return;
    }
    setStep({ kind: 'write' });
    setRefused(failureWords(error, t));
    desk.focus('refused');
  }

  function send(): void {
    if (off) return;

    const refusals = refusalsOf(who, subject, message);
    setRefused(null);
    if (firstRefused(refusals) != null) {
      refuse(refusalWords(refusals, t));
      return;
    }
    setWrong({});
    setStep({ kind: 'checking' });
    desk.focus('check');
    api
      .guestMessageCheck(desk.event.id, audienceOf(who))
      .then((check) => {
        setStep({ kind: 'check', check, seeAll: false });
        desk.focus('check');
      })
      .catch(fromApi);
  }

  function go(check: GuestMessageCheck): void {
    setStep({ kind: 'sending', check });
    api
      .sendGuestMessage(desk.event.id, {
        ...audienceOf(who),
        subject: subject.trim() === '' ? null : subject,
        message,
      })
      .then((sent) => onSent(sent.id, check.people))
      .catch(fromApi);
  }

  function fixed(field: Field, next: { who?: Who; subject?: string; message?: string }): void {
    const now = refusalsOf(next.who ?? who, next.subject ?? subject, next.message ?? message);
    if (now[field] != null) return;
    setWrong(({ [field]: _gone, ...left }) => left);
  }

  function back(): void {
    setStep({ kind: 'write' });
    desk.focus('send');
  }

  const chosen = who.kind === 'chosen' ? who.ids : [];
  const chipWords =
    who.kind === 'all'
      ? guests == null
        ? t('eventMessages.allGuests')
        : `${t('eventMessages.allGuests')} · ${new Intl.NumberFormat(currentLocale()).format(guests.length)}`
      : chosen.length === 0
        ? t('eventMessages.chooseGuests')
        : `${t('eventMessages.chooseGuests')} · ${new Intl.NumberFormat(currentLocale()).format(chosen.length)}`;

  return (
    <div className="mg-in is-compose">
      <h2 className="desk-unseen">{t('eventMessages.newMessage')}</h2>
      <header className="mg-to-head">
        <div className="mg-to-row">
          <span className="mg-to-label">{t('eventMessages.to')}</span>
          <div className="mg-to-at">
            <button
              ref={chip}
              type="button"
              className={wrong.who == null ? 'mg-to-chip' : 'mg-to-chip is-wrong'}
              aria-haspopup="dialog"
              aria-expanded={toOpen}
              aria-describedby={wrong.who == null ? desk.whyOff : `${ids}-who`}
              data-focus="to-chip"
              onClick={() => {
                setChoosing(false);
                setToOpen((open) => !open);
              }}
              {...offButton(off)}
            >
              {chipWords}
              <Glyph name="chevdown" size={14} weight={2.6} />
            </button>
            {toOpen && (
              <ToPopover
                who={who}
                guests={guests}
                addresses={desk.addresses}
                chip={chip}
                choosingFirst={choosing}
                onPick={(next) => {
                  setWho(next);
                  fixed('who', { who: next });
                }}
                onClose={(toChip) => {
                  setToOpen(false);
                  if (toChip) desk.focus('to-chip');
                }}
                onNobody={() => {
                  setToOpen(false);
                  setWrong((was) => ({ ...was, who: t('eventMessages.chooseOne') }));
                  desk.focus('to-chip');
                }}
              />
            )}
          </div>
        </div>
        <ChosenChips
          ids={chosen}
          guests={guests}
          onPick={(next) => setWho({ kind: 'chosen', ids: next })}
          onMore={() => {
            setChoosing(true);
            setToOpen(true);
          }}
        />
        {wrong.who != null && (
          <p id={`${ids}-who`} className="desk-error mg-field-error">
            <Glyph name="alert" size={15} weight={2.2} />
            {wrong.who}
          </p>
        )}
      </header>
      <div className="mg-compose-body">
        {step.kind !== 'write' && (
          <CheckCard
            step={step}
            onSeeAll={(seeAll) => {
              if (step.kind === 'check') setStep({ ...step, seeAll });
              desk.focus(seeAll ? 'see-all' : 'see-all-open');
            }}
            onGo={go}
            onChange={back}
          />
        )}
      </div>
      <form
        className={[
          'mg-composer',
          step.kind === 'write' ? '' : 'is-held',
          wrong.subject == null && wrong.message == null ? '' : 'is-wrong',
        ]
          .filter(Boolean)
          .join(' ')}
        onSubmit={(submitted) => {
          submitted.preventDefault();
          send();
        }}
      >
        <div className="mg-subject-row">
          <input
            className="mg-subject"
            value={subject}
            aria-label={t('eventMessages.subject')}
            aria-invalid={wrong.subject == null ? undefined : true}
            aria-describedby={
              wrong.subject == null ? `${ids}-optional` : `${ids}-subject ${ids}-optional`
            }
            readOnly={step.kind !== 'write' || off}
            data-focus="subject"
            onChange={(typed) => {
              setSubject(typed.target.value);
              fixed('subject', { subject: typed.target.value });
            }}
            onKeyDown={(key) => commandEnter(key, send)}
          />
          <span className={subject === '' ? 'mg-subject-hint' : 'desk-unseen'} aria-hidden>
            {subject === '' && t('eventMessages.subject')}
            <span id={`${ids}-optional`} className="mg-optional">
              {t('eventMessages.optional')}
            </span>
          </span>
        </div>
        {wrong.subject != null && (
          <p id={`${ids}-subject`} className="desk-error mg-field-error">
            <Glyph name="alert" size={15} weight={2.2} />
            {wrong.subject}
          </p>
        )}
        <textarea
          className="mg-field"
          value={message}
          aria-label={t('eventMessages.message')}
          aria-invalid={wrong.message == null ? undefined : true}
          aria-describedby={wrong.message == null ? desk.whyOff : `${ids}-message`}
          placeholder={t('eventMessages.writeToGuests')}
          readOnly={step.kind !== 'write' || off}
          data-focus="body"
          onChange={(typed) => {
            setMessage(typed.target.value);
            fixed('message', { message: typed.target.value });
          }}
          onKeyDown={(key) => commandEnter(key, send)}
        />
        {wrong.message != null && (
          <p id={`${ids}-message`} className="desk-error mg-field-error">
            <Glyph name="alert" size={15} weight={2.2} />
            {wrong.message}
          </p>
        )}
        {refused != null && (
          <p
            id={`${ids}-refused`}
            className="desk-error"
            role="alert"
            tabIndex={-1}
            data-focus="refused"
          >
            <Glyph name="alert" size={15} weight={2.2} />
            {refused}
          </p>
        )}
        {step.kind === 'write' && (
          <div className="mg-tools">
            <span className="today-grow" />
            <span className="mg-goes-page">{t('eventMessages.goesOnTheirPage')}</span>
            <button
              type="submit"
              className="mg-send"
              aria-label={t('eventMessages.send')}
              aria-keyshortcuts="Meta+Enter Control+Enter"
              aria-describedby={refused == null ? desk.whyOff : `${ids}-refused`}
              data-focus="send"
              {...offButton(off)}
            >
              <Glyph name="send" size={20} weight={2.4} />
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

function audienceOf(who: Who): { audience: 'all' | 'chosen'; guestIds?: string[] } {
  return who.kind === 'all' ? { audience: 'all' } : { audience: 'chosen', guestIds: [...who.ids] };
}

function commandEnter(event: KeyboardEvent, then: () => void): void {
  if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return;

  event.preventDefault();
  then();
}

function reasonWords(reason: NotSentReason | null, t: TFunction): string {
  switch (reason) {
    case 'no_address':
      return t('eventMessages.noEmail');
    case 'bouncing':
      return t('eventMessages.addressBouncing');
    case 'complained':
      return t('eventMessages.complained');
    case 'provider_blocked':
      return t('eventMessages.cannotEmailAddress');
    default:
      return t('eventMessages.couldNotSendEmail');
  }
}

function CheckCard({
  step,
  onSeeAll,
  onGo,
  onChange,
}: {
  step: Exclude<Step, { kind: 'write' }>;
  onSeeAll: (open: boolean) => void;
  onGo: (check: GuestMessageCheck) => void;
  onChange: () => void;
}) {
  const { t } = useTranslation();
  const sentenceId = useId();
  const check = step.kind === 'checking' ? null : step.check;
  const listing = step.kind === 'check' && step.seeAll;

  useEffect(() => {
    const keys = (key: globalThis.KeyboardEvent) => {
      if (key.key !== 'Escape' || key.defaultPrevented) return;
      if (document.querySelector('.mg-to-pop') != null) return;

      key.preventDefault();
      if (listing) onSeeAll(false);
      else onChange();
    };

    document.addEventListener('keydown', keys);

    return () => document.removeEventListener('keydown', keys);
  }, [listing, onSeeAll, onChange]);

  if (check == null)
    return (
      <div className="mg-check" role="status" aria-busy="true">
        <p className="mg-check-sentence" tabIndex={-1} data-focus="check">
          {t('eventMessages.loadingNumbers')}
        </p>
      </div>
    );

  const cant = check.cantBeTold;

  return (
    <div
      className="mg-check"
      role="alertdialog"
      aria-label={t('eventMessages.checkName')}
      aria-describedby={sentenceId}
    >
      <p id={sentenceId} className="mg-check-sentence" tabIndex={-1} data-focus="check">
        {t('eventMessages.cannotUndo', { count: check.people })}
      </p>
      {listing ? (
        <div className="mg-all">
          <button type="button" className="desk-text mg-all-back" onClick={() => onSeeAll(false)}>
            <Glyph name="back" size={17} weight={2.2} />
            {t('eventMessages.backToCheck')}
          </button>
          <p className="mg-cant-head" tabIndex={-1} data-focus="see-all">
            {t('eventMessages.cantBeTold', { count: cant.length })}
          </p>
          <ul className="mg-all-list">
            {cant.map((one) => (
              <li key={one.guestId} className="mg-all-row">
                <span className="mg-all-name">{one.name}</span>
                <span>{reasonWords(one.reason, t)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <p className="mg-check-line">
            {[
              t('eventMessages.goesOnPage'),
              check.toldByEmail > 0
                ? t('eventMessages.toldThere', { channels: t('eventMessages.byEmail') })
                : null,
            ]
              .filter((line) => line != null)
              .join(' ')}
          </p>
          {check.toldByEmail > 0 && (
            <ul className="mg-pills">
              <li>
                <Glyph name="mail" size={15} weight={2} />
                {t('eventMessages.email')} ·{' '}
                {new Intl.NumberFormat(currentLocale()).format(check.toldByEmail)}
              </li>
            </ul>
          )}
          {cant.length > 0 && (
            <div className="mg-cant">
              <p className="mg-cant-head">
                {t('eventMessages.cantBeTold', { count: cant.length })}
              </p>
              {cant.slice(0, CANT_SHOWN).map((one) => (
                <p key={one.guestId}>{`${one.name} · ${reasonWords(one.reason, t)}`}</p>
              ))}
              {cant.length > CANT_SHOWN && (
                <button
                  type="button"
                  className="desk-text"
                  data-focus="see-all-open"
                  onClick={() => onSeeAll(true)}
                >
                  {t('eventMessages.seeAll', { count: cant.length })}
                </button>
              )}
            </div>
          )}
        </>
      )}
      <div className="mg-check-acts">
        <button
          type="button"
          className="button button-primary mg-go"
          data-focus="go"
          {...offButton(step.kind === 'sending')}
          onClick={() => onGo(check)}
        >
          {t('eventMessages.sendTo', { count: check.people })}
        </button>
        <button type="button" className="desk-text" onClick={onChange}>
          {t('eventMessages.changeIt')}
        </button>
      </div>
    </div>
  );
}

function ToPopover({
  who,
  guests,
  addresses,
  chip,
  choosingFirst,
  onPick,
  onClose,
  onNobody,
}: {
  who: Who;
  guests: PickableGuest[] | null;
  addresses: boolean;
  chip: RefObject<HTMLButtonElement | null>;
  choosingFirst: boolean;
  onPick: (who: Who) => void;
  onClose: (toChip: boolean) => void;
  onNobody: () => void;
}) {
  const { t } = useTranslation();
  const [choosing, setChoosing] = useState(
    choosingFirst || (who.kind === 'chosen' && who.ids.length === 0),
  );
  const box = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const name = useId();
  const chosen = who.kind === 'chosen' ? who.ids : [];
  const number = new Intl.NumberFormat(currentLocale());

  useEffect(() => {
    if (!choosing) box.current?.querySelector<HTMLElement>('input:checked')?.focus();
  }, [choosing]);

  useEffect(() => {
    const keys = (key: globalThis.KeyboardEvent) => {
      if (key.key !== 'Escape') return;

      key.preventDefault();
      onClose(true);
    };
    const outside = (pointer: PointerEvent) => {
      const target = pointer.target as Node;

      if (!box.current?.contains(target) && !chip.current?.contains(target)) onClose(false);
    };

    document.addEventListener('keydown', keys);
    document.addEventListener('pointerdown', outside);

    return () => {
      document.removeEventListener('keydown', keys);
      document.removeEventListener('pointerdown', outside);
    };
  }, [chip, onClose]);

  if (choosing)
    return (
      <div
        ref={box}
        className="mg-pop mg-to-pop mgt-pop mgc-pop"
        role="dialog"
        aria-labelledby={titleId}
      >
        <ChoosePanel
          chosen={chosen}
          guests={guests}
          addresses={addresses}
          titleId={titleId}
          onPick={(ids) => onPick({ kind: 'chosen', ids })}
          onBack={() => setChoosing(false)}
          onClose={() => onClose(true)}
          onDoneNone={onNobody}
        />
      </div>
    );

  return (
    <div ref={box} className="mg-pop mg-to-pop mgt-pop" role="dialog" aria-labelledby={titleId}>
      <div className="mg-pop-head">
        <h3 id={titleId} className="mg-to-title">
          {t('eventMessages.to')}
        </h3>
        <button
          type="button"
          className="mg-close"
          aria-label={t('eventMessages.closeTo')}
          onClick={() => onClose(true)}
        >
          <Glyph name="clear" size={18} weight={2.4} />
        </button>
      </div>
      <div className="mgt-scroll">
        <fieldset className="mg-radios">
          <legend className="desk-unseen">{t('eventMessages.to')}</legend>
          <label className="mg-radio-row">
            <input
              type="radio"
              name={name}
              className="desk-radio"
              checked={who.kind === 'all'}
              onChange={() => onPick({ kind: 'all' })}
            />
            <span className="today-grow">{t('eventMessages.allGuests')}</span>
            {guests != null && (
              <span className="mg-radio-count">{number.format(guests.length)}</span>
            )}
          </label>
          <label className="mg-radio-row">
            <input
              type="radio"
              name={name}
              className="desk-radio"
              checked={who.kind === 'chosen'}
              onChange={() => {
                onPick({ kind: 'chosen', ids: chosen });
                setChoosing(true);
              }}
            />
            <span className="today-grow">{t('eventMessages.chooseGuests')}</span>
            {who.kind === 'chosen' && (
              <span className="mg-radio-count">{number.format(chosen.length)}</span>
            )}
          </label>
          {who.kind === 'chosen' && (
            <div className="mg-who-block">
              <button type="button" className="desk-text" onClick={() => setChoosing(true)}>
                {chosen.length === 0
                  ? t('eventMessages.chooseGuests')
                  : `${t('eventMessages.chosen', { count: chosen.length })} · ${t('eventMessages.change')}`}
              </button>
            </div>
          )}
        </fieldset>
      </div>
    </div>
  );
}

const SKELETON_ROWS = 7;

/** Choose guests: search by name (and address, with guests.manage), tick guests one by one, Done. Every tick is kept at once, so Escape keeps it too. */
function ChoosePanel({
  chosen,
  guests,
  addresses,
  titleId,
  onPick,
  onBack,
  onClose,
  onDoneNone,
}: {
  chosen: readonly string[];
  guests: PickableGuest[] | null;
  addresses: boolean;
  titleId: string;
  onPick: (ids: string[]) => void;
  onBack: () => void;
  onClose: () => void;
  onDoneNone: () => void;
}) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const [at, setAt] = useState<string | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const ids = useId();
  const loading = guests == null;
  const shown = matching(guests ?? [], typed);
  const total = guests?.length ?? 0;
  const active = shown.some((guest) => guest.id === at) ? at : (shown[0]?.id ?? null);

  useEffect(() => {
    list.current?.closest('.mgc')?.querySelector<HTMLElement>('input[type=search]')?.focus();
  }, []);

  function tick(guest: PickableGuest): void {
    setAt(guest.id);
    onPick(
      chosen.includes(guest.id) ? chosen.filter((id) => id !== guest.id) : [...chosen, guest.id],
    );
  }

  function move(key: KeyboardEvent<HTMLInputElement>): void {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key.key)) return;

    const boxes = [...(list.current?.querySelectorAll<HTMLInputElement>('[data-guest]') ?? [])];
    const now = boxes.indexOf(document.activeElement as HTMLInputElement);
    const next =
      key.key === 'Home'
        ? 0
        : key.key === 'End'
          ? boxes.length - 1
          : Math.min(boxes.length - 1, Math.max(0, now + (key.key === 'ArrowDown' ? 1 : -1)));
    const target = boxes[next];

    key.preventDefault();
    if (target == null) return;
    setAt(target.dataset.guest ?? null);
    target.focus();
  }

  const status = loading
    ? t('eventMessages.loadingGuests')
    : typed.trim() === ''
      ? t('eventMessages.guests', { count: total })
      : t('eventMessages.shown', { shown: shown.length, total });

  return (
    <div className="mgc">
      <div className="mg-pop-head">
        <button
          type="button"
          className="mg-close mgc-back"
          aria-label={t('eventMessages.backToTo')}
          onClick={onBack}
        >
          <Glyph name="back" size={18} weight={2.4} />
        </button>
        <h3 id={titleId} className="mg-to-title mgc-title">
          {t('eventMessages.chooseGuests')}
        </h3>
        <button
          type="button"
          className="mg-close"
          aria-label={t('eventMessages.closeTo')}
          onClick={onClose}
        >
          <Glyph name="clear" size={18} weight={2.4} />
        </button>
      </div>
      <SearchField
        label={t('eventMessages.find')}
        clearLabel={t('eventMessages.clearSearch')}
        value={typed}
        off={loading}
        describedBy={`${ids}-status`}
        onChange={setTyped}
        onClear={() => setTyped('')}
        onEnter={() => list.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus()}
      />
      <p id={`${ids}-status`} className="mgc-status" role="status">
        {status}
      </p>
      <div className="mgc-scroll">
        {loading ? (
          <ul className="mgc-skeleton" aria-hidden="true">
            {Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <li key={index} className="mgc-skeleton-row">
                <span className="mgc-skeleton-box" />
                <span className="mgc-skeleton-lines">
                  <span className="mgc-skeleton-bar" />
                  {addresses && <span className="mgc-skeleton-bar is-short" />}
                </span>
              </li>
            ))}
          </ul>
        ) : shown.length === 0 ? (
          <div className="mgc-none">
            <p className="mgc-none-head">{t('eventMessages.noMatch')}</p>
            <button
              type="button"
              className="desk-text"
              onClick={() => {
                setTyped('');
                list.current?.closest('.mgc')?.querySelector<HTMLElement>('input')?.focus();
              }}
            >
              {t('eventMessages.clear')}
            </button>
          </div>
        ) : null}
        <ul
          ref={list}
          className="mgc-list"
          aria-labelledby={titleId}
          hidden={loading || shown.length === 0}
        >
          {shown.map((guest) => {
            const said = [
              addresses && guest.email != null ? `${ids}-${guest.id}-at` : null,
              guest.flag == null ? null : `${ids}-${guest.id}-flag`,
            ].filter(Boolean);

            return (
              <li key={guest.id}>
                <label className={chosen.includes(guest.id) ? 'mgc-row is-on' : 'mgc-row'}>
                  <input
                    type="checkbox"
                    className="gs-box mgc-box"
                    checked={chosen.includes(guest.id)}
                    tabIndex={guest.id === active ? 0 : -1}
                    aria-labelledby={`${ids}-${guest.id}-name`}
                    aria-describedby={said.length > 0 ? said.join(' ') : undefined}
                    data-guest={guest.id}
                    onFocus={() => setAt(guest.id)}
                    onKeyDown={move}
                    onChange={() => tick(guest)}
                  />
                  <span className="mgc-words">
                    <span id={`${ids}-${guest.id}-name`} className="mgc-name">
                      {guest.name}
                    </span>
                    {addresses && guest.email != null && (
                      <span id={`${ids}-${guest.id}-at`} className="mgc-address">
                        {guest.email}
                      </span>
                    )}
                    {guest.flag != null && (
                      <span
                        id={`${ids}-${guest.id}-flag`}
                        className={guest.flag === 'no_address' ? 'mgc-flag' : 'mgc-flag is-stopped'}
                      >
                        <span
                          className={
                            guest.flag === 'no_address' ? 'mg-mark is-none' : 'mg-mark is-notsent'
                          }
                          aria-hidden="true"
                        />
                        {reasonWords(guest.flag, t)}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="mgc-foot">
        <p className="mgc-chosen" aria-live="polite">
          {t('eventMessages.chosen', { count: chosen.length })}
        </p>
        <button
          type="button"
          className="button button-primary mgc-done"
          onClick={() => (chosen.length === 0 ? onDoneNone() : onClose())}
        >
          {t('eventMessages.done')}
        </button>
      </div>
    </div>
  );
}

function ChosenChips({
  ids,
  guests,
  onPick,
  onMore,
}: {
  ids: readonly string[];
  guests: PickableGuest[] | null;
  onPick: (ids: string[]) => void;
  onMore: () => void;
}) {
  const { t } = useTranslation();
  const people = ids.flatMap((id) => guests?.find((guest) => guest.id === id) ?? []);
  const left = people.length - CHIPS_SHOWN;

  if (people.length === 0) return null;

  return (
    <ul className="mgc-chips" aria-label={t('eventMessages.chosenTo')}>
      {people.slice(0, CHIPS_SHOWN).map((guest) => (
        <li key={guest.id} className="mg-cond mgc-chip">
          {guest.name}
          <button
            type="button"
            aria-label={t('eventMessages.remove', { name: guest.name })}
            onClick={() => onPick(ids.filter((id) => id !== guest.id))}
          >
            <Glyph name="clear" size={13} weight={2.6} />
          </button>
        </li>
      ))}
      {left > 0 && (
        <li>
          <button type="button" className="desk-text mgc-more" onClick={onMore}>
            {t('eventMessages.more', { count: left })}
          </button>
        </li>
      )}
    </ul>
  );
}

function useMessage(
  eventId: string,
  id: string,
  ask: number,
): GuestMessageDetails | null | 'failed' {
  const [message, setMessage] = useState<GuestMessageDetails | null | 'failed'>(null);

  useEffect(() => {
    let current = true;

    api.guestMessage(eventId, id).then(
      (found) => current && setMessage(found),
      () => current && setMessage((was) => (was == null || was === 'failed' ? 'failed' : was)),
    );

    return () => {
      current = false;
    };
  }, [eventId, id, ask]);

  return message;
}

function reachedOf(message: GuestMessageDetails): { reached: number; of: number } {
  return { reached: message.reached, of: message.deliveries.length };
}

function MessagePane({
  desk,
  id,
  ask,
  onWho,
  onFollow,
}: {
  desk: Desk;
  id: string;
  ask: number;
  onWho: () => void;
  onFollow: (who: Who) => void;
}) {
  const { t } = useTranslation();
  const message = useMessage(desk.event.id, id, ask);

  if (message == null) return <Bones />;
  if (message === 'failed')
    return (
      <div className="mg-in">
        <p className="mg-idle-line" role="alert">
          {t('eventMessages.loadFailed')}
        </p>
      </div>
    );

  const title = titleOf(message);
  const { reached, of } = reachedOf(message);

  return (
    <div className="mg-in">
      <header className="mg-head">
        <GroupMark size={44} />
        <div className="mg-head-words">
          <h2 tabIndex={-1} data-focus="heading">
            {title}
          </h2>
          <p>{[audienceWords(message, t), t('eventMessages.email')].join(' · ')}</p>
        </div>
      </header>
      <ol className="mg-stream" role="log" aria-label={title}>
        <li className="mg-said is-host">
          <div className="mg-bubble is-host is-sent">
            {message.subject != null && message.subject.trim() !== '' && (
              <p className="mg-subject-line">{message.subject}</p>
            )}
            <p>{message.message}</p>
          </div>
          <p className="mg-meta is-end">
            <span className="mg-bit">{t('eventMessages.onTheirPage')}</span>
            <span aria-hidden="true">·</span>
            <span className="mg-bit">{`${message.sentBy} · ${whenWords(message.sentAt)}`}</span>
          </p>
          {message.sending ? (
            <p className="mg-sending">
              <span className="mg-spin" aria-hidden="true" />
              {t('eventMessages.sending')} ·{' '}
              {t('eventMessages.reached', { count: reached, total: of })}
            </p>
          ) : (
            <div className="mg-receipt">
              <ReachBar reached={reached} of={of} />
              <p className="mg-receipt-words">
                {t('eventMessages.reached', { count: reached, total: of })}
              </p>
              <button type="button" className="desk-text mg-who" onClick={onWho}>
                {t('eventMessages.whoItReached')}
                <Glyph name="chevron" size={15} weight={2.4} />
              </button>
            </div>
          )}
        </li>
      </ol>
      {desk.manage && (
        <MiniComposer
          desk={desk}
          chip={audienceWords(message, t)}
          placeholder={t('eventMessages.writeFollowUp')}
          onWrite={() =>
            onFollow(
              message.audience === 'all'
                ? { kind: 'all' }
                : { kind: 'chosen', ids: message.deliveries.map((delivery) => delivery.guestId) },
            )
          }
        />
      )}
    </div>
  );
}

function Bones() {
  return (
    <div className="mg-pane is-loading" aria-hidden="true">
      <span className="mg-bone-bubble is-right b1" />
      <span className="mg-bone-bubble b2" />
    </div>
  );
}

function ReachBar({ reached, of }: { reached: number; of: number }) {
  const { t } = useTranslation();
  const width = 1000;
  const lit = of === 0 ? 0 : Math.max(reached > 0 ? 8 : 0, (reached / of) * width);

  return (
    <svg
      className="mg-bar is-small"
      viewBox={`0 0 ${width} 10`}
      preserveAspectRatio="none"
      role="img"
      aria-label={t('eventMessages.reached', { count: reached, total: of })}
    >
      <rect className="mg-bar-track" x={0} y={0} width={width} height={10} />
      <rect className="mg-bar-reached" x={0} y={0} width={lit} height={10} />
    </svg>
  );
}

type Mark = 'delivered' | 'sent' | 'bounced' | 'notsent' | 'sending';

const MARKS: Record<GuestMessageDelivery['state'], Mark> = {
  queued: 'sending',
  sent: 'sent',
  delivered: 'delivered',
  reported_as_spam: 'delivered',
  bounced: 'bounced',
  not_sent: 'notsent',
};

const STATE_WORDS = {
  queued: 'stateQueued',
  sent: 'stateSent',
  delivered: 'stateDelivered',
  reported_as_spam: 'stateReportedAsSpam',
  bounced: 'stateBounced',
  not_sent: 'stateNotSent',
} as const;

function DeliveryMark({ kind }: { kind: Mark }) {
  if (kind === 'delivered' || kind === 'sent')
    return (
      <span className={`mg-mark is-${kind}`} aria-hidden="true">
        <Glyph name="tick" size={8} weight={3.6} />
      </span>
    );
  if (kind === 'bounced')
    return (
      <span className="mg-mark is-bounced" aria-hidden="true">
        <Glyph name="clear" size={8} weight={3.4} />
      </span>
    );

  return <span className={`mg-mark is-${kind}`} aria-hidden="true" />;
}

function initials(name: string): string {
  return name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => [...part][0]?.toLocaleUpperCase() ?? '')
    .join('');
}

function ReachedPane({
  desk,
  id,
  ask,
  onBack,
}: {
  desk: Desk;
  id: string;
  ask: number;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const message = useMessage(desk.event.id, id, ask);

  if (message == null) return <Bones />;
  if (message === 'failed')
    return (
      <div className="mg-in">
        <p className="mg-idle-line" role="alert">
          {t('eventMessages.loadFailed')}
        </p>
      </div>
    );

  const { reached, of } = reachedOf(message);

  return (
    <div className="mg-in is-reached">
      <div className="mg-reached-top">
        <button type="button" className="desk-back" onClick={onBack}>
          <Glyph name="back" size={17} weight={2.4} />
          {titleOf(message)}
        </button>
      </div>
      <div className="mg-reached-body">
        <h2 className="mg-reached-sum" tabIndex={-1} data-focus="heading">
          {t('eventMessages.reached', { count: reached, total: of })}
        </h2>
        <ReachBar reached={reached} of={of} />
        <ul className="mg-people">
          {message.deliveries.map((delivery) => {
            const name = delivery.name ?? '';
            const why = delivery.state === 'not_sent' ? reasonWords(delivery.reason, t) : null;
            const lines = [
              why,
              delivery.at == null ? null : whenWords(delivery.at),
              'address' in delivery
                ? (delivery.address ??
                  (delivery.reason === 'no_address' ? null : t('eventMessages.noEmail')))
                : null,
            ].filter((line): line is string => line != null && line !== '');

            return (
              <li key={delivery.guestId} className="mg-person">
                <span className="mg-avatar is-40" aria-hidden="true">
                  {initials(name)}
                </span>
                <div className="mg-person-words">
                  <p className="mg-person-name">{name}</p>
                  <ul className="mg-person-lines">
                    <li>
                      <DeliveryMark kind={MARKS[delivery.state]} />
                      <span>
                        <strong>{t(`eventMessages.${STATE_WORDS[delivery.state]}`)}</strong>
                        {lines.length > 0 && ` · ${lines.join(' · ')}`}
                      </span>
                    </li>
                  </ul>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
