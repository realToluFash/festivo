import { ApiError } from '@soirely/api-client';
import { PasteCode } from '../../components/PasteCode.tsx';
import { callingCode, countryChoices, phoneLengthProblem } from '@soirely/domain';
import {
  type FormEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../api.ts';
import { type CodeSource, useCodeCheck } from '../../codeCheck.ts';
import { Glyph } from '../../components/Glyph.tsx';
import { currentLocale } from '../../i18n/index.ts';
import { codeChoice, phoneProblemMessage } from '../../phoneProblem.ts';
import { type ProviderOnly, providerOnlyBy } from '../../session.ts';
import { PHONE_CODE_LENGTH, type PhoneEntry } from './redeemEntry.ts';

function entryLines(entry: PhoneEntry, t: ReturnType<typeof useTranslation>['t']) {
  const name = entry.named.trim() === '' ? t('redeem.nameBlank') : (entry.refused.name ?? null);
  const number =
    phoneProblemMessage(phoneLengthProblem(entry.number, entry.country), entry.country, t) ??
    entry.refused.number ??
    (entry.alternative ? t('redeem.phone.alternative') : null);

  return { name, number };
}

/** Your name, the country's code and the mobile number, then Send code, as the web demo's redeem draws it. */
export function PhoneEntryStep({
  entry,
  busy,
  fieldRef,
  onChange,
  onSend,
}: {
  entry: PhoneEntry;
  busy: boolean;
  fieldRef: RefObject<HTMLInputElement | null>;
  onChange: (entry: PhoneEntry) => void;
  onSend: () => void;
}) {
  const { t } = useTranslation();
  const lines = entry.checked || entry.alternative ? entryLines(entry, t) : null;
  const nameSaid = entry.checked ? (lines?.name ?? null) : null;
  const numberSaid = lines?.number ?? null;

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (busy) return;
    const now = entryLines(entry, t);
    onChange({ ...entry, checked: true });
    if (now.name != null || now.number != null) {
      document.getElementById(now.name != null ? 'rd-name' : 'rd-number')?.focus();
      return;
    }
    onSend();
  }

  return (
    <form className="rd-form" noValidate onSubmit={submit}>
      <div className="rd-group">
        <Field
          id="rd-name"
          label={t('redeem.yourName')}
          value={entry.named}
          told={nameSaid == null ? undefined : 'rd-name-line'}
          inputRef={fieldRef}
          autoComplete="name"
          onChange={(named) =>
            onChange({ ...entry, named, refused: { ...entry.refused, name: null } })
          }
        />
        <Says id="rd-name-line">{nameSaid}</Says>
      </div>
      <div className="rd-group">
        <div className="rd-phone">
          <CountryCode
            country={entry.country}
            onChange={(country) =>
              onChange({
                ...entry,
                country,
                alternative: false,
                refused: { ...entry.refused, number: null },
              })
            }
          />
          <Field
            id="rd-number"
            label={t('redeem.phone.mobile')}
            value={entry.number}
            told={numberSaid == null ? undefined : 'rd-number-line'}
            autoComplete="tel-national"
            inputMode="tel"
            onChange={(number) =>
              onChange({
                ...entry,
                number,
                alternative: false,
                refused: { ...entry.refused, number: null },
              })
            }
          />
        </div>
        <Says id="rd-number-line">{numberSaid}</Says>
      </div>
      <Primary submit busy={busy}>
        {t('redeem.phone.sendCode')}
      </Primary>
    </form>
  );
}

