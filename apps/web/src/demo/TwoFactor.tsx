import { shapeRecovery } from '@soirely/domain';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';

import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { offButton } from '../offButton.ts';
import { BoardPage, SignedInAs } from './BoardPage.tsx';
import { CodeField, Heading, Notice, Resend, useBusy } from './parts.tsx';
import {
  CODE_LENGTH,
  LOCK_MS,
  SAMPLE,
  TRIES,
  backIn,
  codeDigits,
  codeLine,
  dayOfTime,
  fullNumber,
  timeOfDay,
  twoFactorAt,
} from './rules.ts';

const PHONE = fullNumber(SAMPLE.number, SAMPLE.country);
const ASKS_A_DAY = 3;
const POLL_MS = 20_000;

/** Back to sign-in, the email filled. */
const toSignIn = { to: '/demo/sign-in', state: { email: SAMPLE.email } };

export function TwoFactorBoard() {
  const [params] = useSearchParams();
  const location = useLocation();
  /** How many times "Send the codes" was pressed, for the limit of three a day: the board stays mounted page to page. */
  const [asks, setAsks] = useState(0);
  const page = params.get('page') ?? 'code';
  const state = params.get('state') ?? '';
  const key = `${page}:${state}:${location.key}`;

  switch (page) {
    case 'recovery':
      return <CodeEntry key={key} recovery state={state} />;
    case 'start':
      return <Start key={key} state={state} asks={asks} onAsk={() => setAsks(asks + 1)} />;
    case 'codes':
      return <BothCodes key={key} state={state} />;
    case 'waiting':
      return <Waiting key={key} state={state} />;
    case 'off':
      return <TwoFactorOff />;
    case 'turned-down':
    case 'ended':
    case 'cancelled':
    case 'replaced':
      return <Ending key={key} ending={page} />;
    case 'setup':
      return <SetUpAgain />;
    case 'not-me':
      return <NotMe key={key} state={state} />;
    default:
      return <CodeEntry key={key} recovery={false} state={state} />;
  }
}

/* Enter your code, and a recovery code */

