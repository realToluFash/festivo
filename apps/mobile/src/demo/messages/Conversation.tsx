import type { ReactNode, Ref, RefObject } from 'react';
import { StyleSheet, type TextInputInstance, View, type ViewInstance } from 'react-native';

import { moveScreenReaderFocus } from '../../components/screenReaderFocus.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { Text, type TextHandle } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Avatar } from '../../components/SettingsParts.tsx';
import { TextAction } from '../../components/Summary.tsx';
import { BigButton, CancelAsk, CheckCard, ResendCheck } from './CheckCard.tsx';
import { sendWithout } from './CheckWaits.ts';
import { AnswerBox, MiniComposer, NewComposer, PreviewBar, ToHead } from './Composers.tsx';
import { GroupTile } from './MessagesList.tsx';
import {
  type Action,
  type Answer,
  type Draft,
  type Messages,
  type Open,
  type ReachedOf,
  channelsWords,
  checkOf,
  dayWords,
  rowDay,
  draftTitle,
  messageName,
  noticeCostOf,
  noticeCreditsOf,
  resultOf,
  tellNowBy,
  tellingBy,
  toChip,
} from './MessagesModel.ts';
import { resendOf } from './Reach.ts';
import {
  GUESTS,
  type GuestKey,
  INVITATION,
  type ManyKey,
  PARKING,
  PARKING_BODY,
  PARKING_REACH,
  READER,
  SCHEDULE_AT,
  DAYS,
  PARKING_TIME,
  TO_FIGURES,
  EVENT,
  HOSTS,
  HELD_TOO_LONG,
  RECEIPTS,
  NOW,
  TELL,
  OTHER_CHANNELS,
} from './MessagesSample.ts';
import { NOTE_SENT, changeTitle } from './TellKinds.ts';
import { CHANNEL_IN_LINE, CHANNEL_WORD, type ChannelKey, W, say } from './MessagesWords.ts';
import { Preview } from './Preview.tsx';
import { previewOf } from './PreviewModel.ts';
import { RefusedSave } from './RefusedSave.tsx';
import { SW, pausedWaits } from './ScheduledSave.ts';
import { clockNote } from './Sms.ts';
import { SMSW } from './SmsWords.ts';
import { type Stopping, headOf, stoppedLine } from './StopWriting.ts';
import {
  NoManageCard,
  NoticeAsk,
  RefusedLines,
  WindowClosed,
  noticeExtras,
} from './NoticeParts.tsx';
import {
  type NoticeCase,
  caseFor,
  guestOf,
  headLineOf,
  languageOf,
  quietLine,
  readsOnly,
  refusalOf as noticeRefusal,
} from './NoticeStates.ts';
import { NW } from './NoticeWords.ts';
import { MoreActions, StoppedInset } from './StopWritingParts.tsx';
import {
  type Bit,
  CountdownLine,
  DayRule,
  FailedLine,
  GuestBubble,
  HostBubble,
  PausedLine,
  Receipt,
  SendingLine,
  SoirelyCard,
  StatusLine,
  Stub,
  SystemLine,
} from './Stream.tsx';

/** What a conversation needs from the screen around it: the model, the refs that take focus, and the overlays it opens. */
export interface Talk {
  m: Messages;
  /** Why this event can't send (sc-3942's 409), read out on every way to send. */
  closed: string | null;
  dispatch: (action: Action) => void;
  wide: boolean;
  columns: boolean;
  refFor: (key: string) => (node: ViewInstance | null) => void;
  headRef: RefObject<TextHandle | null>;
  checkRef: RefObject<TextHandle | null>;
  subjectRef: RefObject<TextInputInstance | null>;
  bodyRef: RefObject<TextInputInstance | null>;
  answerRef: RefObject<TextInputInstance | null>;
  typed: string;
  onTyped: (text: string) => void;
  onAnswer: (key: GuestKey) => void;
  onDone: (key: GuestKey) => void;
  onTo: () => void;
  onInsert: () => void;
  onCaret: (at: number) => void;
  onWho: () => void;
  onWhoSent: () => void;
  locale: string;
  onWhoInvited: () => void;
  onFollowUp: (base: ManyKey | null) => void;
  onRetry: () => void;
  onConfirm: () => void;
  onCancelCountdown: () => void;
  onChangeIt: () => void;
  onSend: () => void;
  onResent: () => void;
  onMatch: () => void;
  onChannel: (key: ChannelKey) => void;
  onLater: () => void;
  onSaveScheduled: () => void;
  onCancelScheduled: () => void;
  ownDesign: (what: string) => void;
  stop: Stopping;
  moreRef: Ref<ViewInstance>;
  insetRef: Ref<TextHandle>;
  onActions: () => void;
  onLetAgain: (key: GuestKey) => void;
}

