import {
  type Account,
  ApiError,
  type CodeOpening,
  type PendingRegistration,
  awaiting,
} from '@soirely/api-client';
import { cleanCode, codeProblem } from '@soirely/domain';
import { type FormEvent, type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useSearchParams } from 'react-router';

import { api } from '../../api.ts';
import { type CodeStatus, codeRefusal, openingStatus } from '../../codeScreen.ts';
import { AuthPage } from '../../components/AuthPage.tsx';
import {
  BackToAccount,
  BackToAccountButton,
  RemoveInAccount,
} from '../../components/BackToAccount.tsx';
import { Pending } from '../../components/Pending.tsx';
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
import { useResendCountdown } from '../../resendCountdown.ts';
import { useFormChecks } from '../../formChecks.ts';
import { useSignOut } from '../../signOut.ts';

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
      opening={() => api.verificationOpening(id)}
      verify={async (code) => {
        await api.verifyEmail(code, id);
      }}
      resend={() => api.resendVerification(id)}
      onExpired={() => navigate('/app/account', { replace: true })}
      fromAccount={id}
    />
  );
}

function ForRegistration({ pending }: { pending: PendingRegistration }) {
  const navigate = useNavigate();
  const session = useSessionState();
  const [account, setAccount] = useState<Account | null>(null);

  return (
    <CodeScreen
      address={pending.email}
      alreadyVerified={false}
      opening={() => api.registrationOpening(pending.registration)}
      verify={async (code) => {
        const signedIn = await api.confirmRegistration(pending.registration, code);
        dropRegistration();
        await adoptAccount(signedIn.account);
        setAccount(signedIn.account);
      }}
      resend={() => api.resendRegistrationCode(pending.registration)}
      onExpired={() => {
        dropRegistration();
        navigate('/register', { replace: true });
      }}
      onGone={() => {
        dropRegistration();
        // A session that ended under the held sign-up says so once the sign-up is gone too (sc-927).
        const ended = session.status === 'signedOut' && session.ended;
        navigate(ended ? '/sign-in?signed-out' : '/sign-in', { replace: true });
      }}
      carryOn={() => {
        if (account == null) return;
        // Registered from a link (sc-562): back to it, now that the address is proved.
        const link = heldInvitation();
        navigate(link == null ? landingFor(awaiting(account)) : `/join/${link}`, { replace: true });
      }}
      wrongAddress={() => {
        dropRegistration();
        navigate('/register');
      }}
      registersAgain
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
  if (state.status === 'unreachable') return <Unreachable signedIn />;
  if (state.status !== 'signedIn') return <Pending />;

  return (
    <CodeScreen
      address={state.session.email}
      alreadyVerified={state.session.verified}
      opening={() => api.verificationOpening()}
      verify={async (code) => {
        await api.verifyEmail(code);
      }}
      resend={() => api.resendVerification()}
      onExpired={() => navigate('/sign-in', { replace: true })}
      carryOn={async () => {
        // The account is read again, so the next gate, or the product, opens rather than this screen.
        await refreshAccount();
        navigate('/app');
      }}
      wrongAddress={signOut}
      stillSignedIn={unreached}
    />
  );
}

function CodeScreen({
  address,
  alreadyVerified,
  opening: readOpening,
  verify,
  resend: sendAgain,
  onExpired,
  onGone,
  carryOn,
  wrongAddress,
  registersAgain = false,
  stillSignedIn = false,
  fromAccount,
}: {
  address: string;
  alreadyVerified: boolean;
  opening: () => Promise<CodeOpening>;
  verify: (code: string) => Promise<void>;
  resend: () => Promise<number>;
  onExpired: () => void;
  /** The sign-up had already run out when the screen opened: nothing to resume, so signed out. */
  onGone?: () => void;
  carryOn?: () => void | Promise<void>;
  wrongAddress?: () => void | Promise<void>;
  /** A sign-up has no session to sign out of: it starts again at Register. */
  registersAgain?: boolean;
  stillSignedIn?: boolean;
  /** The id of an address added in Account: Account's way back replaces the steps and the way on. */
  fromAccount?: string;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<CodeStatus>({ kind: 'entering' });
  const resending = useResendCountdown({
    resend: 'verifyEmail.resend',
    resendIn: 'verifyEmail.resendIn',
  });
  const { begin } = resending;
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

  // Read once, when the screen opens: the source is fixed for the screen's life.
  const firstOpening = useRef(readOpening);
  const gone = useRef(onGone);

  useEffect(() => {
    if (alreadyVerified) return;

    let live = true;

    // A failed read leaves the button enabled; a press then learns the time from the 429.
    firstOpening
      .current()
      .then(({ cooldownSeconds, codeState }) => {
        if (!live) return;
        begin(cooldownSeconds);
        setStatus((now) => openingStatus(now, codeState));
      })
      .catch((error: unknown) => {
        if (live && error instanceof ApiError && error.is('registration_expired')) gone.current?.();
      });

    return () => {
      live = false;
    };
  }, [alreadyVerified, begin]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const typed = String(new FormData(event.currentTarget).get('code') ?? '');

    // Neither an empty code nor a short one is sent, so neither costs an attempt.
    if (!checks.passes({ code: typed })) return;

    const code = cleanCode(typed);

    setStatus({ kind: 'verifying' });
    setAnswered(false);
    const landWhereSent = focusWhereSent();

    try {
      await verify(code);
      setStatus({ kind: 'verified' });
      arriveAtDone();
    } catch (error) {
      if (error instanceof ApiError && error.is('registration_expired')) {
        onExpired();
        return;
      }

      const refusal = codeRefusal(error);
      setStatus(refusal);
      if (refusal.kind === 'expired' || refusal.kind === 'exhausted') answer();
      if (refusal.kind === 'wrong') landWhereSent('code');
    }
  }

  function answer(): void {
    setAnswered(true);
    arriveAtAnswer();
  }

  const resend = (): Promise<void> => resending.once(() => sendOnce(false));
  const resendInPlace = (): Promise<void> => resending.once(() => sendOnce(true));

  async function sendOnce(inPlace: boolean): Promise<void> {
    try {
      resending.countDown(await sendAgain());
      setStatus({ kind: 'entering' });
      setAnswered(false);
      if (inPlace) land(() => document.getElementById('code'));
    } catch (error) {
      const seconds =
        error instanceof ApiError ? Number(error.response?.headers.get('Retry-After')) : NaN;

      if (error instanceof ApiError && error.is('registration_expired')) {
        onExpired();
        return;
      }

      if (Number.isFinite(seconds) && seconds > 0) {
        resending.countDown(seconds);
        setStatus({ kind: 'entering' });
        setAnswered(false);
        if (inPlace) land(() => document.getElementById('code'));

        return;
      }

      setStatus({ kind: 'failed' });
      setAnswered(inPlace);
      if (inPlace) arriveAtAnswer();
    }
  }

  const verified = status.kind === 'verified' || alreadyVerified;
  const entering = ['entering', 'verifying', 'wrong', 'failed'].includes(status.kind);

  const codeError = checks.errors.code ?? (status.kind === 'wrong' ? t('verifyEmail.wrong') : null);

  return (
    <AuthPage>
      {fromAccount == null ? (
        <ol className="steps" aria-label={t('verifyEmail.stepsLabel')}>
          <li className={verified ? 'step step-done' : 'step step-now'}>
            <span className="step-mark" aria-hidden="true">
              {verified ? '✓' : '1'}
            </span>
            {verified ? t('verifyEmail.step1Done') : t('verifyEmail.step1')}
          </li>
          <li className="step step-later">
            <span className="step-mark" aria-hidden="true">
              2
            </span>
            {t('verifyEmail.step2')}
          </li>
        </ol>
      ) : (
        !verified && <BackToAccount />
      )}

      {verified ? (
        <>
          <span className="verified-mark" aria-hidden="true">
            ✓
          </span>
          <div>
            <h1 ref={doneHeading} tabIndex={-1}>
              {t('verifyEmail.doneTitle')}
            </h1>
            <p className="muted">
              {fromAccount == null
                ? t('verifyEmail.doneBody', { address })
                : t('verifyEmail.doneBodyAlternative', { address })}
            </p>
          </div>
          {fromAccount == null ? (
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
          <div>
            <h1>{t('verifyEmail.title')}</h1>
            <p className="muted">{t('verifyEmail.intro', { address })}</p>
          </div>

          {status.kind === 'expired' && (
            <Banner
              title={t('verifyEmail.expiredTitle')}
              body={t('verifyEmail.expiredBody')}
              action={t('verifyEmail.resend')}
              answered={answered}
              bodyRef={answerNotice}
              onAction={() => void resendInPlace()}
            />
          )}

          {status.kind === 'exhausted' && (
            <Banner
              title={t('verifyEmail.exhaustedTitle')}
              body={t('verifyEmail.exhaustedBody')}
              action={t('verifyEmail.resend')}
              answered={answered}
              bodyRef={answerNotice}
              onAction={() => void resendInPlace()}
            />
          )}

          {status.kind === 'failed' && (
            <div className="notice notice-broken" role={answered ? undefined : 'alert'}>
              <span className="mark mark-broken" aria-hidden="true">
                ✕
              </span>
              <div className="notice-body" ref={answerNotice} tabIndex={answered ? -1 : undefined}>
                <p className="notice-title">{t('verifyEmail.failedTitle')}</p>
                <p>{t('verifyEmail.failedBody')}</p>
              </div>
            </div>
          )}

          {entering && (
            <form className="auth-form" noValidate onSubmit={(event) => void submit(event)}>
              <div className="field">
                <label htmlFor="code">{t('verifyEmail.codeLabel')}</label>
                <input
                  className={codeError == null ? 'code-input' : 'code-input input-wrong'}
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
                  onChange={(event) => checks.edited('code', event.target.value)}
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

              <div className="resend">
                <button
                  className="button"
                  type="button"
                  {...resending.button}
                  onClick={() => void resend()}
                >
                  {resending.label}
                </button>
                <p>{t('verifyEmail.resendNote')}</p>
                <span className="visually-hidden" role="status">
                  {resending.status}
                </span>
              </div>
            </form>
          )}

          {fromAccount != null && <RemoveInAccount kind="email" />}

          {stillSignedIn && <StillSignedIn />}

          {wrongAddress != null && (
            <div className="auth-footnote">
              <span>{t('verifyEmail.wrongAddress')}</span>
              <button className="link-button" type="button" onClick={() => void wrongAddress()}>
                {registersAgain ? t('verifyEmail.registerAgain') : t('verifyEmail.signOut')}
              </button>
              {!registersAgain && <span>{t('verifyEmail.wrongAddressBody')}</span>}
            </div>
          )}
        </>
      )}
    </AuthPage>
  );
}

function Banner({
  title,
  body,
  action,
  answered,
  bodyRef,
  onAction,
}: {
  title: string;
  body: string;
  action: string;
  answered: boolean;
  bodyRef: RefObject<HTMLDivElement | null>;
  onAction: () => void;
}) {
  return (
    <>
      <div className="notice notice-attention" role={answered ? undefined : 'alert'}>
        <span className="mark mark-attention" aria-hidden="true">
          !
        </span>
        <div className="notice-body" ref={bodyRef} tabIndex={answered ? -1 : undefined}>
          <p className="notice-title">{title}</p>
          <p>{body}</p>
        </div>
      </div>
      <button className="button button-primary" type="button" onClick={onAction}>
        {action}
      </button>
    </>
  );
}
