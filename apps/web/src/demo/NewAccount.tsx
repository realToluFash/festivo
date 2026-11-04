import { followCountry, meetsPasswordLength, pickPhoneCountry } from '@soirely/domain';
import { type FormEvent, type RefObject, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';

import { offButton } from '../offButton.ts';
import { offField } from '../offField.ts';
import { BoardPage, HaveAccount, OrLine, Providers, SignedInAs } from './BoardPage.tsx';
import {
  CodeForm,
  Heading,
  Loading,
  Notice,
  PasswordRule,
  Unreachable,
  Verified,
  fieldClass,
  useBusy,
} from './parts.tsx';
import {
  type AccountLines,
  COUNTRIES,
  LOCK_MS,
  SAMPLE,
  accountLines,
  at,
  codeChoice,
  fullNumber,
  numberLine,
  timeOfDay,
} from './rules.ts';

/** What one page hands the next: who is signing up, and the number being checked. */
type Flow = { name: string; email: string; phone: string };

const SAMPLE_FLOW: Flow = {
  name: SAMPLE.name,
  email: SAMPLE.email,
  phone: fullNumber(SAMPLE.number, SAMPLE.country),
};

export function NewAccountBoard() {
  const [params] = useSearchParams();
  const location = useLocation();
  const flow: Flow = { ...SAMPLE_FLOW, ...(location.state as Partial<Flow> | null) };
  const page = params.get('page') ?? 'register';
  const state = params.get('state') ?? '';
  const key = `${page}:${state}:${location.key}`;
  const signedIn = page !== 'register';

  if (state === 'loading') return <Loading key={key} />;
  if (state === 'offline') return <Unreachable key={key} to={at(page)} signedIn={signedIn} />;

  switch (page) {
    case 'email':
      return <EmailCode key={key} state={state} flow={flow} />;
    case 'details':
      return <Details key={key} state={state} flow={flow} />;
    case 'phone':
      return <PhoneCode key={key} state={state} flow={flow} />;
    case 'change':
      return <ChangeNumber key={key} flow={flow} />;
    default:
      return <CreateAccount key={key} state={state} flow={flow} />;
  }
}

/* Create your account */

const OPENING: Record<string, { password: string; filled: boolean }> = {
  blank: { password: '', filled: false },
  short: { password: 'nine char', filled: true },
  breached: { password: SAMPLE.breachedPassword, filled: true },
  limited: { password: SAMPLE.password, filled: true },
};

function CreateAccount({ state, flow }: { state: string; flow: Flow }) {
  const navigate = useNavigate();
  const opening = OPENING[state];
  const came = useLocation().state != null;
  const filled = opening == null ? came : opening.filled;
  const [name, setName] = useState(filled ? flow.name : '');
  const [email, setEmail] = useState(filled ? flow.email : '');
  const [password, setPassword] = useState(opening?.password ?? '');
  const [lines, setLines] = useState<AccountLines>(() =>
    state === 'blank' || state === 'short' ? accountLines(name, email, password) : {},
  );
  const [breached, setBreached] = useState(state === 'breached');
  const [liftsAt, setLiftsAt] = useState<number | null>(() =>
    state === 'limited' ? Date.now() + LOCK_MS : null,
  );
  const [revealed, setRevealed] = useState(false);
  const [busy, after] = useBusy();
  const nameField = useRef<HTMLInputElement>(null);
  const emailField = useRef<HTMLInputElement>(null);
  const passwordField = useRef<HTMLInputElement>(null);
  const locked = liftsAt != null;

  useEffect(() => {
    if (state === 'blank') nameField.current?.focus();
    if (state === 'short' || state === 'breached') passwordField.current?.focus();
  }, [state]);

  useEffect(() => {
    if (liftsAt == null) return;

    const lift = window.setTimeout(() => setLiftsAt(null), Math.max(0, liftsAt - Date.now()));

    return () => window.clearTimeout(lift);
  }, [liftsAt]);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (busy || locked) return;

    const found = accountLines(name, email, password);
    setLines(found);
    setBreached(false);
    const first = [
      [found.name, nameField],
      [found.email, emailField],
      [found.password, passwordField],
    ].find(([line]) => line != null);
    if (first != null) {
      (first[1] as typeof nameField).current?.focus();
      return;
    }

    setRevealed(false);
    after(() => {
      if (password === SAMPLE.breachedPassword) {
        setBreached(true);
        passwordField.current?.focus();
        return;
      }

      void navigate(at('email'), { state: { name, email } satisfies Partial<Flow> });
    });
  }

  function edited(field: keyof AccountLines, now: AccountLines): void {
    if (lines[field] == null) return;

    setLines((was) => ({ ...was, [field]: now[field] }));
  }

  const passwordLine =
    lines.password ??
    (breached ? 'This password has appeared in a known data breach. Choose another.' : null);
  const until = liftsAt == null ? null : timeOfDay(liftsAt);

  return (
    <BoardPage end={<HaveAccount />}>
      <Heading title="Create your account">
        {breached ? (
          <Notice title="Creating your account did not work" alert />
        ) : (
          <p className="demo-muted">Next, we email you a code to check the address is yours.</p>
        )}
        {until != null && (
          <Notice title="Too many sign-ups from this network" body={`Try again at ${until}.`} />
        )}
      </Heading>

      <form className="demo-form" noValidate onSubmit={submit}>
        <div className="demo-fields">
          <div className={fieldClass(lines.name != null)}>
            <label htmlFor="name">Full name</label>
            <input
              ref={nameField}
              className="demo-input"
              id="name"
              autoComplete="name"
              value={name}
              {...offField(busy)}
              aria-invalid={lines.name != null}
              aria-describedby={lines.name == null ? undefined : 'name-line'}
              onChange={(event) => {
                setName(event.target.value);
                edited('name', accountLines(event.target.value, email, password));
              }}
            />
            {lines.name != null && (
              <p className="demo-line" id="name-line">
                {lines.name}
              </p>
            )}
          </div>

          <div className={fieldClass(lines.email != null)}>
            <label htmlFor="email">Email</label>
            <input
              ref={emailField}
              className="demo-input"
              id="email"
              type="email"
              autoComplete="email"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              {...offField(busy)}
              aria-invalid={lines.email != null}
              aria-describedby={lines.email == null ? undefined : 'email-line'}
              onChange={(event) => {
                setEmail(event.target.value);
                edited('email', accountLines(name, event.target.value, password));
              }}
            />
            {lines.email != null && (
              <p className="demo-line" id="email-line">
                {lines.email}
              </p>
            )}
          </div>

          <div className={fieldClass(passwordLine != null)}>
            <label htmlFor="password">Password</label>
            <div className="demo-reveal">
              <input
                ref={passwordField}
                className="demo-input"
                id="password"
                type={revealed ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                {...offField(busy)}
                aria-invalid={passwordLine != null}
                aria-describedby={
                  passwordLine == null ? 'password-rule' : 'password-line password-rule'
                }
                onChange={(event) => {
                  setPassword(event.target.value);
                  setBreached(false);
                  edited('password', accountLines(name, email, event.target.value));
                }}
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
            {passwordLine != null && (
              <p className="demo-line" id="password-line">
                {passwordLine}
              </p>
            )}
            <PasswordRule met={meetsPasswordLength(password)} />
          </div>
        </div>

        <button
          className="button button-primary demo-wide"
          type="submit"
          aria-busy={busy}
          {...offButton(locked)}
        >
          {until != null ? `Try again at ${until}` : busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <OrLine />
      <Providers
        busy={busy}
        onChoose={(provider) =>
          after(() => void navigate('/demo/signed-in', { state: { provider } }))
        }
      />
    </BoardPage>
  );
}

function EmailCode({ state, flow }: { state: string; flow: Flow }) {
  const navigate = useNavigate();
  const [verified, setVerified] = useState(state === 'verified');
  const again = { to: at('register'), state: { name: flow.name, email: flow.email } };

  if (verified) {
    return (
      <BoardPage end={<SignedInAs email={flow.email} />}>
        <Verified
          step={1}
          title="Email verified"
          body={`${flow.email} is confirmed. Next, a few details so your team knows who is who.`}
          action="Continue"
          onContinue={() => void navigate(at('details'), { state: flow })}
        />
      </BoardPage>
    );
  }

  return (
    <BoardPage end={<SignedInAs email={flow.email} />} back={again}>
      <Heading step={1} title="Check your email">
        <p className="demo-muted">
          We sent a code to {flow.email}. Enter it here to show the address is yours.
        </p>
      </Heading>
      <CodeForm
        opening={state}
        label="Code from the email"
        submit="Verify email"
        from="the email"
        wrong="That code does not match. Check the newest email from Soirely and try again."
        expired="Codes only work for a while. Send a new one and use the code in the newest email."
        onVerified={() => setVerified(true)}
      />
      <p className="demo-aside">
        <span>Not your address?</span>
        <Link className="link-button demo-link" to={again.to} state={again.state}>
          Register again with the right one
        </Link>
      </p>
    </BoardPage>
  );
}

function PhoneCode({ state, flow }: { state: string; flow: Flow }) {
  const navigate = useNavigate();
  const [verified, setVerified] = useState(state === 'verified');
  const [texted, setTexted] = useState(state === 'texted');
  const [busy, after] = useBusy();

  if (verified) {
    return (
      <BoardPage end={<SignedInAs email={flow.email} />}>
        <Verified
          step={2}
          title="Number verified"
          body={`Soirely can reach you on ${flow.phone} if something goes wrong on the night.`}
          action="Continue to Soirely"
          onContinue={() => void navigate('/demo/signed-in')}
        />
      </BoardPage>
    );
  }

  return (
    <BoardPage end={<SignedInAs email={flow.email} />}>
      <Heading step={2} title="Check your messages">
        <p className="demo-muted" role={texted ? 'status' : undefined}>
          {texted
            ? `We texted the same code to ${flow.phone}. The one on WhatsApp works too.`
            : `We sent a code to your WhatsApp on ${flow.phone}.`}
        </p>
      </Heading>
      <CodeForm
        opening={state}
        label="Code from WhatsApp"
        submit="Verify number"
        from="WhatsApp"
        wrong="That code does not match. Check the newest WhatsApp message from Soirely and try again."
        expired="Codes only work for a while. Send a new one and use the code in the newest message."
        onVerified={() => setVerified(true)}
        resendNote={
          !texted && (
            <button
              className="link-button demo-link"
              type="button"
              aria-busy={busy}
              onClick={() => {
                if (!busy) after(() => setTexted(true));
              }}
            >
              Text it to me instead
            </button>
          )
        }
      />
      <div className="demo-asides">
        <p className="demo-aside">
          <span>Wrong number?</span>
          <Link className="link-button demo-link" to={at('change')} state={flow}>
            Change it
          </Link>
        </p>
        <p className="demo-aside">
          <span>Can’t get texts on this number?</span>
          <Link className="link-button demo-link" to="/demo/signed-in">
            Carry on without it
          </Link>
        </p>
      </div>
    </BoardPage>
  );
}

/* A few details, and changing the number */

function NumberRow({
  code,
  onCode,
  number,
  onNumber,
  line,
  help,
  optional = false,
  numberField,
}: {
  code: string;
  onCode: (code: string) => void;
  number: string;
  onNumber: (number: string) => void;
  line: string | null;
  help: string;
  optional?: boolean;
  numberField: RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="demo-number">
      <div className="demo-number-row">
        <div className="demo-field demo-number-code">
          <label htmlFor="phone-code">Code</label>
          <select
            className="demo-input demo-select"
            id="phone-code"
            value={code}
            onChange={(event) => onCode(event.target.value)}
          >
            {COUNTRIES.map((country) => (
              <option key={country.code} value={country.code}>
                {codeChoice(country.code)}
              </option>
            ))}
          </select>
        </div>
        <div className={fieldClass(line != null)}>
          <div className="demo-label-row">
            <label htmlFor="phone-number">Mobile number</label>
            {optional && <span className="demo-optional">Optional</span>}
          </div>
          <input
            ref={numberField}
            className="demo-input"
            id="phone-number"
            type="tel"
            autoComplete="tel-national"
            value={number}
            aria-invalid={line != null}
            aria-describedby={line == null ? 'phone-help' : 'phone-line'}
            onChange={(event) => onNumber(event.target.value)}
          />
        </div>
      </div>
      {line == null ? (
        <p className="demo-help" id="phone-help">
          {help}
        </p>
      ) : (
        <p className="demo-line" id="phone-line">
          {line}
        </p>
      )}
    </div>
  );
}

function Details({ state, flow }: { state: string; flow: Flow }) {
  const navigate = useNavigate();
  const refusedAtOpening = state === 'refused';
  const [name, setName] = useState(flow.name);
  const [organisation, setOrganisation] = useState('');
  const [country, setCountry] = useState<string>(SAMPLE.country);
  const [phone, setPhone] = useState(() =>
    followCountry({ code: '', picked: false }, SAMPLE.country),
  );
  const [number, setNumber] = useState(refusedAtOpening ? '7400 12' : '');
  const [lines, setLines] = useState(() =>
    refusedAtOpening ? detailsLines(name, '', '7400 12', SAMPLE.country) : {},
  );
  const [busy, after] = useBusy();
  const nameField = useRef<HTMLInputElement>(null);
  const organisationField = useRef<HTMLInputElement>(null);
  const numberField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (refusedAtOpening) organisationField.current?.focus();
  }, [refusedAtOpening]);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (busy) return;

    const found = detailsLines(name, organisation, number, phone.code);
    setLines(found);
    const first =
      found.name != null
        ? nameField
        : found.organisation != null
          ? organisationField
          : found.number != null
            ? numberField
            : null;
    if (first != null) {
      first.current?.focus();
      return;
    }

    after(() => {
      if (number.trim() === '') {
        void navigate('/demo/signed-in');
        return;
      }

      void navigate(at('phone'), {
        state: { ...flow, name, phone: fullNumber(number, phone.code) },
      });
    });
  }

  return (
    <BoardPage end={<SignedInAs email={flow.email} />}>
      <Heading step={2} title="A few details">
        <p className="demo-muted">So the people you work with know who is who.</p>
      </Heading>
      <form className="demo-form" noValidate onSubmit={submit}>
        <div className="demo-fields">
          <div className={fieldClass(lines.name != null)}>
            <label htmlFor="name">Full name</label>
            <input
              ref={nameField}
              className="demo-input"
              id="name"
              autoComplete="name"
              value={name}
              {...offField(busy)}
              aria-invalid={lines.name != null}
              aria-describedby={lines.name == null ? undefined : 'name-line'}
              onChange={(event) => setName(event.target.value)}
            />
            {lines.name != null && (
              <p className="demo-line" id="name-line">
                {lines.name}
              </p>
            )}
          </div>

          <div className={fieldClass(lines.organisation != null)}>
            <label htmlFor="organisation">Organisation name</label>
            <input
              ref={organisationField}
              className="demo-input"
              id="organisation"
              autoComplete="organization"
              value={organisation}
              {...offField(busy)}
              aria-invalid={lines.organisation != null}
              aria-describedby={
                lines.organisation == null ? 'organisation-help' : 'organisation-line'
              }
              onChange={(event) => setOrganisation(event.target.value)}
            />
            {lines.organisation == null ? (
              <p className="demo-help" id="organisation-help">
                Your events belong to it. You can rename it later.
              </p>
            ) : (
              <p className="demo-line" id="organisation-line">
                {lines.organisation}
              </p>
            )}
          </div>

          <div className="demo-field">
            <label htmlFor="country">Country</label>
            <select
              className="demo-input demo-select"
              id="country"
              value={country}
              onChange={(event) => {
                setCountry(event.target.value);
                setPhone((was) => followCountry(was, event.target.value));
              }}
            >
              {COUNTRIES.map((each) => (
                <option key={each.code} value={each.code}>
                  {each.name}
                </option>
              ))}
            </select>
          </div>

          <NumberRow
            code={phone.code}
            onCode={(code) => setPhone(pickPhoneCountry(code))}
            number={number}
            onNumber={setNumber}
            line={lines.number ?? null}
            help="How you are reached on the night if something goes wrong. If you add one, we text it a code to check it."
            optional
            numberField={numberField}
          />
        </div>

        <button className="button button-primary demo-wide" type="submit" aria-busy={busy}>
          {busy ? 'Saving…' : 'Save and continue'}
        </button>
      </form>
    </BoardPage>
  );
}

