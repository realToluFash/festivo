import { Glyph } from '../components/Glyph.tsx';
import { MW, READER, filled, many, outsIn } from './messages.ts';
import { useInbox } from './messagesContext.ts';
import { DayRule, HostBubble, LeadMark, Words } from './MessagesParts.tsx';
import { StreamItems } from './MessagesStream.tsx';
import { Head, MiniComposer } from './MessagesThread.tsx';
import {
  type SentToId,
  REPLY_BY_SEEN,
  SENT_TO_MESSAGES,
  TW,
  resolvedCount,
  sentToHead,
} from './messagesTo.ts';

/** Without messages.manage (a 403): where a composer would be, the reason, and no way to write. */
export function NoManage() {
  return (
    <p className="mgt-manage">
      <Glyph name="info" size={16} weight={2.2} />
      <span>{TW.noManage}</span>
    </p>
  );
}

/** A message whose audience was conditions: who it resolved to when it went, or that nobody matched (an outcome, never a failure). */
export function SentToThread({ id }: { id: SentToId }) {
  const { inbox, to } = useInbox();
  const message = SENT_TO_MESSAGES[id];
  const count = resolvedCount(id);
  const nobody = id === 'reminder';

  return (
    <div className="mg-in">
      <Head
        lead={<LeadMark lead={{ kind: 'many' }} size={44} />}
        title={message.subject}
        line={sentToHead(id, to.book.groups)}
      />
      <ol className="mg-stream" role="log" aria-label={message.subject}>
        <DayRule>{message.day}</DayRule>
        <HostBubble
          subject={message.subject}
          body={<Words body={message.body} />}
          bits={
            nobody
              ? []
              : [
                  { words: MW.onTheirPage },
                  { words: `${READER} · ${message.at}` },
                  {
                    words: `${filled(MW.reached, { count, total: count })} · ${filled(MW.seenBy, { count: REPLY_BY_SEEN })}`,
                  },
                ]
          }
          look={nobody ? 'greyed' : 'sent'}
        >
          <p className="mg-goes">
            {nobody
              ? filled(TW.nobodyDueLine, { time: message.at })
              : filled(TW.workedOut, { time: message.at, guests: many('guests', count) })}
          </p>
        </HostBubble>
        {outsIn(inbox, id).length > 0 && <StreamItems thread={id} />}
      </ol>
      {!nobody && <MiniComposer to={message.to} placeholder={MW.writeFollowUp} thread={id} />}
    </div>
  );
}
