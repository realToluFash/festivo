import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';

import { offField } from '../offField.ts';
import { BoardPage, HaveAccount, SignedInAs } from './BoardPage.tsx';
import {
  CodeForm,
  Heading,
  Notice,
  PasswordField,
  Unreachable,
  Verified,
  fieldClass,
  useBusy,
} from './parts.tsx';
import { BREACHED, LOCK_MS, SAMPLE, backIn, emailLine, passwordLine, timeOfDay } from './rules.ts';

/** What one page hands the next: the address, and the page the reset was opened from. */
export type Reset = { email: string; back: string };

type Dead = { title: string; body: string };

const BROKEN: Dead = {
  title: 'This link doesn’t work',
  body: 'It may have been cut off or mistyped. Send a new link and use the newest email.',
};

const DEAD: Record<string, Dead> = {
  expired: {
    title: 'This link has expired',
    body: 'Reset links only work for a short time. Send a new one and use the newest email.',
  },
  used: {
    title: 'This link has already been used',
    body: 'If you set a new password with it, sign in with that password. If you did not, send a new link now.',
  },
  broken: BROKEN,
};

export function GetBackInBoard() {
  const [params] = useSearchParams();
  const location = useLocation();
  const reset: Reset = {
    email: SAMPLE.email,
    back: '/demo/sign-in',
    ...(location.state as Partial<Reset> | null),
  };
  const page = params.get('page') ?? 'reset';
  const state = params.get('state') ?? '';
  const key = `${page}:${state}:${location.key}`;

  switch (page) {
    case 'sent':
      return <Sent key={key} reset={reset} />;
    case 'new':
      return <NewPassword key={key} state={state} email={reset.email} />;
    case 'done':
      return <Changed key={key} email={reset.email} />;
    case 'code':
      return <CodeFirst key={key} email={reset.email} />;
    case 'link':
      return state === 'offline' ? (
        <Unreachable key={key} to={backIn('new')} signedIn={false} />
      ) : (
        <DeadLink key={key} state={state} />
      );
    default:
      return <ResetPassword key={key} state={state} reset={reset} />;
  }
}

function ResetPassword({ state, reset }: { state: string; reset: Reset }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState(reset.email);
  const [line, setLine] = useState<string | null>(null);
  const [failed, setFailed] = useState(state === 'failed');
  const [liftsAt] = useState<number | null>(() =>
    state === 'limited' ? Date.now() + LOCK_MS : null,
  );
  const [busy, after] = useBusy();
  const field = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (busy) return;

    const refused = emailLine(email);
    setLine(refused);
    if (refused != null) {
      field.current?.focus();
      return;
    }

    after(() => {
      if (liftsAt != null && Date.now() < liftsAt) return;

      setFailed(false);
      void navigate(backIn('sent'), { state: { email, back: reset.back } satisfies Reset });
    });
  }

  return (
    <BoardPage end={<HaveAccount question="Remembered it?" />} back={{ to: reset.back }}>
      <Heading title="Reset your password">
        <p className="demo-muted">
          Enter the email you sign in with. If it has an account, we send it a link to set a new
          password.
        </p>
        {liftsAt != null && (
          <Notice
            title="Too many requests"
            body={`Try again at ${timeOfDay(liftsAt)}. Any link already sent still works.`}
          />
        )}
        {failed && (
          <Notice
            title="That did not work"
            body="Something went wrong on the way. Try again in a moment."
            alert
          />
        )}
      </Heading>

      <form className="demo-form" noValidate onSubmit={submit}>
        <div className={fieldClass(line != null)}>
          <label htmlFor="email">Email</label>
          <input
            ref={field}
            className="demo-input"
            id="email"
            type="email"
            autoComplete="email"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            {...offField(busy)}
            aria-invalid={line != null}
            aria-describedby={line == null ? undefined : 'email-line'}
            onChange={(event) => {
              setEmail(event.target.value);
              if (line != null) setLine(emailLine(event.target.value));
            }}
          />
          {line != null && (
            <p className="demo-line" id="email-line">
              {line}
            </p>
          )}
        </div>
        <button className="button button-primary demo-wide" type="submit" aria-busy={busy}>
          {busy ? 'Sending…' : 'Send the link'}
        </button>
      </form>
    </BoardPage>
  );
}

