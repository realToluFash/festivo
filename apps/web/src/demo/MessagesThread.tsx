import { type FormEvent, type ReactNode, useEffect, useId, useState } from 'react';

import { offButton } from '../offButton.ts';
import { Glyph } from '../components/Glyph.tsx';
import {
  type Answer,
  type Audience,
  type Channel,
  type ConvoId,
  type Draft,
  type GuestId,
  type MessagesState,
  type Sched,
  ANSWERS,
  GUESTS,
  RECEIPTS,
  HELD_TOO_LONG,
  MATCHES,
  MW,
  NOW,
  PARKING,
  READER,
  TICKS,
  UNKNOWN,
  ZONE_SHORT,
  checkOf,
  changeTitle,
  channelWord,
  chipWords,
  countOf,
  dayWords,
  draftOf,
  filled,
  freshId,
  isGuest,
  isSched,
  listed,
  many,
  noticeOf,
  outTitle,
  outsIn,
  toLine,
  toldWords,
} from './messages.ts';
import { Composer, ComposePane, ResendCard } from './MessagesCompose.tsx';
import { NoManage, SentToThread } from './MessagesSentTo.tsx';
import { INVITE_WORLD } from './messagesInvite.ts';
import { InviteCompose } from './MessagesInvite.tsx';
import { type World, MESSAGES_WORLD, isSentTo } from './messagesTo.ts';
import { TW } from './messagesToWords.ts';
import { type Bit, useInbox, whereBits } from './messagesContext.ts';
import { LaterDialog, MatchPicker } from './MessagesDialogs.tsx';
import {
  DayRule,
  GuestBubble,
  HostBubble,
  LeadMark,
  Stub,
  SystemLine,
  Words,
  WhereGlyph,
} from './MessagesParts.tsx';
import { ReachedView } from './MessagesReached.tsx';
import { RefusedSave } from './MessagesScheduled.tsx';
import {
  endBits,
  endLine,
  endedOf,
  refusalOf,
  reloaded,
  statusWord,
  typedEdit,
} from './messagesScheduled.ts';
import { useStopWriting } from './MessagesStop.tsx';
import { StreamItems } from './MessagesStream.tsx';
import { MessagesBell } from './MessagesTell.tsx';

export function ConversationPane({
  state,
  onDone,
}: {
  state: MessagesState | null;
  onDone: (id: ConvoId) => void;
}) {
  const { inbox } = useInbox();
  const pane = inbox.pane;

  if (inbox.loading)
    return (
      <section className="mg-pane is-loading" aria-hidden="true">
        <span className="mg-bone-bubble is-right b1" />
        <span className="mg-bone-bubble b2" />
        <span className="mg-bone-bubble is-right b3" />
        <span className="mg-bone-bubble b4" />
      </section>
    );

  return (
    <section className="mg-pane">
      {pane.kind === 'compose' && inbox.draft?.invite != null ? (
        <InviteCompose />
      ) : pane.kind === 'compose' ? (
        <ComposePane opening={state === 'to'} later={state === 'later'} />
      ) : pane.kind === 'reached' ? (
        <ReachedView key={pane.thread} of={pane.of} thread={pane.thread} state={state} />
      ) : pane.kind === 'convo' ? (
        <Thread key={pane.id} id={pane.id} state={state} onDone={onDone} />
      ) : (
        <Idle />
      )}
    </section>
  );
}

function Idle() {
  const { inbox, whyOff } = useInbox();
  const pick = whyOff == null ? MW.pickOne : MW.pickOneClosed;

  return (
    <div className="mg-in is-idle">
      <h2 className="desk-unseen">{MW.newMessage}</h2>
      <p className="mg-idle-line">{inbox.present.length === 0 ? MW.noneLine : pick}</p>
      <MiniComposer to={{ kind: 'all' }} placeholder={MW.writeToGuests} thread={freshId(inbox)} />
    </div>
  );
}

