import { useEffect, useRef, useState } from 'react';

import { Glyph } from '../components/Glyph.tsx';
import { offButton } from '../offButton.ts';
import { MW } from './messages.ts';
import { useInbox } from './messagesContext.ts';
import { type Billing, type Waits, WW, askedWords, billingOf, ownersOf } from './messagesWaits.ts';
import './messagesWaits.css';

const ASKING_MS = 600;

/** The check's too-few-credits part (sc-3963): what goes either way, what waits, and the ways past. */
export function WaitBlock({ waits }: { waits: Waits }) {
  const { act, focus, tell, to } = useInbox();
  const billing = billingOf(to.state);
  const way = waits.way;

  return (
    <div className="mg-waits">
      {waits.either && (
        <p className="mg-waits-either">
          <Glyph name="mail" size={15} weight={2} />
          {WW.eitherWay}
        </p>
      )}
      {waits.lines.map((line) => (
        <p key={line} className="mg-waits-line">
          <Glyph name="clock" size={15} weight={2.2} />
          {line}
        </p>
      ))}
      <div className="mg-waits-past">
        {way != null && (
          <button
            type="button"
            className="button mg-waits-without"
            onClick={() => {
              act({ kind: 'draft', draft: { ticks: way.ticks } });
              act({ kind: 'go' });
              focus('cancel');
            }}
          >
            {way.word}
          </button>
        )}
        {billing === 'add' ? (
          <button
            type="button"
            className="desk-text"
            onClick={() => tell(`${MW.addCredits} has its own design.`)}
          >
            {MW.addCredits}
          </button>
        ) : (
          <AskOwner start={billing} owners={ownersOf(to.state)} />
        )}
      </div>
    </div>
  );
}

/** Ask an owner, for a member without billing.manage (sc-3963): the owners sent the link, or Not sent and try again. */
export function AskOwner({ start, owners }: { start: Exclude<Billing, 'add'>; owners: number }) {
  const { focus } = useInbox();
  const [billing, setBilling] = useState<Billing>(start);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function ask(): void {
    if (billing === 'asking') return;
    setBilling('asking');
    timer.current = window.setTimeout(() => {
      setBilling('sent');
      focus('asked');
    }, ASKING_MS);
  }

  if (billing === 'sent')
    return (
      <p className="mg-waits-asked" role="status" tabIndex={-1} data-focus="asked">
        <Glyph name="tick" size={15} weight={2.8} />
        {askedWords(owners)}
      </p>
    );

  return (
    <div className="mg-waits-ask">
      <button
        type="button"
        className={billing === 'asking' ? 'desk-text is-busy' : 'desk-text'}
        aria-busy={billing === 'asking'}
        {...offButton(billing === 'asking', { dim: false })}
        onClick={ask}
      >
        {WW.askOwner}
      </button>
      {billing === 'failed' && (
        <p className="desk-error" role="alert">
          <Glyph name="alert" size={15} weight={2.3} />
          {WW.askFailed}
        </p>
      )}
    </div>
  );
}
