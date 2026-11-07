import { followCountry, pickPhoneCountry } from '@soirely/domain';
import { type FormEvent, type RefObject, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';

import { offButton } from '../offButton.ts';
import { offField } from '../offField.ts';
import { BoardPage, HaveAccount, OrLine, Providers, SignedInAs } from './BoardPage.tsx';
import {
  type Answer,
  Answers,
  CodeForm,
  Heading,
  Loading,
  Notice,
  Organisation,
  PasswordField,
  Unreachable,
  Verified,
  fieldClass,
  useBusy,
} from './parts.tsx';
import {
  type AccountLines,
  BREACHED,
  COUNTRIES,
  LOCK_MS,
  SAMPLE,
  accountLines,
  at,
  codeChoice,
  fullNumber,
  numberLine,
  timeOfDay,
  way,
} from './rules.ts';

/** What one page hands the next: who is signing up, and the number being checked. */
export type Flow = { name: string; email: string; phone: string };

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
  'timed-out': { password: '', filled: true },
  'timed-out-new-tab': { password: '', filled: true },
};

const TIMED_OUT =
  'Your sign-up timed out, so we did not keep the password. Enter it again to get a new code.';

function CreateAccount({ state, flow }: { state: string; flow: Flow }) {
  const navigate = useNavigate();
  const opening = OPENING[state];
  const came = useLocation().state != null;
  const filled = opening == null ? came : opening.filled;
  const [name, setName] = useState(filled && state !== 'timed-out-new-tab' ? flow.name : '');
  const [email, setEmail] = useState(filled ? flow.email : '');
  const [password, setPassword] = useState(opening?.password ?? '');
  const [lines, setLines] = useState<AccountLines>(() =>
    state === 'blank' || state === 'short' ? accountLines(name, email, password) : {},
  );
  const [breached, setBreached] = useState(state === 'breached');
  const [liftsAt, setLiftsAt] = useState<number | null>(() =>
    state === 'limited' ? Date.now() + LOCK_MS : null,
  );
  const [timedOut, setTimedOut] = useState(state.startsWith('timed-out'));
  const [revealed, setRevealed] = useState(false);
  const [busy, after] = useBusy();
  const nameField = useRef<HTMLInputElement>(null);
  const emailField = useRef<HTMLInputElement>(null);
  const passwordField = useRef<HTMLInputElement>(null);
  const locked = liftsAt != null;

  useEffect(() => {
    if (state === 'blank') nameField.current?.focus();
    if (state === 'short' || state === 'breached' || state.startsWith('timed-out')) {
      passwordField.current?.focus();
    }
  }, [state]);

  useEffect(() => {
    if (liftsAt == null) return;

    const lift = window.setTimeout(() => setLiftsAt(null), Math.max(0, liftsAt - Date.now()));

    return () => window.clearTimeout(lift);
  }, [liftsAt]);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (busy || locked) return;

    setTimedOut(false);
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

  const passwordLine = lines.password ?? (breached ? BREACHED : null);
  const until = liftsAt == null ? null : timeOfDay(liftsAt);

  return (
    <BoardPage end={<HaveAccount />}>
      <Heading title="Create your account">
        {breached ? (
          <Notice title="Creating your account did not work" alert />
        ) : timedOut ? (
          <Notice title={TIMED_OUT} late />
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

          <PasswordField
            label="Password"
            field={passwordField}
            password={password}
            line={passwordLine}
            busy={busy}
            revealed={revealed}
            onReveal={setRevealed}
            onChange={(typed) => {
              setPassword(typed);
              setBreached(false);
              edited('password', accountLines(name, email, typed));
            }}
          />
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
          after(() => void navigate(way('details', provider === 'Apple' ? 'apple' : 'google')))
        }
      />
    </BoardPage>
  );
}

function EmailCode({ state, flow }: { state: string; flow: Flow }) {
  const navigate = useNavigate();
  const [verified, setVerified] = useState(state === 'verified');
  const again = { to: at('register'), state: { name: flow.name, email: flow.email } };
  const runOut =
    state === 'run-out'
      ? () => void navigate(at('register', 'timed-out'), { state: again.state })
      : undefined;

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
        onRunOut={runOut}
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
          body={`Soirely can reach you on ${flow.phone} if something goes wrong on the day.`}
          action="Continue to Soirely"
          onContinue={() => void navigate('/demo/today')}
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
          <Link className="link-button demo-link" to="/demo/today">
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

/** How the account came without an email code, said under the title. */
export type Arrival = 'Google' | 'Apple';

/** What the page offers before the organisation fields: the company at the address's domain, or an invitation. */
export type Offer = 'company' | 'invitation';

const DOMAIN = SAMPLE.email.split('@')[1] ?? '';

export function Details({
  state,
  flow,
  arrival,
  offer: offered,
}: {
  state: string;
  flow: Flow;
  arrival?: Arrival;
  offer?: Offer;
}) {
  const navigate = useNavigate();
  const refusedAtOpening = state === 'refused';
  const [offer, setOffer] = useState<Offer | 'declined' | null>(offered ?? null);
  const [pressed, setPressed] = useState<Answer | null>(null);
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
    if (arrival != null && nameField.current?.value === '') nameField.current.focus();
  }, [refusedAtOpening, arrival]);

  function ask(): void {
    if (busy) return;

    if (name.trim() === '') {
      setLines({ name: 'Enter your full name.' });
      nameField.current?.focus();
      return;
    }

    after(() => void navigate(way('waiting')));
  }

  function answer(chosen: Answer): void {
    if (busy) return;
    setPressed(chosen);
    after(() => {
      setPressed(null);
      if (chosen === 'accept') {
        void navigate(way('invitation', 'joined'));
        return;
      }

      setOffer('declined');
    });
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (busy || offer === 'company') return;

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
        void navigate('/demo/today');
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
        {arrival != null && (
          <Notice
            title={`Signed in with ${arrival}`}
            body={`${arrival} has already confirmed ${flow.email}, so there is no email code to enter.`}
          />
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
              onChange={(event) => setName(event.target.value)}
            />
            {lines.name != null && (
              <p className="demo-line" id="name-line">
                {lines.name}
              </p>
            )}
          </div>

          {offer === 'company' ? (
            <DomainOffer busy={busy} onAsk={ask} onStartOwn={() => setOffer(null)} />
          ) : (
            <>
              {offer === 'invitation' && (
                <WaitingInvitation
                  pressed={pressed}
                  held={busy && pressed == null}
                  onAnswer={answer}
                />
              )}
              {offer === 'declined' && (
                <p className="demo-muted" role="status">
                  You declined. {SAMPLE.inviter} will see that you said no.
                </p>
              )}

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
                help="How you are reached on the day if something goes wrong. If you add one, we text it a code to check it."
                optional
                numberField={numberField}
              />
              {offered === 'company' && (
                <button
                  className="link-button demo-link"
                  type="button"
                  onClick={() => setOffer('company')}
                >
                  Ask to join an organisation at {DOMAIN} instead
                </button>
              )}
            </>
          )}
        </div>

        {offer !== 'company' && (
          <button
            className="button button-primary demo-wide"
            type="submit"
            aria-busy={busy && pressed == null}
            {...offButton(pressed != null)}
          >
            {busy && pressed == null ? 'Saving…' : 'Save and continue'}
          </button>
        )}
      </form>
    </BoardPage>
  );
}

function DomainOffer({
  busy,
  onAsk,
  onStartOwn,
}: {
  busy: boolean;
  onAsk: () => void;
  onStartOwn: () => void;
}) {
  return (
    <section className="demo-offer" aria-labelledby="offer-heading">
      <div className="demo-offer-intro">
        <h2 id="offer-heading">Your organisation</h2>
        <p className="demo-muted">
          Your address is at {DOMAIN}. Ask to join your company’s organisation, or start your own.
        </p>
      </div>
      <div className="demo-offer-row">
        <Organisation
          title={`${SAMPLE.organisation} uses Soirely`}
          line="Somebody there approves you before you see anything."
        />
        <button
          className="button button-primary demo-offer-ask"
          type="button"
          aria-label={`Ask to join ${SAMPLE.organisation}`}
          aria-busy={busy}
          onClick={onAsk}
        >
          {busy ? 'Asking…' : 'Ask to join'}
        </button>
      </div>
      <button className="button demo-wide" type="button" {...offButton(busy)} onClick={onStartOwn}>
        Start my own organisation
      </button>
    </section>
  );
}

function WaitingInvitation({
  pressed,
  held,
  onAnswer,
}: {
  pressed: Answer | null;
  held: boolean;
  onAnswer: (answer: Answer) => void;
}) {
  return (
    <section className="demo-offer" aria-labelledby="invitations-heading">
      <div className="demo-offer-intro">
        <h2 id="invitations-heading">Invitations</h2>
        <p className="demo-muted">
          You have an invitation waiting. Accept it to join that organisation, or start your own
          below.
        </p>
      </div>
      <div className="demo-invitation">
        <Organisation
          invited
          line={`Invitation from ${SAMPLE.inviter} · ${SAMPLE.role}`}
          until={`Works until ${SAMPLE.invitedUntil}`}
        />
        <Answers pressed={pressed} held={held} onAnswer={onAnswer} sized />
      </div>
      <OrLine words="Or start your own organisation" />
    </section>
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
