import { Fragment } from 'react';

import { Glyph } from '../components/Glyph.tsx';
import {
  type ConvoId,
  type Out,
  type Reach,
  EVENT_NAME,
  RECEIPTS_REACH,
  HOSTS,
  INVITE,
  INVITE_REACH,
  MW,
  PARKING,
  PARKING_OF,
  PARKING_SEEN,
  READER,
  filled,
  many,
  outReach,
  outsIn,
  reachFrom,
} from './messages.ts';
import { type Bit, useInbox } from './messagesContext.ts';
import { IW, REPLY_BY } from './messagesInvite.ts';
import type { Group } from './messagesTo.ts';
import { demoWords } from './demoWords.ts';
import { DayRule, HostBubble, ReachBar, SoirelyCard, SystemLine, Words } from './MessagesParts.tsx';

const RING = 2 * Math.PI * 12.5;
const iw = demoWords(IW);

/** Ten seconds on the message (sc-3963): said at 10, 5 and 0 only, by the page's status line. */
export function Countdown({ left, onCancel }: { left: number; onCancel: () => void }) {
  return (
    <div className="mg-countdown">
      <span className="mg-clock" aria-hidden="true">
        <svg viewBox="0 0 28 28" width={28} height={28}>
          <circle className="mg-clock-track" cx={14} cy={14} r={12.5} />
          <circle
            className="mg-clock-sweep"
            cx={14}
            cy={14}
            r={12.5}
            strokeDasharray={RING}
            strokeDashoffset={RING * (1 - left / 10)}
            transform="rotate(-90 14 14)"
          />
        </svg>
        <span className="mg-clock-n">{left}</span>
      </span>
      <span className="mg-countdown-words" aria-hidden="true">
        {filled(MW.sendingIn, { count: left })}
      </span>
      <button
        type="button"
        className="desk-text"
        data-focus="cancel"
        aria-keyshortcuts="Meta+Z Control+Z"
        onClick={onCancel}
      >
        <Glyph name="undo" size={17} weight={2.3} />
        {MW.cancel}
      </button>
    </div>
  );
}

export function Receipt({ reach, onWho }: { reach: Reach; onWho: () => void }) {
  return (
    <div className="mg-receipt">
      <ReachBar reach={reach} />
      <p className="mg-receipt-words">
        {filled(MW.reached, { count: reach.reached, total: reach.of })} ·{' '}
        {filled(MW.seenBy, { count: reach.seen })}
      </p>
      <button type="button" className="desk-text mg-who" onClick={onWho}>
        {MW.whoItReached}
        <Glyph name="chevron" size={15} weight={2.4} />
      </button>
    </div>
  );
}

function stageBits(out: Out, compact: boolean, groups: readonly Group[]): Bit[] {
  const reach = outReach(out, groups);

  switch (out.stage) {
    case 'sending':
      return [{ words: MW.onTheirPage }, { words: `${READER} · ${out.at}` }];
    case 'sent':
      return [
        { words: MW.onTheirPage },
        { words: `${READER} · ${out.at}` },
        ...(compact
          ? [
              {
                words: `${filled(MW.reached, { count: reach.reached, total: reach.count })} · ${filled(MW.seenBy, { count: reach.seen })}`,
              },
            ]
          : []),
      ];
    default:
      return [{ words: out.at }];
  }
}

/** A message to many as it goes: ten seconds, Sending…, who it reached, or why nothing went; an earlier one keeps its reach in its line. */
function OutItem({ out, compact }: { out: Out; compact: boolean }) {
  const { act, focus, to } = useInbox();
  const reach = outReach(out, to.book.groups);
  const note = out.invite?.note.trim() ?? '';

  return (
    <>
      {out.invite != null && (
        <SoirelyCard
          title={filled(MW.inviteSubject, { event: EVENT_NAME, hosts: HOSTS })}
          lines={[
            filled(MW.dear, { greeting: out.invite.greeting }),
            filled(MW.invitedOn, { event: EVENT_NAME, date: INVITE.date }),
            filled(MW.willYou, { replyBy: REPLY_BY }),
            [MW.replyYes, MW.replyNo, MW.replyNotSure].join(' · '),
          ]}
          bits={[{ words: MW.soirelysOwn }]}
        />
      )}
      <HostBubble
        subject={out.invite == null ? out.subject : filled(IW.noteFrom, { hosts: HOSTS })}
        body={out.invite == null ? <Words body={out.body} /> : note}
        bits={out.invite != null && note === '' ? [] : stageBits(out, compact, to.book.groups)}
        look={out.stage === 'failed' ? 'faded' : out.stage === 'countdown' ? 'arriving' : 'sent'}
        bare={out.invite != null && note === ''}
      >
        {out.stage === 'countdown' && (
          <Countdown
            left={out.left}
            onCancel={() => {
              act({ kind: 'cancel' });
              focus('body');
            }}
          />
        )}
        {out.stage === 'sending' && (
          <p className="mg-sending">
            <span className="mg-spin" aria-hidden="true" />
            {MW.sending} · {filled(MW.reachedSoFar, { count: reach.soFar, total: reach.count })}
          </p>
        )}
        {out.stage === 'sent' && !compact && (
          <Receipt
            reach={{
              reached: reach.reached,
              of: reach.count,
              seen: reach.seen,
              parts: [
                { kind: 'reached', count: reach.reached },
                { kind: 'none', count: reach.count - reach.reached },
              ],
            }}
            onWho={() => {
              act({ kind: 'reached', of: 'new', thread: out.thread });
              focus('heading');
            }}
          />
        )}
        {out.stage === 'failed' && (
          <div className="mg-failed" role="alert">
            <p>
              <Glyph name="alert" size={15} weight={2.2} />
              {MW.failed}
            </p>
            <button
              type="button"
              className="desk-text"
              data-focus="try"
              onClick={() => act({ kind: 'stage', from: 'failed', to: 'sending' })}
            >
              <Glyph name="refresh" size={17} weight={2.2} />
              {MW.tryAgain}
            </button>
          </div>
        )}
      </HostBubble>
      {out.stage === 'sending' && !compact && (
        <li className="mg-status">
          <Glyph name="info" size={15} weight={2.2} />
          <p>{out.invite == null ? many('queued', reach.count) : iw.many('queued', reach.count)}</p>
        </li>
      )}
      {out.invite != null && out.stage === 'sent' && (
        <SystemLine glyph="tick">{many('nowInvited', out.invite.reached)}</SystemLine>
      )}
    </>
  );
}

