import { type Provider, type ProviderSignInAttempt } from '@soirely/api-client';
import {
  PROOF_MINUTES,
  type ZoneRow,
  callingCode,
  cleanCode,
  codeProblem,
  countryChoices,
  exactZone,
  formerName,
  matchingZones,
  phoneLengthProblem,
  refusedPhoneField,
  zoneLabel,
} from '@soirely/domain';
import { type TFunction } from 'i18next';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type ContactKind,
  type ContactRow,
  type VerifyWords,
  verifyWords,
} from '../accountPage.ts';
import { type CodeSource, useCodeCheck } from '../codeCheck.ts';
import { emailMessage } from '../formChecks.ts';
import { currentLocale } from '../i18n/index.ts';
import { offButton } from '../offButton.ts';
import { codeChoice, phoneProblemMessage } from '../phoneProblem.ts';
import { PROVIDER_NAMES, type ReturnPurpose, startProviderSignIn } from '../providerSignIn.ts';
import { type ProveWith, useProving } from '../proving.ts';
import { ExpiredCode } from './AccountParts.tsx';
import { FieldError } from './FieldError.tsx';
import { Glyph } from './Glyph.tsx';
import { Ask, Dialog, Field, Note, RowWords } from './SettingsParts.tsx';

type Saving = Promise<string | null>;

/** Where a dialog opens: what is already typed, Save already pressed, or the Discard ask up. The demo's state links open on these. */
export interface Opening {
  typed?: string;
  tried?: boolean;
  discarding?: boolean;
}

const ZONES_SHOWN = 8;

/** Presses the dialog's own button once, on arrival, when it opens with Save already pressed. */
function useTriedOnArrival(tried: boolean | undefined, press: () => void): void {
  const pressed = useRef(false);

  useEffect(() => {
    if (tried !== true || pressed.current) return;
    pressed.current = true;
    press();
    // Once, on arrival: the press is the opening's, never a later render's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

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
  start,
  onClose,
  onSave,
}: {
  saved: string;
  start?: Opening;
  onClose: () => void;
  onSave: (name: string) => Saving;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState(start?.typed ?? saved);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(start?.discarding ?? false);
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

  useTriedOnArrival(start?.tried, () => void save());

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

function zoneRowLine(zone: ZoneRow, typed: string, t: TFunction): string {
  const was = formerName(zone, typed);

  return was == null
    ? zone.country
    : t('timeZone.countryWas', { country: zone.country, name: was });
}

export function ZoneDialog<Zone extends ZoneRow>({
  zones,
  now,
  start,
  onClose,
  onSave,
}: {
  zones: readonly Zone[];
  now: string | null;
  start?: Opening & { picked?: Zone | null };
  onClose: () => void;
  onSave: (zone: Zone) => Saving;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState(start?.typed ?? '');
  const [picked, setPicked] = useState<Zone | null>(start?.picked ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(start?.discarding ?? false);
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

  useTriedOnArrival(start?.tried, () => void save());

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
  start,
  onAdd,
}: {
  start?: Opening;
  onClose: () => void;
  onAdd: (address: string) => Saving;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState(start?.typed ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(start?.discarding ?? false);

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

  useTriedOnArrival(start?.tried, () => void add());

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
  start,
  onClose,
  onAdd,
}: {
  startCountry: string;
  start?: Opening;
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
  const [typed, setTyped] = useState(start?.typed ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(start?.discarding ?? false);
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

  useTriedOnArrival(start?.tried, () => void add());

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

/** Confirm it's you before the address you sign in with changes: the password, or Google or Apple, then the code while two-factor is on. */
export function ProveDialog({
  via,
  twoFactorOn,
  returned,
  purpose,
  start,
  prove,
  onClose,
  onProved,
}: {
  via: 'password' | Provider | null;
  twoFactorOn: boolean;
  returned: ProviderSignInAttempt | null;
  purpose: ReturnPurpose;
  start?: Opening & { password?: string };
  prove: (first: ProveWith, code?: string) => Promise<string>;
  onClose: () => void;
  onProved: (proof: string) => void;
}) {
  const { t } = useTranslation();
  const passwordRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState(start?.password ?? '');
  const [code, setCode] = useState(start?.typed ?? '');
  const proving = useProving({
    via,
    twoFactorOn,
    returned,
    prove,
    onProved,
    onSend: () => (outcome) => {
      if (outcome.kind === 'code') window.requestAnimationFrame(() => codeRef.current?.focus());
      if (outcome.kind === 'expired') setCode('');
      if (outcome.kind === 'refused' && outcome.refusal.field !== 'failed')
        (outcome.refusal.field === 'password' ? passwordRef : codeRef).current?.focus();
    },
  });
  const { signIn, expired, refusal, setRefusal, checking, codeAsked, provider, askPassword } =
    proving;
  const providerName = provider == null ? null : PROVIDER_NAMES[provider];
  const showsCode = codeAsked && (askPassword || signIn != null);
  const leaves = !askPassword && signIn == null && provider != null;

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
    void proving.send(password, showsCode ? code.trim() : undefined);
  }

  useTriedOnArrival(start?.tried, () => go());

  const stepTwo = proving.stepTwo == null ? null : PROVIDER_NAMES[proving.stepTwo];

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
  source,
  start,
  onClose,
  onVerified,
}: {
  kind: ContactKind;
  row: ContactRow;
  source: CodeSource;
  start?: Opening;
  onClose: () => void;
  onVerified: (primary: boolean) => Promise<void>;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const resendButton = useRef<HTMLButtonElement>(null);
  const email = kind === 'email';
  const [held] = useState(source);
  const check = useCodeCheck(kind, held);
  const { status, resending, wording } = check;
  const cooldown = resending.cooldown;
  const [typed, setTyped] = useState(start?.typed ?? '');
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
    if (checked == null) return;
    if (checked.verified) return onVerified(checked.primary);
    if (checked.refusal.kind === 'wrong') setError(words.wrong);
    if (checked.refusal.kind === 'failed') setError(t('verifyEmail.failedBody'));
    if (checked.refusal.kind === 'wrong' || checked.refusal.kind === 'failed') {
      input.current?.focus();
      input.current?.select();
    } else resendButton.current?.focus();
  }

  useTriedOnArrival(start?.tried, () => void verify());

  async function resend(): Promise<void> {
    if (cooldown > 0) return;
    const resent = await check.resend();
    if (resent == null) return;
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
          {resending.label}
        </button>
        <p className="desk-note">{t('verifyEmail.resendNote')}</p>
        <span className="visually-hidden" role="status">
          {resending.status}
        </span>
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
