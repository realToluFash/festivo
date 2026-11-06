import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router';

import { NotFound } from '../routes/public/NotFound.tsx';
import { offButton } from '../offButton.ts';
import { offField } from '../offField.ts';
import { BoardPage, OrLine, Providers } from './BoardPage.tsx';
import { EventPage } from './EventPage.tsx';
import { Events } from './Events.tsx';
import { EVENTS_PAGES } from './events.ts';
import { ACCOUNT_PAGES } from './account.ts';
import { GENERAL_PAGES } from './general.ts';
import { GetBackInBoard } from './GetBackIn.tsx';
import { NewAccountBoard } from './NewAccount.tsx';
import { NOTIFICATIONS_PAGES } from './notifications.ts';
import { SECURITY_PAGES } from './security.ts';
import { Settings } from './Settings.tsx';
import { SETTINGS_PAGES } from './settings.ts';
import { SIGN_IN_RULES_PAGES } from './signInRules.ts';
import { SWITCHER_PAGES } from './switcher.ts';
import { Today } from './Today.tsx';
import { TwoFactorBoard } from './TwoFactor.tsx';
import { WaysInBoard } from './WaysIn.tsx';
import {
  type FieldLines,
  GET_BACK_IN_PAGES,
  LOCK_MS,
  NEW_ACCOUNT_PAGES,
  SAMPLE,
  TWO_FACTOR_PAGES,
  WAYS_IN_PAGES,
  backIn,
  fieldLines,
  refuse,
  samplePair,
  timeOfDay,
  twoFactorAt,
} from './rules.ts';
import './demo.css';

const BUSY_MS = 900;

type Notice = { title: string; body: string };

/** The states the board draws, each opened from the demo's home. */
const TODAY_MOMENTS: { key: string; name: string }[] = [
  { key: 'plan', name: 'A planning day' },
  { key: 'planNow', name: 'A planning day, built now' },
  { key: 'day', name: 'The event day' },
  { key: 'dayNow', name: 'The event day, built now' },
  { key: 'quiet', name: 'A quiet week' },
  { key: 'first', name: 'A first run' },
];

const SIGN_IN_STATES: { key: string; name: string; notice?: Notice }[] = [
  { key: 'first-visit', name: 'Signed out, first visit' },
  {
    key: 'signed-out',
    name: 'You were signed out',
    notice: { title: 'You were signed out', body: 'Sign in again to carry on.' },
  },
  {
    key: 'rule',
    name: 'Signed out by Ire Events’ rule',
    notice: {
      title: 'Signed out by Ire Events’ rule',
      body: 'Ire Events signs people out after 30 days without use. Sign in again to carry on.',
    },
  },
  {
    key: 'google-failed',
    name: 'Google sign-in did not work',
    notice: {
      title: 'Google sign-in did not work',
      body: 'Nothing was changed. Try Google again, or sign in with your email and password.',
    },
  },
  {
    key: 'failed',
    name: 'Signing in did not work',
    notice: {
      title: 'Signing in did not work',
      body: 'Something went wrong on the way. Try again in a moment.',
    },
  },
  { key: 'locked', name: 'Too many tries' },
  {
    key: 'provider-only',
    name: 'Ire Events signs in with Google or Apple only',
    notice: {
      title: 'Ire Events signs in with Google or Apple only',
      body: 'Password sign-in is off in Ire Events. Use Google or Apple instead.',
    },
  },
];

