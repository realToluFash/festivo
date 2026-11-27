import { useEffect, useRef, useState } from 'react';

import { Glyph } from '../components/Glyph.tsx';
import { offButton } from '../offButton.ts';
import { type Ask, LW, type Owners, answerOf, mayAsk } from './limitReached.ts';
import './limitReached.css';

const SENDING_MS = 900;

/** Ask an owner in its four states. Both regions are in the page before they fill, so the change is announced. */
export function AskOwner({
  start,
  offline,
  owners,
  onSent,
}: {
  start: Ask;
  offline: boolean;
  owners: Owners;
  onSent?: () => void;
}) {
  const [ask, setAsk] = useState<Ask>(start);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function press(): void {
    if (!mayAsk(ask)) return;
    setAsk({ now: 'sending' });
    timer.current = window.setTimeout(() => {
      const answer = answerOf(offline, owners);
      setAsk(answer);
      if (answer.now === 'sent') onSent?.();
    }, SENDING_MS);
  }

  const sending = ask.now === 'sending';

  return (
    <div className="lr-ask">
      {ask.now !== 'sent' && (
        <button
          type="button"
          className={sending ? 'button is-busy' : 'button'}
          aria-busy={sending}
          {...offButton(sending, { dim: false })}
          onClick={press}
        >
          <span className="button-label">{LW.askOwner}</span>
        </button>
      )}
      <div role="status" aria-live="polite" className="lr-said">
        {ask.now === 'sent' && (
          <p className="lr-sent">
            <Glyph name="tick" size={16} weight={2.8} />
            {LW.sent[ask.owners]}
          </p>
        )}
      </div>
      <div role="alert" className="lr-said">
        {ask.now === 'notSent' && (
          <p className="desk-error">
            <Glyph name="clear" size={15} weight={2.6} />
            {LW.notSent}
          </p>
        )}
      </div>
    </div>
  );
}