/** The composer waiting at the foot: its To, and a field that opens the full composer on the first key. */
export function MiniComposer({
  to,
  placeholder,
  thread,
  world,
}: {
  to: Audience;
  placeholder: string;
  thread: ConvoId;
  world?: World;
}) {
  const { act, focus, inbox, whyOff, to: event } = useInbox();

  if (!event.manage) return <NoManage />;

  function open(text: string, toPick: boolean): void {
    act({
      kind: 'compose',
      draft: {
        ...draftOf(to, 'write', false, thread),
        body: text === '' ? [] : [{ kind: 'text', text }],
        seed: (inbox.draft?.seed ?? 0) + 1,
        openTo: toPick,
      },
    });
    if (!toPick) focus('body');
  }

  return (
    <div className="mg-mini">
      <div className="mg-mini-to">
        <span>{MW.to}</span>
        <button
          type="button"
          className="mg-to-chip"
          aria-haspopup="dialog"
          aria-expanded="false"
          aria-describedby={whyOff}
          onClick={() => open('', true)}
          {...offButton(whyOff != null)}
        >
          {chipWords(to, event.book, world)}
          <Glyph name="chevdown" size={14} weight={2.6} />
        </button>
      </div>
      <div className="mg-mini-row">
        <input
          className="mg-mini-field"
          placeholder={placeholder}
          aria-label={placeholder}
          aria-describedby={whyOff}
          data-focus="follow"
          disabled={whyOff != null}
          value=""
          onChange={(event) => open(event.target.value, false)}
        />
        <button
          type="button"
          className="mg-send is-off"
          aria-label={MW.send}
          aria-describedby={whyOff}
          {...offButton(true, { dim: false })}
        >
          <Glyph name="send" size={20} weight={2.4} />
        </button>
      </div>
    </div>
  );
}

export function Head({
  lead,
  title,
  line,
  action,
}: {
  lead: ReactNode;
  title: string;
  line: string;
  action?: ReactNode;
}) {
  return (
    <header className="mg-head">
      {lead}
      <div className="mg-head-words">
        <h2 tabIndex={-1} data-focus="heading">
          {title}
        </h2>
        <p>{line}</p>
      </div>
      {action}
      <MessagesBell />
    </header>
  );
}

function Thread({
  id,
  state,
  onDone,
}: {
  id: ConvoId;
  state: MessagesState | null;
  onDone: (id: ConvoId) => void;
}) {
  const { inbox } = useInbox();

  if (isGuest(id) || id === 'unknown') return <GuestThread id={id} state={state} onDone={onDone} />;
  if (isSentTo(id)) return <SentToThread id={id} />;
  if (isSched(id) && outsIn(inbox, id).length === 0) {
    const sched = inbox.scheds.find((one) => one.id === id);

    if (sched != null) return <ScheduledThread sched={sched} state={state} />;
  }

  return <ManyThread id={id} />;
}

function answerBits(answer: Answer, toldBy: Channel): Bit[] {
  const base: Bit[] = [{ words: MW.onTheirPage }, { words: `${READER} · ${answer.at}` }];
  const by = answer.by ?? toldBy;
  const seen: Bit = {
    words: answer.seen == null ? MW.notSeenYet : filled(MW.seen, { time: answer.seen }),
  };

  if (answer.stage === 'sending') return [...base, { words: MW.sending, mark: 'sending' }];
  if (answer.notice === 'held')
    return [...base, { words: `${channelWord(by)} · ${MW.heldForCredits}`, mark: 'held' }, seen];
  if (answer.notice === 'tooLate')
    return [...base, { words: `${channelWord(by)} · ${MW.notSentTooLate}`, mark: 'notsent' }, seen];

  return [...base, { words: TOLD_BY[by], mark: 'delivered' }, seen];
}

const TOLD_BY = { email: MW.toldByEmail, sms: MW.toldBySms, whatsApp: MW.toldByWhatsApp } as const;
const ANSWER_BY = {
  email: MW.answerChannelEmail,
  sms: MW.answerChannelSms,
  whatsApp: MW.answerChannelWhatsApp,
} as const;

