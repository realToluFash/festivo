import { useEffect, useRef, useState } from 'react';

import { Glyph } from '../components/Glyph.tsx';
import { CardStep, Dialog, Note, type Tell } from '../components/SettingsParts.tsx';
import { focusWhenFree } from '../layers.ts';
import { SHARED_WORDS as S } from './dataControl.ts';
import {
  ASKS,
  ASK_WORDS as W,
  type AskNow,
  SAMPLE_OWNERS,
  answerAsk,
  answered,
  askStart,
  lockStepOf,
  mayAsk,
  showsButton,
} from './enterpriseAsk.ts';
import type { Viewer } from './settings.ts';
import './enterpriseAsk.css';

const ASK_MS = 700;

/** The step on a locked Enterprise card (sc-72241): Contact for an owner, Ask an owner for an admin, none for a member. */
export function EnterpriseStep({
  viewer,
  state,
  tell,
}: {
  viewer: Pick<Viewer, 'owns' | 'manages'>;
  state: string;
  tell: Tell;
}) {
  const step = lockStepOf(viewer);

  if (step === 'contact') return <ContactStep tell={tell} />;
  if (step === 'ask') return <AskStep state={state} />;
  return null;
}

/** Opens Compare plans over the page with Enterprise's card in view; Close puts the focus back on the step. */
function ContactStep({ tell }: { tell: Tell }) {
  const [open, setOpen] = useState(false);
  const step = useRef<HTMLButtonElement>(null);
  const enterprise = useRef<HTMLHeadingElement>(null);

  const close = () => {
    setOpen(false);
    focusWhenFree(() => step.current);
  };

  return (
    <div className="ea-step">
      <CardStep ref={step} label={S.contact} onClick={() => setOpen(true)} />
      {open && (
        <Dialog
          title={W.compare}
          verb={null}
          dismiss={W.close}
          first={enterprise}
          onDismiss={close}
          onConfirm={close}
        >
          <section className="ea-plan">
            <h3 className="ea-plan-name">
              {W.free} <span className="ea-plan-now">{W.yourPlan}</span>
            </h3>
            <Note>{W.freeLine}</Note>
          </section>
          <section className="ea-plan is-asked">
            <h3 ref={enterprise} className="ea-plan-name" tabIndex={-1}>
              {W.enterprise}
            </h3>
            <Note>{W.soldBy}</Note>
            <div className="ea-plan-changes">
              <Note strong>{W.changes}</Note>
              <Note>{W.changesLine}</Note>
            </div>
            <Note>{W.talkLine}</Note>
            <button type="button" className="ea-talk" onClick={() => tell(W.talkTold)}>
              {W.talk}
            </button>
          </section>
        </Dialog>
      )}
    </div>
  );
}

/** Ask an owner, as Limit reached's (sc-3930): it stays while sending, and the answer replaces it or sits under it. */
function AskStep({ state }: { state: string }) {
  const [ask, setAsk] = useState<AskNow>(() => askStart(state));
  const told = useRef<HTMLParagraphElement>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const press = () => {
    if (!mayAsk(ask)) return;
    setAsk({ now: 'sending' });
    timer.current = window.setTimeout(() => {
      const at = Date.now();
      const answer = answerAsk(ASKS.lastAt, at, SAMPLE_OWNERS);
      if (answer !== 'failed' && 'sent' in answer) ASKS.lastAt = at;
      setAsk(answered(answer));
      focusWhenFree(() => told.current);
    }, ASK_MS);
  };

  const sending = ask.now === 'sending';

  return (
    <div className="ea-step">
      {showsButton(ask) && (
        <button
          type="button"
          className="desk-step"
          aria-busy={sending || undefined}
          onClick={sending ? undefined : press}
        >
          {W.ask}
        </button>
      )}
      <div className="ea-said-region" role="alert">
        {ask.now === 'notSent' && (
          <p className="ea-said is-broken">
            <Glyph name="alert" size={18} weight={2.2} />
            {W.notSent}
          </p>
        )}
        {ask.now === 'asked' && (
          <p ref={told} className="ea-said is-asked" tabIndex={-1}>
            <Glyph name="info" size={18} weight={2.2} />
            {W.asked[ask.owners]}
          </p>
        )}
      </div>
      <div className="ea-said-region" role="status">
        {ask.now === 'sent' && (
          <p ref={told} className="ea-said is-sent" tabIndex={-1}>
            <Glyph name="tick" size={18} weight={2.6} />
            {W.sent[ask.owners]}
          </p>
        )}
      </div>
    </div>
  );
}
