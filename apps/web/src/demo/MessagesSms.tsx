import { Glyph } from '../components/Glyph.tsx';
import type { Hour } from './messagesSms.ts';
import { SW } from './messagesSmsWords.ts';
import { WhereGlyph } from './MessagesParts.tsx';
import './messagesSms.css';

/** SMS's reach line (sc-3946), whenever SMS is ticked, above WhatsApp's: its mark, then who it reaches and who it can't. */
export function SmsReach({ line }: { line: string | null }) {
  if (line == null) return null;

  return (
    <p className="mg-wa-reach">
      <WhereGlyph where="sms" size={15} />
      <span>{line}</span>
    </p>
  );
}

/** The one line saying how many wait for 09:00 their time, shown only when something waits. */
export function SmsWait({ line }: { line: string | null }) {
  if (line == null) return null;

  return (
    <p className="mg-sms-wait">
      <Glyph name="clock" size={15} weight={2.2} />
      {line}
    </p>
  );
}

/** The demo's clock for `checkNow`: the hour the sample is read at, which the product takes from the device. */
export function SmsClock({ hour }: { hour: Hour | undefined }) {
  return hour === 'live' ? <p className="mg-sms-clock">{SW.liveAtNight}</p> : null;
}