export default function Demo() {
  const { state } = useLocation() as { state: { from?: string } | null };
  const [from] = useState(() => state?.from ?? '/sign-in');

  return (
    <Routes>
      <Route index element={<DemoHome from={from} />} />
      <Route path="sign-in" element={<SignInBoard />} />
      <Route path="create-account" element={<NewAccountBoard />} />
      <Route path="get-back-in" element={<GetBackInBoard />} />
      <Route path="two-factor" element={<TwoFactorBoard />} />
      <Route path="ways-in" element={<WaysInBoard />} />
      <Route path="signed-in" element={<SignedIn />} />
      <Route path="today" element={<Today />} />
      <Route path="events" element={<Events />} />
      <Route path="events/:id" element={<EventPage />} />
      <Route path="settings" element={<Settings />} />
      <Route path="settings/members" element={<Settings />} />
      <Route path="settings/account" element={<Settings open="account" />} />
      <Route path="settings/security" element={<Settings open="security" />} />
      <Route path="settings/notifications" element={<Settings open="notifications" />} />
      <Route path="settings/general" element={<Settings open="general" />} />
      <Route path="settings/sign-in-rules" element={<Settings open="signInRules" />} />
      <Route path="later" element={<Later />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function DemoHome({ from }: { from: string }) {
  const navigate = useNavigate();

  return (
    <main id="content" className="demo-home">
      <header className="demo-home-header">
        <h1>Design demo</h1>
        <button className="button" type="button" onClick={() => void navigate(from)}>
          Close
        </button>
      </header>
      <p className="demo-home-line">
        The designs, working on sample data. Nothing is sent. Sign in with{' '}
        <strong>{SAMPLE.email}</strong> and <strong>{SAMPLE.password}</strong>. The code from the
        email or the phone is <strong>{SAMPLE.code}</strong>. The authenticator’s code is{' '}
        <strong>{SAMPLE.authenticator}</strong>, a recovery code <strong>{SAMPLE.recovery}</strong>,
        and <strong>{SAMPLE.usedRecovery}</strong> one used already.
      </p>

      <section className="demo-home-page" aria-labelledby="demo-page-29">
        <h2 id="demo-page-29">29 · Today · where signing in lands</h2>
        <h3>Today in B Confetti · desktop</h3>
        <ul className="demo-home-rows">
          {TODAY_MOMENTS.map((moment) => (
            <li key={moment.key}>
              <Link className="demo-home-row" to={`today?moment=${moment.key}`}>
                <span>{moment.name}</span>
                <span aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>
        <h3>Events in A · Summary first · desktop</h3>
        <BoardPages pages={EVENTS_PAGES} />
        <h3>The organisation switcher in B · Places · desktop</h3>
        <BoardPages pages={SWITCHER_PAGES} />
      </section>

      <section className="demo-home-page" aria-labelledby="demo-page-28">
        <h2 id="demo-page-28">28 · Organisations and access · Settings at a desk</h2>
        <h3>Settings in B · Summary first · desktop</h3>
        <BoardPages pages={SETTINGS_PAGES} />
        <h3>Your account in B · Summary first · desktop</h3>
        <BoardPages pages={ACCOUNT_PAGES} />
        <h3>Security in B · Summary first · desktop</h3>
        <BoardPages pages={SECURITY_PAGES} />
        <h3>Notification settings in B · Summary first · desktop</h3>
        <BoardPages pages={NOTIFICATIONS_PAGES} />
        <h3>General in B · Summary first · desktop</h3>
        <BoardPages pages={GENERAL_PAGES} />
        <h3>Sign-in rules in B · Where you stand · desktop</h3>
        <BoardPages pages={SIGN_IN_RULES_PAGES} />
      </section>

      <section className="demo-home-page" aria-labelledby="demo-page-27">
        <h2 id="demo-page-27">27 · Sign in · desktop polish</h2>
        <h3>Sign in · desktop · second pass</h3>
        <ul className="demo-home-rows">
          {SIGN_IN_STATES.map((state) => (
            <li key={state.key}>
              <Link className="demo-home-row" to={`sign-in?state=${state.key}`}>
                <span>{state.name}</span>
                <span aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>

        <h3>Create an account · desktop</h3>
        <BoardPages pages={NEW_ACCOUNT_PAGES} />

        <h3>Getting back in · desktop</h3>
        <BoardPages pages={GET_BACK_IN_PAGES} />

        <h3>Two-factor · desktop</h3>
        <BoardPages pages={TWO_FACTOR_PAGES} />

        <h3>Other ways in · desktop</h3>
        <p className="demo-home-line">
          The organisation is <strong>{SAMPLE.organisation}</strong>, and the invitation is from{' '}
          <strong>
            {SAMPLE.inviter}, {SAMPLE.role}
          </strong>
          .
        </p>
        <BoardPages pages={WAYS_IN_PAGES} />
      </section>
    </main>
  );
}

function BoardPages({
  pages,
}: {
  pages: readonly { name: string; states: readonly { to: string; name: string }[] }[];
}) {
  return pages.map((page) => (
    <div key={page.name} className="demo-home-group">
      <h4>{page.name}</h4>
      <ul className="demo-home-rows">
        {page.states.map((state) => (
          <li key={state.to}>
            <Link className="demo-home-row" to={state.to}>
              <span>{state.name}</span>
              <span aria-hidden="true">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  ));
}

function SignInBoard() {
  const [params] = useSearchParams();
  const key = params.get('state') ?? 'first-visit';

  return <SignInForm key={key} state={key} />;
}

/** Where a page sends sign-in from: the email to keep, and whether two-factor was just turned off. */
type Arrival = { email?: string; recovered?: boolean };

function SignInForm({ state }: { state: string }) {
  const navigate = useNavigate();
  const arrival = (useLocation().state as Arrival | null) ?? {};
  const [twoFactor, setTwoFactor] = useState(false);
  const drawn = SIGN_IN_STATES.find((each) => each.key === state);
  const [notice, setNotice] = useState<Notice | null>(drawn?.notice ?? null);
  const [providerOnly, setProviderOnly] = useState(state === 'provider-only');
  const [liftsAt, setLiftsAt] = useState<number | null>(() =>
    state === 'locked' ? Date.now() + LOCK_MS : null,
  );
  const [refusals, setRefusals] = useState(0);
  const [refused, setRefused] = useState(false);
  const [lines, setLines] = useState<FieldLines>({});
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const email = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);
  const pending = useRef<number | undefined>(undefined);
  const knownEmail = state === 'rule' || state === 'provider-only' ? SAMPLE.email : arrival.email;
  const locked = liftsAt != null;

  useEffect(() => () => window.clearTimeout(pending.current), []);

  useEffect(() => {
    if (liftsAt == null) return;

    const lift = window.setTimeout(
      () => {
        if (password.current != null) password.current.value = '';
        setNotice(null);
        setLiftsAt(null);
      },
      Math.max(0, liftsAt - Date.now()),
    );

    return () => window.clearTimeout(lift);
  }, [liftsAt]);

  function after(then: () => void): void {
    setBusy(true);
    pending.current = window.setTimeout(() => {
      setBusy(false);
      then();
    }, BUSY_MS);
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (busy || locked) return;

    const typed = { email: email.current?.value ?? '', password: password.current?.value ?? '' };
    const found = fieldLines(typed.email, typed.password);

    setLines(found);
    setRefused(false);
    if (found.email != null || found.password != null) {
      (found.email != null ? email : password).current?.focus();
      return;
    }

    setRevealed(false);
    after(() => {
      if (samplePair(typed.email, typed.password)) {
        if (arrival.recovered === true) void navigate(twoFactorAt('setup'));
        else void navigate(twoFactor ? twoFactorAt('code') : '/demo/today');
        return;
      }

      const next = refuse(refusals, Date.now());
      setRefusals(next.refusals);
      if (next.liftsAt != null) {
        setLiftsAt(next.liftsAt);
        return;
      }

      setRefused(true);
      password.current?.focus();
      password.current?.select();
    });
  }

  function edited(field: keyof FieldLines): void {
    if (lines[field] == null) return;

    const now = fieldLines(email.current?.value ?? '', password.current?.value ?? '');
    setLines((was) => ({ ...was, [field]: now[field] }));
  }

  function provider(): void {
    if (busy) return;

    after(() => void navigate('/demo/today'));
  }

  const until = liftsAt == null ? null : timeOfDay(liftsAt);
  const shown: Notice | null =
    until == null ? notice : { title: 'Too many tries', body: `Try again at ${until}.` };

  return (
    <BoardPage
      controls={
        <label className="demo-switch">
          <input
            type="checkbox"
            role="switch"
            checked={twoFactor}
            onChange={(event) => setTwoFactor(event.target.checked)}
          />
          Demo: this account uses two-factor
        </label>
      }
    >
      <div className="demo-heading">
        <h1>Sign in</h1>
        {shown != null && (
          <div
            className="demo-notice"
            role={locked || state.endsWith('failed') ? 'alert' : 'status'}
          >
            <p className="demo-notice-title">{shown.title}</p>
            <p>{shown.body}</p>
          </div>
        )}
      </div>

      {providerOnly ? (
        <>
          <div className="demo-field">
            <label htmlFor="email">Email</label>
            <input className="demo-input" id="email" type="email" value={SAMPLE.email} readOnly />
          </div>
          <Providers busy={busy} onChoose={provider} />
          <p className="demo-muted">
            A rule set by Ire Events: password sign-in is off for everyone in it.
          </p>
          <button
            className="link-button demo-link"
            type="button"
            onClick={() => {
              setProviderOnly(false);
              setNotice(null);
            }}
          >
            Sign in with another account
          </button>
        </>
      ) : (
        <>
          <form className="demo-form" noValidate onSubmit={submit}>
            <div className="demo-fields">
              <div className={lines.email == null ? 'demo-field' : 'demo-field demo-field-wrong'}>
                <label htmlFor="email">Email</label>
                <input
                  ref={email}
                  className="demo-input"
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoCorrect="off"
                  spellCheck={false}
                  defaultValue={knownEmail}
                  {...offField(busy)}
                  aria-invalid={lines.email != null}
                  aria-describedby={lines.email == null ? undefined : 'email-line'}
                  onChange={() => edited('email')}
                />
                {lines.email != null && (
                  <p className="demo-line" id="email-line">
                    {lines.email}
                  </p>
                )}
              </div>

              <div
                className={lines.password == null ? 'demo-field' : 'demo-field demo-field-wrong'}
              >
                <div className="demo-label-row">
                  <label htmlFor="password">Password</label>
                  <Link
                    className="link-button demo-link"
                    to={backIn('reset')}
                    onClick={(event) => {
                      event.preventDefault();
                      void navigate(backIn('reset'), {
                        state: {
                          email: email.current?.value ?? '',
                          back: `/demo/sign-in?state=${state}`,
                        },
                      });
                    }}
                  >
                    Forgot your password?
                  </Link>
                </div>
                <div className="demo-reveal">
                  <input
                    ref={password}
                    className="demo-input"
                    id="password"
                    name="password"
                    type={revealed ? 'text' : 'password'}
                    autoComplete="current-password"
                    {...offField(busy)}
                    aria-invalid={lines.password != null}
                    aria-describedby={
                      lines.password != null || refused ? 'password-line' : undefined
                    }
                    onChange={() => edited('password')}
                  />
                  <button
                    className="demo-reveal-button"
                    type="button"
                    aria-pressed={revealed}
                    onClick={() => setRevealed((was) => !was)}
                  >
                    {revealed ? 'Hide' : 'Show'}
                  </button>
                </div>
                {(lines.password != null || refused) && (
                  <p className="demo-line" id="password-line" role={refused ? 'alert' : undefined}>
                    {lines.password ?? 'That email and password do not match.'}
                  </p>
                )}
              </div>
            </div>

            <button
              className="button button-primary demo-wide"
              type="submit"
              aria-busy={busy}
              {...offButton(locked)}
            >
              {until != null ? `Try again at ${until}` : busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <OrLine />
          <Providers busy={busy} onChoose={provider} />
        </>
      )}
    </BoardPage>
  );
}

function SignedIn() {
  const { state } = useLocation() as { state: { provider?: string } | null };

  return (
    <BoardPage>
      <div className="demo-heading">
        <h1>Signed in</h1>
        <p className="demo-muted">
          {state?.provider != null
            ? `A stand-in: ${state.provider} is not wired in the demo, so this is where it would land.`
            : `A stand-in for your events, signed in as ${SAMPLE.email}.`}
        </p>
      </div>
      <Link className="button demo-wide" to="/demo/sign-in?state=signed-out">
        Sign out
      </Link>
    </BoardPage>
  );
}

const LATER: Record<string, string> = {
  terms: 'Terms',
  privacy: 'Privacy',
  security: 'Your account › Security',
};

function Later() {
  const [params] = useSearchParams();
  const screen = LATER[params.get('screen') ?? ''] ?? 'Terms';

  return (
    <BoardPage>
      <div className="demo-heading">
        <h1>{screen}</h1>
        <p className="demo-muted">A stand-in: this page comes to the demo at its own step.</p>
      </div>
      <Link className="button demo-wide" to="/demo/sign-in">
        Back to sign in
      </Link>
    </BoardPage>
  );
}
