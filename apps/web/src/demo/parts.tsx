import {
  PASSWORD_MINIMUM_LENGTH,
  formatCountdown,
  initials,
  meetsPasswordLength,
} from '@soirely/domain';
import { type FormEvent, type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
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
  step?: 1 | 2 | undefined;
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
  late = false,
}: {
  title: string;
  body?: string;
  alert?: boolean;
  /** The words arrive a tick after the region, so a screen reader says them on a page that opens with them. */
  late?: boolean;
}) {
  const ticked = useShownAfter(0);
  const said = !late || ticked;

  return (
    <div className="demo-notice" role={alert ? 'alert' : 'status'}>
      {said && <p className="demo-notice-title">{title}</p>}
      {said && body != null && <p>{body}</p>}
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

export function PasswordField({
  label,
  field,
  password,
  line,
  busy,
  revealed,
  onReveal,
  onChange,
}: {
  label: string;
  field: RefObject<HTMLInputElement | null>;
  password: string;
  line: string | null;
  busy: boolean;
  revealed: boolean;
  onReveal: (revealed: boolean) => void;
  onChange: (password: string) => void;
}) {
  return (
    <div className={fieldClass(line != null)}>
      <label htmlFor="password">{label}</label>
      <div className="demo-reveal">
        <input
          ref={field}
          className="demo-input"
          id="password"
          type={revealed ? 'text' : 'password'}
          autoComplete="new-password"
          value={password}
          {...offField(busy)}
          aria-invalid={line != null}
          aria-describedby={line == null ? 'password-rule' : 'password-line password-rule'}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          className="demo-reveal-button"
          type="button"
          aria-pressed={revealed}
          onClick={() => onReveal(!revealed)}
        >
          {revealed ? 'Hide' : 'Show'}
        </button>
      </div>
      {line != null && (
        <p className="demo-line" id="password-line">
          {line}
        </p>
      )}
      <PasswordRule met={meetsPasswordLength(password)} />
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
  resend = true,
  onRunOut,
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
  /** False for an authenticator's code: nothing to send, so no resend and no end to the tries. */
  resend?: boolean;
  /** The sign-up's hold has run out: Verify and Send a new code both end here. */
  onRunOut?: (() => void) | undefined;
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
      if (onRunOut != null) {
        onRunOut();
        return;
      }

      if (code === SAMPLE.code) {
        onVerified();
        return;
      }

      if (resend && wrongs + 1 >= TRIES) {
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
      if (onRunOut != null) {
        onRunOut();
        return;
      }

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
        <CodeField
          id="code"
          label={label}
          line={line}
          field={field}
          value={code}
          busy={busy}
          onChange={setCode}
        />
        <button className="button button-primary demo-wide" type="submit" aria-busy={busy}>
          {sending ? 'Sending…' : busy ? 'Verifying…' : submit}
        </button>
      </form>
      {resend && (
        <Resend key={countFrom} onResend={sendNew}>
          {resendNote}
        </Resend>
      )}
      {below}
    </>
  );
}

/** The board's one code field: sign-in's code page, Enter your code and Both codes all render it. */
export function CodeField({
  id,
  label,
  sent,
  line,
  field,
  value,
  busy,
  onChange,
  inputMode = 'numeric',
  shape = codeDigits,
  maxLength = CODE_LENGTH,
}: {
  id: string;
  label: string;
  /** "Sent to …", under the field. */
  sent?: string;
  line: string | null | undefined;
  field: RefObject<HTMLInputElement | null>;
  value: string;
  busy: boolean;
  onChange: (code: string) => void;
  inputMode?: 'numeric' | 'text';
  shape?: (typed: string) => string;
  maxLength?: number;
}) {
  const described = [line == null ? null : `${id}-line`, sent == null ? null : `${id}-sent`]
    .filter((each) => each != null)
    .join(' ');

  return (
    <div className={fieldClass(line != null)}>
      <label htmlFor={id}>{label}</label>
      <input
        ref={field}
        className="demo-input demo-code"
        id={id}
        inputMode={inputMode}
        autoComplete="one-time-code"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        maxLength={maxLength}
        value={value}
        {...offField(busy)}
        aria-invalid={line != null}
        aria-describedby={described === '' ? undefined : described}
        onChange={(event) => onChange(shape(event.target.value))}
      />
      {line != null && (
        <p className="demo-line" id={`${id}-line`} role="alert">
          {line}
        </p>
      )}
      {sent != null && (
        <p className="demo-help" id={`${id}-sent`}>
          {sent}
        </p>
      )}
    </div>
  );
}

/** "No code? Send a new code in 0:41", a link once the count ends; the note under it. */
export function Resend({
  onResend,
  plural = false,
  children,
}: {
  onResend: () => void;
  /** "No codes? Send new codes", where two codes went. */
  plural?: boolean;
  children?: ReactNode;
}) {
  const [left, setLeft] = useState(RESEND_SECONDS);
  const send = plural ? 'Send new codes' : 'Send a new code';

  useEffect(() => {
    if (left <= 0) return;

    const tick = window.setTimeout(() => setLeft(left - 1), 1000);

    return () => window.clearTimeout(tick);
  }, [left]);

  return (
    <div className="demo-resend">
      <p className="demo-resend-line">
        <span>{plural ? 'No codes?' : 'No code?'}</span>
        {left > 0 ? (
          <span className="demo-resend-wait">
            {send} in {formatCountdown(left)}
          </span>
        ) : (
          <button className="link-button demo-link" type="button" onClick={onResend}>
            {send}
          </button>
        )}
      </p>
      <p className="demo-resend-note">
        {plural ? 'New codes replace the last ones.' : 'A new code replaces the last one.'}
      </p>
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
  step?: 1 | 2;
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
  invited = false,
  until,
}: {
  line: string;
  name?: string;
  /** The bold line, where it says more than the name. */
  title?: string;
  /** An organisation you are invited to and not yet in: the dashed tile. */
  invited?: boolean;
  until?: string;
}) {
  return (
    <div className="demo-organisation">
      <span className={invited ? 'org-tile org-tile-invited' : 'org-tile'} aria-hidden="true">
        {initials(name)}
      </span>
      <p className="demo-organisation-name">
        <span>{title}</span>
        <span className="demo-help">{line}</span>
        {until != null && <span className="demo-help">{until}</span>}
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
  held = false,
}: {
  pressed: Answer | null;
  onAnswer: (answer: Answer) => void;
  /** Both answers wait while another form on the page is working. */
  held?: boolean;
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
          {...offButton(held || pressed === 'decline')}
          onClick={() => !held && pressed == null && onAnswer('accept')}
        >
          {pressed === 'accept' ? 'Joining…' : 'Accept and join'}
        </button>
        <button
          className="button"
          type="button"
          aria-busy={pressed === 'decline'}
          {...offButton(held || pressed === 'accept')}
          onClick={() => !held && pressed == null && onAnswer('decline')}
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
