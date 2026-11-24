import {
  ApiError,
  type CurrentFactor,
  type HeldFactors,
  type PasskeyOptions,
  type TwoFactorEnrolment,
} from '@soirely/api-client';
import {
  PASSWORD_MINIMUM_LENGTH,
  cleanCode,
  codeProblem,
  keyInGroups,
  meetsPasswordLength,
} from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { emailMessage } from '../formChecks.ts';
import { offButton } from '../offButton.ts';
import { askPasskey, canUsePasskeys } from '../passkey.ts';
import { useResendCountdown } from '../resendCountdown.ts';
import {
  changeRefusal,
  chosenRefusal,
  emailedCodeRefusal,
  factorRefusal,
  forgotRefusal,
  setupRefusal,
} from '../securityRefusals.ts';
import { type Opening, useTriedOnArrival } from './AccountDialogs.tsx';
import { ExpiredCode } from './AccountParts.tsx';
import { FieldError } from './FieldError.tsx';
import { Glyph } from './Glyph.tsx';
import { NoBrowser, Refused, Waiting } from './PasskeyParts.tsx';
import { Ask, Dialog, Field, Note, TextAction } from './SettingsParts.tsx';
import './SecurityParts.css';

export interface TwoOpening extends Opening {
  second?: string;
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

function Rule({ password }: { password: string }) {
  const { t } = useTranslation();
  const met = meetsPasswordLength(password);

  return (
    <div className="security-rule">
      <div className="security-rule-row">
        <span className={met ? 'desk-mark is-yes' : 'desk-mark is-notyet'} aria-hidden="true">
          {met && <Glyph name="tick" size={10} weight={3.4} />}
        </span>
        <span className="security-rule-name">
          {t('register.ruleLength', { count: PASSWORD_MINIMUM_LENGTH })}
        </span>
        <span className="security-rule-word">
          {met ? t('register.ruleMet') : t('register.ruleNotYet')}
        </span>
      </div>
      <p className="desk-note">{t('register.ruleNote')}</p>
    </div>
  );
}

export function SectionFailed({
  line,
  title,
  announce,
  onRetry,
}: {
  line: string;
  title?: string;
  announce: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="desk-failed" role={announce ? 'alert' : undefined}>
      {title != null && <p className="security-failed-title">{title}</p>}
      <p className="desk-line">{line}</p>
      <TextAction label={t('error.retry')} onClick={onRetry} />
    </div>
  );
}

export function ChangePasswordDialog({
  email,
  start,
  change,
  onForgot,
  onClose,
  onChanged,
}: {
  email: string;
  start?: TwoOpening;
  change: (current: string, next: string) => Promise<{ signedOut: number }>;
  onForgot: () => void;
  onClose: () => void;
  onChanged: (signedOut: number) => void;
}) {
  const { t } = useTranslation();
  const currentRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState(start?.typed ?? '');
  const [next, setNext] = useState(start?.second ?? '');
  const [problems, setProblems] = useState<{ current?: string; next?: string }>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(start?.discarding ?? false);

  function blanks(): { current?: string; next?: string } {
    if (current === '' || next === '')
      return {
        ...(current === '' && { current: t('passwordCard.currentBlank') }),
        ...(next === '' && { next: t('passwordCard.newBlank') }),
      };

    return meetsPasswordLength(next)
      ? {}
      : { next: t('register.tooShort', { count: PASSWORD_MINIMUM_LENGTH }) };
  }

  async function save(): Promise<void> {
    if (busy) return;
    const found = blanks();
    setProblems(found);
    setFailed(null);
    if (found.current != null) return currentRef.current?.focus();
    if (found.next != null) return nextRef.current?.focus();
    setBusy(true);
    try {
      const { signedOut } = await change(current, next);
      onChanged(signedOut);
    } catch (error) {
      setBusy(false);
      const refused = changeRefusal(error, t);
      if (refused.field === 'currentPassword') {
        setProblems({ current: refused.message });
        currentRef.current?.focus();
      } else if (refused.field === 'newPassword') {
        setProblems({ next: refused.message });
        nextRef.current?.focus();
      } else setFailed(refused.message);
    }
  }

  useTriedOnArrival(start?.tried, () => void save());

  return (
    <>
      <Dialog
        title={t('passwordCard.change')}
        verb={t('account.save')}
        on={!busy}
        locked={busy}
        first={problems.current != null || current === '' ? currentRef : nextRef}
        onDismiss={() => (current === '' && next === '' ? onClose() : setAsking(true))}
        onConfirm={() => void save()}
      >
        {failed != null && <FieldError id="change-password-failed" message={failed} />}
        <div className="desk-fields">
          <Field
            label={t('passwordCard.current')}
            value={current}
            secret
            autoComplete="current-password"
            inputRef={currentRef}
            error={problems.current ?? null}
            action={
              <button type="button" className="desk-text" onClick={onForgot}>
                {t('passwordCard.forgot')}
              </button>
            }
            onChange={(value) => {
              setCurrent(value);
              setProblems(({ next: kept }) => (kept == null ? {} : { next: kept }));
            }}
          />
          <Field
            label={t('passwordCard.new')}
            value={next}
            secret
            autoComplete="new-password"
            inputRef={nextRef}
            error={problems.next ?? null}
            onChange={(value) => {
              setNext(value);
              setProblems(({ current: kept }) => (kept == null ? {} : { current: kept }));
            }}
          />
        </div>
        <Rule password={next} />
        <Note>{t('passwordCard.signsOut')}</Note>
        <Note>{t('passwordCard.emailed', { email })}</Note>
      </Dialog>
      {asking && (
        <Discard line={t('security.changeStays')} onKeep={() => setAsking(false)} onGo={onClose} />
      )}
    </>
  );
}

/** Reset your password, from Forgot it?: a proof of nothing, so Cancel closes it at once. */
export function ForgotDialog({
  start,
  send,
  onClose,
  onSent,
}: {
  start?: Opening;
  send: (email: string) => Promise<void>;
  onClose: () => void;
  onSent: (email: string) => void;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState(start?.typed ?? '');
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function go(): Promise<void> {
    if (busy) return;
    const refusal = emailMessage(typed, t);
    setError(refusal);
    setFailed(null);
    if (refusal != null) return input.current?.focus();
    setBusy(true);
    try {
      await send(typed.trim());
      onSent(typed.trim());
    } catch (problem) {
      setBusy(false);
      setFailed(forgotRefusal(problem, t));
    }
  }

  useTriedOnArrival(start?.tried, () => void go());

  return (
    <Dialog
      title={t('recovery.title')}
      verb={t('security.send')}
      on={!busy}
      locked={busy}
      first={input}
      onDismiss={onClose}
      onConfirm={() => void go()}
    >
      {failed != null && <FieldError id="forgot-failed" message={failed} />}
      <Note>{t('recovery.intro')}</Note>
      <div className="desk-fields">
        <Field
          label={t('recovery.email')}
          value={typed}
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
  );
}

export function SentDialog({ onDone, onAgain }: { onDone: () => void; onAgain: () => void }) {
  const { t } = useTranslation();

  return (
    <Dialog
      title={t('recovery.sentTitle')}
      verb={t('security.done')}
      cancel={false}
      onDismiss={onDone}
      onConfirm={onDone}
    >
      <Note>{t('recovery.sentBody')}</Note>
      <div className="security-there">
        <p className="security-there-title">{t('security.nothingThere')}</p>
        <p className="desk-note">{t('security.nothingThereLine')}</p>
      </div>
      <button type="button" className="desk-text" onClick={onAgain}>
        {t('security.sendAgain')}
      </button>
      <p className="desk-note">{t('recovery.providerNote')}</p>
      <p className="desk-note">{t('recovery.gotIt')}</p>
    </Dialog>
  );
}

export function SetCodeDialog({
  email,
  start,
  begin,
  pass,
  onClose,
  onPassed,
}: {
  email: string;
  start?: Opening & { expired?: boolean };
  begin: () => Promise<number>;
  pass: (code: string) => Promise<string>;
  onClose: () => void;
  onPassed: (stepUp: string) => void;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const resendButton = useRef<HTMLButtonElement>(null);
  const [typed, setTyped] = useState(start?.typed ?? '');
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [expired, setExpired] = useState(start?.expired ?? false);
  const [busy, setBusy] = useState(false);
  const resending = useResendCountdown({
    resend: 'passwordCard.resend',
    resendIn: 'passwordCard.resendIn',
  });
  const waiting = resending.button['aria-disabled'] === true;

  const send = (clicked: boolean): Promise<void> =>
    resending.once(async () => {
      setFailed(null);
      const countDown = clicked ? resending.countDown : resending.begin;
      try {
        countDown(await begin());
        if (!clicked) return;
        setTyped('');
        setError(null);
        setExpired(false);
        window.requestAnimationFrame(() => input.current?.focus());
      } catch (problem) {
        const seconds =
          problem instanceof ApiError
            ? Number(problem.response?.headers.get('Retry-After'))
            : Number.NaN;
        if (Number.isFinite(seconds) && seconds > 0) countDown(seconds);
        else setFailed(t('passwordCard.setSendFailed'));
      }
    });

  // Sent once, as the dialog opens; Send a new code sends again.
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || start?.expired === true) return;
    sent.current = true;
    void send(false);
  });