function CodeEntry({ recovery, state }: { recovery: boolean; state: string }) {
  const navigate = useNavigate();
  const carried = useLocation().state as { outlasted?: boolean } | null;
  const opening = recovery
    ? state === 'used'
      ? SAMPLE.usedRecovery
      : ''
    : state === 'wrong'
      ? SAMPLE.authenticator.split('').reverse().join('')
      : '';
  const [code, setCode] = useState(opening);
  const [line, setLine] = useState<string | null>(() =>
    state === 'used'
      ? 'That recovery code has already been used. Try another one from your list.'
      : state === 'wrong'
        ? 'That code did not work. Enter the code your app shows now.'
        : null,
  );
  const [wrongs, setWrongs] = useState(state === 'wrong' ? 1 : 0);
  const [liftsAt, setLiftsAt] = useState<number | null>(() =>
    state === 'paused' ? Date.now() + LOCK_MS : null,
  );
  /** A pause outlasts the sign-in's five minutes, and the API checks those before the code (sc-29956). */
  const [outlasted, setOutlasted] = useState(carried?.outlasted === true);
  const [busy, after] = useBusy();
  const field = useRef<HTMLInputElement>(null);
  const locked = liftsAt != null;

  useEffect(() => {
    if (state !== 'wrong' && state !== 'used') return;

    field.current?.focus();
    field.current?.select();
  }, [state]);

  useEffect(() => {
    if (liftsAt == null) return;

    const lift = window.setTimeout(
      () => {
        setLiftsAt(null);
        setOutlasted(true);
        field.current?.focus();
      },
      Math.max(0, liftsAt - Date.now()),
    );

    return () => window.clearTimeout(lift);
  }, [liftsAt]);

  function refusal(typed: string): string | null {
    if (recovery) return typed === '' ? 'Enter one of your recovery codes.' : null;

    return codeLine(typed, 'your app');
  }

  function verify(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (busy || locked) return;

    const refused = refusal(code);
    setLine(refused);
    if (refused != null) {
      field.current?.focus();
      return;
    }

    after(() => {
      if (outlasted) {
        void navigate('/demo/sign-in?state=code-timed-out', {
          replace: true,
          state: toSignIn.state,
        });
        return;
      }

      if (code === (recovery ? SAMPLE.recovery : SAMPLE.authenticator)) {
        void navigate('/demo/today');
        return;
      }

      if (wrongs + 1 >= TRIES) {
        setWrongs(0);
        setCode('');
        setLine(null);
        setLiftsAt(Date.now() + LOCK_MS);
        return;
      }

      setWrongs(wrongs + 1);
      setLine(
        recovery && code === SAMPLE.usedRecovery
          ? 'That recovery code has already been used. Try another one from your list.'
          : recovery
            ? 'That recovery code did not work. Check it against your saved list.'
            : 'That code did not work. Enter the code your app shows now.',
      );
      field.current?.focus();
      field.current?.select();
    });
  }

  const until = liftsAt == null ? null : timeOfDay(liftsAt);

  return (
    <BoardPage end={null} back={toSignIn}>
      <Heading title={recovery ? 'Enter a recovery code' : 'Enter your code'}>
        <p className="demo-muted">
          {recovery
            ? 'One of the codes you saved when you turned on two-factor. Each works once.'
            : `Open your authenticator app and enter the ${CODE_LENGTH}-digit code for ${SAMPLE.email}.`}
        </p>
        {until != null && (
          <Notice
            title="Too many wrong codes"
            body={`Code entry is paused until ${until}. Then enter the code your app shows at that moment.`}
          />
        )}
      </Heading>

      <form className="demo-form" noValidate onSubmit={verify}>
        <CodeField
          id="code"
          label={recovery ? 'Recovery code' : 'Code'}
          line={line}
          field={field}
          value={code}
          busy={busy || locked}
          onChange={setCode}
          inputMode={recovery ? 'text' : 'numeric'}
          shape={recovery ? shapeRecovery : codeDigits}
          maxLength={recovery ? 9 : CODE_LENGTH}
        />
        <button
          className="button button-primary demo-wide"
          type="submit"
          aria-busy={busy}
          {...offButton(locked)}
        >
          {until != null
            ? `Try again at ${until}`
            : busy
              ? 'Verifying…'
              : recovery
                ? 'Use this code'
                : 'Verify and sign in'}
        </button>
      </form>

      <div className="demo-asides">
        <Link
          className="link-button demo-link"
          to={twoFactorAt(recovery ? 'code' : 'recovery')}
          state={outlasted ? { outlasted } : null}
        >
          {recovery ? 'Use your authenticator app instead' : 'Use a recovery code instead'}
        </Link>
        <Link className="link-button demo-link" to={twoFactorAt('start')}>
          Lost your authenticator and your recovery codes?
        </Link>
        {locked && (
          <p className="demo-aside">
            <span>Not you trying?</span>
            <Link className="link-button demo-link" to={backIn('reset')}>
              Reset your password
            </Link>
          </p>
        )}
      </div>
    </BoardPage>
  );
}

/* Lost authenticator */

function BackToSignIn() {
  return (
    <Link className="link-button demo-link" to={toSignIn.to} state={toSignIn.state}>
      Back to sign in
    </Link>
  );
}

/** One code goes to an account with no verified phone, so its lines count one (sc-30737). */
function codeWords(emailOnly: boolean) {
  return emailOnly
    ? { step: 'You enter the code here.', send: 'Send the code', sending: 'Sending the code…' }
    : { step: 'You enter the codes here.', send: 'Send the codes', sending: 'Sending the codes…' };
}

