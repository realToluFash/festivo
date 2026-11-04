import { PASSWORD_MINIMUM_LENGTH, formatCountdown, initials } from '@soirely/domain';
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { offButton } from '../offButton.ts';
import { offField } from '../offField.ts';
import { useShownAfter } from '../shownAfter.ts';
import { BoardPage, Tick } from './BoardPage.tsx';
import { CODE_LENGTH, RESEND_SECONDS, SAMPLE, TRIES, codeDigits, codeLine } from './rules.ts';

/** The parts the board's pages share, so each new board imports them rather than copying. */

const BUSY_MS = 900;
const LOADING_AFTER_MS = 400;

export function useBusy(): [boolean, (then: () => void) => void] {
  const [busy, setBusy] = useState(false);
  const pending = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(pending.current), []);

  return [
    busy,
    (then) => {
      setBusy(true);
      pending.current = window.setTimeout(() => {
        setBusy(false);
        then();
      }, BUSY_MS);
    },
  ];
}

export function Heading({
  step,
  title,
  done = false,
  children,
}: {
  step?: 1 | 2;
  title: string;
  done?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="demo-heading">
      {step != null && <p className="demo-step">Step {step} of 2</p>}
      {done ? (
        <div className="demo-done">
          <Tick size={26} />
          <h1>{title}</h1>
        </div>
      ) : (
        <h1>{title}</h1>
      )}
      {children}
    </div>
  );
}

export function Notice({
  title,
  body,
  alert = false,
}: {
  title: string;
  body?: string;
  alert?: boolean;
}) {
  return (
    <div className="demo-notice" role={alert ? 'alert' : 'status'}>
      <p className="demo-notice-title">{title}</p>
      {body != null && <p>{body}</p>}
    </div>
  );
}

export function fieldClass(wrong: boolean): string {
  return wrong ? 'demo-field demo-field-wrong' : 'demo-field';
}

export function PasswordRule({ met }: { met: boolean }) {
  return (
    <div className="demo-rule" id="password-rule">
      <p className={met ? 'demo-rule-line demo-rule-met' : 'demo-rule-line'}>
        {met ? <Tick /> : <span className="demo-ring" aria-hidden="true" />}
        At least {PASSWORD_MINIMUM_LENGTH} characters
      </p>
      <p className="demo-rule-note">
        That is the only rule. When you submit, we also check the password has not appeared in a
        known data breach.
      </p>
    </div>
  );
}

type Dead = 'expired' | 'exhausted';

export function CodeForm({
  opening,
  label,
  submit,
  from,
  wrong,
  expired,
  onVerified,
  below,
  resendNote,
}: {
  opening: string;
  label: string;
  submit: string;
  /** "the email", "WhatsApp": where the code came from. */
  from: string;
  wrong: string;
  expired: string;
  onVerified: () => void;
  /** Under the resend line while the field shows. */
  below?: ReactNode;
  resendNote?: ReactNode;
}) {
  const [code, setCode] = useState(opening === 'wrong' ? '482193' : '');
  const [line, setLine] = useState<string | null>(opening === 'wrong' ? wrong : null);
  const [dead, setDead] = useState<Dead | null>(
    opening === 'expired' || opening === 'exhausted' ? opening : null,
  );
  const [wrongs, setWrongs] = useState(opening === 'wrong' ? 1 : 0);
  const [busy, after] = useBusy();
  const [sending, setSending] = useState(false);
  const [countFrom, setCountFrom] = useState(() => Date.now());
  const field = useRef<HTMLInputElement>(null);
  const focusOnMount = useRef(false);

  useEffect(() => {
    if (!focusOnMount.current || field.current == null) return;

    focusOnMount.current = false;
    field.current.focus();
  });

  useEffect(() => {
    if (opening !== 'wrong') return;

    field.current?.focus();
    field.current?.select();
  }, [opening]);

  function verify(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (busy) return;

    const refused = codeLine(code, from);
    setLine(refused);
    if (refused != null) {
      field.current?.focus();
      return;
    }

    after(() => {
      if (code === SAMPLE.code) {
        onVerified();
        return;
      }

      if (wrongs + 1 >= TRIES) {
        setDead('exhausted');
        return;
      }

      setWrongs(wrongs + 1);
      setLine(wrong);
      field.current?.focus();
      field.current?.select();
    });
  }

  function sendNew(): void {
    if (busy) return;

    setSending(true);
    after(() => {
      setSending(false);
      setDead(null);
      setCode('');
      setLine(null);
      setWrongs(0);
      setCountFrom(Date.now());
      focusOnMount.current = true;
    });
  }

  if (dead != null) {
    return (
      <>
        <Notice
          title={dead === 'expired' ? 'That code has expired' : 'Too many wrong tries'}
          body={
            dead === 'expired' ? expired : 'That code no longer works. Send a new one to carry on.'
          }
        />
        <button
          className="button button-primary demo-wide"
          type="button"
          aria-busy={busy}
          onClick={sendNew}
        >
          {busy ? 'Sending…' : 'Send a new code'}
        </button>
      </>
    );
  }

  return (
    <>
      <form className="demo-form" noValidate onSubmit={verify}>
        <div className={fieldClass(line != null)}>
          <label htmlFor="code">{label}</label>
          <input
            ref={field}
            className="demo-input demo-code"
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            value={code}
            {...offField(busy)}
            aria-invalid={line != null}
            aria-describedby={line == null ? undefined : 'code-line'}
            onChange={(event) => setCode(codeDigits(event.target.value))}
          />
          {line != null && (
            <p className="demo-line" id="code-line" role="alert">
              {line}
            </p>
          )}
        </div>
        <button className="button button-primary demo-wide" type="submit" aria-busy={busy}>
          {sending ? 'Sending…' : busy ? 'Verifying…' : submit}
        </button>
      </form>
      <Resend key={countFrom} onResend={sendNew}>
        {resendNote}
      </Resend>
      {below}
    </>
  );
}