/** The same words whether or not the address has an account. */
function Sent({ reset }: { reset: Reset }) {
  const [sentAgain, setSentAgain] = useState(false);
  const [busy, after] = useBusy();

  return (
    <BoardPage
      end={null}
      back={{ to: backIn('reset'), state: reset }}
      controls={
        <Link className="link-button" to={backIn('new')} state={reset}>
          Demo: open the link
        </Link>
      }
    >
      <Heading title="Check your email">
        <p className="demo-muted">
          If that address has an account, we have sent it a link to set a new password. The link
          works once.
        </p>
      </Heading>
      <div className="demo-asides">
        <p className="demo-aside">
          <span>Nothing there? Check your spam folder first, then</span>
          <span>
            <button
              className="link-button demo-link"
              type="button"
              aria-busy={busy}
              onClick={() => {
                if (busy) return;

                setSentAgain(false);
                after(() => setSentAgain(true));
              }}
            >
              {busy ? 'Sending…' : 'send it again'}
            </button>
            .
          </span>
          <span role="status">{sentAgain && 'Sent again.'}</span>
        </p>
        <p className="demo-muted">
          Signed up with Google or Apple? Then there is no password to reset, and the email says how
          you sign in instead.
        </p>
        <p className="demo-aside">
          <span>Got the link? Open it on any device.</span>
          <Link className="link-button demo-link" to="/demo/sign-in">
            Back to sign in
          </Link>
        </p>
      </div>
    </BoardPage>
  );
}

const BLANK = 'Enter a new password.';

/** Opened from the link, so it has no Back. */
function NewPassword({ state, email }: { state: string; email: string }) {
  const navigate = useNavigate();
  const [password, setPassword] = useState(state === 'short' ? 'nine char' : '');
  const [line, setLine] = useState<string | null>(
    state === 'short' ? passwordLine('nine char', BLANK) : null,
  );
  const [breached, setBreached] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [busy, after] = useBusy();
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state === 'short') field.current?.focus();
  }, [state]);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (busy) return;

    const refused = passwordLine(password, BLANK);
    setLine(refused);
    setBreached(false);
    if (refused != null) {
      field.current?.focus();
      return;
    }

    setRevealed(false);
    after(() => {
      if (password === SAMPLE.breachedPassword) {
        setBreached(true);
        field.current?.focus();
        return;
      }

      void navigate(backIn('done'), { state: { email } satisfies Partial<Reset> });
    });
  }

  const shown = line ?? (breached ? BREACHED : null);

  return (
    <BoardPage end={null}>
      <Heading title="Set a new password">
        <p className="demo-muted">For {email}.</p>
      </Heading>
      <form className="demo-form" noValidate onSubmit={submit}>
        <PasswordField
          label="New password"
          field={field}
          password={password}
          line={shown}
          busy={busy}
          revealed={revealed}
          onReveal={setRevealed}
          onChange={(typed) => {
            setPassword(typed);
            setBreached(false);
            if (line != null) setLine(passwordLine(typed, BLANK));
          }}
        />

        <p className="demo-muted">
          Setting it signs you out on every other device. This one stays signed in.
        </p>
        <button className="button button-primary demo-wide" type="submit" aria-busy={busy}>
          {busy ? 'Setting it…' : 'Set password and sign in'}
        </button>
      </form>
    </BoardPage>
  );
}

function Changed({ email }: { email: string }) {
  const navigate = useNavigate();

  return (
    <BoardPage end={<SignedInAs email={email} />}>
      <Verified
        title="Password changed"
        body={`You are signed in on this device and signed out everywhere else. We have emailed ${email} to say it was changed.`}
        action="Continue to Soirely"
        onContinue={() => void navigate('/demo/today')}
      />
    </BoardPage>
  );
}

function DeadLink({ state }: { state: string }) {
  const navigate = useNavigate();
  const dead = DEAD[state] ?? BROKEN;
  const [busy, after] = useBusy();

  return (
    <BoardPage end={null}>
      <Heading title={dead.title}>
        <p className="demo-muted">{dead.body}</p>
      </Heading>
      <button
        className="button button-primary demo-wide"
        type="button"
        aria-busy={busy}
        onClick={() => {
          if (!busy) after(() => void navigate(backIn('sent')));
        }}
      >
        {busy ? 'Sending…' : 'Send a new link'}
      </button>
      <p className="demo-aside">
        <span>Remembered it after all?</span>
        <Link className="link-button demo-link" to="/demo/sign-in">
          Sign in
        </Link>
      </p>
    </BoardPage>
  );
}

/** Two-factor on: the code passes before the password can change. */
function CodeFirst({ email }: { email: string }) {
  const navigate = useNavigate();

  return (
    <BoardPage end={null}>
      <Heading title="Enter your code">
        <p className="demo-muted">
          Your account uses two-factor, so the reset asks for a code first. Open your authenticator
          app and enter the 6-digit code for {email}. Nothing changes until it passes.
        </p>
      </Heading>
      <CodeForm
        opening=""
        label="Code"
        submit="Continue to a new password"
        from="your app"
        wrong="That code did not work. Enter the code your app shows now."
        expired=""
        resend={false}
        onVerified={() => void navigate(backIn('new'), { state: { email } })}
      />
      <div className="demo-asides">
        <Link className="link-button demo-link" to="/demo/later?screen=recovery">
          Use a recovery code instead
        </Link>
        <Link className="link-button demo-link" to="/demo/later?screen=lost">
          Lost your authenticator and your recovery codes?
        </Link>
      </div>
    </BoardPage>
  );
}
