import { useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { ActionPair } from '../components/ActionPair.tsx';
import { Glyph } from '../components/Glyph.tsx';
import { LayersContext, useDeskDialog } from '../layers.ts';
import { offButton } from '../offButton.ts';
import type { SampleEvent } from './events.ts';
import { type Offer, type Phase, LW, costOf, lw } from './makeLive.ts';
import './messagesWaits.css';
import './makeLive.css';

export const MAKING_MS = 600;

export interface MakeLiveProps {
  event: SampleEvent;
  phase: Phase;
  /** What the offer counts once the event is live; null makes no offer. */
  offer: Offer | null;
  onLive: () => void;
  onClose: () => void;
  onMadeLive: () => void;
  onSent: (offer: Offer) => void;
}

/** Make live in A's 400 dialog (sc-3971): the question, then, once the event is live, the same dialog turned into the offer to send the invitations. */
export function MakeLiveAsk(props: MakeLiveProps) {
  const { host } = useContext(LayersContext);

  return host == null ? null : createPortal(<MakeLiveBox {...props} />, host);
}

function MakeLiveBox({
  event,
  phase: first,
  offer,
  onLive,
  onClose,
  onMadeLive,
  onSent,
}: MakeLiveProps) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>(first);
  const asking = phase.at === 'ask' || phase.at === 'making';
  const busy = phase.at === 'making' || phase.at === 'sending';
  const turned = !asking;

  useDeskDialog(box, turned ? heading : keep, onClose, busy);

  useEffect(() => {
    if (turned) heading.current?.focus();
  }, [turned]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function makeLive(): void {
    if (busy) return;
    setPhase({ at: 'making' });
    timer.current = window.setTimeout(() => {
      onLive();
      if (offer == null) onMadeLive();
      else
        setPhase(
          offer.reached === 0 ? { at: 'cannot', why: 'nobody' } : { at: 'offer', failed: false },
        );
    }, MAKING_MS);
  }

  function send(): void {
    if (busy || offer == null) return;
    setPhase({ at: 'sending' });
    timer.current = window.setTimeout(() => onSent(offer), MAKING_MS);
  }

  const count = offer?.count ?? 0;
  const title = asking
    ? lw.filled(LW.confirmTitle, { name: event.name })
    : phase.at === 'cannot'
      ? lw.many('cannotTitle', count)
      : lw.many('offerTitle', count);
  const cost = offer == null ? null : costOf(offer);
  const failed = (phase.at === 'ask' || phase.at === 'offer') && phase.failed;
  const verb = asking ? LW.makeLive : lw.many('sendThem', count);
  const busyWord = phase.at === 'making' ? LW.making : LW.sending;

  return (
    <>
      <div className="dialog-scrim is-over" aria-hidden="true" />
      <div
        ref={box}
        className="desk-ask ml-ask"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-line`}
      >
        <h2 ref={heading} id={`${id}-title`} tabIndex={turned ? -1 : undefined}>
          {title}
        </h2>
        {asking ? (
          <>
            <p id={`${id}-line`}>{LW.confirmLine}</p>
            {failed && <Alert>{LW.failed}</Alert>}
          </>
        ) : (
          <div className="desk-ask-body">
            <p id={`${id}-line`}>{lw.filled(LW.isLive, { name: event.name })}</p>
            {phase.at === 'cannot' ? (
              <Alert>{phase.why === 'forbidden' ? LW.forbidden : lw.many('nobody', count)}</Alert>
            ) : (
              cost != null && (
                <div className="ml-cost">
                  {cost.credits != null && <p className="ml-credits">{cost.credits}</p>}
                  {cost.either != null && (
                    <p className="mg-waits-either">
                      <Glyph name="mail" size={15} weight={2} />
                      {cost.either}
                    </p>
                  )}
                  {cost.waits != null && (
                    <p className="mg-waits-line">
                      <Glyph name="clock" size={15} weight={2.2} />
                      {cost.waits}
                    </p>
                  )}
                </div>
              )
            )}
            {failed && <Alert>{LW.notSent}</Alert>}
          </div>
        )}
        <ActionPair
          className="desk-ask-pair"
          stacks={false}
          dismiss={
            <button
              ref={keep}
              type="button"
              className={busy ? 'desk-text desk-ask-keep is-waits' : 'desk-text desk-ask-keep'}
              {...offButton(busy, { dim: false })}
              onClick={onClose}
            >
              {phase.at === 'cannot' ? LW.close : LW.notYet}
            </button>
          }
          confirm={
            phase.at !== 'cannot' && (
              <button
                type="button"
                className={busy ? 'desk-text is-busy' : 'desk-text'}
                aria-busy={busy || undefined}
                {...offButton(busy, { dim: false })}
                onClick={asking ? makeLive : send}
              >
                {busy && <span className="pending-spinner desk-turning" aria-hidden="true" />}
                {busy ? busyWord : verb}
              </button>
            )
          }
        />
      </div>
    </>
  );
}

function Alert({ children }: { children: string }) {
  return (
    <p className="desk-ask-alert" role="alert">
      <Glyph name="alert" size={18} weight={2.2} />
      {children}
    </p>
  );
}