export interface Parts {
  title: string;
  titleLines?: number;
  line?: string | undefined;
  right?: ReactNode;
  lead?: ReactNode;
  head?: ReactNode;
  under?: ReactNode;
  stream: ReactNode;
  align: 'end' | 'start';
  bare?: boolean | undefined;
  foot?: ReactNode;
}

const SAMPLE_CHANNELS: readonly ChannelKey[] = ['email', 'sms'];
const HELD_CHANNELS: readonly ChannelKey[] = ['email', 'wa'];

function many(locale: string, channels = SAMPLE_CHANNELS): string {
  return say.onPageTold(channelsWords(channels, locale));
}

function toldBy(channels: Record<ChannelKey, boolean>, locale: string): string {
  return channelsWords(
    (['email', 'sms', 'wa'] as const).filter((key) => channels[key]),
    locale,
  );
}

const ALL = TO_FIGURES.all.count;

function told(channel: keyof typeof CHANNEL_IN_LINE): string {
  return say.toldBy(CHANNEL_IN_LINE[channel]);
}

/** How the notice of an answer went, as a mark and a word: told, held for credits, or held too long and not sent. */
function noticeBit(answer: Pick<Answer, 'by' | 'notice' | 'refused' | 'waits'>): Bit {
  if (answer.refused != null)
    return {
      word: say.where(CHANNEL_WORD[answer.by], `${W.notSent} · ${answer.refused.reason}`),
      mark: answer.refused.mark,
    };
  if (answer.waits != null)
    return { word: say.where(CHANNEL_WORD[answer.by], answer.waits), mark: 'sending' };
  switch (answer.notice) {
    case 'held':
      return { word: say.where(CHANNEL_WORD[answer.by], W.heldForCredits), mark: 'sending' };
    case 'tooLate':
      return { word: say.where(CHANNEL_WORD[answer.by], W.tooLate), mark: 'notsent' };
    default:
      return { word: told(answer.by), mark: 'delivered' };
  }
}

/** A sender Soirely could not match (sc-3976): their message and Choose the guest, then once matched the answer box. */
function unknownParts(talk: Talk): Parts {
  const { m } = talk;
  const guest = GUESTS.unknown;
  const matched = m.matched;
  const answer = m.answers.unknown;
  const kase = caseFor(m, 'unknown');
  const hidden = readsOnly(m);
  const reader = m.reader ?? READER;
  const doneOrWaiting = m.done.includes('unknown') ? (
    <TextAction
      label={W.markAsWaiting}
      onPress={() => talk.dispatch({ type: 'markWaiting', key: 'unknown' })}
      testID="messages.waiting"
    />
  ) : (
    <TextAction
      label={W.markAsDone}
      glyph="tick"
      onPress={() => talk.onDone('unknown')}
      testID="messages.done"
    />
  );

  return {
    title: matched ?? (hidden ? NW.unknownSender : guest.name),
    line:
      matched == null
        ? say.where(CHANNEL_WORD.email, W.notMatched)
        : say.where(guest.head, W.matchedByHand),
    right:
      headOf(talk.stop, 'unknown') === 'none' ? undefined : matched == null ? (
        doneOrWaiting
      ) : (
        <View style={styles.rights}>
          <TextAction label={W.changeGuest} onPress={talk.onMatch} testID="messages.changeGuest" />
          {doneOrWaiting}
        </View>
      ),
    lead: <Avatar initials={matched == null ? '?' : initialsOf(matched)} side={44} tone={0} />,
    stream: (
      <>
        <DayRule text={dayWords(DAYS.parking, talk.locale)} />
        <GuestBubble text={guest.asked.text} where="email" when={guest.asked.time} />
        {matched == null ? (
          <View style={styles.unmatched}>
            <Text size={14.5} weight="medium" style={styles.unmatchedLine}>
              {hidden ? NW.couldNotMatch : say.couldntMatch(guest.head)}
            </Text>
            {talk.stop.manage && (
              <BigButton
                label={W.chooseGuest}
                onPress={talk.onMatch}
                testID="messages.chooseGuest"
              />
            )}
          </View>
        ) : (
          <SystemLine text={say.matchedLine(matched, READER, guest.head)} glyph="tick" />
        )}
        {matched != null && kase?.extras != null && noticeExtras(kase.extras, matched)}
        {answer != null && (
          <HostBubble
            text={answer.text}
            settles={answer.seen == null}
            bits={[
              { word: W.onTheirPage, where: 'page' },
              { word: say.byAt(reader, answer.time) },
              { word: told('email'), mark: 'delivered' },
              { word: W.notSeenYet },
            ]}
          />
        )}
      </>
    ),
    align: 'end',
    foot: !talk.stop.manage ? (
      <NoManageCard />
    ) : matched == null ? undefined : (
      <AnswerBox
        name={matched}
        channel="email"
        value={talk.typed}
        reason={talk.closed}
        fieldRef={talk.answerRef}
        onChange={talk.onTyped}
        onSend={() => talk.onAnswer('unknown')}
      />
    ),
  };
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2);
}

