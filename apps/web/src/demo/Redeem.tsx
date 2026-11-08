import {
  type FormEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
import { useSearchParams } from 'react-router';
import { callingCode } from '@soirely/domain';

import { Brand } from '../components/Brand.tsx';
import { Toast } from '../components/Toast.tsx';
import { BUSY_MS, DOOR_EVENT, HOLD_MS } from './doorCode.ts';
import { Glyph } from '../components/Glyph.tsx';
import {
  type Busy,
  CALLING,
  COUNTRY,
  type CodeProblem,
  EVENT_LINE,
  type EventLines,
  LIFTS_AT,
  MESH,
  PHONE_CODE_LENGTH,
  type Via,
  deadCode,
  phoneCodeLine,
  R,
  RESEND_FROM,
  type RedeemState,
  type Step,
  TRIES_A_MINUTE,
  codeOpens,
  eventLines,
  joinCodeLine,
  redeemStart,
  redeemStateOf,
  rightPhoneCode,
  sendNewIn,
  shownNumber,
} from './redeem.ts';
import { codeChoice, COUNTRIES, TRIES } from './rules.ts';
import './today.css';
import './redeem.css';

/** The redeem page in a browser, signed out, for someone without the app: 390 first, one centred column wider (sc-72). */
export function Redeem() {
  const [params] = useSearchParams();
  const state = redeemStateOf(params.get('state'));

  return <RedeemPage key={state} state={state} />;
}

type Want = 'title' | 'field' | 'select' | 'number' | null;

/** Where focus starts: the field being typed in, the heading of a step that shows the event, nothing on "Signed out." (a status). */
function firstFocus(state: RedeemState): Want {
  if (state === 'signed-out') return null;
  if (state === 'event-short') return 'number';
  if (state === 'code-wrong') return 'select';
  if (state === 'code-expired' || state === 'code-exhausted') return 'title';
  if (state.startsWith('enter') || state.startsWith('code') || state === 'event-blank')
    return 'field';

  return state === 'refused' || state === 'checking' ? 'field' : 'title';
}

function RedeemPage({ state }: { state: RedeemState }) {
  const [start] = useState(() => redeemStart(state));
  const [step, setStep] = useState<Step>(start.step);
  const [name, setName] = useState(start.name);
  const [number, setNumber] = useState(start.number);
  const [country, setCountry] = useState(COUNTRY);
  const [tries, setTries] = useState(state === 'refused' ? 1 : 0);
  const [told, setTold] = useState<string | null>(null);
  const [want, setWant] = useState<{ to: Want; n: number }>({ to: firstFocus(state), n: 0 });
  const title = useRef<HTMLHeadingElement>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const to = {
      title: title.current,
      field: field.current,
      select: field.current,
      number: document.getElementById('rd-number'),
      none: null,
    }[want.to ?? 'none'];
    to?.focus();
    if (want.to === 'select') field.current?.select();
  }, [want]);

  const go = (next: Step, to: Want = 'title') => {
    setStep(next);
    setWant((was) => ({ to, n: was.n + 1 }));
  };

  // A send takes a moment; from a deep link it waits long enough to look at.
  const arrive = useEffectEvent(() => {
    if (step.kind === 'enter') {
      if (codeOpens(step.typed)) {
        setTries(0);
        go(
          { kind: 'event', name: '', number: '', checked: false, busy: 'no', usedUp: false },
          'title',
        );
        setName('');
        setNumber('');
        return;
      }
      const now = tries + 1;
      setTries(now);
      if (now >= TRIES_A_MINUTE) go({ kind: 'tooMany' });
      else setStep({ ...step, line: 'refused', busy: 'no' });
      return;
    }
    if (step.kind === 'event') {
      if (step.usedUp) setStep({ ...step, busy: 'no' });
      else
        go(
          {
            kind: 'code',
            via: 'whatsapp',
            digits: '',
            problem: null,
            line: null,
            resend: RESEND_FROM,
            busy: 'no',
            wrongs: 0,
          },
          'field',
        );
      return;
    }
    if (step.kind === 'joinAs') go({ kind: 'in', name });
    if (step.kind === 'code') {
      if (rightPhoneCode(step.digits)) {
        go({ kind: 'in', name });
        return;
      }
      const wrongs = step.wrongs + 1;
      if (wrongs >= TRIES) {
        go({ ...step, digits: '', problem: 'exhausted', busy: 'no', wrongs, resend: 0 });
        return;
      }
      go({ ...step, problem: 'wrong', busy: 'no', wrongs }, 'select');
    }
  });

  const busy: Busy = 'busy' in step ? step.busy : 'no';
  useEffect(() => {
    if (busy === 'no') return;
    const timer = setTimeout(arrive, busy === 'held' ? HOLD_MS : BUSY_MS);

    return () => clearTimeout(timer);
  }, [busy]);

  const resend = step.kind === 'code' ? step.resend : 0;
  useEffect(() => {
    if (resend <= 0) return;
    const timer = setTimeout(
      () => setStep((was) => (was.kind === 'code' ? { ...was, resend: was.resend - 1 } : was)),
      1000,
    );

    return () => clearTimeout(timer);
  }, [resend]);

  function signOut(): void {
    setName('');
    setNumber('');
    go({ kind: 'enter', typed: '', line: null, busy: 'no', signedOut: true }, 'title');
  }

  function body(): ReactNode {
    switch (step.kind) {
      case 'enter':
        return (
          <EnterStep
            step={step}
            titleRef={title}
            fieldRef={field}
            onType={(typed) => setStep({ ...step, typed, line: null })}
            onContinue={() => {
              const line = joinCodeLine(step.typed);
              if (line != null) {
                setStep({ ...step, line: line === R.codeBlank ? 'blank' : 'short' });
                field.current?.focus();
                return;
              }
              setStep({ ...step, line: null, busy: 'busy' });
            }}
          />
        );
      case 'tooMany':
        return (
          <>
            <Title titleRef={title}>{R.tooMany}</Title>
            <p className="rd-intro">{R.tryAt(LIFTS_AT)}</p>
          </>
        );
      case 'event':
        return (
          <EventStep
            step={step}
            name={name}
            number={number}
            country={country}
            titleRef={title}
            fieldRef={field}
            onName={setName}
            onNumber={setNumber}
            onCountry={setCountry}
            onSend={() => {
              const lines = eventLines(name, number, country);
              setStep({ ...step, checked: true });
              if (lines.name != null || lines.number != null) {
                document.getElementById(lines.name != null ? 'rd-name' : 'rd-number')?.focus();
                return;
              }
              setStep({ ...step, checked: true, busy: 'busy' });
            }}
          />
        );
      case 'joinAs':
        return (
          <>
            <Tile />
            <Title titleRef={title}>{DOOR_EVENT}</Title>
            <p className="rd-intro">{EVENT_LINE}</p>
            <div className="rd-pair">
              <Primary busy={step.busy !== 'no'} onClick={() => setStep({ ...step, busy: 'busy' })}>
                {R.joinAs(name)}
              </Primary>
              <button type="button" className="rd-quiet is-centre" onClick={signOut}>
                {R.signOut}
              </button>
            </div>
          </>
        );
      case 'member':
        return (
          <>
            <Tile />
            <Title titleRef={title}>{R.memberTitle}</Title>
            <p className="rd-intro">{R.memberLine}</p>
            <Primary onClick={() => setTold(R.eventsLater)}>{R.openEvents}</Primary>
          </>
        );
      case 'code': {
        const fresh = (via: Via) =>
          go(
            {
              kind: 'code',
              via,
              digits: '',
              problem: null,
              line: null,
              resend: RESEND_FROM,
              busy: 'no',
              wrongs: 0,
            },
            'field',
          );

        return (
          <CodeStep
            step={step}
            number={shownNumber(number, country)}
            titleRef={title}
            fieldRef={field}
            onDigits={(digits) =>
              setStep({
                ...step,
                digits,
                line: null,
                problem: step.problem === 'wrong' ? null : step.problem,
              })
            }
            onVerify={() => {
              const line = phoneCodeLine(step.digits);
              if (line != null) {
                setStep({ ...step, line, problem: null });
                field.current?.focus();
                return;
              }
              setStep({ ...step, line: null, busy: 'busy' });
            }}
            onText={() => fresh('text')}
            onSendNew={() => fresh(step.via)}
          />
        );
      }
      case 'in':
        return (
          <>
            <Tile />
            <Title titleRef={title}>{R.inTitle}</Title>
            <p className="rd-intro">{R.endsLine}</p>
            <Primary onClick={() => setTold(R.eventLater)}>{R.openEvent}</Primary>
            <div className="rd-you">
              <p className="rd-you-name">{R.signedInAs(step.name)}</p>
              <p className="rd-you-line">{R.signedOutAt}</p>
              <button type="button" className="rd-out" onClick={signOut}>
                <SignOutLine />
                {R.signOut}
              </button>
            </div>
          </>
        );
    }
  }

  return (
    <main id="content" className="rd">
      <div className="rd-column" data-step={step.kind}>
        <div className="rd-brand">
          <Brand />
        </div>
        {body()}
      </div>
      {told != null && <Toast key={told} words={told} onClose={() => setTold(null)} />}
    </main>
  );
}

