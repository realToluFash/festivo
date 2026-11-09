import {
  ApiError,
  type Provider,
  type ProviderSignInAttempt,
  type TimeZoneOption,
  proofRefusal,
} from '@soirely/api-client';
import {
  PROOF_MINUTES,
  callingCode,
  cleanCode,
  codeProblem,
  countryChoices,
  exactZone,
  formatCountdown,
  formatTimeOfDay,
  formerName,
  matchingZones,
  phoneLengthProblem,
  refusedPhoneField,
  zoneLabel,
} from '@soirely/domain';
import { type TFunction } from 'i18next';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import {
  type ContactKind,
  type ContactRow,
  type VerifyWords,
  verifyWords,
} from '../../../accountPage.ts';
import { useCodeCheck } from '../../../codeCheck.ts';
import { ExpiredCode } from '../../../components/AccountParts.tsx';
import { FieldError } from '../../../components/FieldError.tsx';
import { Glyph } from '../../../components/Glyph.tsx';
import { Ask, Dialog, Field, Note, RowWords } from '../../../components/SettingsParts.tsx';
import { emailMessage } from '../../../formChecks.ts';
import { currentLocale, dateLocale } from '../../../i18n/index.ts';
import { offButton } from '../../../offButton.ts';
import { codeChoice, phoneProblemMessage } from '../../../phoneProblem.ts';
import {
  PROVIDER_NAMES,
  type ReturnPurpose,
  startProviderSignIn,
} from '../../../providerSignIn.ts';
import { dropProof, holdProof } from '../../../recentProof.ts';

/** What a save answers: null once it has gone, else the words for the field. */
type Saving = Promise<string | null>;

const ZONES_SHOWN = 8;

function Discard({ line, onKeep, onGo }: { line: string; onKeep: () => void; onGo: () => void }) {
  const { t } = useTranslation();

  return (
    <Ask
      title={t('account.discardTitle')}
      line={line}
      keep={t('account.keepEditing')}
      go={t('account.discard')}
      onKeep={onKeep}
      onGo={onGo}
    />
  );
}