function guestParts(talk: Talk, key: GuestKey): Parts {
  const { m } = talk;
  if (key === 'unknown') return unknownParts(talk);
  const guest = guestOf(m, key);
  const kase = caseFor(m, key);
  const reader = m.reader ?? READER;
  const answer = m.answers[key];
  const done = m.done.includes(key) || key === 'marta';
  const at = m.doneAt[key];
  const history: ReactNode[] = [];
  const asked = (
    <GuestBubble
      key="asked"
      text={guest.asked.text}
      where={guest.asked.where}
      when={guest.asked.time || rowDay(guest.asked.day, '', talk.locale)}
    />
  );

  if (kase?.askedFirst === true)
    history.push(<DayRule key="d0" text={dayWords(guest.asked.day, talk.locale)} />, asked);

  if (key === 'ines')
    history.push(
      <DayRule key="d1" text={dayWords(DAYS.invite, talk.locale)} />,
      <Stub
        key="inv"
        title={W.invitation}
        mark="mail"
        bits={[
          { word: say.where(CHANNEL_WORD.email, W.delivered), mark: 'delivered' },
          { word: say.seenAt(rowDay(DAYS.inviteSeen, '', talk.locale)) },
        ]}
      />,
      <DayRule key="d2" text={dayWords(DAYS.parking, talk.locale)} />,
      <Stub
        key="park"
        title={PARKING}
        mark="group"
        bits={[{ word: W.onTheirPage }, parkingBit(kase), { word: say.seenAt('19:02') }]}
      />,
      <DayRule key="d3" text={W.today} />,
    );
  if (key === 'kwame') {
    if (talk.wide || kase?.askedFirst === true)
      history.push(<DayRule key="d1" text={dayWords(DAYS.parking, talk.locale)} />);
    history.push(
      <Stub
        key="park"
        title={PARKING}
        mark="group"
        bits={[
          { word: W.onTheirPage },
          { word: told('sms'), mark: 'delivered' },
          { word: W.notSeenYet },
        ]}
      />,
    );
  }
  if (key === 'lucia' && m.heldTooLong)
    history.push(
      <DayRule key="d0" text={dayWords(HELD_TOO_LONG.day, talk.locale)} />,
      <GuestBubble
        key="ask0"
        text={HELD_TOO_LONG.asked}
        where="page"
        when={HELD_TOO_LONG.askedAt}
      />,
      <HostBubble
        key="ans0"
        text={HELD_TOO_LONG.answer}
        settles={false}
        bits={[
          { word: W.onTheirPage, where: 'page' },
          { word: say.byAt(READER, HELD_TOO_LONG.answeredAt) },
          noticeBit({ by: 'wa', notice: 'tooLate' }),
          { word: W.notSeenYet },
        ]}
      />,
    );
  if (key === 'lucia' || key === 'valentina')
    history.push(
      <DayRule
        key="d1"
        text={guest.asked.day === DAYS.today ? W.today : dayWords(guest.asked.day, talk.locale)}
      />,
    );
  if (key === 'marta') history.push(<DayRule key="d1" text={dayWords(DAYS.marta, talk.locale)} />);

  const stream = (
    <>
      {history}
      {kase?.askedFirst !== true && asked}
      {key === 'kwame' && kase == null && <SystemLine text={W.cameBySms} mark="sms" />}
      {kase?.extras != null && noticeExtras(kase.extras, guest.name)}
      {answer != null && (
        <HostBubble
          text={answer.text}
          settles={answer.seen == null}
          bits={[
            { word: W.onTheirPage, where: 'page' },
            { word: say.byAt(reader, answer.time) },
            noticeBit(answer),
            { word: answer.seen == null ? W.notSeenYet : say.seenAt(answer.seen) },
          ]}
        />
      )}
      {m.done.includes(key) && at != null && (
        <SystemLine text={say.doneBy(reader, at)} glyph="tick" />
      )}
    </>
  );
  const doneOrWaiting = done ? (
    <TextAction
      label={W.markAsWaiting}
      onPress={() => talk.dispatch({ type: 'markWaiting', key })}
      testID="messages.waiting"
    />
  ) : (
    <TextAction
      label={W.markAsDone}
      glyph="tick"
      onPress={() => talk.onDone(key)}
      testID="messages.done"
    />
  );
  const { stop } = talk;
  const stopped = stop.stopped[key];
  const head = headOf(stop, key);
  const change = kase?.shared != null && (
    <TextAction label={W.changeGuest} onPress={talk.onMatch} testID="messages.changeGuest" />
  );
  const right =
    head === 'none' ? undefined : head === 'doneAndMore' ? (
      <View style={styles.withMore}>
        {change}
        {doneOrWaiting}
        <MoreActions open={stop.menu} onPress={talk.onActions} buttonRef={talk.moreRef} />
      </View>
    ) : (
      doneOrWaiting
    );

  return {
    title: guest.name,
    line: headLineOf(m, key, talk.locale),
    right,
    lead: <Avatar initials={guest.initials} side={44} tone={0} />,
    under:
      stopped == null ? undefined : (
        <StoppedInset
          line={stoppedLine(stopped, talk.locale)}
          manage={stop.manage}
          saving={stop.saving === 'letAgain'}
          failed={stop.failed === 'letAgain'}
          lineRef={talk.insetRef}
          onLetAgain={() => talk.onLetAgain(key)}
        />
      ),
    stream,
    align: 'end',
    foot: !stop.manage ? (
      <NoManageCard />
    ) : (
      <AnswerBox
        name={guest.name}
        channel={tellingBy(m, key)}
        cost={noticeCostOf(m, key)}
        others={tellNowBy(m, key)}
        value={talk.typed}
        reason={talk.closed}
        fieldRef={talk.answerRef}
        autoFocus={(key === 'kwame' || kase != null) && talk.typed !== ''}
        onChange={talk.onTyped}
        onTellBy={(channel) => talk.dispatch({ type: 'tellBy', key, channel })}
        onSend={() => talk.onAnswer(key)}
        notice={kase == null ? {} : noticeOf(talk, key, kase)}
      />
    ),
  };
}