function Title({
  titleRef,
  children,
}: {
  titleRef: RefObject<HTMLHeadingElement | null>;
  children: ReactNode;
}) {
  return (
    <h1 ref={titleRef} className="rd-title" tabIndex={-1}>
      {children}
    </h1>
  );
}

function Tile() {
  return <span className={`rd-tile today-cover is-${MESH}`} aria-hidden="true" />;
}

function Primary({
  busy = false,
  submit = false,
  onClick,
  children,
}: {
  busy?: boolean;
  submit?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type={submit ? 'submit' : 'button'}
      className="rd-primary"
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      onClick={(event) => {
        if (busy) event.preventDefault();
        else onClick?.();
      }}
    >
      {busy && <span className="rd-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

/** B's onboarding field: the label inside, small once something is typed or it has focus. */
function Field({
  id,
  label,
  value,
  wrong,
  told,
  inputRef,
  code = false,
  autoComplete,
  inputMode,
  maxLength,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  wrong: boolean;
  told?: string | undefined;
  inputRef?: RefObject<HTMLInputElement | null>;
  code?: boolean;
  autoComplete: string;
  inputMode?: 'text' | 'tel' | 'numeric';
  maxLength?: number;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className={['rd-field', wrong && 'is-wrong', value !== '' && 'is-filled']
        .filter(Boolean)
        .join(' ')}
    >
      <label htmlFor={id} className="rd-label">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        className={code ? 'rd-input is-code' : 'rd-input'}
        value={value}
        autoComplete={autoComplete}
        autoCapitalize={code ? 'characters' : undefined}
        inputMode={inputMode}
        maxLength={maxLength}
        spellCheck={false}
        aria-invalid={wrong}
        aria-describedby={told}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function Says({
  id,
  alert = false,
  children,
}: {
  id: string;
  alert?: boolean;
  children: ReactNode;
}) {
  return (
    <p id={id} className="rd-says" role={alert ? 'alert' : undefined}>
      {children}
    </p>
  );
}

const ENTER_LINES = { blank: R.codeBlank, short: R.codeShort, refused: R.refused } as const;

function EnterStep({
  step,
  titleRef,
  fieldRef,
  onType,
  onContinue,
}: {
  step: Extract<Step, { kind: 'enter' }>;
  titleRef: RefObject<HTMLHeadingElement | null>;
  fieldRef: RefObject<HTMLInputElement | null>;
  onType: (typed: string) => void;
  onContinue: () => void;
}) {
  const busy = step.busy !== 'no';

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!busy) onContinue();
  }

  return (
    <form className="rd-form" noValidate onSubmit={submit}>
      {step.signedOut && (
        <p className="rd-signed-out" role="status">
          <SignOutLine size={26} />
          {R.signedOut}
        </p>
      )}
      <Title titleRef={titleRef}>{R.enterTitle}</Title>
      <Field
        id="rd-code"
        label={R.joinCode}
        value={step.typed}
        wrong={step.line != null}
        told={step.line == null ? undefined : 'rd-code-line'}
        inputRef={fieldRef}
        code
        autoComplete="off"
        onChange={onType}
      />
      {step.line != null && (
        <Says id="rd-code-line" alert={step.line === 'refused'}>
          {ENTER_LINES[step.line]}
        </Says>
      )}
      <Primary submit busy={busy}>
        {R.continue}
      </Primary>
    </form>
  );
}

function EventStep({
  step,
  name,
  number,
  country,
  titleRef,
  fieldRef,
  onName,
  onNumber,
  onCountry,
  onSend,
}: {
  step: Extract<Step, { kind: 'event' }>;
  name: string;
  number: string;
  country: string;
  titleRef: RefObject<HTMLHeadingElement | null>;
  fieldRef: RefObject<HTMLInputElement | null>;
  onName: (name: string) => void;
  onNumber: (number: string) => void;
  onCountry: (country: string) => void;
  onSend: () => void;
}) {
  const lines: EventLines = step.checked ? eventLines(name, number, country) : {};

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (step.busy === 'no') onSend();
  }

  return (
    <form className="rd-form" noValidate onSubmit={submit}>
      <Tile />
      <Title titleRef={titleRef}>{DOOR_EVENT}</Title>
      <p className="rd-intro">{EVENT_LINE}</p>
      {step.usedUp && (
        <p className="rd-alert" role="alert">
          <Glyph name="alert" size={17} weight={2.2} />
          {R.refused}
        </p>
      )}
      <div className="rd-group">
        <Field
          id="rd-name"
          label={R.yourName}
          value={name}
          wrong={lines.name != null}
          told={lines.name == null ? undefined : 'rd-name-line'}
          inputRef={fieldRef}
          autoComplete="name"
          onChange={onName}
        />
        {lines.name != null && <Says id="rd-name-line">{lines.name}</Says>}
      </div>
      <div className="rd-group">
        <div className="rd-phone">
          <CountryCode country={country} onChange={onCountry} />
          <Field
            id="rd-number"
            label={R.mobile}
            value={number}
            wrong={lines.number != null}
            told={lines.number == null ? undefined : 'rd-number-line'}
            autoComplete="tel-national"
            inputMode="tel"
            onChange={onNumber}
          />
        </div>
        {lines.number != null && <Says id="rd-number-line">{lines.number}</Says>}
      </div>
      <Primary submit busy={step.busy !== 'no'}>
        {R.sendCode}
      </Primary>
    </form>
  );
}

/** "+351 ⌄": the country's code, its list a native select laid over it. */
function CountryCode({ country, onChange }: { country: string; onChange: (code: string) => void }) {
  return (
    <div className="rd-country">
      <span className="rd-country-code" aria-hidden="true">
        {callingCode(country) ?? CALLING}
        <Glyph name="chevdown" size={14} weight={2.4} />
      </span>
      <select
        className="rd-country-pick"
        aria-label={R.countryCode}
        value={country}
        onChange={(event) => onChange(event.target.value)}
      >
        {COUNTRIES.map((one) => (
          <option key={one.code} value={one.code}>
            {codeChoice(one.code)}
          </option>
        ))}
      </select>
    </div>
  );
}

const PROBLEMS: Partial<Record<CodeProblem, { title: string; body: string }>> = {
  expired: { title: R.expiredTitle, body: R.expiredBody },
  exhausted: { title: R.exhaustedTitle, body: R.exhaustedBody },
  failed: { title: R.failedTitle, body: R.failedBody },
};

const CODE_LINES = {
  whatsapp: { blank: R.codeBlankWhatsApp, short: R.codeShortPhone, wrong: R.wrongWhatsApp },
  text: { blank: R.codeBlankText, short: R.codeShortPhone, wrong: R.wrongText },
} as const;

/** The phone code in a browser: one field and Verify, as the web's onboarding has it (WCAG 3.2.2); nothing is sent as it is typed. */
function CodeStep({
  step,
  number,
  titleRef,
  fieldRef,
  onDigits,
  onVerify,
  onText,
  onSendNew,
}: {
  step: Extract<Step, { kind: 'code' }>;
  number: string;
  titleRef: RefObject<HTMLHeadingElement | null>;
  fieldRef: RefObject<HTMLInputElement | null>;
  onDigits: (digits: string) => void;
  onVerify: () => void;
  onText: () => void;
  onSendNew: () => void;
}) {
  const texted = step.via === 'text';
  const problem = step.problem == null ? undefined : PROBLEMS[step.problem];
  const dead = deadCode(step.problem);
  const busy = step.busy !== 'no';
  const lines = CODE_LINES[step.via];
  const said = step.line != null ? lines[step.line] : step.problem === 'wrong' ? lines.wrong : null;

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!busy) onVerify();
  }

  return (
    <div className="rd-form">
      <Title titleRef={titleRef}>{texted ? R.checkMessages : R.checkWhatsApp}</Title>
      <p className="rd-intro">{texted ? R.texted(number) : R.sentWhatsApp(number)}</p>
      {problem != null && (
        <div className="rd-problem" role="alert">
          <p className="rd-problem-title">{problem.title}</p>
          <p className="rd-problem-body">{problem.body}</p>
        </div>
      )}
      {dead ? (
        <Primary onClick={onSendNew}>{R.sendNew}</Primary>
      ) : (
        <>
          <form className="rd-form" noValidate onSubmit={submit}>
            <div className="rd-group">
              <Field
                id="rd-phone-code"
                label={texted ? R.codeFromText : R.codeFromWhatsApp}
                value={step.digits}
                wrong={said != null}
                told={said == null ? undefined : 'rd-phone-code-line'}
                inputRef={fieldRef}
                code
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={PHONE_CODE_LENGTH}
                onChange={(typed) =>
                  onDigits(typed.replace(/\D/gu, '').slice(0, PHONE_CODE_LENGTH))
                }
              />
              {said != null && (
                <Says id="rd-phone-code-line" alert={step.problem === 'wrong'}>
                  {said}
                </Says>
              )}
            </div>
            <Primary submit busy={busy}>
              {busy ? R.verifying : R.verify}
            </Primary>
          </form>
          <div className="rd-ways">
            {!texted && (
              <button type="button" className="rd-quiet" onClick={onText}>
                {R.textInstead}
              </button>
            )}
            {step.resend <= 0 ? (
              <button type="button" className="rd-quiet" onClick={onSendNew}>
                {R.sendNew}
              </button>
            ) : (
              <p className="rd-quiet is-off">{sendNewIn(step.resend)}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SignOutLine({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="rd-out-mark"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
