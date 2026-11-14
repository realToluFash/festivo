import { Glyph } from '../components/Glyph.tsx';
import { type Channel, channelWord, filled, whereWord } from './messages.ts';
import { type Extra, type Refusal, NW, attachmentsWords } from './messagesNotice.ts';
import { DayRule, DeliveryMark, GuestBubble, SystemLine } from './MessagesParts.tsx';
import './messagesNotice.css';

/** What Soirely wrote into a conversation after the guest's question (sc-3976): a stop or start keyword, a shared number, a later message. */
export function NoticeExtras({ extras, name }: { extras: readonly Extra[]; name: string }) {
  return extras.map((extra, index) => {
    switch (extra.kind) {
      case 'day':
        return <DayRule key={index}>{extra.day}</DayRule>;
      case 'stopped':
        return (
          <SystemLine key={index} glyph="slash">
            {`${filled(extra.channel === 'sms' ? NW.stoppedTexts : NW.stoppedWhatsApp, { guest: name })} · ${extra.at}`}
          </SystemLine>
        );
      case 'started':
        return (
          <SystemLine key={index} glyph="sms">
            {`${filled(NW.startedTexts, { guest: name })} · ${extra.at}`}
          </SystemLine>
        );
      case 'shared':
        return (
          <SystemLine key={index} glyph="people">
            {filled(NW.shareNumberLast, { count: extra.count, guest: name })}
          </SystemLine>
        );
      default:
        return (
          <GuestBubble
            key={index}
            text={extra.text}
            bits={[
              { words: whereWord('email'), where: 'email' },
              { words: extra.at },
              { words: attachmentsWords(extra.attachments), clip: true },
            ]}
          />
        );
    }
  });
}

/** Over the answer line when the 24 hours closed between writing and Send: nothing went, and what Send does now. */
export function WindowClosed({ again }: { again: boolean }) {
  return (
    <div className="mg-closed" role="alert">
      <p className="mg-closed-line">
        <Glyph name="alert" size={15} weight={2.3} />
        {NW.windowRanOut}
      </p>
      {again && <p className="mg-closed-again">{NW.sendAgainTemplate}</p>}
    </div>
  );
}

/** The notice refused on the answer's channel: the reason with Who it reached's mark, and the guest's other channels. */
export function RefusedNotice({
  refusal,
  name,
  by,
  onTell,
  label,
}: {
  refusal: Refusal;
  name: string;
  by: string;
  onTell: (channel: Channel) => void;
  label: (channel: Channel) => string;
}) {
  return (
    <>
      <p className="mg-answer-line">
        <Glyph name="page" size={15} />
        {filled(NW.cannotTell, { name, channel: by })}
      </p>
      <p className="mg-refused-why">
        <DeliveryMark kind={refusal.mark} />
        {refusal.reason}
      </p>
      {refusal.others.length === 0 ? (
        <p className="mg-refused-none">{NW.noOther}</p>
      ) : (
        <div className="mg-answer-others mg-refused-others">
          <p>{NW.tellNowBy}</p>
          {refusal.others.map((channel) => (
            <button
              key={channel}
              type="button"
              className="button mg-answer-other"
              aria-label={label(channel)}
              onClick={() => onTell(channel)}
            >
              {channelWord(channel)}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
