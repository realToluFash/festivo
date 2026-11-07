import type { ReactNode, RefObject } from 'react';
import { StyleSheet, type TextInputInstance, View, type ViewInstance } from 'react-native';

import { Text, type TextHandle } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Avatar } from '../settings/parts.tsx';
import { TextAction } from '../settings/Summary.tsx';
import { CheckCard, ResendCheck } from './CheckCard.tsx';
import { AnswerBox, MiniComposer, NewComposer, PreviewBar, ToHead } from './Composers.tsx';
import { GroupTile } from './MessagesList.tsx';
import {
  type Action,
  type Messages,
  type Open,
  checkOf,
  draftTitle,
  resultOf,
  toChip,
} from './MessagesModel.ts';
import {
  GUESTS,
  type GuestKey,
  INVITATION,
  NOW,
  PARKING,
  PARKING_BODY,
  PARKING_REACH,
  READER,
  SCHEDULED,
  SCHEDULED_AT,
  SCHEDULED_BODY,
  TO_ALL,
  TO_WORD,
  type ToGroup,
  EVENT,
  HOSTS,
} from './MessagesSample.ts';
import { CHANNEL_IN_LINE, CHANNEL_WORD, type ChannelKey, W, say } from './MessagesWords.ts';
import { Preview } from './Preview.tsx';
import {
  type Bit,
  CountdownLine,
  DayRule,
  FailedLine,
  GuestBubble,
  HostBubble,
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
  dispatch: (action: Action) => void;
  wide: boolean;
  columns: boolean;
  refFor: (key: string) => (node: ViewInstance | null) => void;
  headRef: RefObject<TextHandle | null>;
  checkRef: RefObject<TextHandle | null>;
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
  onNew: (to: ToGroup, picking: boolean) => void;
  onRetry: () => void;
  onConfirm: () => void;
  onCancelCountdown: () => void;
  onChangeIt: () => void;
  onSend: () => void;
  onResent: () => void;
  ownDesign: (what: string) => void;
}

export interface Parts {
  title: string;
  line?: string | undefined;
  right?: ReactNode;
  lead?: ReactNode;
  head?: ReactNode;
  stream: ReactNode;
  align: 'end' | 'start';
  bare?: boolean;
  foot?: ReactNode;
}

const many = `${W.onTheirPage.toLowerCase()} · told by Email and SMS`;

function toldBy(channels: Record<ChannelKey, boolean>): string {
  const words = (['email', 'sms', 'wa'] as const)
    .filter((key) => channels[key])
    .map((key) => CHANNEL_WORD[key]);

  return new Intl.ListFormat('en', { type: 'conjunction' }).format(words);
}

function told(channel: keyof typeof CHANNEL_IN_LINE): string {
  return say.toldBy(CHANNEL_IN_LINE[channel]);
}