function parkingBit(kase: NoticeCase | null): Bit {
  if (kase?.parking === 'bounced')
    return { word: say.where(CHANNEL_WORD.email, W.bounced), mark: 'bounced' };
  if (kase?.parking === 'spam')
    return { word: say.where(CHANNEL_WORD.email, NW.reportedAsSpam), mark: 'delivered' };

  return { word: told('email'), mark: 'delivered' };
}

/** sc-3976's lines in the answer box: the 24 hours closed, the refusal, the quiet-hours wait, Ask an owner. */
function noticeOf(talk: Talk, key: GuestKey, kase: NoticeCase) {
  const { m } = talk;
  const by = tellingBy(m, key);
  const refusal =
    kase.blocks == null
      ? null
      : noticeRefusal(
          by,
          kase.blocks,
          othersOf(key, kase),
          languageOf(key, talk.locale),
          (one) => noticeCreditsOf(key, one) <= m.balance,
        );

  return {
    closed: kase.windowClosed === true ? <WindowClosed again={refusal == null} /> : undefined,
    refused:
      refusal == null ? undefined : (
        <RefusedLines
          refusal={refusal}
          name={guestOf(m, key).name}
          channel={by}
          onTellBy={(channel) => talk.dispatch({ type: 'tellBy', key, channel })}
        />
      ),
    quiet: refusal == null && kase.quiet != null ? quietLine(by, kase.quiet) : null,
    ask: kase.ask == null ? undefined : <NoticeAsk start={kase.ask} />,
  };
}

function othersOf(key: GuestKey, kase: NoticeCase): readonly ChannelKey[] {
  return kase.others ?? OTHER_CHANNELS[key] ?? [];
}

/** The resend's check, in the conversation of the message whose Who it reached asked for it. */
function Resend({ talk, of }: { talk: Talk; of: ReachedOf }) {
  const check = resendOf(talk.m, of);

  return (
    <ResendCheck
      check={check}
      headRef={talk.checkRef}
      onGo={talk.onResent}
      onChange={() => talk.dispatch({ type: 'resending', open: false })}
      onSeeAll={() => talk.ownDesign(say.seeAll(check.still))}
      onBack={() => {
        talk.dispatch({ type: 'resending', open: false });
        talk.dispatch({ type: 'open', open: { kind: 'reached', of } });
      }}
    />
  );
}

