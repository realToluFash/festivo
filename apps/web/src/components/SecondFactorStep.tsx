import {
  ApiError,
  type HeldFactors,
  type PasskeyOptions,
  type SecondFactor,
} from '@soirely/api-client';
import { cleanCode, codeProblem, shapeRecovery } from '@soirely/domain';
import { type FormEvent, type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { selectCode } from '../codeScreen.ts';
import { offButton } from '../offButton.ts';
import { focusWhereSent, offField } from '../offField.ts';
import { askPasskey, canUsePasskeys } from '../passkey.ts';
import { type Mode, type SecondFactorStatus, statusFrom } from '../secondFactorStatus.ts';
import { FieldError } from './FieldError.tsx';
import { NoBrowser, Refused, Waiting } from './PasskeyParts.tsx';
import { ColumnBack } from './Onboarding.tsx';

/** "Enter your code", for any step a second factor guards: a sign-in, or a password reset. */
export function SecondFactorStep({
  intro,
  recoveryIntro,
  submitLabel,
  pausedNote,
  failedTitle,
  failedBody,
  lostBoth,
  lostWhileWaiting = false,
  onVerify,
  onExpired,
  onBack,
  headingRef,
  factors = { app: true, passkeys: false },
  passkey,
  opensOn,
}: {
  intro: string;
  recoveryIntro: string;
  submitLabel: string;
  pausedNote?: string;
  failedTitle: string;
  failedBody: string;
  /** The way back in for somebody who has neither (sc-509). */
  lostBoth?: { to: string; state?: unknown };
  /** The lost link also under the passkey's waiting state: the reset's, not a sign-in's. */
  lostWhileWaiting?: boolean;
  onVerify: (factor: SecondFactor) => Promise<void>;
  onExpired: () => void;
  /** The column's ‹ Back, where the step has one to go back to: a sign-in's (WebTwoFactor, page 27). */
  onBack?: () => void;
  headingRef?: RefObject<HTMLHeadingElement | null>;
  factors?: HeldFactors;
  /** Where the account holds a passkey: the step opens on it, its sheet over the page (sc-86885). */
  passkey?: { lead: string; options: () => Promise<PasskeyOptions> };
  /** Recovery, for a step reached from Use a recovery code instead elsewhere: the staff link's (sc-4235). */
  opensOn?: 'recovery';
}) {
  const { t } = useTranslation();
  const browserCan = canUsePasskeys();
  const offersPasskey = factors.passkeys && passkey != null && browserCan;
  const codeMode: Mode = factors.app ? 'app' : 'recovery';
  const [mode, setMode] = useState<Mode>(opensOn ?? (offersPasskey ? 'passkey' : codeMode));
  const [typed, setTyped] = useState('');
  const [blank, setBlank] = useState<string | null>(null);
  const [status, setStatus] = useState<SecondFactorStatus>({ kind: 'ready' });

  const checking = status.kind === 'checking' || status.kind === 'waiting';
  const opened = useRef(false);
  const liftsAt = status.kind === 'paused' ? status.liftsAt : null;
  const error = blank ?? (status.kind === 'wrong' ? status.message : null);

  useEffect(() => {
    if (liftsAt == null) return;

    const land = focusWhereSent();
    const lift = window.setTimeout(
      () => {
        setTyped('');
        setStatus({ kind: 'ready' });
        land('code');
      },
      Math.max(0, liftsAt - Date.now()),
    );

    return () => window.clearTimeout(lift);
  }, [liftsAt]);

  useEffect(() => {
    if (opened.current || mode !== 'passkey') return;
    opened.current = true;
    void openSheet();
    // The sheet opens by itself once, as the step arrives; after that only Use a passkey opens it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openSheet(): Promise<void> {
    if (passkey == null || checking || status.kind === 'paused') return;

    setStatus({ kind: 'waiting' });

    try {
      const answer = await askPasskey(await passkey.options());
      if (answer == null) {
        setStatus({ kind: 'ready' });
        return;
      }
      await onVerify({ passkey: answer });
      setStatus({ kind: 'ready' });
    } catch (refusal) {
      if (refusal instanceof ApiError && refusal.is('two_factor_challenge_invalid')) {
        onExpired();
        return;
      }
      setStatus(
        refusal instanceof ApiError && refusal.is('passkey_refused')
          ? { kind: 'refused' }
          : statusFrom(refusal, 'passkey', t),
      );
    }
  }

  function switchTo(next: Mode): void {
    setMode(next);
    setTyped('');
    setBlank(null);
    if (status.kind === 'wrong' || status.kind === 'refused') setStatus({ kind: 'ready' });
  }

  function type(value: string): void {
    setTyped(mode === 'recovery' ? shapeRecovery(value) : value);
    setBlank(null);
    if (status.kind === 'wrong') setStatus({ kind: 'ready' });
  }

  // Checked before sending, and a failed check costs no attempt.
  function problem(): string | null {
    if (mode === 'recovery') return typed.trim() === '' ? t('twoFactor.recoveryBlank') : null;

    const found = codeProblem(typed);

    return found === 'blank'
      ? t('twoFactor.codeBlank')
      : found === 'short'
        ? t('twoFactor.codeLength')
        : null;
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (checking || status.kind === 'paused') return;

    const found = problem();
    setBlank(found);
    if (found != null) {
      document.getElementById('code')?.focus();
      return;
    }

    setStatus({ kind: 'checking' });
    const land = focusWhereSent();

    try {
      await onVerify(mode === 'app' ? { code: cleanCode(typed) } : { recoveryCode: typed.trim() });
      setStatus({ kind: 'ready' });
    } catch (refusal) {
      if (refusal instanceof ApiError && refusal.is('two_factor_challenge_invalid')) {
        onExpired();
        return;
      }

      const next = statusFrom(refusal, mode, t);
      setStatus(next);
      if (next.kind === 'wrong') {
        land('code');
        selectCode();
      }
    }
  }

  const lostWords = !factors.passkeys
    ? t('twoFactor.lostBoth')
    : factors.app
      ? t('twoFactor.lostAll')
      : t('twoFactor.lostPasskeys');
  const lost =
    lostBoth == null ? null : (
      <Link className="link-button" to={lostBoth.to} state={lostBoth.state}>
        {lostWords}
      </Link>
    );

  if (mode === 'passkey') {
    return (
      <>
        {onBack != null && <ColumnBack onClick={onBack} />}
        <div className="auth-heading">
          <h1 ref={headingRef} tabIndex={headingRef == null ? undefined : -1}>
            {t('passkey.waitTitle')}
          </h1>
          <p>{passkey?.lead}</p>
          {(status.kind === 'paused' || status.kind === 'failed') && (
            <div className="auth-notice" role="alert">
              <p className="auth-notice-title">
                {status.kind === 'paused' ? t('passkey.pausedTitle') : failedTitle}
              </p>
              <p>
                {status.kind === 'paused'
                  ? t('passkey.pausedBody', { time: status.time })
                  : failedBody}
              </p>
              {status.kind === 'paused' && pausedNote != null && <p>{pausedNote}</p>}
            </div>
          )}
        </div>

        {status.kind === 'waiting' ? (
          <Waiting />
        ) : (
          <button
            className="button button-primary"
            type="button"
            {...offButton(status.kind === 'paused')}
            onClick={() => void openSheet()}
          >
            {status.kind === 'paused'
              ? t('twoFactor.tryAgainAt', { time: status.time })
              : t('passkey.use')}
          </button>
        )}

        <div className="auth-asides">
          <button className="link-button" type="button" onClick={() => switchTo(codeMode)}>
            {t('passkey.useCode')}
          </button>
        </div>
        {status.kind === 'refused' && <Refused line={t('passkey.refused')} />}
        {lostWhileWaiting && lost != null && <div className="auth-asides">{lost}</div>}
      </>
    );
  }

  return (
    <>
      {onBack != null && <ColumnBack onClick={onBack} />}
      <div className="auth-heading">
        <h1 ref={headingRef} tabIndex={headingRef == null ? undefined : -1}>
          {mode === 'app' ? t('twoFactor.title') : t('twoFactor.recoveryTitle')}
        </h1>
        <p>{mode === 'app' ? intro : recoveryIntro}</p>
        {factors.passkeys && !browserCan && <NoBrowser />}
        {(status.kind === 'paused' || status.kind === 'failed') && (
          <div className="auth-notice" role="alert">
            <p className="auth-notice-title">
              {status.kind === 'paused' ? t('twoFactor.pausedTitle') : failedTitle}
            </p>
            <p>
              {status.kind === 'paused'
                ? t('twoFactor.pausedBody', { time: status.time })
                : failedBody}
            </p>
            {status.kind === 'paused' && pausedNote != null && <p>{pausedNote}</p>}
          </div>
        )}
      </div>

      <form className="auth-form" noValidate onSubmit={(event) => void submit(event)}>
        <div className={error == null ? 'field' : 'field field-wrong'}>
          <label htmlFor="code">
            {mode === 'app' ? t('twoFactor.code') : t('twoFactor.recoveryCode')}
          </label>
          <input
            className={error == null ? 'input code-field' : 'input code-field input-wrong'}
            id="code"
            name="code"
            type="text"
            {...(mode === 'app'
              ? { inputMode: 'numeric' as const, autoComplete: 'one-time-code' }
              : { autoComplete: 'off', autoCapitalize: 'none', maxLength: 9 })}
            autoCorrect="off"
            spellCheck={false}
            value={typed}
            {...offField(checking || status.kind === 'paused')}
            aria-invalid={error != null}
            aria-describedby={error == null ? undefined : 'code-error'}
            onChange={(event) => type(event.target.value)}
          />
          {error != null && <FieldError id="code-error" message={error} />}
        </div>

        <button
          className="button button-primary"
          type="submit"
          aria-busy={checking}
          {...offButton(status.kind === 'paused')}
        >
          {status.kind === 'paused'
            ? t('twoFactor.tryAgainAt', { time: status.time })
            : mode === 'app'
              ? submitLabel
              : t('twoFactor.useThisCode')}
        </button>
      </form>

      <div className="auth-asides">
        {offersPasskey && (
          <button
            className="link-button"
            type="button"
            onClick={() => {
              switchTo('passkey');
              void openSheet();
            }}
          >
            {t('passkey.useInstead')}
          </button>
        )}
        {factors.app && (
          <button
            className="link-button"
            type="button"
            onClick={() => switchTo(mode === 'app' ? 'recovery' : 'app')}
          >
            {mode === 'app' ? t('twoFactor.useRecovery') : t('twoFactor.useApp')}
          </button>
        )}
        {lost}
        {status.kind === 'paused' && (
          <p className="auth-aside">
            <span>{t('twoFactor.notYou')}</span>
            <Link className="link-button" to="/forgot-password">
              {t('twoFactor.resetPassword')}
            </Link>
          </p>
        )}
      </div>
    </>
  );
}
