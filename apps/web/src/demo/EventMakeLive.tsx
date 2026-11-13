import { useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { ActionPair } from '../components/ActionPair.tsx';
import { Glyph } from '../components/Glyph.tsx';
import { LayersContext, useDeskDialog } from '../layers.ts';
import { offButton } from '../offButton.ts';
import type { SampleEvent } from './events.ts';
import { type Offer, type Phase, LW, costOf, hostTyped, lw } from './makeLive.ts';
import './messagesWaits.css';
import './makeLive.css';

export const MAKING_MS = 600;

export interface MakeLiveProps {
  event: SampleEvent;
  phase: Phase;
  /** What the offer counts once the event is live; null makes no offer. */
  offer: Offer | null;
  /** Called as the event turns Live, with Host 1 as typed when it was asked. */
  onLive: (host: string | null) => void;
  onClose: () => void;
  onMadeLive: () => void;
  onSent: (offer: Offer) => void;
  onChangeDates: () => void;
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
  onChangeDates,
}: MakeLiveProps) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>(first);
  const [asksHost] = useState(event.hosts.length === 0);
  const [typed, setTyped] = useState('');
  const [blank, setBlank] = useState(first.at === 'ask' && first.blank);
  const asking = phase.at === 'ask' || phase.at === 'making';
  const told = phase.at === 'told' ? phase.why : null;
  const busy = phase.at === 'making' || phase.at === 'sending';
  const turned = !asking && told == null;

  useDeskDialog(box, turned ? heading : asksHost && asking ? field : keep, onClose, busy);

  useEffect(() => {
    if (turned) heading.current?.focus();
  }, [turned]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function makeLive(): void {
    if (busy) return;

    const host = asksHost ? hostTyped(typed) : null;

    if (asksHost && host == null) {
      setBlank(true);
      field.current?.focus();
      return;
    }
    setPhase({ at: 'making' });
    timer.current = window.setTimeout(() => {
      onLive(host);
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
  const title =
    told === 'endPassed'
      ? LW.notMadeLive
      : told === 'changed'
        ? LW.changedElsewhere
        : asking
          ? lw.filled(LW.confirmTitle, { name: event.name })
          : phase.at === 'cannot'
            ? lw.many('cannotTitle', count)
            : lw.many('offerTitle', count);
  const cost = offer == null ? null : costOf(offer);
  const failed = (phase.at === 'ask' || phase.at === 'offer') && phase.failed;
  const verb =
    told === 'endPassed' ? LW.changeDates : asking ? LW.makeLive : lw.many('sendThem', count);
  const busyWord = phase.at === 'making' ? LW.making : LW.sending;
  const closes = phase.at === 'cannot' || told != null;
  const confirms = phase.at !== 'cannot' && told !== 'changed';
  const describedBy = [`${id}-line`, asksHost && asking ? `${id}-help` : null]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <div className="dialog-scrim is-over" aria-hidden="true" />
      <div
        ref={box}
        className="desk-ask ml-ask"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={describedBy}
      >
        <h2 ref={heading} id={`${id}-title`} tabIndex={turned ? -1 : undefined}>
          {title}
        </h2>
        {told != null ? (
          <Alert id={`${id}-line`}>{told === 'endPassed' ? LW.endPassed : LW.nowLive}</Alert>
        ) : asking ? (
          <>
            <p id={`${id}-line`}>{LW.confirmLine}</p>
            {asksHost && (
              <div className="desk-field">
                <label htmlFor={`${id}-host`} className="desk-label">
                  {LW.host}
                </label>
                <div className={blank ? 'desk-box is-wrong' : 'desk-box'}>
                  <input
                    ref={field}
                    id={`${id}-host`}
                    type="text"
                    value={typed}
                    autoComplete="off"
                    aria-invalid={blank}
                    aria-describedby={`${id}-help`}
                    readOnly={busy}
                    onChange={(change) => {
                      setTyped(change.target.value.replaceAll(/[\r\n]+/gu, ' '));
                      setBlank(false);
                    }}
                    onKeyDown={(key) => {
                      if (key.key === 'Enter') makeLive();
                    }}
                  />
                </div>
                {blank ? (
                  <p id={`${id}-help`} className="desk-error" role="alert">
                    <Glyph name="alert" size={18} weight={2.2} />
                    {LW.hostEmpty}
                  </p>
                ) : (
                  <p id={`${id}-help`} className="desk-help">
                    {LW.hostExplainer}
                  </p>
                )}
              </div>
            )}
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
              {closes ? LW.close : LW.notYet}
            </button>
          }
          confirm={
            confirms && (
              <button
                type="button"
                className={busy ? 'desk-text is-busy' : 'desk-text'}
                aria-busy={busy || undefined}
                {...offButton(busy, { dim: false })}
                onClick={told === 'endPassed' ? onChangeDates : asking ? makeLive : send}
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

function Alert({ id, children }: { id?: string; children: string }) {
  return (
    <p id={id} className="desk-ask-alert" role="alert">
      <Glyph name="alert" size={18} weight={2.2} />
      {children}
    </p>
  );
}