/** A message the hosts sent: their words, then where it went and what happened (the receipt once it is sent). */
function SentMessage({
  talk,
  draft,
  last,
  follow = false,
}: {
  talk: Talk;
  draft: Draft;
  last: boolean;
  follow?: boolean;
}) {
  const result = resultOf(draft);
  const time = draft.step === 'sent' || !last || follow ? say.byAt(READER, draft.time) : draft.time;
  const reach = last
    ? []
    : [{ word: `${say.reached(result.reached, result.count)} · ${say.seenBy(result.seen)}` }];
  const bits: Bit[] =
    draft.step === 'sending' || draft.step === 'sent'
      ? [{ word: W.onTheirPage, where: 'page' }, { word: time }, ...reach]
      : [{ word: draft.time }];

  return (
    <>
      <HostBubble
        subject={draft.subject}
        text={draft.body}
        bits={bits}
        faded={draft.step === 'failed'}
        settles={last && draft.step === 'sending'}
      />
      {last && draft.step === 'countdown' && (
        <CountdownLine
          seconds={draft.seconds}
          cancelRef={talk.refFor('cancel')}
          onCancel={talk.onCancelCountdown}
        />
      )}
      {draft.step === 'sending' && (
        <>
          <SendingLine soFar={result.soFar} of={result.count} />
          {last && !follow && <StatusLine text={say.queued(result.count)} />}
        </>
      )}
      {last && draft.step === 'sent' && (
        <Receipt
          reached={result.reached}
          of={result.count}
          seen={result.seen}
          onWho={talk.onWhoSent}
        />
      )}
      {last && draft.step === 'failed' && (
        <FailedLine retryRef={talk.refFor('retry')} onRetry={talk.onRetry} />
      )}
      {last && talk.m.resending && <Resend talk={talk} of="draft" />}
    </>
  );
}

interface Own {
  head?: ReactNode;
  line?: string | undefined;
  stream: ReactNode;
  bare?: boolean | undefined;
  align: 'end' | 'start';
  foot: ReactNode;
  writing: boolean;
}

/** The active thread's own messages, after whatever it follows up: those sent, then the one being written, checked or sent. */
function ownParts(talk: Talk, followUp: string): Own {
  const { m, dispatch } = talk;
  const draft = m.draft;
  const thread = m.thread;
  if (draft == null || thread == null)
    return { stream: null, align: 'end', foot: null, writing: false };
  const locked = thread.base != null || thread.earlier.length > 0;
  const toWord = say.toGroup(toChip(draft.to));
  const earlier = [
    ...thread.earlier.map((one, index) => (
      <SentMessage key={index} talk={talk} draft={one} last={false} />
    )),
    ...(thread.earlier.length > 0
      ? [<SystemLine key="followUp" text={say.followUpLine(resultOf(draft).count)} mark="group" />]
      : []),
  ];
  const head = (
    <ToHead
      draft={draft}
      picking={m.picking}
      locked={locked}
      toRef={talk.refFor('to')}
      onTo={talk.onTo}
      onChannel={(key) => dispatch({ type: 'channel', key })}
    />
  );
  const composer = (tools: boolean) => (
    <NewComposer
      draft={draft}
      tools={tools}
      autoFocus={draft.cancelled}
      locale={talk.locale}
      subjectRef={talk.subjectRef}
      bodyRef={talk.bodyRef}
      sendRef={talk.refFor('send')}
      insertRef={talk.refFor('insert')}
      onSubject={(text) => dispatch({ type: 'subject', text })}
      onBody={(text) => dispatch({ type: 'body', text })}
      onCaret={talk.onCaret}
      onInsert={talk.onInsert}
      onPreview={() => dispatch({ type: 'preview' })}
      onSend={talk.onSend}
    />
  );

  if (draft.step === 'write')
    return {
      head,
      stream: (
        <>
          {earlier}
          {draft.cancelled && talk.wide && <StatusLine text={W.cancelled} />}
        </>
      ),
      align: 'end',
      foot: composer(true),
      writing: true,
    };
  if (draft.step === 'preview')
    return {
      bare: true,
      stream: (
        <Preview
          draft={draft}
          columns={talk.columns}
          phone={!talk.wide}
          as={previewOf(m)}
          dispatch={dispatch}
        />
      ),
      align: 'start',
      foot: (
        <PreviewBar
          sendRef={talk.refFor('send')}
          onEdit={() => dispatch({ type: 'edit' })}
          onSend={talk.onSend}
        />
      ),
      writing: true,
    };
  const note = clockNote(m.clock);
  if (draft.step === 'check')
    return {
      head: talk.wide ? head : undefined,
      line: talk.wide ? undefined : `${toWord} · ${toldBy(draft.channels, talk.locale)}`,
      stream: (
        <>
          {earlier}
          <CheckCard
            draft={draft}
            locale={talk.locale}
            headRef={talk.checkRef}
            goRef={talk.refFor('go')}
            onGo={talk.onConfirm}
            onLater={talk.onLater}
            onChange={talk.onChangeIt}
            onKeep={() => dispatch({ type: 'keepScheduled' })}
            onChannel={talk.onChannel}
            onSeeAll={(count) => talk.ownDesign(say.seeAll(count))}
            balance={m.balance}
            waits={m.waits}
            clock={m.clock}
            onWithout={(drops) => {
              for (const action of sendWithout(drops)) dispatch(action);
            }}
          />
          {note != null && (
            <DemoOnly title={SMSW.demoTitle}>
              <Text size={13.5} weight="medium" style={styles.note}>
                {note}
              </Text>
            </DemoOnly>
          )}
        </>
      ),
      align: 'end',
      foot: composer(false),
      writing: true,
    };

  return {
    line: Object.values(draft.channels).some(Boolean)
      ? `${toWord} · ${say.onPageTold(toldBy(draft.channels, talk.locale))}`
      : `${toWord} · ${say.onPage}`,
    stream: (
      <>
        {earlier}
        <SentMessage talk={talk} draft={draft} last follow={thread.earlier.length > 0} />
      </>
    ),
    align: 'end',
    foot: talk.m.resending ? null : (
      <MiniComposer
        to={toChip(draft.to)}
        placeholder={followUp}
        off={draft.step !== 'sent'}
        onOpen={() => talk.onFollowUp(thread.base)}
      />
    ),
    writing: false,
  };
}