export function NameDialog({
  saved,
  onClose,
  onSave,
}: {
  saved: string;
  onClose: () => void;
  onSave: (name: string) => Saving;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const changed = typed.trim() !== saved;

  async function save(): Promise<void> {
    if (busy) return;
    if (typed.trim() === '') {
      setError(t('nameCard.blank'));
      return input.current?.focus();
    }
    setBusy(true);
    const refused = await onSave(typed.trim());
    if (refused == null) return;
    setBusy(false);
    setError(refused);
    input.current?.focus();
  }

  return (
    <>
      <Dialog
        title={t('nameCard.title')}
        verb={t('account.save')}
        on={changed && !busy}
        locked={busy}
        first={input}
        onDismiss={() => (changed ? setAsking(true) : onClose())}
        onConfirm={() => void save()}
      >
        <div className="desk-fields">
          <Field
            label={t('account.fullName')}
            value={typed}
            autoComplete="name"
            inputRef={input}
            error={error}
            onChange={(value) => {
              setTyped(value);
              setError(null);
            }}
          />
        </div>
      </Dialog>
      {asking && (
        <Discard
          line={t('account.nameStays', { name: saved })}
          onKeep={() => setAsking(false)}
          onGo={onClose}
        />
      )}
    </>
  );
}

function zoneRowLine(zone: TimeZoneOption, typed: string, t: TFunction): string {
  const was = formerName(zone, typed);

  return was == null
    ? zone.country
    : t('timeZone.countryWas', { country: zone.country, name: was });
}

export function ZoneDialog({
  zones,
  now,
  onClose,
  onSave,
}: {
  zones: readonly TimeZoneOption[];
  now: string | null;
  onClose: () => void;
  onSave: (zone: TimeZoneOption) => Saving;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState('');
  const [picked, setPicked] = useState<TimeZoneOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const showingPicked = picked != null && typed === zoneLabel(picked);
  const matches = showingPicked ? [] : matchingZones(zones, typed).slice(0, ZONES_SHOWN);
  const wanted = typed.trim();

  async function save(): Promise<void> {
    if (busy) return;
    const zone = showingPicked ? picked : exactZone(zones, typed);
    if (zone == null) {
      setError(
        wanted === '' || matches.length > 0
          ? t('timeZone.choose')
          : t('timeZone.chooseNoMatch', { typed: wanted }),
      );
      return input.current?.focus();
    }
    setBusy(true);
    const refused = await onSave(zone);
    if (refused == null) return;
    setBusy(false);
    setError(refused);
    input.current?.focus();
  }

  return (
    <>
      <Dialog
        title={t('timeZone.title')}
        verb={t('account.save')}
        on={!busy}
        locked={busy}
        first={input}
        onDismiss={() => (wanted === '' ? onClose() : setAsking(true))}
        onConfirm={() => void save()}
      >
        <Note>{t('timeZone.intro')}</Note>
        <div className="desk-fields">
          <Field
            label={t('timeZone.find')}
            value={typed}
            placeholder={t('timeZone.placeholder')}
            help={t('timeZone.help', { now: now ?? t('timeZone.nowUnset') })}
            autoComplete="off"
            inputRef={input}
            error={error}
            onChange={(value) => {
              setTyped(value);
              setError(null);
            }}
          />
        </div>
        <div className="account-status" role="status">
          {wanted !== '' && !showingPicked && matches.length === 0 && (
            <p className="desk-line">{t('timeZone.noneMatch', { typed: wanted })}</p>
          )}
        </div>
        {matches.length > 0 && (
          <ul className="desk-rows account-zones" aria-label={t('timeZone.listLabel')}>
            {matches.map((zone) => (
              <li key={zone.id}>
                <button
                  type="button"
                  className="desk-row account-row"
                  onClick={() => {
                    setTyped(zoneLabel(zone));
                    setPicked(zone);
                    setError(null);
                    input.current?.focus();
                  }}
                >
                  <RowWords title={zoneLabel(zone)} lines={[zoneRowLine(zone, typed, t)]} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
      {asking && (
        <Discard
          line={now == null ? t('account.zoneStaysUnset') : t('account.zoneStays', { zone: now })}
          onKeep={() => setAsking(false)}
          onGo={onClose}
        />
      )}
    </>
  );
}

export function AddEmailDialog({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (address: string) => Saving;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);

  async function add(): Promise<void> {
    if (busy) return;
    const problem = emailMessage(typed, t);
    if (problem != null) {
      setError(problem);
      return input.current?.focus();
    }
    setBusy(true);
    const refused = await onAdd(typed.trim());
    if (refused == null) return;
    setBusy(false);
    setError(refused);
    input.current?.focus();
  }

  return (
    <>
      <Dialog
        title={t('contacts.addEmail')}
        verb={t('account.add')}
        on={!busy}
        locked={busy}
        first={input}
        onDismiss={() => (typed.trim() === '' ? onClose() : setAsking(true))}
        onConfirm={() => void add()}
      >
        <div className="desk-fields">
          <Field
            label={t('contacts.emailLabel')}
            value={typed}
            help={t('contacts.emailHelp')}
            inputMode="email"
            autoComplete="email"
            inputRef={input}
            error={error}
            onChange={(value) => {
              setTyped(value);
              setError(null);
            }}
          />
        </div>
      </Dialog>
      {asking && (
        <Discard line={t('account.nothingAdded')} onKeep={() => setAsking(false)} onGo={onClose} />
      )}
    </>
  );
}

export function AddPhoneDialog({
  startCountry,
  onClose,
  onAdd,
}: {
  startCountry: string;
  onClose: () => void;
  onAdd: (country: string, number: string) => Saving;
}) {
  const { t } = useTranslation();
  const id = useId();
  const locale = currentLocale();
  const input = useRef<HTMLInputElement>(null);
  const select = useRef<HTMLSelectElement>(null);
  const countries = useMemo(
    () => countryChoices(locale).filter(({ code }) => callingCode(code) != null),
    [locale],
  );
  const [country, setCountry] = useState(startCountry);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const changed = typed.trim() !== '' || country !== startCountry;
  const told = [`${id}-help`, error == null ? null : `${id}-error`].filter(Boolean).join(' ');

  async function add(): Promise<void> {
    if (busy) return;
    const found = phoneLengthProblem(typed, country);
    const problem = phoneProblemMessage(found, country, t);
    if (problem != null) {
      setError(problem);
      return (refusedPhoneField(found) === 'country' ? select : input).current?.focus();
    }
    setBusy(true);
    const refused = await onAdd(country, typed);
    if (refused == null) return;
    setBusy(false);
    setError(refused);
    input.current?.focus();
  }

  return (
    <>
      <Dialog
        title={t('contacts.addPhone')}
        verb={t('account.add')}
        on={!busy}
        locked={busy}
        first={input}
        onDismiss={() => (changed ? setAsking(true) : onClose())}
        onConfirm={() => void add()}
      >
        <div className="desk-fields">
          <div className="desk-field">
            <label htmlFor={`${id}-number`} className="desk-label">
              {t('contacts.phoneLabel')}
            </label>
            <div className="account-phone">
              <div className="desk-box account-country">
                <span aria-hidden="true">
                  {country === '' ? '' : `${country} ${callingCode(country) ?? ''}`}
                </span>
                <Glyph name="chevdown" size={16} weight={2.4} />
                <select
                  ref={select}
                  aria-label={t('verifyPhone.countryLabel')}
                  value={country}
                  onChange={(event) => {
                    setCountry(event.target.value);
                    setError(null);
                  }}
                >
                  <option value="" disabled hidden />
                  {countries.map(({ code, name }) => (
                    <option key={code} value={code}>
                      {codeChoice(code, name)}
                    </option>
                  ))}
                </select>
              </div>
              <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
                <input
                  ref={input}
                  id={`${id}-number`}
                  type="tel"
                  value={typed}
                  autoComplete="tel-national"
                  aria-invalid={error != null}
                  aria-describedby={told}
                  onChange={(event) => {
                    setTyped(event.target.value);
                    setError(null);
                  }}
                />
              </div>
            </div>
            {error != null && (
              <p id={`${id}-error`} className="desk-error">
                <Glyph name="alert" size={15} weight={2.2} />
                {error}
              </p>
            )}
            <p id={`${id}-help`} className="desk-help">
              {t('contacts.phoneHelp')}
            </p>
          </div>
        </div>
      </Dialog>
      {asking && (
        <Discard line={t('account.nothingAdded')} onKeep={() => setAsking(false)} onGo={onClose} />
      )}
    </>
  );
}

type Refusal = { field: 'password' | 'code' | 'failed'; message: string };

function provingRefusal(error: unknown, t: TFunction, providerName: string | null): Refusal {
  const refusal = proofRefusal(error, providerName == null);

  if (refusal.kind === 'trip')
    return { field: 'failed', message: t('waysCard.providerRefused', { provider: providerName }) };
  if (refusal.kind === 'limited')
    return {
      field: 'failed',
      message:
        refusal.until == null
          ? t('passwordCard.pausedSoon')
          : t('passwordCard.pausedBody', { time: formatTimeOfDay(refusal.until, dateLocale()) }),
    };
  if (refusal.kind === 'field')
    return {
      field: refusal.field,
      message: refusal.field === 'password' ? t('waysCard.passwordWrong') : t('waysCard.codeWrong'),
    };

  return { field: 'failed', message: t('waysCard.failedBody') };
}

/** Confirm it's you before the address you sign in with changes: the password, or Google or Apple, then the code while two-factor is on. */
export function ProveDialog({
  via,
  twoFactorOn,
  returned,
  purpose,
  onClose,
  onProved,
}: {
  via: 'password' | Provider | null;
  twoFactorOn: boolean;
  returned: ProviderSignInAttempt | null;
  purpose: ReturnPurpose;
  onClose: () => void;
  onProved: (proof: string) => void;
}) {
  const { t } = useTranslation();
  const passwordRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const [signIn, setSignIn] = useState(returned);
  const [expired, setExpired] = useState(false);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [checking, setChecking] = useState(false);
  const [codeAsked, setCodeAsked] = useState(twoFactorOn);
  const [vouched, setVouched] = useState<{ email: string | null } | null>(null);
  // The API's kept proof once a sign-in waits for its code: Google's or Apple's is single-use (RFC 6749 §4.1.2).
  const kept = useRef<string | null>(null);
  const askPassword = via === 'password' && signIn == null;
  const provider = via === 'password' || via == null ? null : via;
  const providerName = provider == null ? null : PROVIDER_NAMES[provider];
  const showsCode = codeAsked && (askPassword || signIn != null);
  const leaves = !askPassword && signIn == null && provider != null;

  async function send(second: string | undefined): Promise<void> {
    setChecking(true);

    try {
      const proof = await api.prove(
        kept.current != null
          ? { pendingProof: kept.current }
          : signIn != null && provider != null
            ? { provider, signIn }
            : { password },
        second,
      );
      holdProof(proof);
      onProved(proof.proof);
    } catch (error) {
      setChecking(false);
      dropProof();

      if (error instanceof ApiError && error.is('two_factor_required')) {
        if (signIn != null) {
          kept.current = error.problem.pendingProof ?? kept.current;
          const email = error.problem.providerEmail ?? null;
          setVouched((now) => now ?? { email });
        }
        setCodeAsked(true);
        window.requestAnimationFrame(() => codeRef.current?.focus());

        return;
      }

      if (signIn != null && error instanceof ApiError && error.is('proof_required')) {
        setSignIn(null);
        kept.current = null;
        setVouched(null);
        setCode('');
        setRefusal(null);
        setExpired(true);

        return;
      }

      if (signIn != null && error instanceof ApiError)
        kept.current = error.problem.pendingProof ?? kept.current;
      const refused = provingRefusal(error, t, signIn != null ? providerName : null);
      setRefusal(refused);
      if (refused.field === 'password') passwordRef.current?.focus();
      if (refused.field === 'code') codeRef.current?.focus();
    }
  }

  // Google's or Apple's sign-in is exchanged the moment it returns: the minute counts from it, not the code.
  const exchanged = useRef(false);

  useEffect(() => {
    if (signIn == null || exchanged.current) return;
    exchanged.current = true;
    void send(undefined);
    // Once, on arrival: what came back from the provider is taken then and never again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function go(): void {
    if (checking) return;
    if (leaves && provider != null) {
      void startProviderSignIn(provider, purpose).catch(() =>
        setRefusal({
          field: 'failed',
          message: t('waysCard.providerFailed', { provider: providerName }),
        }),
      );
      return;
    }
    const blank = {
      password: askPassword && password === '' ? t('waysCard.passwordBlank') : null,
      code: showsCode && code.trim() === '' ? t('waysCard.codeBlank') : null,
    };
    if (blank.password != null || blank.code != null) {
      setRefusal(
        blank.password != null
          ? { field: 'password', message: blank.password }
          : { field: 'code', message: blank.code ?? '' },
      );
      (blank.password != null ? passwordRef : codeRef).current?.focus();
      return;
    }
    void send(showsCode ? code.trim() : undefined);
  }

  const stepTwo = vouched != null && signIn != null ? providerName : null;

  return (
    <Dialog
      title={t('waysCard.proveTitle')}
      verb={
        leaves && providerName != null
          ? t('waysCard.continueWith', { provider: providerName })
          : t('waysCard.continue')
      }
      on={!checking}
      locked={checking}
      first={askPassword ? passwordRef : codeRef}
      onDismiss={onClose}
      onConfirm={go}
    >
      <Note>
        {leaves && providerName != null
          ? t('waysCard.proveWithProvider', { provider: providerName })
          : t('contacts.proveIntro')}
      </Note>
      {expired && providerName != null && (
        <div className="notice notice-attention" role="status">
          <span className="mark mark-attention" aria-hidden="true">
            !
          </span>
          <p>{t('waysCard.proofExpired', { provider: providerName, count: PROOF_MINUTES })}</p>
        </div>
      )}
      {stepTwo != null && <Note strong>{t('waysCard.signedInWith', { provider: stepTwo })}</Note>}
      {(askPassword || showsCode) && (
        <div className="desk-fields">
          {askPassword && (
            <Field
              label={t('waysCard.yourPassword')}
              value={password}
              secret
              autoComplete="current-password"
              inputRef={passwordRef}
              error={refusal?.field === 'password' ? refusal.message : null}
              onChange={(value) => {
                setPassword(value);
                if (refusal?.field === 'password') setRefusal(null);
              }}
            />
          )}
          {showsCode && (
            <Field
              label={t('waysCard.code')}
              value={code}
              help={
                stepTwo == null
                  ? t('waysCard.codeHelp')
                  : `${t('waysCard.codeHelp')} ${t('waysCard.codeKeepsSignIn', { provider: stepTwo, count: PROOF_MINUTES })}`
              }
              autoComplete="one-time-code"
              inputRef={codeRef}
              error={refusal?.field === 'code' ? refusal.message : null}
              onChange={(value) => {
                setCode(value);
                if (refusal?.field === 'code') setRefusal(null);
              }}
            />
          )}
        </div>
      )}
      {refusal?.field === 'failed' && (
        <FieldError id="account-prove-failed" message={refusal.message} />
      )}
    </Dialog>
  );
}

/** Check your email or your messages for one of the account's own rows. */
export function VerifyDialog({
  kind,
  row,
  onClose,
  onVerified,
}: {
  kind: ContactKind;
  row: ContactRow;
  onClose: () => void;
  onVerified: (primary: boolean) => Promise<void>;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const resendButton = useRef<HTMLButtonElement>(null);
  const email = kind === 'email';
  const check = useCodeCheck(kind, row.id);
  const { status, cooldown, wording } = check;
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resendFailed, setResendFailed] = useState(false);
  const words: VerifyWords = verifyWords(email ? 'email' : wording.line, row.shown, t);
  const spent =
    status.kind === 'expired'
      ? words.expired
      : status.kind === 'exhausted'
        ? words.exhausted
        : null;
  const busy = status.kind === 'verifying' || status.kind === 'verified';

  async function verify(): Promise<void> {
    if (busy || spent != null) return;
    const problem = codeProblem(typed);
    if (problem != null) {
      setError(problem === 'blank' ? words.blank : words.short);
      return input.current?.focus();
    }
    setResendFailed(false);
    const checked = await check.verify(cleanCode(typed));
    if (checked.verified) return onVerified(checked.primary);
    if (checked.refusal.kind === 'wrong') setError(words.wrong);
    if (checked.refusal.kind === 'failed') setError(t('verifyEmail.failedBody'));
    if (checked.refusal.kind === 'wrong' || checked.refusal.kind === 'failed') {
      input.current?.focus();
      input.current?.select();
    } else resendButton.current?.focus();
  }

  async function resend(): Promise<void> {
    if (cooldown > 0) return;
    const resent = await check.resend();
    setResendFailed(resent === 'failed');
    if (resent === 'failed') return;
    setTyped('');
    setError(null);
    window.requestAnimationFrame(() => input.current?.focus());
  }

  const note = check.textingFailed
    ? t('verifyPhone.textInsteadFailed')
    : resendFailed
      ? t('verifyEmail.failedBody')
      : null;

  return (
    <Dialog
      title={words.title}
      verb={t('account.verify')}
      on={spent == null && !busy}
      locked={busy}
      first={spent == null ? input : resendButton}
      onDismiss={onClose}
      onConfirm={() => void verify()}
    >
      <Note>{words.lead}</Note>
      {spent != null ? (
        <ExpiredCode title={spent.title} line={spent.line} />
      ) : (
        <div className="desk-fields">
          <Field
            label={words.codeLabel}
            value={typed}
            inputMode="numeric"
            autoComplete="one-time-code"
            inputRef={input}
            error={error}
            onChange={(value) => {
              setTyped(value);
              setError(null);
            }}
          />
        </div>
      )}
      <div className="desk-red">
        <button
          ref={resendButton}
          type="button"
          className={cooldown > 0 ? 'desk-text account-wait' : 'desk-text'}
          {...offButton(cooldown > 0, { dim: false })}
          onClick={() => void resend()}
        >
          {cooldown > 0
            ? t('verifyEmail.resendIn', { time: formatCountdown(cooldown) })
            : t('verifyEmail.resend')}
        </button>
        <p className="desk-note">{t('verifyEmail.resendNote')}</p>
        {!email && wording.offerText && spent == null && (
          <button type="button" className="desk-text" onClick={() => void check.textInstead()}>
            {t('verifyPhone.textInstead')}
          </button>
        )}
      </div>
      {note != null && <FieldError id={`verify-${row.id}-failed`} message={note} />}
    </Dialog>
  );
}