function Start({ state, asks, onAsk }: { state: string; asks: number; onAsk: () => void }) {
  const navigate = useNavigate();
  /** When asking opens again: a day after the third ask. */
  const [opensAt, setOpensAt] = useState<number | null>(() =>
    state === 'limited' ? Date.now() : null,
  );
  const limited = opensAt != null;
  const [emailOnly, setEmailOnly] = useState(state.startsWith('email-only'));
  const [busy, after] = useBusy();
  const sending = busy || state.endsWith('sending');
  const words = codeWords(emailOnly);

  function send(): void {
    if (sending) return;

    after(() => {
      if (asks >= ASKS_A_DAY) {
        setOpensAt(Date.now());
        return;
      }

      onAsk();
      void navigate(twoFactorAt('codes', emailOnly ? 'email-only' : undefined));
    });
  }

  return (
    <BoardPage
      end={null}
      back={{ to: twoFactorAt('code') }}
      controls={
        <label className="demo-switch">
          <input
            type="checkbox"
            role="switch"
            checked={emailOnly}
            onChange={(event) => setEmailOnly(event.target.checked)}
          />
          Demo: no verified phone
        </label>
      }
    >
      <Heading title="Get back in without your authenticator">
        <p className="demo-muted">
          For when you have lost your authenticator app and your recovery codes.
        </p>
        {limited && (
          <Notice
            title="Too many requests"
            body={`You can ask ${ASKS_A_DAY} times a day. Try again tomorrow at ${timeOfDay(opensAt)}.`}
            alert
          />
        )}
      </Heading>
      <ol className="demo-steps">
        <li>
          <span className="demo-step-number" aria-hidden="true">
            1
          </span>
          <span>
            {emailOnly
              ? `We send a code to ${SAMPLE.email}.`
              : `We send a code to ${SAMPLE.email}, and one to ${PHONE} if your number is verified.`}
          </span>
        </li>
        <li>
          <span className="demo-step-number" aria-hidden="true">
            2
          </span>
          <span>{words.step}</span>
        </li>
        <li>
          <span className="demo-step-number" aria-hidden="true">
            3
          </span>
          <span>
            An owner or admin of {SAMPLE.organisation} confirms it’s you. You stay signed out until
            they do.
          </span>
        </li>
      </ol>
      <p className="demo-help">
        When they confirm, two-factor is turned off, every session ends, and you sign in again.
        Every step is emailed to you.
      </p>
      <button
        className="button button-primary demo-wide"
        type="button"
        aria-busy={sending}
        {...offButton(limited)}
        onClick={send}
      >
        {sending ? words.sending : words.send}
      </button>
      <BackToSignIn />
    </BoardPage>
  );
}

type Lines = { email?: string; phone?: string };

type Spent = 'expired' | 'exhausted';

function spentWords(spent: Spent, emailOnly: boolean, last: string) {
  if (spent === 'exhausted') {
    return {
      title: 'Too many wrong tries',
      body: emailOnly
        ? 'That code no longer works. Send a new one to carry on.'
        : 'Those codes no longer work. Send new ones to carry on.',
    };
  }

  return emailOnly
    ? {
        title: 'That code has expired',
        body: 'Codes only work for a while. Send a new one and use the code in the newest email.',
      }
    : {
        title: 'Those codes have expired',
        body: `Codes only work for a while. Send new ones and use the codes in the newest email and ${last}.`,
      };
}