/** How a scheduled message stands: Scheduled, or how it ended. */
function scheduledWord(draft: Draft, locale: string): string {
  if (draft.step === 'cancelled') return W.cancelledTag;
  if (draft.outcome === 'sent') return say.onPageTold(toldBy(draft.channels, locale));

  return draft.outcome === 'tooLate' ? W.tooLate : W.scheduled;
}

function endBits(draft: Draft, when: string): Bit[] {
  if (draft.outcome === 'sent')
    return [{ word: W.onTheirPage, where: 'page' }, { word: say.byAt(READER, draft.time) }];
  if (draft.outcome === 'tooLate') return [{ word: W.tooLate, mark: 'notsent' }];

  return draft.paused === true && draft.step === 'scheduled'
    ? [{ word: W.scheduled, ring: true }, { word: when }]
    : [];
}

/** A scheduled message (sc-3963): dashed until it goes, with Edit, Send now and Cancel…, each drawn on Messaging-B-Phone-3. */
function scheduledParts(talk: Talk, draft: Draft): Parts {
  const { dispatch } = talk;
  const at = draft.at ?? SCHEDULE_AT;
  const day = dayWords(at.date, talk.locale);
  const cancelled = draft.step === 'cancelled';
  const paused = draft.paused === true && !cancelled && draft.outcome == null;
  const refused = talk.m.refusedSave;
  const shown = draft.was ?? { subject: draft.subject, body: draft.body };
  const bubble = (
    <HostBubble
      subject={shown.subject}
      text={shown.body}
      bits={endBits(draft, say.inZone(day, at.time, W.londonTime))}
      dashed={!cancelled && draft.outcome == null}
      greyed={cancelled || draft.outcome === 'tooLate'}
      faded={draft.was != null}
    />
  );
  let rest: ReactNode = null;
  let foot: ReactNode;

  if (cancelled)
    rest = (
      <SystemLine
        text={say.cancelledBy(draft.cancelledBy ?? READER, draft.cancelledAt ?? '')}
        {...(draft.finished === true ? { more: SW.finishedWhy } : {})}
        glyph="x"
      />
    );
  else if (draft.outcome === 'tooLate') rest = <SystemLine text={SW.tooLateWhy} glyph="clock" />;
  else if (draft.outcome === 'sent') rest = null;
  else if (draft.was != null) {
    rest =
      refused == null ? (
        <>
          {paused && talk.wide && <PausedLine text={pausedWaits()} />}
          <Text size={13.5} weight="medium" style={styles.goes}>
            {paused ? SW.editingPaused : say.editing(day, at.time)}
          </Text>
        </>
      ) : (
        <RefusedSave
          refusal={refused}
          alertRef={talk.refFor('refused')}
          onReload={() => {
            dispatch({ type: 'reload' });
            setTimeout(() => moveScreenReaderFocus(talk.headRef.current), 350);
          }}
        />
      );
    foot = (
      <NewComposer
        draft={draft}
        bodyRef={talk.bodyRef}
        insertRef={talk.refFor('insert')}
        onSubject={(text) => dispatch({ type: 'subject', text })}
        onBody={(text) => dispatch({ type: 'body', text })}
        onCaret={talk.onCaret}
        onInsert={talk.onInsert}
        editing={{ onChangeWhen: talk.onLater, onSave: talk.onSaveScheduled }}
      />
    );
  } else if (draft.step === 'check')
    rest = (
      <CheckCard
        draft={draft}
        locale={talk.locale}
        headRef={talk.checkRef}
        goRef={talk.refFor('go')}
        onGo={talk.onConfirm}
        onLater={talk.onLater}
        onChange={talk.onChangeIt}
        onKeep={() => dispatch({ type: 'keepScheduled' })}
        onChannel={talk.onChannel}
        onSeeAll={() => talk.ownDesign(say.seeAll(checkOf(draft).cantTell))}
      />
    );
  else if (draft.asking)
    rest = (
      <CancelAsk
        subject={messageName(draft)}
        keepRef={talk.refFor('keep')}
        onKeep={() => dispatch({ type: 'askCancel', open: false })}
        onCancel={talk.onCancelScheduled}
      />
    );
  else if (readsOnly(talk.m))
    rest = (
      <Text size={13.5} weight="medium" style={styles.goes}>
        {say.goesAt(say.inZone(day, at.time, W.londonTime))}
      </Text>
    );
  else
    rest = (
      <>
        {paused ? (
          <PausedLine text={pausedWaits()} />
        ) : (
          <Text size={13.5} weight="medium" style={styles.goes}>
            {say.goesAt(say.inZone(day, at.time, W.londonTime))}
          </Text>
        )}
        <View style={styles.scheduledActions}>
          <TextAction
            ref={talk.refFor('schedEdit')}
            label={W.edit}
            onPress={() => {
              dispatch({ type: 'editScheduled' });
              setTimeout(() => talk.bodyRef.current?.focus(), 400);
            }}
            testID="messages.sched.edit"
          />
          <TextAction
            label={W.sendNow}
            onPress={() => dispatch({ type: 'sendNow' })}
            testID="messages.sched.now"
          />
          <TextAction
            ref={talk.refFor('askCancel')}
            label={W.cancelAsks}
            removes
            onPress={() => dispatch({ type: 'askCancel', open: true })}
            testID="messages.sched.cancel"
          />
        </View>
      </>
    );

  return {
    title: messageName(draft),
    titleLines: 1,
    line: `${say.toGroup(toChip(draft.to))} · ${scheduledWord(draft, talk.locale)}`,
    lead: <GroupTile side={44} />,
    stream: (
      <>
        <DayRule text={at.date === DAYS.today ? W.today : day} />
        {bubble}
        {rest}
      </>
    ),
    align: 'end',
    foot,
  };
}