function guestParts(talk: Talk, key: GuestKey): Parts {
  const { m } = talk;
  const guest = GUESTS[key];
  const answer = m.answers[key];
  const done = m.done.includes(key) || key === 'marta';
  const at = m.doneAt[key];
  const history: ReactNode[] = [];

  if (key === 'ines')
    history.push(
      <DayRule key="d1" text="Oct 12" />,
      <Stub
        key="inv"
        title={W.invitation}
        mark="mail"
        bits={[{ word: 'Email · Delivered', mark: 'delivered' }, { word: 'Seen Oct 13' }]}
      />,
      <DayRule key="d2" text="Mon, Nov 2" />,
      <Stub
        key="park"
        title={PARKING}
        mark="group"
        bits={[
          { word: W.onTheirPage },
          { word: told('email'), mark: 'delivered' },
          { word: say.seenAt('19:02') },
        ]}
      />,
      <DayRule key="d3" text={W.today} />,
    );
  if (key === 'kwame') {
    if (talk.wide) history.push(<DayRule key="d1" text="Mon, Nov 2" />);
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
  if (key === 'lucia') history.push(<DayRule key="d1" text={W.today} />);
  if (key === 'marta') history.push(<DayRule key="d1" text="Sat" />);

  const stream = (
    <>
      {history}
      <GuestBubble text={guest.asked.text} where={guest.asked.where} when={guest.asked.time} />
      {key === 'kwame' && <SystemLine text={W.cameBySms} mark="sms" />}
      {answer != null && (
        <HostBubble
          text={answer.text}
          settles={answer.seen == null}
          bits={[
            { word: W.onTheirPage, where: 'page' },
            { word: say.byAt(READER, answer.time) },
            { word: told(guest.channel), mark: 'delivered' },
            { word: answer.seen == null ? W.notSeenYet : say.seenAt(answer.seen) },
          ]}
        />
      )}
      {m.done.includes(key) && at != null && (
        <SystemLine text={say.doneBy(READER, at)} glyph="tick" />
      )}
    </>
  );
  const right = done ? (
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

  return {
    title: guest.name,
    line: guest.head,
    right,
    lead: <Avatar initials={guest.initials} side={44} tone={0} />,
    stream,
    align: 'end',
    foot: (
      <AnswerBox
        name={guest.name}
        channel={guest.channel}
        value={talk.typed}
        fieldRef={talk.answerRef}
        autoFocus={key === 'kwame' && talk.typed !== ''}
        onChange={talk.onTyped}
        onSend={() => talk.onAnswer(key)}
      />
    ),
  };
}

function draftParts(talk: Talk): Parts {
  const { m, dispatch } = talk;
  const draft = m.draft;
  if (draft == null) return { title: W.newMessage, stream: null, align: 'end' };
  const toWord = `${say.toGroup(toChip(draft.to))}`;
  const head = (
    <ToHead
      draft={draft}
      picking={m.picking}
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
      title: W.newMessage,
      head,
      stream: draft.cancelled && talk.wide ? <StatusLine text={W.cancelled} /> : null,
      align: 'end',
      foot: composer(true),
    };
  if (draft.step === 'preview')
    return {
      title: W.newMessage,
      bare: true,
      stream: <Preview draft={draft} columns={talk.columns} />,
      align: 'start',
      foot: (
        <PreviewBar
          sendRef={talk.refFor('send')}
          onEdit={() => dispatch({ type: 'edit' })}
          onSend={talk.onSend}
        />
      ),
    };
  if (draft.step === 'check')
    return {
      title: W.newMessage,
      line: talk.wide ? undefined : `${toWord} · ${toldBy(draft.channels)}`,
      head: talk.wide ? head : undefined,
      stream: (
        <CheckCard
          draft={draft}
          headRef={talk.checkRef}
          goRef={talk.refFor('go')}
          onGo={talk.onConfirm}
          onLater={() => talk.ownDesign(W.later)}
          onChange={talk.onChangeIt}
          onSeeAll={() => talk.ownDesign(say.seeAll(checkOf(draft).cantTell))}
        />
      ),
      align: 'end',
      foot: composer(false),
    };

  const result = resultOf(draft);
  const time = draft.step === 'sent' ? say.byAt(READER, NOW) : NOW;
  const bits: Bit[] =
    draft.step === 'sending' || draft.step === 'sent'
      ? [{ word: W.onTheirPage, where: 'page' }, { word: time }]
      : [{ word: NOW }];

  return {
    title: draftTitle(draft),
    line: Object.values(draft.channels).some(Boolean)
      ? `${toWord} · ${W.onTheirPage.toLowerCase()} · told by ${toldBy(draft.channels)}`
      : `${toWord} · ${W.onTheirPage.toLowerCase()}`,
    lead: <GroupTile side={44} />,
    stream: (
      <>
        <DayRule text={W.today} />
        <HostBubble
          subject={draft.subject}
          text={draft.body}
          bits={bits}
          faded={draft.step === 'failed'}
          settles={draft.step === 'sending'}
        />
        {draft.step === 'countdown' && (
          <CountdownLine
            seconds={draft.seconds}
            cancelRef={talk.refFor('cancel')}
            onCancel={talk.onCancelCountdown}
          />
        )}
        {draft.step === 'sending' && (
          <>
            <SendingLine soFar={result.soFar} of={result.count} />
            <StatusLine text={say.queued(result.count)} />
          </>
        )}
        {draft.step === 'sent' && (
          <Receipt
            reached={result.reached}
            of={result.count}
            seen={result.seen}
            onWho={() => talk.ownDesign(W.whoItReached)}
          />
        )}
        {draft.step === 'failed' && (
          <FailedLine retryRef={talk.refFor('retry')} onRetry={talk.onRetry} />
        )}
      </>
    ),
    align: 'end',
    foot: (
      <MiniComposer
        to={toChip(draft.to)}
        placeholder={W.writeAFollowUp}
        onOpen={(picking) => talk.onNew(draft.to, picking)}
      />
    ),
  };
}

function manyParts(talk: Talk, key: 'parking' | 'invite' | 'sched'): Parts {
  const { m } = talk;

  if (key === 'parking')
    return {
      title: PARKING,
      line:
        m.resending && !talk.wide ? `${TO_ALL} · 142 · Mon, Nov 2` : `${TO_ALL} · 142 · ${many}`,
      lead: <GroupTile side={44} />,
      stream: (
        <>
          <DayRule text="Mon, Nov 2" />
          <HostBubble
            subject={PARKING}
            text={PARKING_BODY}
            bits={[{ word: W.onTheirPage, where: 'page' }, { word: say.byAt(READER, '18:20') }]}
          />
          {m.resending ? (
            <ResendCheck
              headRef={talk.checkRef}
              onGo={talk.onResent}
              onChange={() => talk.dispatch({ type: 'resending', open: false })}
              onSeeAll={() => talk.ownDesign(say.seeAll(8))}
            />
          ) : (
            <Receipt
              reached={PARKING_REACH.reached}
              of={PARKING_REACH.of}
              seen={PARKING_REACH.seen}
              onWho={talk.onWho}
            />
          )}
        </>
      ),
      align: 'end',
      foot: m.resending ? undefined : (
        <MiniComposer
          to={toChip('all')}
          placeholder={W.writeAFollowUp}
          onOpen={(picking) => talk.onNew('all', picking)}
        />
      ),
    };
  if (key === 'invite')
    return {
      title: W.invitation,
      line: `${TO_ALL} · 142 · Email and SMS`,
      lead: <GroupTile side={44} />,
      stream: (
        <>
          <DayRule text="Mon, Oct 12" />
          <SystemLine text={say.sentWhenLive(READER)} glyph="events" />
          <SoirelyCard
            title={say.inviteTitle(EVENT, HOSTS)}
            lines={INVITATION.lines}
            bits={[{ word: W.soirelysOwn }]}
          />
          <Receipt
            reached={INVITATION.reached}
            of={INVITATION.of}
            seen={INVITATION.seen}
            onWho={() => talk.ownDesign(W.whoItReached)}
          />
          <SystemLine text={say.nowInvited(INVITATION.reached)} glyph="tick" />
        </>
      ),
      align: 'end',
      foot: (
        <MiniComposer
          to={toChip('all')}
          placeholder={W.writeToThem}
          onOpen={(picking) => talk.onNew('all', picking)}
        />
      ),
    };

  return {
    title: SCHEDULED,
    line: `${say.toGroup(TO_WORD.coming)} · 96 · ${W.scheduled}`,
    lead: <GroupTile side={44} />,
    stream: (
      <>
        <DayRule text="Thu, Nov 5" />
        <HostBubble subject={SCHEDULED} text={SCHEDULED_BODY} bits={[]} dashed />
        <Text size={13.5} weight="medium" style={styles.goes}>
          {say.goesAt(`${SCHEDULED_AT} London time`)}
        </Text>
        <View style={styles.scheduledActions}>
          <TextAction
            label={W.edit}
            onPress={() => talk.ownDesign(W.edit)}
            testID="messages.sched.edit"
          />
          <TextAction
            label={W.sendNow}
            onPress={() => talk.ownDesign(W.sendNow)}
            testID="messages.sched.now"
          />
          <TextAction
            label={W.cancelAsks}
            removes
            onPress={() => talk.ownDesign(W.cancelAsks)}
            testID="messages.sched.cancel"
          />
        </View>
      </>
    ),
    align: 'end',
  };
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
  scheduledActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    columnGap: tokens.spaceXxl,
  },
});