/** What was sent from here in a thread: a follow-up says it goes to the same guests, under the first message on their page (pm, 7 Nov). */
function Outs({ thread, follows }: { thread: ConvoId; follows: boolean }) {
  const { inbox, to } = useInbox();
  const outs = outsIn(inbox, thread);

  return outs.map((out, index) => {
    const following = follows || index > 0;
    const compact = index < outs.length - 1 && out.stage === 'sent';

    return (
      <Fragment key={index}>
        {following && (
          <SystemLine glyph="group">
            {many('followLine', outReach(out, to.book.groups).count)}
          </SystemLine>
        )}
        <OutItem out={out} compact={compact} />
      </Fragment>
    );
  });
}

export function StreamItems({ thread }: { thread: ConvoId }) {
  const { inbox, act, focus } = useInbox();

  if (thread === 'receipts')
    return (
      <>
        <DayRule>{PARKING.day}</DayRule>
        <HostBubble
          subject={PARKING.subject}
          body={<Words body={PARKING.body} />}
          bits={[{ words: MW.onTheirPage }, { words: `${READER} · ${PARKING.at}` }]}
        >
          <Receipt
            reach={RECEIPTS_REACH}
            onWho={() => {
              act({ kind: 'reached', of: 'receipts', thread });
              focus('heading');
            }}
          />
        </HostBubble>
      </>
    );

  if (thread === 'parking')
    return (
      <>
        <DayRule>{PARKING.day}</DayRule>
        <HostBubble
          subject={PARKING.subject}
          body={<Words body={PARKING.body} />}
          bits={[{ words: MW.onTheirPage }, { words: `${READER} · ${PARKING.at}` }]}
        >
          {inbox.resend?.thread !== 'parking' && (
            <Receipt
              reach={reachFrom(PARKING_OF, PARKING_SEEN, inbox.unreached)}
              onWho={() => {
                act({ kind: 'reached', of: 'parking', thread: 'parking' });
                focus('heading');
              }}
            />
          )}
        </HostBubble>
        {outsIn(inbox, thread).length > 0 && <DayRule>Today</DayRule>}
        <Outs thread={thread} follows />
      </>
    );

  if (thread === 'invite') {
    const reach: Reach = {
      ...INVITE_REACH,
      parts: [
        { kind: 'reached', count: INVITE_REACH.reached },
        { kind: 'none', count: INVITE_REACH.of - INVITE_REACH.reached },
      ],
    };

    return (
      <>
        <DayRule>{INVITE.day}</DayRule>
        <SystemLine glyph="events">{filled(MW.sentWhenLive, { name: READER })}</SystemLine>
        <SoirelyCard
          title={filled(MW.inviteSubject, { event: EVENT_NAME, hosts: HOSTS })}
          lines={[
            filled(MW.dear, { greeting: 'Kwame Mensah' }),
            filled(MW.invitedOn, { event: EVENT_NAME, date: INVITE.date }),
            filled(MW.willYou, { replyBy: INVITE.by }),
            [MW.replyYes, MW.replyNo, MW.replyNotSure].join(' · '),
          ]}
          bits={[{ words: MW.soirelysOwn }]}
        />
        <li className="mg-said is-host">
          <Receipt
            reach={reach}
            onWho={() => {
              act({ kind: 'reached', of: 'invite', thread: 'invite' });
              focus('heading');
            }}
          />
        </li>
        <SystemLine glyph="tick">{many('nowInvited', INVITE_REACH.reached)}</SystemLine>
        {outsIn(inbox, thread).length > 0 && <DayRule>Today</DayRule>}
        <Outs thread={thread} follows />
      </>
    );
  }

  return (
    <>
      <DayRule>Today</DayRule>
      <Outs thread={thread} follows={false} />
    </>
  );
}