/** "+351 ⌄": the country's code, its list a native select laid over it. */
function CountryCode({ country, onChange }: { country: string; onChange: (code: string) => void }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const countries = useMemo(
    () => countryChoices(locale).filter(({ code }) => callingCode(code) != null),
    [locale],
  );

  return (
    <div className="rd-country">
      <span className="rd-country-code" aria-hidden="true">
        {callingCode(country) ?? '+'}
        <Glyph name="chevdown" size={14} weight={2.4} />
      </span>
      <select
        className="rd-country-pick"
        aria-label={t('redeem.phone.countryCode')}
        value={country}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="" disabled hidden />
        {countries.map(({ code, name }) => (
          <option key={code} value={code}>
            {codeChoice(code, name)}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Where the code step leaves to: signed in (You're in, or two-factor first), or a refusal the page shows itself. */
export type Leave<Signed> =
  | { kind: 'signedIn'; signedIn: Signed }
  | { kind: 'alternative' }
  | { kind: 'providerOnly'; refusal: ProviderOnly }
  | { kind: 'refused'; error: ApiError };

/** The phone code in a browser: one field and Verify, nothing sent as it is typed (WCAG 3.2.2). */
export function PhoneCodeStep<Signed>({
  signIn,
  handle,
  number,
  titleRef,
  fieldRef,
  onLeave,
  action,
}: {
  signIn: (typed: string) => Promise<Signed>;
  handle: string;
  number: string;
  titleRef: RefObject<HTMLHeadingElement | null>;
  fieldRef: RefObject<HTMLInputElement | null>;
  onLeave: (leave: Leave<Signed>) => void;
  /** The button, Verify by default; Sign in on a staff link. */
  action?: { idle: string; busy: string };
}) {
  const { t } = useTranslation();
  const signed = useRef<{ signedIn: Signed } | null>(null);
  // Read at the press, so a new function each render never reopens the code.
  const signInNow = useRef(signIn);
  useEffect(() => {
    signInNow.current = signIn;
  });
  const source = useMemo<CodeSource>(
    () => ({
      opening: () => api.phoneSignInOpening(handle),
      verify: async (typed) => {
        signed.current = { signedIn: await signInNow.current(typed) };

        return { primary: true };
      },
      resend: () => api.resendPhoneSignIn(handle),
      textInstead: () => api.textPhoneSignInInstead(handle),
    }),
    [handle],
  );
  const check = useCodeCheck('phone', source, {
    leaves: (error, when) => {
      if (when !== 'answer' || !(error instanceof ApiError)) return false;
      if (error.is('phone_alternative')) {
        onLeave({ kind: 'alternative' });
        return true;
      }
      const providerOnly = providerOnlyBy(error.problem);
      if (providerOnly != null) {
        onLeave({ kind: 'providerOnly', refusal: providerOnly });
        return true;
      }
      if (error.status === 429 || error.status === 404 || error.is('door_code_invalid')) {
        onLeave({ kind: 'refused', error });
        return true;
      }

      return false;
    },
  });
  const [digits, setDigits] = useState('');
  const [line, setLine] = useState<'blank' | 'short' | null>(null);
  const texted = !check.wording.fromWhatsApp;
  const status = check.status.kind;
  const dead = status === 'expired' || status === 'exhausted';
  const busy = status === 'verifying';
  const said =
    line != null
      ? t(texted ? `redeem.phone.${line}Text` : `redeem.phone.${line}WhatsApp`)
      : status === 'wrong'
        ? t(texted ? 'redeem.phone.wrongText' : 'redeem.phone.wrongWhatsApp')
        : null;
  const problem = problemOf(status, texted, t);

  async function verify(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;
    if (digits.length < PHONE_CODE_LENGTH) {
      setLine(digits === '' ? 'blank' : 'short');
      fieldRef.current?.focus();
      return;
    }
    setLine(null);
    const checked = await check.verify(digits);
    if (checked?.verified === true && signed.current != null)
      onLeave({ kind: 'signedIn', signedIn: signed.current.signedIn });
    else if (checked?.verified === false) fieldRef.current?.select();
  }

  async function sendNew(): Promise<void> {
    if ((await check.resend()) === 'failed') check.fail();
    setDigits('');
  }

  return (
    <div className="rd-form">
      <Title titleRef={titleRef}>
        {texted ? t('redeem.phone.checkMessages') : t('redeem.phone.checkWhatsApp')}
      </Title>
      <p className="rd-intro">
        {texted ? t('redeem.phone.texted', { number }) : t('redeem.phone.sentWhatsApp', { number })}
      </p>
      {problem != null && (
        <div className="rd-problem" role="alert">
          <p className="rd-problem-title">{problem.title}</p>
          <p className="rd-problem-body">{problem.body}</p>
        </div>
      )}
      {dead ? (
        <Primary onClick={() => void sendNew()}>{t('verifyPhone.resend')}</Primary>
      ) : (
        <>
          <form className="rd-form" noValidate onSubmit={(event) => void verify(event)}>
            <div className="rd-group">
              <Field
                id="rd-phone-code"
                label={texted ? t('redeem.phone.codeFromText') : t('redeem.phone.codeFromWhatsApp')}
                value={digits}
                told={said == null ? undefined : 'rd-phone-code-line'}
                inputRef={fieldRef}
                code
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={PHONE_CODE_LENGTH}
                onChange={(typed) => {
                  setDigits(typed.replace(/\D/gu, '').slice(0, PHONE_CODE_LENGTH));
                  setLine(null);
                }}
              />
              <Says id="rd-phone-code-line" alert={status === 'wrong'}>
                {said}
              </Says>
              <PasteCode field="rd-phone-code" />
            </div>
            <Primary submit busy={busy}>
              {busy
                ? (action?.busy ?? t('redeem.phone.verifying'))
                : (action?.idle ?? t('redeem.phone.verify'))}
            </Primary>
          </form>
          <div className="rd-ways">
            {check.wording.offerText && (
              <button type="button" className="rd-quiet" onClick={() => void check.textInstead()}>
                {t('redeem.phone.textInstead')}
              </button>
            )}
            {check.resending.cooldown <= 0 ? (
              <button type="button" className="rd-quiet" onClick={() => void sendNew()}>
                {check.resending.label}
              </button>
            ) : (
              <p className="rd-quiet is-off">{check.resending.label}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function problemOf(
  status: string,
  texted: boolean,
  t: ReturnType<typeof useTranslation>['t'],
): { title: string; body: string } | null {
  if (status === 'expired')
    return {
      title: t('redeem.phone.expiredTitle'),
      body: t(texted ? 'redeem.phone.expiredBody' : 'redeem.phone.expiredBodyWhatsApp'),
    };
  if (status === 'exhausted')
    return { title: t('redeem.phone.exhaustedTitle'), body: t('redeem.phone.exhaustedBody') };
  if (status === 'failed')
    return { title: t('redeem.phone.failedTitle'), body: t('redeem.line.failed') };

  return null;
}

export function Title({
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

export function Field({
  id,
  label,
  value,
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
  told?: string | undefined;
  inputRef?: RefObject<HTMLInputElement | null>;
  code?: boolean;
  autoComplete: string;
  inputMode?: 'tel' | 'numeric';
  maxLength?: number;
  onChange: (typed: string) => void;
}) {
  const wrong = told != null;

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

/** A field's line, under its group, so a number's sits under the code and the number together. */
export function Says({
  id,
  alert = false,
  children,
}: {
  id: string;
  alert?: boolean;
  children: string | null;
}) {
  if (children == null) return null;

  return (
    <p id={id} className="rd-says" role={alert ? 'alert' : undefined}>
      {children}
    </p>
  );
}

export function Primary({
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
      <span className="rd-primary-words">{children}</span>
    </button>
  );
}

export function SignOutLine({ size = 18 }: { size?: number }) {
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