function GuestThread({
  id,
  state,
  onDone,
}: {
  id: GuestId | 'unknown';
  state: MessagesState | null;
  onDone: (id: ConvoId) => void;
}) {
  const { inbox, act, keys, focus, say, to } = useInbox();
  const [picking, setPicking] = useState(state === 'matchPicker' && id === 'unknown');
  const done = inbox.done.includes(id);
  const match = id === 'unknown' ? MATCHES.find((one) => one.name === inbox.matched) : null;
  const guest = id === 'unknown' ? null : GUESTS[id];
  const name = guest?.name ?? match?.name ?? UNKNOWN.address;
  const answers = inbox.answers[id] ?? [];
  const doneAt = inbox.doneAt[id];
  const toldBy = guest?.toldBy ?? 'email';
  const stop = useStopWriting(id, state);
  const action =
    to.manage && id === 'unknown' && match != null ? (
      <button type="button" className="desk-text" onClick={() => setPicking(true)}>
        {MW.changeGuest}
      </button>
    ) : !to.manage ? null : done ? (
      <button
        type="button"
        className="desk-text"
        aria-keyshortcuts={keys ? 'E' : undefined}
        onClick={() => {
          act({ kind: 'waiting', id });
          focus('heading');
        }}
      >
        {MW.markAsWaiting}
      </button>
    ) : (
      <button
        type="button"
        className="desk-text"
        aria-keyshortcuts={keys ? 'E' : undefined}
        onClick={() => onDone(id)}
      >
        <Glyph name="tick" size={17} weight={2.3} />
        {MW.markAsDone}
      </button>
    );

  return (
    <div className="mg-in">
      <Head
        lead={
          <LeadMark
            lead={
              guest != null || match != null
                ? {
                    kind: 'guest',
                    initials: guest?.initials ?? match?.initials ?? '',
                    unread: true,
                  }
                : { kind: 'unknown' }
            }
            size={44}
          />
        }
        title={name}
        line={
          guest?.contact ??
          (match == null
            ? `${MW.email} · ${MW.notMatched}`
            : `${UNKNOWN.address} · ${MW.matchedByHand}`)
        }
        action={
          <>
            {action}
            {stop.more}
          </>
        }
      />
      {stop.inset}
      <ol className="mg-stream" role="log" aria-label={name}>
        {id === 'ines' && (
          <>
            <DayRule>Oct 12</DayRule>
            <Stub
              title={MW.invitation}
              glyph="mail"
              bits={[
                { words: `${MW.email} · ${MW.delivered}`, mark: 'delivered' },
                { words: filled(MW.seen, { time: 'Oct 13' }) },
              ]}
            />
          </>
        )}
        {(id === 'ines' || id === 'kwame') && (
          <>
            <DayRule>{PARKING.day}</DayRule>
            <Stub
              title={PARKING.subject}
              glyph="group"
              bits={[
                { words: MW.onTheirPage },
                { words: id === 'ines' ? MW.toldByEmail : MW.toldBySms, mark: 'delivered' },
                { words: id === 'ines' ? filled(MW.seen, { time: '19:02' }) : MW.notSeenYet },
              ]}
            />
          </>
        )}
        {guest == null ? (
          <>
            <DayRule>{UNKNOWN.day}</DayRule>
            <GuestBubble text={UNKNOWN.text} bits={whereBits('email', UNKNOWN.at)} />
            {match == null ? (
              <li className="mg-match">
                <p>
                  {filled(to.manage ? MW.couldntMatch : TW.notMatchedYet, {
                    address: UNKNOWN.address,
                  })}
                </p>
                {to.manage && (
                  <button
                    type="button"
                    className="button button-primary mg-choose"
                    data-focus="choose"
                    onClick={() => setPicking(true)}
                  >
                    {MW.chooseGuest}
                  </button>
                )}
              </li>
            ) : (
              <SystemLine glyph="tick">
                {filled(MW.matchedLine, { name: match.name, by: READER, address: UNKNOWN.address })}
              </SystemLine>
            )}
          </>
        ) : (
          <>
            {id === 'lucia' && inbox.heldTooLong === true && (
              <>
                <DayRule>{HELD_TOO_LONG.day}</DayRule>
                <GuestBubble
                  text={HELD_TOO_LONG.asked}
                  bits={whereBits('page', HELD_TOO_LONG.askedAt)}
                />
                <HostBubble
                  body={HELD_TOO_LONG.answer}
                  bits={answerBits(
                    {
                      text: HELD_TOO_LONG.answer,
                      at: HELD_TOO_LONG.answeredAt,
                      stage: 'told',
                      notice: 'tooLate',
                    },
                    toldBy,
                  )}
                  look="sent"
                />
              </>
            )}
            {id !== 'kwame' && <DayRule>{guest.day}</DayRule>}
            <GuestBubble
              text={guest.asked}
              bits={whereBits(
                guest.where,
                inbox.fresh === id ? MW.now : inbox.arrived === id ? NOW : guest.at,
              )}
            />
            {id === 'kwame' && <SystemLine glyph="sms">{MW.cameBySms}</SystemLine>}
          </>
        )}
        {answers.map((answer, index) => (
          <HostBubble
            key={index}
            body={answer.text}
            bits={answerBits(answer, toldBy)}
            look={answer.stage === 'sending' ? 'arriving' : 'sent'}
          />
        ))}
        {done && doneAt != null && (
          <SystemLine glyph="tick">{filled(MW.doneBy, { name: READER, time: doneAt })}</SystemLine>
        )}
      </ol>
      {(guest != null || match != null) && (
        <AnswerBox
          key={`${id}${match?.name ?? ''}`}
          id={id}
          name={name}
          toldBy={toldBy}
          canAlso={guest?.canAlso ?? []}
          typed={typedOf(state, id)}
        />
      )}
      {stop.ask}
      {picking && (
        <MatchPicker
          onCancel={() => {
            setPicking(false);
            focus(match == null ? 'choose' : 'heading');
          }}
          onMatch={(picked) => {
            setPicking(false);
            act({ kind: 'match', name: picked });
            say(filled(MW.matchedSaid, { name: picked }));
            focus('heading');
          }}
        />
      )}
    </div>
  );
}