function draftParts(talk: Talk): Parts {
  const { m } = talk;
  if (m.draft == null) return { title: W.newMessage, stream: null, align: 'end' };
  if (m.draft.at != null || m.draft.step === 'cancelled') return scheduledParts(talk, m.draft);
  const own = ownParts(talk, W.writeAFollowUp);
  const sent = m.draft.step !== 'write' || (m.thread?.earlier.length ?? 0) > 0;

  return {
    title: draftTitle(m.draft, m.thread),
    titleLines: 1,
    line: own.line,
    lead: <GroupTile side={44} />,
    head: own.head,
    bare: own.bare,
    stream:
      own.writing && !sent ? (
        own.stream
      ) : (
        <>
          <DayRule text={W.today} />
          {own.stream}
        </>
      ),
    align: own.align,
    foot: own.foot,
  };
}

function manyParts(talk: Talk, key: ManyKey): Parts {
  const { m } = talk;
  const own = m.thread?.base === key && m.draft != null ? ownParts(talk, W.writeAFollowUp) : null;
  const followUp = (placeholder: string) =>
    own?.foot ?? (
      <MiniComposer
        to={toChip('all')}
        placeholder={placeholder}
        reason={talk.closed}
        onOpen={() => talk.onFollowUp(key)}
      />
    );
  const today =
    own == null || (own.writing && (m.thread?.earlier.length ?? 0) === 0) ? null : (
      <DayRule text={W.today} />
    );

  if (key === 'parking' || key === 'receipts') {
    const held = key === 'receipts';
    const reach = held ? RECEIPTS : PARKING_REACH;

    return {
      title: PARKING,
      titleLines: 1,
      line:
        own?.writing === true
          ? undefined
          : m.resending && !talk.wide
            ? `${W.toAllGuests} · ${ALL} · ${dayWords(DAYS.parking, talk.locale)}`
            : `${W.toAllGuests} · ${ALL} · ${many(talk.locale, held ? HELD_CHANNELS : undefined)}`,
      lead: <GroupTile side={44} />,
      head: own?.writing === true ? own.head : undefined,
      bare: own?.bare,
      stream:
        own?.bare === true ? (
          own.stream
        ) : (
          <>
            <DayRule text={dayWords(DAYS.parking, talk.locale)} />
            <HostBubble
              subject={PARKING}
              text={PARKING_BODY}
              bits={[
                { word: W.onTheirPage, where: 'page' },
                { word: say.byAt(READER, PARKING_TIME) },
              ]}
            />
            {m.resending ? (
              <Resend talk={talk} of={key} />
            ) : (
              <Receipt reached={reach.reached} of={reach.of} seen={reach.seen} onWho={talk.onWho} />
            )}
            {today}
            {own?.stream}
          </>
        ),
      align: own?.align ?? 'end',
      foot: m.resending || readsOnly(m) ? undefined : followUp(W.writeAFollowUp),
    };
  }
  if (key === 'change') {
    const row = m.changeRow ?? {
      what: m.change.what,
      reached: TELL.count - TELL.cannot,
      of: TELL.count,
    };

    return {
      title: changeTitle(row.what),
      titleLines: 1,
      line:
        own?.writing === true
          ? undefined
          : `${say.guestsCount(row.of)} · ${channelsWords(['email', 'sms', 'wa'], talk.locale)}`,
      lead: <GroupTile side={44} />,
      head: own?.writing === true ? own.head : undefined,
      bare: own?.bare,
      stream:
        own?.bare === true ? (
          own.stream
        ) : (
          <>
            <DayRule text={W.today} />
            <SoirelyCard
              title={say.changedSubject(EVENT)}
              lines={[...m.change.lines, W.openYourPage]}
              bits={[{ word: W.soirelysOwn }]}
            />
            <HostBubble
              text={NOTE_SENT}
              bits={[{ word: W.onTheirPage, where: 'page' }, { word: say.byAt(READER, NOW) }]}
            />
            <Receipt
              reached={row.reached}
              of={row.of}
              seen={3}
              onWho={() => talk.ownDesign(W.whoItReached)}
            />
            {own?.stream}
          </>
        ),
      align: own?.align ?? 'end',
      foot: readsOnly(m) ? undefined : followUp(W.writeToThem),
    };
  }
  if (key === 'invite')
    return {
      title: W.invitation,
      line:
        own?.writing === true
          ? undefined
          : `${W.toAllGuests} · ${ALL} · ${channelsWords(SAMPLE_CHANNELS, talk.locale)}`,
      lead: <GroupTile side={44} />,
      head: own?.writing === true ? own.head : undefined,
      bare: own?.bare,
      stream:
        own?.bare === true ? (
          own.stream
        ) : (
          <>
            <DayRule text={dayWords(DAYS.invite, talk.locale)} />
            <SystemLine text={say.sentWhenLive(READER)} glyph="events" />
            <SoirelyCard
              title={say.inviteTitle(EVENT, HOSTS)}
              lines={INVITATION.lines}
              bits={[{ word: W.soirelysOwn }]}
            />
            {m.resending ? (
              <Resend talk={talk} of="invite" />
            ) : (
              <Receipt
                reached={INVITATION.reached}
                of={INVITATION.of}
                seen={INVITATION.seen}
                onWho={talk.onWhoInvited}
              />
            )}
            <SystemLine text={say.nowInvited(INVITATION.reached)} glyph="tick" />
            {today}
            {own?.stream}
          </>
        ),
      align: own?.align ?? 'end',
      foot: m.resending || readsOnly(m) ? undefined : followUp(W.writeToThem),
    };
  return { title: W.invitation, stream: null, align: 'end' };
}

export function partsOf(talk: Talk, open: Exclude<Open, null | { kind: 'reached' }>): Parts {
  if (open.kind === 'guest') return guestParts(talk, open.key);
  if (open.kind === 'draft') return draftParts(talk);

  return manyParts(talk, open.key);
}

const styles = StyleSheet.create({
  goes: {
    alignSelf: 'flex-end',
    maxWidth: '86%',
    textAlign: 'right',
    color: tokens.colorInkSecondary,
    lineHeight: 13.5 * 1.45,
  },
  withMore: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  note: { lineHeight: 13.5 * 1.45 },
  rights: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.spaceLg,
  },
  unmatched: {
    gap: tokens.spaceMd,
    paddingVertical: 14,
    paddingHorizontal: tokens.spaceXl,
    borderRadius: 18,
    backgroundColor: tokens.colorInset,
    alignItems: 'flex-start',
  },
  unmatchedLine: { lineHeight: 14.5 * 1.45 },
  scheduledActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    columnGap: tokens.spaceXxl,
  },
});
