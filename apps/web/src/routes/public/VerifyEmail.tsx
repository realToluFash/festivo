import { type Account, ApiError, type PendingRegistration, awaiting } from '@soirely/api-client';
import { cleanCode, codeDigits, codeProblem } from '@soirely/domain';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';

import { api } from '../../api.ts';
import { type CodeSource, apiCodeSource, useCodeCheck } from '../../codeCheck.ts';
import { selectCode } from '../../codeScreen.ts';
import { AuthPage } from '../../components/AuthPage.tsx';
import {
  BackToAccount,
  BackToAccountButton,
  RemoveInAccount,
} from '../../components/BackToAccount.tsx';
import {
  ColumnBack,
  ResendLine,
  SignedInAs,
  StepLine,
  Tick,
} from '../../components/Onboarding.tsx';
import { Pending, PendingPage } from '../../components/Pending.tsx';
import { StillSignedIn } from '../../components/StillSignedIn.tsx';
import { Unreachable } from '../../components/Unreachable.tsx';
import { dropRegistration, heldRegistration } from '../../pendingRegistration.ts';
import { heldInvitation } from '../../heldInvitation.ts';
import {
  adoptAccount,
  landingFor,
  refreshAccount,
  restoreSession,
  useSessionState,
} from '../../session.ts';
import { useFocusOnceShown, useStepFocus } from '../../stepFocus.ts';
import { FieldError } from '../../components/FieldError.tsx';
import { offButton } from '../../offButton.ts';
import { focusWhereSent } from '../../offField.ts';
import { useFormChecks } from '../../formChecks.ts';
import { useSignOut } from '../../signOut.ts';
import type { Carried } from './Register.tsx';

/** "Check your email": for a sign-up, by its registration handle; for an older unverified account, by its session. */
export function VerifyEmail() {
  const [pending] = useState(heldRegistration);
  const alternative = useSearchParams()[0].get('address');

  if (alternative != null) return <ForAlternative id={alternative} />;

  return pending == null ? <ForSession /> : <ForRegistration pending={pending} />;
}

/** An address added from Settings > Account (sc-113), by its id: back to Account, never a sign-out. */
function ForAlternative({ id }: { id: string }) {
  const navigate = useNavigate();
  const [held, setHeld] = useState<{ address: string; verified: boolean } | 'gone' | null>(null);

  useEffect(() => {
    let live = true;

    api
      .me()
      .then((me) => {
        if (live) setHeld(me.emailAddresses.find((one) => one.id === id) ?? 'gone');
      })
      .catch(() => {
        if (live) setHeld('gone');
      });

    return () => {
      live = false;
    };
  }, [id]);

  if (held === 'gone') return <Navigate to="/app/account" replace />;
  if (held == null) return <Pending />;

  return (
    <CodeScreen
      address={held.address}
      alreadyVerified={held.verified}
      source={apiCodeSource('email', id)}
      onExpired={() => navigate('/app/account', { replace: true })}
      fromAccount={id}
    />
  );
}

function ForRegistration({ pending }: { pending: PendingRegistration }) {
  const navigate = useNavigate();
  const session = useSessionState();
  const [account, setAccount] = useState<Account | null>(null);
  const carried = useLocation().state as Carried | null;

  function timedOut(): void {
    dropRegistration();
    navigate('/register', {
      replace: true,
      state: { name: carried?.name, email: pending.email, timedOut: true } satisfies Carried,
    });
  }

  return (
    <CodeScreen
      address={pending.email}
      alreadyVerified={false}
      source={{
        opening: () =>
          api
            .registrationOpening(pending.registration)
            .then((opening) => ({ ...opening, route: null })),
        verify: async (code) => {
          const signedIn = await api.confirmRegistration(pending.registration, code);
          dropRegistration();
          await adoptAccount(signedIn.account);
          setAccount(signedIn.account);

          return { primary: true };
        },
        resend: () => api.resendRegistrationCode(pending.registration),
        textInstead: () => Promise.resolve(),
      }}
      onExpired={timedOut}
      onGone={() => {
        // A session that ended under the held sign-up says so once the sign-up is gone too (sc-927).
        if (session.status === 'signedOut' && session.ended) {
          dropRegistration();
          navigate('/sign-in?signed-out', { replace: true });
          return;
        }

        timedOut();
      }}
      carryOn={() => {
        if (account == null) return;
        // Registered from a link (sc-562): back to it, now that the address is proved.
        const link = heldInvitation();
        navigate(link == null ? landingFor(awaiting(account)) : `/join/${link}`, { replace: true });
      }}
      back={() => {
        dropRegistration();
        navigate('/register', { state: { name: carried?.name, email: pending.email } });
      }}
      signOut={() => {
        // A sign-up has no session yet: signing out lets go of the held one.
        dropRegistration();
        navigate('/sign-in');
      }}
    />
  );
}