function detailsLines(
  name: string,
  organisation: string,
  number: string,
  code: string,
): { name?: string; organisation?: string; number?: string } {
  const numberProblem = numberLine(number, code, true);

  return {
    ...(name.trim() === '' && { name: 'Enter your full name.' }),
    ...(organisation.trim() === '' && {
      organisation: 'Add your organisation’s name to carry on.',
    }),
    ...(numberProblem != null && { number: numberProblem }),
  };
}

function ChangeNumber({ flow }: { flow: Flow }) {
  const navigate = useNavigate();
  const [code, setCode] = useState<string>(SAMPLE.country);
  const [number, setNumber] = useState('');
  const [line, setLine] = useState<string | null>(null);
  const [busy, after] = useBusy();
  const numberField = useRef<HTMLInputElement>(null);
  const toCode = { to: at('phone'), state: flow };

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (busy) return;

    const refused = numberLine(number, code, false);
    setLine(refused);
    if (refused != null) {
      numberField.current?.focus();
      return;
    }

    after(
      () => void navigate(at('phone'), { state: { ...flow, phone: fullNumber(number, code) } }),
    );
  }

  return (
    <BoardPage end={<SignedInAs email={flow.email} />} back={toCode}>
      <Heading title="Change your mobile number">
        <p className="demo-muted">Now: {flow.phone} · not verified yet</p>
        <p className="demo-muted demo-tight">
          Your current number keeps working until the new one is verified.
        </p>
      </Heading>
      <form className="demo-form" noValidate onSubmit={submit}>
        <NumberRow
          code={code}
          onCode={setCode}
          number={number}
          onNumber={setNumber}
          line={line}
          help="Choose the country code, then type the number any way you like."
          numberField={numberField}
        />
        <button className="button button-primary demo-wide" type="submit" aria-busy={busy}>
          {busy ? 'Texting a code…' : 'Text a code to this number'}
        </button>
      </form>
      <Link className="link-button demo-link" to={toCode.to} state={toCode.state}>
        Keep my current number
      </Link>
    </BoardPage>
  );
}