/** "No code? Send a new code in 0:41", a link once the count ends; the note under it. */
export function Resend({ onResend, children }: { onResend: () => void; children?: ReactNode }) {
  const [left, setLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (left <= 0) return;

    const tick = window.setTimeout(() => setLeft(left - 1), 1000);

    return () => window.clearTimeout(tick);
  }, [left]);

  return (
    <div className="demo-resend">
      <p className="demo-resend-line">
        <span>No code?</span>
        {left > 0 ? (
          <span className="demo-resend-wait">Send a new code in {formatCountdown(left)}</span>
        ) : (
          <button className="link-button demo-link" type="button" onClick={onResend}>
            Send a new code
          </button>
        )}
      </p>
      <p className="demo-resend-note">A new code replaces the last one.</p>
      {children}
    </div>
  );
}

export function Verified({
  step,
  title,
  body,
  action,
  onContinue,
}: {
  step: 1 | 2;
  title: string;
  body: string;
  action: string;
  onContinue: () => void;
}) {
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => button.current?.focus(), []);

  return (
    <>
      <Heading step={step} title={title} done>
        <p className="demo-muted">{body}</p>
      </Heading>
      <button
        ref={button}
        className="button button-primary demo-wide"
        type="button"
        onClick={onContinue}
      >
        {action}
      </button>
    </>
  );
}

export function Loading() {
  const shown = useShownAfter(LOADING_AFTER_MS);

  return (
    <BoardPage end={null}>
      {shown && (
        <p className="demo-loading" role="status">
          <span className="demo-spinner" aria-hidden="true" />
          Loading…
        </p>
      )}
    </BoardPage>
  );
}

/** Try again reloads `to`, once the demo's switch says the connection is back. */
export function Unreachable({ to, signedIn }: { to: string; signedIn: boolean }) {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [online, setOnline] = useState(false);
  const [busy, after] = useBusy();

  return (
    <BoardPage
      end={null}
      controls={
        <label className="demo-switch">
          <input
            type="checkbox"
            role="switch"
            checked={online}
            onChange={(event) => setOnline(event.target.checked)}
          />
          Demo: the connection is back
        </label>
      }
    >
      <Heading title="Cannot reach Soirely">
        <p className="demo-muted">
          {signedIn && 'You are still signed in. '}
          Soirely is not answering, so nothing can load yet. Check your connection, then try again.
        </p>
      </Heading>
      <button
        className="button button-primary demo-wide"
        type="button"
        aria-busy={busy}
        onClick={() => {
          if (!busy) after(() => online && void navigate(to, { replace: true, state }));
        }}
      >
        {busy ? 'Trying again…' : 'Try again'}
      </button>
    </BoardPage>
  );
}

/** The organisation on one line: its tile, its name, and how you came. */
export function Organisation({
  line,
  name = SAMPLE.organisation,
  title = name,
}: {
  line: string;
  name?: string;
  /** The bold line, where it says more than the name. */
  title?: string;
}) {
  return (
    <div className="demo-organisation">
      <span className="org-tile" aria-hidden="true">
        {initials(name)}
      </span>
      <p className="demo-organisation-name">
        <span>{title}</span>
        <span className="demo-help">{line}</span>
      </p>
    </div>
  );
}

export type Answer = 'accept' | 'decline';

/** Accept and join and Decline: two answers to one question, the pressed one working and the other waiting. */
export function Answers({
  pressed,
  onAnswer,
  sized = false,
}: {
  pressed: Answer | null;
  onAnswer: (answer: Answer) => void;
  /** Each button its own width, inside a row of the details page, rather than half the column. */
  sized?: boolean;
}) {
  return (
    <div className="demo-answers-block">
      <div className={sized ? 'demo-answers demo-answers-sized' : 'demo-answers'}>
        <button
          className="button button-primary"
          type="button"
          aria-busy={pressed === 'accept'}
          {...offButton(pressed === 'decline')}
          onClick={() => pressed == null && onAnswer('accept')}
        >
          {pressed === 'accept' ? 'Joining…' : 'Accept and join'}
        </button>
        <button
          className="button"
          type="button"
          aria-busy={pressed === 'decline'}
          {...offButton(pressed === 'accept')}
          onClick={() => pressed == null && onAnswer('decline')}
        >
          {pressed === 'decline' ? 'Declining…' : 'Decline'}
        </button>
      </div>
      <p className="demo-help">
        Declining tells {SAMPLE.inviter} you said no. Nothing else changes.
      </p>
    </div>
  );
}
