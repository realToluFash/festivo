import {
  type Account,
  ApiUnreachableError,
  phoneAwaitingCode,
  primaryEmailAddress,
} from '@soirely/api-client';
import { cleanCode, codeDigits, codeProblem, formatPhone } from '@soirely/domain';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';

import { api } from '../../api.ts';
import { apiCodeSource, useCodeCheck } from '../../codeCheck.ts';
import { selectCode } from '../../codeScreen.ts';
import { AuthPage } from '../../components/AuthPage.tsx';
import {
  BackToAccount,
  BackToAccountButton,
  RemoveInAccount,
} from '../../components/BackToAccount.tsx';
import { ResendLine, SignedInAs, StepLine, Tick } from '../../components/Onboarding.tsx';
import { PendingPage } from '../../components/Pending.tsx';
import { Unreachable } from '../../components/Unreachable.tsx';
import { StillSignedIn } from '../../components/StillSignedIn.tsx';
import { refreshAccount, useSessionState } from '../../session.ts';
import { useFocusOnceShown, useStepFocus } from '../../stepFocus.ts';
import { FieldError } from '../../components/FieldError.tsx';
import { focusWhereSent } from '../../offField.ts';
import { useSignOut } from '../../signOut.ts';

/** "Check your messages": the code texted to the primary phone, under email's rules and with its parts. */
export function VerifyPhone() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // A number added from Settings > Account (sc-113), by its id: verified there, then back to Account.
  const alternative = params.get('phone') ?? undefined;
  const onboarding = params.get('from') === 'onboarding' && alternative == null;
  const [account, setAccount] = useState<Account | 'none' | 'unreachable' | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { signOut, unreached } = useSignOut(() => navigate('/sign-in'));
  const session = useSessionState();
  // A try again after the API was out of reach opens the code check afresh, with a new source.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const source = useMemo(() => apiCodeSource('phone', alternative), [alternative, attempt]);
  const check = useCodeCheck('phone', source);
  const { status, resending, wording } = check;
  const [codeError, setCodeError] = useState<'blank' | 'short' | null>(null);
  const [doneHeading, arriveAtDone] = useStepFocus();
  const [bannerTitle, arriveAtBanner] = useStepFocus<HTMLParagraphElement>();
  const [failedNotice, arriveAtFailed] = useStepFocus<HTMLDivElement>();
  const [answered, setAnswered] = useState(false);
  const [textedLine, arriveAtTexted] = useStepFocus<HTMLParagraphElement>();
  const land = useFocusOnceShown();

  useEffect(() => {
    let live = true;

    api
      .me()
      .then((me) => {
        if (live) setAccount(me);
      })
      .catch((error: unknown) => {
        if (live) setAccount(error instanceof ApiUnreachableError ? 'unreachable' : 'none');
      });

    return () => {
      live = false;
    };
  }, [attempt]);

  if (account === 'none') return <Navigate to="/sign-in" replace />;
  if (account === 'unreachable')
    return (
      <Unreachable
        signedIn={session.status === 'signedIn'}
        bare
        retry={{
          retrying: false,
          again: () => {
            setAccount(null);
            setAttempt((was) => was + 1);
          },
        }}
      />
    );
  if (account == null) return <PendingPage />;

  const phone =
    alternative == null
      ? phoneAwaitingCode(account)
      : (account.phoneNumbers.find((held) => held.id === alternative) ?? null);
  if (phone == null && alternative != null) return <Navigate to="/app/account" replace />;
  if (phone == null)
    return <Navigate to={onboarding ? '/phone?from=onboarding' : '/phone'} replace />;

  const number = formatPhone(phone.number);
  const verified = status.kind === 'verified' || phone.verified;

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const typed = String(new FormData(event.currentTarget).get('code') ?? '');
    const problem = codeProblem(typed);

    if (problem != null) {
      setCodeError(problem);
      document.getElementById('code')?.focus();
      return;
    }

    const code = cleanCode(typed);

    setCodeError(null);
    setAnswered(false);
    const landWhereSent = focusWhereSent();
    const checked = await check.verify(code);

    if (checked == null) return;
    if (checked.verified) return arriveAtDone();

    const { refusal } = checked;
    if (refusal.kind === 'expired' || refusal.kind === 'exhausted') {
      setAnswered(true);
      arriveAtBanner();
    }
    if (refusal.kind === 'wrong') {
      landWhereSent('code');
      selectCode();
    }
  }

  async function resend(inPlace: boolean): Promise<void> {
    const resent = await check.resend();

    if (resent == null) return;
    if (resent === 'failed') {
      check.fail();
      setAnswered(inPlace);
      if (inPlace) arriveAtFailed();
      return;
    }

    setAnswered(false);
    if (inPlace) land(() => document.getElementById('code'));
  }

  async function carryOn(): Promise<void> {
    await refreshAccount();
    navigate('/app');
  }

  // Saving the details with no number removes the phone, so the gate rests on the email again.
  async function withoutPhone(name: string): Promise<void> {
    try {
      await api.completeProfile({ name });
      await carryOn();
    } catch {
      check.fail();
    }
  }

  async function textInstead(): Promise<void> {
    if (await check.textInstead()) arriveAtTexted();
  }

  const entering = ['entering', 'verifying', 'wrong', 'failed'].includes(status.kind);
  const dead = status.kind === 'expired' || status.kind === 'exhausted';
  const wrong = wording.fromWhatsApp ? t('verifyPhone.wrongWhatsApp') : t('verifyPhone.wrong');
  const blank = wording.fromWhatsApp
    ? t('verifyPhone.codeBlankWhatsApp')
    : t('verifyPhone.codeBlank');
  const fieldError =
    codeError === 'short'
      ? t('verifyPhone.codeShort')
      : codeError === 'blank'
        ? blank
        : status.kind === 'wrong'
          ? wrong
          : null;
  const line = {
    whatsapp: t('verifyPhone.introWhatsApp', { number }),
    fallback: t('verifyPhone.introFallback', { number }),
    chosen: t('verifyPhone.introChosen', { number }),
    texted: t('verifyPhone.intro', { number }),
  }[wording.line];

  return (
    <AuthPage
      bare
      end={
        alternative == null ? (
          <SignedInAs email={primaryEmailAddress(account) ?? ''} onSignOut={() => void signOut()} />
        ) : undefined
      }
    >
      {alternative != null && !verified && <BackToAccount />}

      {verified ? (
        <>
          <div className="auth-heading">
            {onboarding && <StepLine step={2} />}
            <div className="auth-done">
              <Tick size={26} />
              <h1 ref={doneHeading} tabIndex={-1}>
                {t('verifyPhone.doneTitle')}
              </h1>
            </div>
            <p>
              {alternative == null
                ? t('verifyPhone.doneBody', { number })
                : (check.primary ?? phone.primary)
                  ? t('contacts.verifiedPrimaryPhone', { number })
                  : t('verifyPhone.doneBodyAlternative', { number })}
            </p>
          </div>
          {alternative == null ? (
            <button className="button button-primary" type="button" onClick={() => void carryOn()}>
              {t('verifyPhone.continue')}
            </button>
          ) : (
            <BackToAccountButton verified={alternative} />
          )}
        </>
      ) : (
        <>
          <div className="auth-heading">
            {onboarding && <StepLine step={2} />}
            <h1>{t('verifyPhone.title')}</h1>
            {/* One live element whose text changes, so a fallback is announced without moving focus. */}
            <p
              aria-live={check.texted ? 'off' : 'polite'}
              ref={textedLine}
              tabIndex={check.texted ? -1 : undefined}
            >
              {line}
            </p>
            {dead && (
              <div className="auth-notice" role={answered ? undefined : 'alert'}>
                <p
                  className="auth-notice-title"
                  ref={bannerTitle}
                  tabIndex={answered ? -1 : undefined}
                  aria-describedby={answered ? 'dead-body' : undefined}
                >
                  {status.kind === 'expired'
                    ? t('verifyPhone.expiredTitle')
                    : t('verifyPhone.exhaustedTitle')}
                </p>
                <p id="dead-body">
                  {status.kind === 'expired'
                    ? t('verifyPhone.expiredBody')
                    : t('verifyPhone.exhaustedBody')}
                </p>
              </div>
            )}
            {status.kind === 'failed' && (
              <div
                className="auth-notice"
                role={answered ? undefined : 'alert'}
                ref={failedNotice}
                tabIndex={answered ? -1 : undefined}
              >
                <p className="auth-notice-title">{t('verifyPhone.failedTitle')}</p>
                <p>{t('verifyPhone.failedBody')}</p>
              </div>
            )}
          </div>

          {dead && (
            <button
              className="button button-primary"
              type="button"
              onClick={() => void resend(true)}
            >
              {t('verifyPhone.resend')}
            </button>
          )}

          {entering && (
            <>
              <form className="auth-form" noValidate onSubmit={(event) => void submit(event)}>
                <div className={fieldError == null ? 'field' : 'field field-wrong'}>
                  <label htmlFor="code">
                    {wording.fromWhatsApp
                      ? t('verifyPhone.codeLabelWhatsApp')
                      : t('verifyPhone.codeLabel')}
                  </label>
                  <input
                    className={
                      fieldError == null ? 'input code-field' : 'input code-field input-wrong'
                    }
                    id="code"
                    name="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-invalid={fieldError != null}
                    aria-describedby={fieldError == null ? undefined : 'code-error'}
                    onChange={(event) => {
                      event.target.value = codeDigits(event.target.value);
                      setCodeError(null);
                    }}
                  />
                  {fieldError != null && <FieldError id="code-error" message={fieldError} />}
                </div>

                <button
                  className="button button-primary"
                  type="submit"
                  aria-busy={status.kind === 'verifying'}
                >
                  {status.kind === 'verifying'
                    ? t('verifyPhone.submitting')
                    : t('verifyPhone.submit')}
                </button>
              </form>

              <ResendLine
                resending={resending}
                note={t('verifyPhone.resendNote')}
                onResend={() => void resend(false)}
              >
                {wording.offerText && (
                  <button className="link-button" type="button" onClick={() => void textInstead()}>
                    {t('verifyPhone.textInstead')}
                  </button>
                )}
                {check.textingFailed && (
                  <FieldError
                    id="text-instead-error"
                    message={t('verifyPhone.textInsteadFailed')}
                  />
                )}
              </ResendLine>
            </>
          )}

          {alternative == null ? (
            <div className="auth-asides">
              <p className="auth-aside">
                <span>{t('verifyPhone.wrongNumber')}</span>
                <Link className="link-button" to={onboarding ? '/phone?from=onboarding' : '/phone'}>
                  {t('verifyPhone.changeIt')}
                </Link>
              </p>
              {onboarding && (
                <p className="auth-aside">
                  <span>{t('verifyPhone.cantGetTexts')}</span>
                  <button
                    className="link-button"
                    type="button"
                    onClick={() => void withoutPhone(account.name)}
                  >
                    {t('verifyPhone.carryOnWithout')}
                  </button>
                </p>
              )}
            </div>
          ) : (
            <RemoveInAccount kind="phone" />
          )}

          {unreached && <StillSignedIn />}
        </>
      )}
    </AuthPage>
  );
}