  async function go(): Promise<void> {
    if (busy || expired) return;
    const problem = codeProblem(typed);
    if (problem != null) {
      setError(
        problem === 'blank' ? t('passwordCard.setCodeBlank') : t('passwordCard.setCodeShort'),
      );
      return input.current?.focus();
    }
    setBusy(true);
    setFailed(null);
    try {
      onPassed(await pass(cleanCode(typed)));
    } catch (refused) {
      setBusy(false);
      if (refused instanceof ApiError && refused.is('verification_code_expired')) {
        setExpired(true);
        window.requestAnimationFrame(() => resendButton.current?.focus());
        return;
      }
      const { refusal, paused } = emailedCodeRefusal(refused, t);
      if (paused != null) setFailed(paused);
      else {
        setError(refusal);
        input.current?.focus();
      }
    }
  }

  useTriedOnArrival(start?.tried, () => void go());

  return (
    <Dialog
      title={t('passwordCard.setCodeTitle')}
      verb={t('passwordCard.continue')}
      on={!expired && !busy}
      locked={busy}
      first={expired ? resendButton : input}
      onDismiss={onClose}
      onConfirm={() => void go()}
    >
      {failed != null && <FieldError id="set-code-failed" message={failed} />}
      <Note>{t('passwordCard.setCodeIntro', { email })}</Note>
      {expired ? (
        <ExpiredCode title={t('verifyEmail.expiredTitle')} line={t('verifyEmail.expiredBody')} />
      ) : (
        <div className="desk-fields security-fields">
          <Field
            label={t('passwordCard.setCodeLabel')}
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
          className={waiting ? 'desk-text account-wait' : 'desk-text'}
          {...offButton(waiting, { dim: false })}
          onClick={() => void send(true)}
        >
          {resending.label}
        </button>
        <p className="desk-note">{t('verifyEmail.resendNote')}</p>
        <span className="visually-hidden" role="status">
          {resending.status}
        </span>
      </div>
      <Note>{t('passwordCard.setCodeNote')}</Note>
    </Dialog>
  );
}

export function ChoosePasswordDialog({
  email,
  start,
  save,
  onClose,
  onExpired,
  onAdded,
}: {
  email: string;
  start?: Opening;
  save: (password: string) => Promise<void>;
  onClose: () => void;
  onExpired: () => void;
  onAdded: () => void;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState(start?.typed ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(start?.discarding ?? false);

  async function go(): Promise<void> {
    if (busy) return;
    const refusal =
      typed === ''
        ? t('passwordCard.setNewBlank')
        : meetsPasswordLength(typed)
          ? null
          : t('register.tooShort', { count: PASSWORD_MINIMUM_LENGTH });
    setError(refusal);
    if (refusal != null) return input.current?.focus();
    setBusy(true);
    try {
      await save(typed);
      onAdded();
    } catch (refused) {
      setBusy(false);
      if (refused instanceof ApiError && refused.is('verification_code_expired'))
        return onExpired();
      setError(chosenRefusal(refused, t));
      input.current?.focus();
    }
  }

  useTriedOnArrival(start?.tried, () => void go());

  return (
    <>
      <Dialog
        title={t('passwordCard.setNewTitle')}
        verb={t('account.save')}
        on={!busy}
        locked={busy}
        first={input}
        onDismiss={() => (typed === '' ? onClose() : setAsking(true))}
        onConfirm={() => void go()}
      >
        <div className="desk-fields">
          <Field
            label={t('passwordCard.setNewLabel')}
            value={typed}
            secret
            autoComplete="new-password"
            inputRef={input}
            error={error}
            onChange={(value) => {
              setTyped(value);
              setError(null);
            }}
          />
        </div>
        <Rule password={typed} />
        <Note>{t('passwordCard.setEmailed', { email })}</Note>
      </Dialog>
      {asking && (
        <Discard line={t('account.nothingAdded')} onKeep={() => setAsking(false)} onGo={onClose} />
      )}
    </>
  );
}

/** Confirm it's you with the current factor: the passkey's sheet first where it can open, else a code. */
export function FactorDialog({
  purpose,
  email,
  start,
  held = { app: true, passkeys: false },
  passkeyOptions,
  submit,
  onClose,
  onDone,
  onKept,
}: {
  purpose: 'turnOff' | 'newCodes' | 'remove' | 'add' | 'addApp';
  email: string;
  start?: Opening;
  held?: HeldFactors;
  passkeyOptions?: () => Promise<PasskeyOptions>;
  submit: (current: CurrentFactor) => Promise<void>;
  onClose: () => void;
  onDone: () => void;
  onKept: (organisation: string) => void;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const useCode = useRef<HTMLButtonElement>(null);
  const browserCan = canUsePasskeys();
  const offersPasskey = held.passkeys && passkeyOptions != null && browserCan;
  const [mode, setMode] = useState<'passkey' | 'code'>(offersPasskey ? 'passkey' : 'code');
  const [typed, setTyped] = useState(start?.typed ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const recovery = !held.app;
  const opened = useRef(false);

  async function send(current: CurrentFactor): Promise<boolean> {
    try {
      await submit(current);
      onDone();
      return true;
    } catch (refused) {
      setBusy(false);
      if (refused instanceof ApiError && refused.is('two_factor_kept_by_rule')) {
        onKept(refused.problem.organisation ?? '');
        return true;
      }
      setError(
        refused instanceof ApiError && refused.is('passkey_refused')
          ? t('passkey.refused')
          : factorRefusal(refused, t),
      );
      return false;
    }
  }

  async function go(): Promise<void> {
    if (busy) return;
    if (typed.trim() === '') {
      setError(recovery ? t('passkey.recoveryBlank') : t('twoFactorCard.offBlank'));
      return input.current?.focus();
    }
    setBusy(true);
    if (!(await send({ code: typed.trim() }))) input.current?.focus();
  }

  async function openSheet(): Promise<void> {
    if (busy || passkeyOptions == null) return;
    setBusy(true);
    setError(null);
    try {
      const answer = await askPasskey(await passkeyOptions());
      if (answer == null) return setBusy(false);
      await send({ passkey: answer });
    } catch (refused) {
      setBusy(false);
      setError(factorRefusal(refused, t));
    }
  }

  useEffect(() => {
    if (opened.current || mode !== 'passkey') return;
    opened.current = true;
    void openSheet();
    // The sheet opens by itself once, as the dialog arrives; after that only Use a passkey opens it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useTriedOnArrival(start?.tried, () => void go());

  function switchTo(next: 'passkey' | 'code'): void {
    setMode(next);
    setError(null);
  }

  if (mode === 'passkey')
    return (
      <Dialog
        title={t('passkey.proveTitle')}
        verb={t('passkey.use')}
        on={!busy}
        locked={busy}
        first={useCode}
        onDismiss={onClose}
        onConfirm={() => void openSheet()}
      >
        <Note strong>{t('passkey.waitTitle')}</Note>
        <p className="desk-note">{t('passkey.waitLine')}</p>
        {busy && <Waiting />}
        {error != null && <Refused line={error} />}
        <div className="account-acts">
          <button
            ref={useCode}
            type="button"
            className="desk-text"
            onClick={() => switchTo('code')}
          >
            {t('passkey.useCode')}
          </button>
        </div>
      </Dialog>
    );

  return (
    <Dialog
      title={t('waysCard.proveTitle')}
      verb={t('waysCard.continue')}
      on={!busy}
      locked={busy}
      first={input}
      onDismiss={onClose}
      onConfirm={() => void go()}
    >
      {held.passkeys && !browserCan && <NoBrowser />}
      <Note strong>{recovery ? t('passkey.recoveryLead') : t('passkey.codeLead')}</Note>
      <div className="desk-fields security-fields">
        <Field
          label={recovery ? t('passkey.recoveryLabel') : t('waysCard.code')}
          value={typed}
          help={
            purpose === 'turnOff'
              ? t('twoFactorCard.offEmail', { email })
              : recovery
                ? t('passkey.recoveryHelp')
                : t('waysCard.codeHelp')
          }
          autoComplete="one-time-code"
          inputRef={input}
          error={error}
          onChange={(value) => {
            setTyped(value);
            setError(null);
          }}
        />
      </div>
      {offersPasskey && (
        <div className="account-acts">
          <button type="button" className="desk-text" onClick={() => switchTo('passkey')}>
            {t('passkey.useInstead')}
          </button>
        </div>
      )}
    </Dialog>
  );
}

export function SetupDialog({
  start,
  adding = false,
  enrol,
  activate,
  onClose,
  onOn,
}: {
  start?: Opening;
  /** Beside passkeys already on: the app joins them, so it reads as adding rather than turning on. */
  adding?: boolean;
  enrol: () => Promise<TwoFactorEnrolment>;
  activate: (code: string) => Promise<string[]>;
  onClose: () => void;
  onOn: (codes: string[]) => void;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [enrolment, setEnrolment] = useState<TwoFactorEnrolment | 'failed' | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [typed, setTyped] = useState(start?.typed ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = enrolment != null && enrolment !== 'failed';

  useEffect(() => {
    let live = true;
    enrol().then(
      (made) => live && setEnrolment(made),
      () => live && setEnrolment('failed'),
    );

    return () => {
      live = false;
    };
    // A new key on each try, never on a re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  async function turnOn(): Promise<void> {
    if (busy || !ready) return;
    const problem = codeProblem(typed);
    if (problem != null) {
      setError(problem === 'blank' ? t('twoFactor.codeBlank') : t('twoFactor.codeLength'));
      return input.current?.focus();
    }
    setBusy(true);
    try {
      onOn(await activate(cleanCode(typed)));
    } catch (refused) {
      setBusy(false);
      setError(setupRefusal(refused, t));
      input.current?.focus();
    }
  }

  const tried = useRef(false);
  useEffect(() => {
    if (start?.tried !== true || tried.current || !ready) return;
    tried.current = true;
    void turnOn();
    // Once, when the key has arrived: the press is the opening's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return (
    <Dialog
      title={adding ? t('passkey.addApp') : t('security.setupTitle')}
      verb={adding ? t('passkey.addAppVerb') : t('security.setupVerb')}
      on={ready && !busy}
      locked={busy}
      first={input}
      onDismiss={onClose}
      onConfirm={() => void turnOn()}
    >
      {enrolment === 'failed' ? (
        <SectionFailed
          line={t('twoFactorCard.failedBody')}
          title={t('twoFactorCard.failedTitle')}
          announce={attempt === 0}
          onRetry={() => {
            setEnrolment(null);
            setAttempt((n) => n + 1);
          }}
        />
      ) : (
        <>
          <p className="security-scan">{t('twoFactorCard.scan')}</p>
          <span className="security-qr">
            {ready && (
              <img
                src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrolment.qrSvg)}`}
                alt={t('twoFactorCard.qrAlt')}
              />
            )}
          </span>
          <Note>{t('twoFactorCard.cantScan')}</Note>
          <p className="security-key" aria-label={t('security.setupKey')}>
            {ready ? keyInGroups(enrolment.secret) : ' '}
          </p>
          <div className="desk-fields security-fields">
            <Field
              label={t('twoFactorCard.enterCode')}
              value={typed}
              help={adding ? t('passkey.addAppLine') : t('twoFactorCard.staysOff')}
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
        </>
      )}
    </Dialog>
  );
}

/** Rejects where the browser has no clipboard, as over plain http, so nothing says it copied what it did not. */
async function copyAll(codes: readonly string[]): Promise<void> {
  await navigator.clipboard.writeText(codes.join('\n'));
}

/** The codes, once: no Cancel, since two-factor is already on, and Finish waits for the box so a slip cannot lose them. */
export function RecoveryDialog({
  codes,
  held = { app: true, passkeys: false },
  start,
  onFinish,
}: {
  codes: readonly string[];
  held?: HeldFactors;
  start?: { copied?: boolean; saved?: boolean };
  onFinish: () => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(start?.copied ?? false);
  const [saved, setSaved] = useState(start?.saved ?? false);
  const box = useRef<HTMLInputElement>(null);

  return (
    <Dialog
      title={t('twoFactorCard.saveTitle')}
      verb={t('twoFactorCard.finish')}
      cancel={false}
      on={saved}
      locked={!saved}
      first={box}
      onDismiss={onFinish}
      onConfirm={onFinish}
    >
      <Note>
        {!held.passkeys
          ? t('twoFactorCard.saveIntro')
          : held.app
            ? t('twoFactorCard.saveIntroBoth')
            : t('twoFactorCard.saveIntroPasskeys')}
      </Note>
      <ul className="security-codes" aria-label={t('twoFactorCard.recoveryCodes')}>
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="desk-red">
        <button
          type="button"
          className="desk-text"
          onClick={() =>
            void copyAll(codes).then(
              () => setCopied(true),
              () => setCopied(false),
            )
          }
        >
          <Glyph name={copied ? 'tick' : 'copy'} size={17} weight={2.3} />
          {copied ? t('twoFactorCard.copied') : t('twoFactorCard.copyAll')}
        </button>
        <div role="status">
          {copied && (
            <p className="desk-note">{t('twoFactorCard.copiedAll', { count: codes.length })}</p>
          )}
        </div>
      </div>
      <label className="security-check">
        <input
          ref={box}
          type="checkbox"
          checked={saved}
          onChange={(event) => setSaved(event.target.checked)}
        />
        {t('twoFactorCard.savedThem')}
      </label>
      <p className="desk-note" aria-live="polite">
        {saved ? t('twoFactorCard.finishReady') : t('twoFactorCard.finishLocked')}
      </p>
    </Dialog>
  );
}