function typedOf(state: MessagesState | null, id: GuestId | 'unknown'): string {
  if (state === 'channelReply' && id === 'kwame') return ANSWERS.kwame ?? '';
  if ((state === 'noticeCost' || state === 'noticeWaits') && id === 'lucia')
    return ANSWERS.lucia ?? '';

  return '';
}

function AnswerBox({
  id,
  name,
  toldBy,
  canAlso,
  typed,
}: {
  id: GuestId | 'unknown';
  name: string;
  toldBy: Channel;
  canAlso: readonly Channel[];
  typed: string;
}) {
  const { inbox, act, keys, tell, say, focus, whyOff, to } = useInbox();
  const [text, setText] = useState(typed);
  const [by, setBy] = useState<Channel>(toldBy);

  if (!to.manage) return <NoManage />;

  const blank = text.trim() === '';
  const notice = noticeOf(id, by, inbox.balance, canAlso);

  function send(event?: FormEvent): void {
    event?.preventDefault();
    if (blank) return;
    act({ kind: 'answer', id, text: text.trim(), ...(by === toldBy ? {} : { by }) });
    setText('');
  }

  function tellBy(channel: Channel): void {
    setBy(channel);
    say(filled(MW.answerLine, { name, channel: ANSWER_BY[channel] }));
    focus('answer');
  }

  return (
    <form className="mg-answer" onSubmit={send}>
      <p className="mg-answer-line">
        <Glyph name="page" size={15} />
        {filled(MW.answerLine, { name, channel: ANSWER_BY[by] })}
      </p>
      {whyOff == null && notice.cost != null && <p className="mg-answer-cost">{notice.cost}</p>}
      {whyOff == null && notice.waits != null && (
        <div className="mg-answer-wait">
          <p className="mg-answer-waits">
            <Glyph name="clock" size={15} weight={2.2} />
            {notice.waits}
          </p>
          <button
            type="button"
            className="desk-text"
            onClick={() => tell(`${MW.addCredits} has its own design.`)}
          >
            {MW.addCredits}
          </button>
          {notice.others.length > 0 && (
            <div className="mg-answer-others">
              <p>{MW.tellNowBy}</p>
              {notice.others.map((channel) => (
                <button
                  key={channel}
                  type="button"
                  className="button mg-answer-other"
                  aria-label={filled(MW.tellNowAs, { channel: ANSWER_BY[channel] })}
                  onClick={() => tellBy(channel)}
                >
                  {channelWord(channel)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="mg-answer-row">
        <textarea
          className="mg-answer-field"
          rows={1}
          aria-label={MW.yourAnswer}
          placeholder={MW.writeAnswer}
          aria-keyshortcuts={keys && whyOff == null ? 'R' : undefined}
          aria-describedby={whyOff}
          data-focus="answer"
          disabled={whyOff != null}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) send();
          }}
        />
        <button
          type="submit"
          className={blank ? 'mg-send is-off' : 'mg-send'}
          aria-label={MW.send}
          aria-keyshortcuts={whyOff == null ? 'Meta+Enter Control+Enter' : undefined}
          aria-describedby={whyOff}
          {...offButton(blank, { dim: false })}
        >
          <Glyph name="send" size={20} weight={2.4} />
        </button>
      </div>
    </form>
  );
}

function ManyThread({ id }: { id: ConvoId }) {
  const { inbox, to: event } = useInbox();
  const first = outsIn(inbox, id)[0];
  const resending = inbox.resend?.thread === id;
  const fixed = id === 'parking' || id === 'invite' || id === 'receipts';
  const to: Audience = fixed ? { kind: 'all' } : (first?.to ?? { kind: 'all' });
  const world = first?.invite == null ? MESSAGES_WORLD : INVITE_WORLD;
  const title = fixed
    ? id === 'invite'
      ? MW.invitation
      : PARKING.subject
    : first == null
      ? MW.newMessage
      : first.change == null
        ? outTitle(first)
        : changeTitle(first.change);
  const line =
    first?.change == null
      ? [
          toLine(to, event.book.groups),
          countOf(to, event.book.groups, world),
          id === 'invite'
            ? listed([MW.email, MW.sms])
            : toldWords(id === 'receipts' ? RECEIPTS.ticks : (first?.ticks ?? TICKS)),
        ]
          .filter((part) => part != null && part !== '')
          .join(' · ')
      : `${many('guests', first.change.count)} · ${listed(first.change.channels.map(channelWord))}`;

  return (
    <div className="mg-in">
      <Head lead={<LeadMark lead={{ kind: 'many' }} size={44} />} title={title} line={line} />
      <ol className="mg-stream" role="log" aria-label={title}>
        <StreamItems thread={id} />
        {resending && (
          <li className="mg-said is-host">
            <ResendCard />
          </li>
        )}
      </ol>
      {!resending && (
        <MiniComposer
          to={to}
          placeholder={id === 'invite' || first?.invite != null ? MW.writeToThem : MW.writeFollowUp}
          thread={id}
          world={world}
        />
      )}
    </div>
  );
}

type SchedMode = 'waiting' | 'edit' | 'sendNow' | 'cancelAsk';

function modeOf(state: MessagesState | null): SchedMode {
  switch (state) {
    case 'scheduledEdit':
      return 'edit';
    case 'sendNow':
      return 'sendNow';
    case 'cancelAsk':
      return 'cancelAsk';
    default:
      return 'waiting';
  }
}

/** A message scheduled for later (sc-3963): dashed until it goes, edited in the box, sent now through the check, or cancelled after asking. */
function ScheduledThread({ sched, state }: { sched: Sched; state: MessagesState | null }) {
  const { act, focus, say, tell, to: event } = useInbox();
  const [refused, setRefused] = useState(refusalOf(state));
  const [mode, setMode] = useState<SchedMode>(refused == null ? modeOf(state) : 'edit');
  const [words, setWords] = useState<Pick<Draft, 'subject' | 'body' | 'seed'>>({
    subject: sched.subject,
    body: refused == null ? sched.body : typedEdit(sched.body),
    seed: 0,
  });
  const [later, setLater] = useState(false);
  const ended = endedOf(sched);
  const ending = endLine(sched);
  const title = outTitle(sched);
  const when = { date: dayWords(sched.day), time: sched.time };
  const count = countOf(sched.to, event.book.groups) ?? 0;
  const check = checkOf(sched.to, sched.ticks, event.book.groups);

  function to(next: SchedMode, key: string): void {
    setMode(next);
    focus(key);
  }

  return (
    <div className="mg-in">
      <Head
        lead={<LeadMark lead={{ kind: 'many' }} size={44} />}
        title={title}
        line={[toLine(sched.to, event.book.groups), count, statusWord(sched)].join(' · ')}
      />
      <ol className="mg-stream" role="log" aria-label={title}>
        <DayRule>{when.date}</DayRule>
        <HostBubble
          subject={sched.subject}
          body={<Words body={sched.body} />}
          bits={endBits(sched)}
          look={
            sched.outcome === 'sent'
              ? 'sent'
              : ended
                ? 'greyed'
                : mode === 'edit'
                  ? 'dashedFaded'
                  : 'dashed'
          }
        >
          {ended ? null : mode === 'edit' ? (
            refused == null && <p className="mg-goes">{filled(MW.editing, when)}</p>
          ) : mode === 'waiting' ? (
            <>
              <p className="mg-goes">
                {filled(MW.goesAt, { when: `${when.date}, ${when.time} ${ZONE_SHORT}` })}
              </p>
              {event.manage && (
                <div className="mg-acts is-end">
                  <button
                    type="button"
                    className="desk-text"
                    data-focus="edit"
                    onClick={() => to('edit', 'body')}
                  >
                    {MW.edit}
                  </button>
                  <button
                    type="button"
                    className="desk-text"
                    data-focus="send-now"
                    onClick={() => to('sendNow', 'check')}
                  >
                    {MW.sendNow}
                  </button>
                  <button
                    type="button"
                    className="desk-text is-red"
                    data-focus="cancel-ask"
                    onClick={() => to('cancelAsk', 'keep')}
                  >
                    {MW.cancelEllipsis}
                  </button>
                </div>
              )}
            </>
          ) : null}
        </HostBubble>
        {ending != null && (
          <SystemLine glyph={sched.cancelledAt != null ? 'clear' : 'clock'}>{ending}</SystemLine>
        )}
        {mode === 'sendNow' && !ended && (
          <li className="mg-said is-host">
            <div className="mg-check" role="alertdialog" aria-label={MW.checkName}>
              <p className="mg-check-sentence" tabIndex={-1} data-focus="check">
                {many('cannotUndo', count)}
              </p>
              <p className="mg-check-line">{filled(MW.goesNowInstead, when)}</p>
              <ul className="mg-pills">
                {check.pills.map((pill) => (
                  <li key={pill.channel}>
                    <WhereGlyph where={pill.channel} size={15} />
                    {channelWord(pill.channel)} · {pill.count}
                  </li>
                ))}
              </ul>
              <p className="mg-cant-head">{filled(MW.cantBeTold, { count: check.cantTell })}</p>
              {check.credits != null && <p className="mg-credits">{check.credits}</p>}
              <div className="mg-check-acts">
                <button
                  type="button"
                  className="button button-primary mg-go"
                  onClick={() => {
                    act({ kind: 'sendNow', id: sched.id });
                    focus('cancel');
                  }}
                >
                  {many('sendTo', count)}
                </button>
                <button
                  type="button"
                  className="desk-text"
                  onClick={() => to('waiting', 'send-now')}
                >
                  {MW.keepScheduled}
                </button>
              </div>
            </div>
          </li>
        )}
        {mode === 'cancelAsk' && !ended && (
          <li className="mg-said is-host">
            <CancelAsk
              subject={title}
              onKeep={() => to('waiting', 'cancel-ask')}
              onCancel={() => {
                act({ kind: 'resched', id: sched.id, sched: { cancelledAt: '09:46' } });
                say(MW.cancelledSaid);
                to('waiting', 'heading');
              }}
            />
          </li>
        )}
        {refused != null && (
          <RefusedSave
            refusal={refused}
            onReload={() => {
              const now = reloaded(refused, sched);

              act({ kind: 'resched', id: sched.id, sched: now });
              setRefused(null);
              setWords({
                subject: sched.subject,
                body: now.body ?? sched.body,
                seed: words.seed + 1,
              });
              to('waiting', 'heading');
            }}
          />
        )}
      </ol>
      {mode === 'edit' && !ended && (
        <Composer
          draft={words}
          tools
          refused={null}
          onDraft={(next) => setWords((now) => ({ ...now, ...next }))}
          onPreview={() => tell(`${MW.preview} has its own design.`)}
          onSend={() => {
            if (refused != null) return focus('refused-save');
            act({
              kind: 'resched',
              id: sched.id,
              sched: { subject: words.subject, body: words.body },
            });
            say(MW.savedSaid);
            to('waiting', 'edit');
          }}
          editing={{ onChangeWhen: () => setLater(true) }}
        />
      )}
      {later && (
        <LaterDialog
          day={sched.day}
          time={sched.time}
          onCancel={() => setLater(false)}
          onNow={() => {
            setLater(false);
            to('sendNow', 'check');
          }}
          onSchedule={(day, time) => {
            setLater(false);
            act({ kind: 'resched', id: sched.id, sched: { day, time } });
            say(filled(MW.scheduledSaid, { date: dayWords(day), time }));
          }}
        />
      )}
    </div>
  );
}

function CancelAsk({
  subject,
  onKeep,
  onCancel,
}: {
  subject: string;
  onKeep: () => void;
  onCancel: () => void;
}) {
  const questionId = useId();
  const lineId = useId();

  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onKeep();
    };

    document.addEventListener('keydown', keys);

    return () => document.removeEventListener('keydown', keys);
  }, [onKeep]);

  return (
    <div
      className="mg-ask"
      role="alertdialog"
      aria-labelledby={questionId}
      aria-describedby={lineId}
    >
      <p id={questionId} className="mg-ask-question">
        {filled(MW.cancelSubject, { subject })}
      </p>
      <p id={lineId} className="mg-check-line">
        {MW.cancelLine}
      </p>
      <div className="mg-acts is-end">
        <button type="button" className="desk-text" data-focus="keep" onClick={onKeep}>
          {MW.keepIt}
        </button>
        <button type="button" className="mg-danger" onClick={onCancel}>
          {MW.cancelMessage}
        </button>
      </div>
    </div>
  );
}