function ForSession() {
  const navigate = useNavigate();
  const state = useSessionState();
  const { signOut, unreached } = useSignOut(() => navigate('/sign-in'));

  useEffect(() => {
    void restoreSession();
  }, []);

  if (state.status === 'signedOut') return <Navigate to="/sign-in" replace />;
  if (state.status === 'unreachable') return <Unreachable signedIn={false} bare />;
  if (state.status !== 'signedIn') return <PendingPage />;

  return (
    <CodeScreen
      address={state.session.email}
      alreadyVerified={state.session.verified}
      source={apiCodeSource('email')}
      onExpired={() => navigate('/sign-in', { replace: true })}
      carryOn={async () => {
        // The account is read again, so the next gate, or the product, opens rather than this screen.
        await refreshAccount();
        navigate('/app');
      }}
      signOut={() => void signOut()}
      stillSignedIn={unreached}
    />
  );
}

function CodeScreen({
  address,
  alreadyVerified,
  source,
  onExpired,
  onGone,
  carryOn,
  back,
  signOut,
  stillSignedIn = false,
  fromAccount,
}: {
  address: string;
  alreadyVerified: boolean;
  source: CodeSource;
  onExpired: () => void;
  /** The sign-up had already run out when the screen opened. */
  onGone?: () => void;
  carryOn?: () => void | Promise<void>;
  /** A sign-up's way back to Register, with what was typed there. */
  back?: () => void;
  /** The header's Sign out; an address added in Account has none. */
  signOut?: () => void;
  stillSignedIn?: boolean;
  /** The id of an address added in Account: Account's way back replaces the steps and the way on. */
  fromAccount?: string;
}) {
  const { t } = useTranslation();
  // Fixed for the screen's life, as the sign-up or the address it checks is.
  const [held] = useState(source);
  const check = useCodeCheck('email', held, {
    opens: !alreadyVerified,
    leaves: (error, when) => {
      if (!(error instanceof ApiError && error.is('registration_expired'))) return false;
      if (when === 'opening') onGone?.();
      else onExpired();

      return true;
    },
  });
  const { status, resending } = check;
  const [doneHeading, arriveAtDone] = useStepFocus();
  const [answerNotice, arriveAtAnswer] = useStepFocus<HTMLDivElement>();
  const [answered, setAnswered] = useState(false);
  const land = useFocusOnceShown();
  const checks = useFormChecks(
    ['code'] as const,
    (_field, value) => {
      const problem = codeProblem(value);

      if (problem == null) return null;

      return problem === 'blank' ? t('verifyEmail.codeBlank') : t('verifyEmail.codeShort');
    },
    () => document.getElementById('code')?.focus(),
  );

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const typed = String(new FormData(event.currentTarget).get('code') ?? '');

    // Neither an empty code nor a short one is sent, so neither costs an attempt.
    if (!checks.passes({ code: typed })) return;

    const code = cleanCode(typed);

    setAnswered(false);
    const landWhereSent = focusWhereSent();
    const checked = await check.verify(code);

    if (checked == null) return;
    if (checked.verified) return arriveAtDone();

    const { refusal } = checked;
    if (refusal.kind === 'expired' || refusal.kind === 'exhausted') answer();
    if (refusal.kind === 'wrong') {
      landWhereSent('code');
      selectCode();
    }
  }

  function answer(): void {
    setAnswered(true);
    arriveAtAnswer();
  }

  async function resend(inPlace: boolean): Promise<void> {
    const resent = await check.resend();

    if (resent == null) return;
    if (resent === 'failed') {
      check.fail();
      setAnswered(inPlace);
      if (inPlace) arriveAtAnswer();
      return;
    }

    setAnswered(false);
    if (inPlace) land(() => document.getElementById('code'));
  }

  const verified = status.kind === 'verified' || alreadyVerified;
  const entering = ['entering', 'verifying', 'wrong', 'failed'].includes(status.kind);

  const codeError = checks.errors.code ?? (status.kind === 'wrong' ? t('verifyEmail.wrong') : null);

  const onboarding = fromAccount == null;
  const dead = status.kind === 'expired' || status.kind === 'exhausted';

  return (
    <AuthPage
      bare
      end={signOut == null ? undefined : <SignedInAs email={address} onSignOut={signOut} />}
    >
      {!onboarding && !verified && <BackToAccount />}
      {onboarding && !verified && back != null && <ColumnBack onClick={back} />}

      {verified ? (
        <>
          <div className="auth-heading">
            {onboarding && <StepLine step={1} />}
            <div className="auth-done">
              <Tick size={26} />
              <h1 ref={doneHeading} tabIndex={-1}>
                {t('verifyEmail.doneTitle')}
              </h1>
            </div>
            <p>
              {onboarding
                ? t('verifyEmail.doneBody', { address })
                : t('verifyEmail.doneBodyAlternative', { address })}
            </p>
          </div>
          {onboarding ? (
            <button
              className="button button-primary"
              type="button"
              onClick={() => void carryOn?.()}
            >
              {t('verifyEmail.continue')}
            </button>
          ) : (
            <BackToAccountButton verified={fromAccount} />
          )}
        </>
      ) : (
        <>
          <div className="auth-heading">
            {onboarding && <StepLine step={1} />}
            <h1>{t('verifyEmail.title')}</h1>
            <p>{t('verifyEmail.intro', { address })}</p>
            {(dead || status.kind === 'failed') && (
              <div
                className="auth-notice"
                role={answered ? undefined : 'alert'}
                ref={answerNotice}
                tabIndex={answered ? -1 : undefined}
              >
                <p className="auth-notice-title">
                  {status.kind === 'expired'
                    ? t('verifyEmail.expiredTitle')
                    : status.kind === 'exhausted'
                      ? t('verifyEmail.exhaustedTitle')
                      : t('verifyEmail.failedTitle')}
                </p>
                <p>
                  {status.kind === 'expired'
                    ? t('verifyEmail.expiredBody')
                    : status.kind === 'exhausted'
                      ? t('verifyEmail.exhaustedBody')
                      : t('verifyEmail.failedBody')}
                </p>
              </div>
            )}
          </div>

          {dead && (
            <button
              className="button button-primary"
              type="button"
              onClick={() => void resend(true)}
            >
              {t('verifyEmail.resend')}
            </button>
          )}

          {entering && (
            <>
              <form className="auth-form" noValidate onSubmit={(event) => void submit(event)}>
                <div className={codeError == null ? 'field' : 'field field-wrong'}>
                  <label htmlFor="code">{t('verifyEmail.codeLabel')}</label>
                  <input
                    className={
                      codeError == null ? 'input code-field' : 'input code-field input-wrong'
                    }
                    id="code"
                    name="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    aria-invalid={codeError != null}
                    aria-describedby={codeError == null ? undefined : 'code-error'}
                    onBlur={(event) => checks.left('code', event.target.value)}
                    onChange={(event) => {
                      event.target.value = codeDigits(event.target.value);
                      checks.edited('code', event.target.value);
                    }}
                  />
                  {codeError != null && <FieldError id="code-error" message={codeError} />}
                </div>

                <button
                  className="button button-primary"
                  type="submit"
                  {...offButton(status.kind === 'verifying')}
                >
                  {status.kind === 'verifying'
                    ? t('verifyEmail.submitting')
                    : t('verifyEmail.submit')}
                </button>
              </form>

              <ResendLine
                resending={resending}
                note={t('verifyEmail.resendNote')}
                onResend={() => void resend(false)}
              />
            </>
          )}

          {back != null && (
            <p className="auth-aside">
              <span>{t('verifyEmail.wrongAddress')}</span>
              <button className="link-button" type="button" onClick={back}>
                {t('verifyEmail.registerAgain')}
              </button>
            </p>
          )}

          {!onboarding && <RemoveInAccount kind="email" />}

          {stillSignedIn && <StillSignedIn />}
        </>
      )}
    </AuthPage>
  );
}
