import { type ReactNode, useId } from 'react';

import { offButton } from '../offButton.ts';
import { Lead } from './AccountParts.tsx';
import { Glyph, type GlyphName } from './Glyph.tsx';
import { Card, CardStep, OnCard, RowWords, Says } from './SettingsParts.tsx';
import './AccountParts.css';
import './SecurityParts.css';

/** How you are protected: the shield, on or off, the ways and devices, then what was just done or why two-factor matters. */
export function ShieldCard({
  says,
  summary,
  said,
  step,
  saidRef,
}: {
  says: string;
  summary: string;
  said: { text: string; done: boolean } | null;
  step: { label: string; onClick: () => void } | null;
  saidRef?: (line: HTMLParagraphElement | null) => void;
}) {
  return (
    <Card size="person">
      <div>
        <div className="desk-who">
          <span className="desk-disc security-shield" aria-hidden="true">
            <Glyph name="shield" size={29} weight={2.2} />
          </span>
          <div className="desk-who-words">
            <Says>{says}</Says>
            <OnCard>{summary}</OnCard>
          </div>
        </div>
        <SaidLine said={said} saidRef={saidRef} />
      </div>
      {step != null && <CardStep label={step.label} onClick={step.onClick} />}
    </Card>
  );
}

/** The card's result line, also drawn alone in the card's place while two-factor has not loaded. */
export function SaidLine({
  said,
  saidRef,
  alone = false,
}: {
  said: { text: string; done: boolean } | null;
  saidRef?: ((line: HTMLParagraphElement | null) => void) | undefined;
  /** On the page ground in the card's place, so it takes the page's ink. */
  alone?: boolean;
}) {
  return (
    <div aria-live="polite">
      {said != null && (
        <p
          ref={saidRef}
          tabIndex={saidRef == null ? undefined : -1}
          className={`account-said${said.done ? ' is-done' : ''}${alone ? ' is-alone' : ''}`}
        >
          {said.done && (
            <span className="desk-mark is-yes account-done" aria-hidden="true">
              <Glyph name="tick" size={11} weight={3.4} />
            </span>
          )}
          {said.text}
        </p>
      )}
    </div>
  );
}

/** A row that opens in place, lit with no ring, what it holds under a Violet rule. */
export function Openable({
  title,
  line,
  lead,
  on,
  onToggle,
  children,
}: {
  title: string;
  line: string;
  lead: GlyphName;
  on: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const id = useId();

  return (
    <li>
      <button
        type="button"
        className={on ? 'desk-row account-row is-open' : 'desk-row account-row'}
        aria-expanded={on}
        aria-controls={on ? id : undefined}
        onClick={onToggle}
      >
        <Lead name={lead} />
        <RowWords title={title} lines={[line]} />
        <Glyph name={on ? 'chevup' : 'chevdown'} size={18} weight={2.4} className="desk-chevron" />
      </button>
      {on && (
        <div id={id} className="account-open" role="group" aria-label={title}>
          {children}
        </div>
      )}
    </li>
  );
}

/** An action a rule keeps: still there to be found, never pressed. */
export function KeptAction({ label }: { label: string }) {
  return (
    <button type="button" className="desk-text security-off" {...offButton(true, { dim: false })}>
      {label}
    </button>
  );
}
