import { useEffect, useId, useRef, useState } from 'react';

import { Glyph } from '../components/Glyph.tsx';
import { HostOneField } from '../components/HostOneField.tsx';
import { Ask, AskAlert } from '../components/SettingsParts.tsx';
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

/** Make live in the product's dialog (sc-3971): the question, then, once the event is live, the same dialog turned into the offer to send the invitations. */
export function MakeLiveAsk({
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
  const line =
    told === 'endPassed'
      ? LW.endPassed
      : told === 'changed'
        ? LW.nowLive
        : asking
          ? LW.confirmLine
          : lw.filled(LW.isLive, { name: event.name });
  const cost = offer == null ? null : costOf(offer);
  const failed = (phase.at === 'ask' || phase.at === 'offer') && phase.failed;
  const verb =
    told === 'endPassed' ? LW.changeDates : asking ? LW.makeLive : lw.many('sendThem', count);
  const busyWord = phase.at === 'making' ? LW.making : LW.sending;
  const closes = phase.at === 'cannot' || told != null;
  const confirms = phase.at !== 'cannot' && told !== 'changed';

  return (
    <Ask
      title={title}
      line={line}
      told={told != null}
      red={false}
      titleFirst={turned}
      flat={!turned}
      first={asksHost && asking ? field : undefined}
      keepFirst
      describedBy={asksHost && asking ? `${id}-help` : undefined}
      failed={failed ? (asking ? LW.failed : LW.notSent) : undefined}
      keep={closes ? LW.close : LW.notYet}
      go={confirms ? verb : undefined}
      busy={busy ? busyWord : undefined}
      onKeep={onClose}
      onGo={told === 'endPassed' ? onChangeDates : asking ? makeLive : send}
    >
      {turned &&
        (phase.at === 'cannot' ? (
          <AskAlert>{phase.why === 'forbidden' ? LW.forbidden : lw.many('nobody', count)}</AskAlert>
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
        ))}
      {asksHost && asking && (
        <HostOneField
          id={id}
          host={{
            label: LW.host,
            value: typed,
            wrong: blank ? LW.hostEmpty : null,
            help: LW.hostExplainer,
            onType: (value) => {
              setTyped(value);
              setBlank(false);
            },
          }}
          field={field}
          readOnly={busy}
          onGo={makeLive}
        />
      )}
    </Ask>
  );
}