function BothCodes({ state }: { state: string }) {
  const navigate = useNavigate();
  const [emailOnly, setEmailOnly] = useState(state.startsWith('email-only'));
  const [spent, setSpent] = useState<Spent | null>(() =>
    state.endsWith('expired') ? 'expired' : state.endsWith('exhausted') ? 'exhausted' : null,
  );
  const [wrongs, setWrongs] = useState(0);
  const focusEmail = useRef(false);
  const [emailCode, setEmailCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [lines, setLines] = useState<Lines>({});
  const [texted, setTexted] = useState(false);
  const [sentAt, setSentAt] = useState(() => Date.now());
  const [busy, after] = useBusy();
  const emailField = useRef<HTMLInputElement>(null);
  const phoneField = useRef<HTMLInputElement>(null);
  const from = texted ? 'the text' : 'WhatsApp';

  useEffect(() => {
    if (!focusEmail.current || emailField.current == null) return;

    focusEmail.current = false;
    emailField.current.focus();
  });

  function check(): Lines {
    const found: Lines = {};
    const email = codeLine(emailCode, 'the email');

    if (email != null) found.email = email;
    if (!emailOnly) {
      const phone = codeLine(phoneCode, from);
      if (phone != null) found.phone = phone;
    }

    return found;
  }

  function ask(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (busy) return;

    const found = check();
    setLines(found);
    if (found.email != null || found.phone != null) {
      (found.email != null ? emailField : phoneField).current?.focus();
      return;
    }

    after(() => {
      const wrong: Lines = {};
      if (emailCode !== SAMPLE.code)
        wrong.email =
          'That code does not match. Check the newest email from Soirely and try again.';
      if (!emailOnly && phoneCode !== SAMPLE.code)
        wrong.phone = texted
          ? 'That code does not match. Check the newest text from Soirely and try again.'
          : 'That code does not match. Check the newest WhatsApp message from Soirely and try again.';

      if (wrong.email == null && wrong.phone == null) {
        void navigate(twoFactorAt('waiting'));
        return;
      }

      if (wrongs + 1 >= TRIES) {
        setWrongs(0);
        setLines({});
        setSpent('exhausted');
        return;
      }

      setWrongs(wrongs + 1);
      setLines(wrong);

      const first = (wrong.email != null ? emailField : phoneField).current;
      first?.focus();
      first?.select();
    });
  }

  function resend(): void {
    if (busy) return;

    after(() => {
      setEmailCode('');
      setPhoneCode('');
      setLines({});
      setTexted(false);
      setSpent(null);
      setWrongs(0);
      setSentAt(Date.now());
      focusEmail.current = true;
    });
  }

  const dead =
    spent == null ? null : spentWords(spent, emailOnly, texted ? 'text' : 'WhatsApp message');

  return (
    <BoardPage
      end={null}
      back={{ to: twoFactorAt('start') }}
      tall
      controls={
        <label className="demo-switch">
          <input
            type="checkbox"
            role="switch"
            checked={emailOnly}
            onChange={(event) => {
              setEmailOnly(event.target.checked);
              setLines({});
            }}
          />
          Demo: no verified phone
        </label>
      }
    >
      <Heading title={emailOnly ? 'Enter the code' : 'Enter both codes'}>
        <p className="demo-muted">
          {emailOnly
            ? `We sent a code to ${SAMPLE.email}.`
            : `We sent a code to ${SAMPLE.email} and another to ${PHONE}. You need both.`}
        </p>
        {dead != null && <Notice title={dead.title} body={dead.body} />}
      </Heading>

      {dead != null ? (
        <button
          className="button button-primary demo-wide"
          type="button"
          aria-busy={busy}
          onClick={resend}
        >
          {emailOnly ? 'Send a new code' : 'Send new codes'}
        </button>
      ) : (
        <>
          <form className="demo-form" noValidate onSubmit={ask}>
            <div className="demo-fields">
              <CodeField
                id="email-code"
                label="Code from the email"
                sent={`Sent to ${SAMPLE.email}`}
                line={lines.email}
                field={emailField}
                value={emailCode}
                busy={busy}
                onChange={setEmailCode}
              />
              {!emailOnly && (
                <CodeField
                  id="phone-code"
                  label={texted ? 'Code from the text' : 'Code from WhatsApp'}
                  sent={
                    texted
                      ? `Texted to ${PHONE}: the same code as on WhatsApp`
                      : `Sent to your WhatsApp on ${PHONE}`
                  }
                  line={lines.phone}
                  field={phoneField}
                  value={phoneCode}
                  busy={busy}
                  onChange={setPhoneCode}
                />
              )}
            </div>
            <button className="button button-primary demo-wide" type="submit" aria-busy={busy}>
              {busy ? 'Asking…' : 'Ask to get back in'}
            </button>
          </form>

          <Resend key={sentAt} plural={!emailOnly} onResend={resend}>
            {!emailOnly && !texted && (
              <button
                className="link-button demo-link"
                type="button"
                onClick={() => {
                  if (!busy) after(() => setTexted(true));
                }}
              >
                Text it to me instead
              </button>
            )}
          </Resend>
        </>
      )}
    </BoardPage>
  );
}

/* Once asked */

type Answer = 'off' | 'turned-down' | 'ended' | 'replaced';

const ANSWERS: { answer: Answer; name: string }[] = [
  { answer: 'off', name: 'Confirm' },
  { answer: 'turned-down', name: 'Turn down' },
  { answer: 'ended', name: 'Let it end' },
  { answer: 'replaced', name: 'Replace it' },
];

/** Cancel the request asks first (sc-29957); an answer found while the dialog is open leaves the page, and the dialog with it. */
function Waiting({ state }: { state: string }) {
  const navigate = useNavigate();
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [confirming, setConfirming] = useState(state === 'confirm' || state === 'not-cancelled');
  const [notCancelled, setNotCancelled] = useState(state === 'not-cancelled');
  const [reachable, setReachable] = useState(true);
  const [busy, after] = useBusy();
  const [asked] = useState(() => Date.now());
  const given = useRef<Answer | null>(null);

  useEffect(() => {
    given.current = answer;
  }, [answer]);

  useEffect(() => {
    const look = window.setInterval(() => {
      if (given.current != null) void navigate(twoFactorAt(given.current));
    }, POLL_MS);

    return () => window.clearInterval(look);
  }, [navigate]);

  return (
    <BoardPage
      end={null}
      controls={
        <>
          <div className="demo-answer-controls" role="group" aria-label="Demo: answer the request">
            {ANSWERS.map((each) => (
              <button
                key={each.answer}
                className="button demo-dense"
                type="button"
                aria-pressed={answer === each.answer}
                onClick={() => setAnswer(each.answer)}
              >
                Demo: {each.name}
              </button>
            ))}
          </div>
          <label className="demo-switch">
            <input
              type="checkbox"
              role="switch"
              checked={!reachable}
              onChange={(event) => setReachable(!event.target.checked)}
            />
            Demo: Soirely can’t be reached
          </label>
        </>
      }
    >
      <Heading title="Waiting for your organisation">
        <p className="demo-muted">
          We’ve asked the owners and admins of {SAMPLE.organisation} to confirm it’s you. One answer
          is enough.
        </p>
      </Heading>
      <div className="demo-lines">
        <p>Asked {when(asked)}.</p>
        <p className="demo-muted">
          If nobody answers by {when(asked + 7 * 24 * 60 * 60 * 1000)}, the request ends.
        </p>
      </div>
      <p className="demo-muted">
        You stay signed out until somebody answers. We’ll email {SAMPLE.email} either way.
      </p>
      <p className="demo-aside">
        <span>This wasn’t you?</span>
        <button className="link-button demo-link" type="button" onClick={() => setConfirming(true)}>
          Cancel the request
        </button>
      </p>
      <BackToSignIn />
      {confirming && (
        <ConfirmDialog
          id="cancel-request"
          title="Cancel your request?"
          keep="Keep waiting"
          go="Cancel the request"
          pending={busy}
          opensPage={reachable}
          refusal={
            notCancelled ? (
              <div className="notice notice-broken" role="alert">
                <span className="mark mark-broken" aria-hidden="true">
                  ✕
                </span>
                <div className="notice-body">
                  <p>Not cancelled. Your request is still waiting. Try again.</p>
                </div>
              </div>
            ) : undefined
          }
          onKeep={() => {
            setConfirming(false);
            setNotCancelled(false);
          }}
          onGo={() => {
            setNotCancelled(false);
            // A request already answered refuses the cancel, so the page shows that answer.
            after(() =>
              reachable ? void navigate(twoFactorAt(answer ?? 'cancelled')) : setNotCancelled(true),
            );
          }}
        >
          <p>You’ll need to start again to get back in.</p>
        </ConfirmDialog>
      )}
    </BoardPage>
  );
}

function when(at: number): string {
  return `${dayOfTime(at)} at ${timeOfDay(at)}`;
}

function TwoFactorOff() {
  return (
    <BoardPage end={null}>
      <Heading title="Two-factor is off" done>
        <p className="demo-muted">
          Somebody in {SAMPLE.organisation} confirmed it was you. Every session you had has ended.
          Sign in, then set it up again.
        </p>
      </Heading>
      {/* After a recovery, signing in goes on to Set up two-factor again. */}
      <Link
        className="button button-primary demo-wide"
        to={toSignIn.to}
        state={{ ...toSignIn.state, recovered: true }}
      >
        Sign in
      </Link>
    </BoardPage>
  );
}

const ENDINGS: Record<
  'turned-down' | 'ended' | 'cancelled' | 'replaced',
  { title: string; body: string; note?: string; again?: string }
> = {
  'turned-down': {
    title: 'Your request was turned down',
    body: `Two-factor is still on, so you can’t sign in without it. Ask an owner or admin of ${SAMPLE.organisation}, or contact Soirely support.`,
  },
  ended: {
    title: 'Your request ended',
    body: 'Nobody answered within 7 days. Two-factor is still on. You can ask again.',
    again: 'Ask again',
  },
  cancelled: {
    title: 'Request cancelled',
    body: 'Nothing changed. Two-factor is still on.',
  },
  replaced: {
    title: 'A newer request replaced this one',
    body: 'A newer request was started on another device. Start again to ask from here.',
    note: 'Starting again sends new codes here and ends the request on the other device. It counts as one of your 3 requests a day.',
    again: 'Start again',
  },
};

function Ending({ ending }: { ending: keyof typeof ENDINGS }) {
  const words = ENDINGS[ending];

  return (
    <BoardPage end={null}>
      <Heading title={words.title}>
        <p className="demo-muted">{words.body}</p>
      </Heading>
      {words.note != null && <p className="demo-help">{words.note}</p>}
      {words.again != null && (
        <Link className="button button-primary demo-wide" to={twoFactorAt('start')}>
          {words.again}
        </Link>
      )}
      {ending === 'turned-down' && (
        <a className="button demo-wide" href="mailto:support@soirely.com">
          Email support@soirely.com
        </a>
      )}
      <BackToSignIn />
    </BoardPage>
  );
}

/* After getting back in */

function SetUpAgain() {
  return (
    <BoardPage end={<SignedInAs />}>
      <Heading title="Set up two-factor again">
        <p className="demo-muted">
          Two-factor was turned off to let you back in. Set it up again so a password alone can’t
          open your account.
        </p>
      </Heading>
      <div className="demo-buttons">
        <Link className="button button-primary demo-wide" to="/demo/later?screen=security">
          Set up two-factor
        </Link>
        <Link className="button demo-wide" to="/demo/today">
          Not now
        </Link>
      </div>
      <p className="demo-help">You can set it up any time in Your account › Security.</p>
    </BoardPage>
  );
}

function NotMe({ state }: { state: string }) {
  const [done, setDone] = useState(state === 'done');
  const [busy, after] = useBusy();

  if (done) {
    return (
      <BoardPage end={null}>
        <Heading title="Cancelled and signed out">
          <p className="demo-muted" role="status">
            Any request that was waiting is cancelled, and every session is signed out. If somebody
            else knows your password, change it when you next sign in.
          </p>
        </Heading>
        <BackToSignIn />
      </BoardPage>
    );
  }

  return (
    <BoardPage end={null}>
      <Heading title="This wasn’t you?">
        <p className="demo-muted">
          This cancels any request to get into your account without two-factor that is still
          waiting, and signs out every session.
        </p>
      </Heading>
      <button
        className="button button-primary demo-wide"
        type="button"
        aria-busy={busy}
        onClick={() => {
          if (!busy) after(() => setDone(true));
        }}
      >
        {busy ? 'Cancelling…' : 'Cancel and sign out everywhere'}
      </button>
      <BackToSignIn />
    </BoardPage>
  );
}
