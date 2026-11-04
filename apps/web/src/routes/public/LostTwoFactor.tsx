import {
  ApiError,
  type RecoveryOpening,
  type RecoveryState,
  type TwoFactorChallenge,
} from '@soirely/api-client';
import {
  cleanCode,
  codeProblem,
  codeWording,
  formatPhone,
  recoveryFirstStep,
  recoveryIntroKey,
} from '@soirely/domain';
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';

import { api } from '../../api.ts';
import { AuthPage } from '../../components/AuthPage.tsx';
import { FieldError } from '../../components/FieldError.tsx';
import { ColumnBack, ResendLine, Tick } from '../../components/Onboarding.tsx';
import { offButton } from '../../offButton.ts';
import { focusWhereSent, offField } from '../../offField.ts';
import { useOneAtATime } from '../../oneAtATime.ts';
import { useResendCountdown } from '../../resendCountdown.ts';
import { Pending } from '../../components/Pending.tsx';
import { dropRecovery, heldRecovery, holdRecovery } from '../../heldRecovery.ts';
import { currentLocale } from '../../i18n/index.ts';

/** A request whose codes are out, kept while Start shows again so those codes still work. */
type Asked = { recovery: string; state: RecoveryState };

type View =
  | { kind: 'loading' }
  | {
      kind: 'start';
      opening: RecoveryOpening;
      limitedUntil: string | null;
      sending: boolean;
      asked?: Asked;
    }
  | { kind: 'nobody'; supportAddress: string }
  | ({ kind: 'request'; opening?: RecoveryOpening } & Asked)
  | { kind: 'replaced' }
  | { kind: 'signIn' }
  | { kind: 'timedOut' }
  | { kind: 'failed' };

/** Lost both the authenticator and the recovery codes (sc-509): nothing on this page signs anybody in. */
export function LostTwoFactor() {
  const navigate = useNavigate();
  const signingIn = useLocation().state as TwoFactorChallenge | null;
  const challenge = signingIn?.challenge ?? null;
  const [view, setView] = useState<View>({ kind: 'loading' });
  const starting = useOneAtATime();

  const load = useCallback(async (): Promise<View> => {
    const held = heldRecovery();

    if (recoveryFirstStep(challenge, held) === 'held' && held != null) {
      try {
        return { kind: 'request', recovery: held, state: await api.recoveryState(held) };
      } catch (refusal) {
        if (replacedElsewhere(refusal)) return { kind: 'replaced' };
        if (!(refusal instanceof ApiError && refusal.is('recovery_request_invalid')))
          return { kind: 'failed' };

        dropRecovery();
      }
    }

    if (challenge == null) return { kind: 'signIn' };
    if (held != null) dropRecovery();

    try {
      const opening = await api.recoveryOpening(challenge);

      if (opening.open != null) {
        holdRecovery(opening.open.recovery);
        return { kind: 'request', opening, ...opening.open };
      }

      return opening.nobody
        ? { kind: 'nobody', supportAddress: opening.supportAddress }
        : { kind: 'start', opening, limitedUntil: null, sending: false };
    } catch (refusal) {
      return refusal instanceof ApiError && refusal.is('two_factor_challenge_invalid')
        ? { kind: 'timedOut' }
        : { kind: 'failed' };
    }
  }, [challenge]);

  useEffect(() => {
    let live = true;

    void load().then((next) => {
      if (live) setView(next);
    });

    return () => {
      live = false;
    };
  }, [load]);

  const reload = (): void => {
    void load().then(setView);
  };

  /** "Start again" from a replaced request: the start screen, never the newer request another device holds. */
  async function startAgain(): Promise<void> {
    if (challenge == null) {
      setView({ kind: 'signIn' });
      return;
    }

    try {
      const opening = await api.recoveryOpening(challenge);
      setView({ kind: 'start', opening, limitedUntil: null, sending: false });
    } catch (refusal) {
      setView(
        refusal instanceof ApiError && refusal.is('two_factor_challenge_invalid')
          ? { kind: 'timedOut' }
          : { kind: 'failed' },
      );
    }
  }

  const start = (opening: RecoveryOpening, asked?: Asked): Promise<void> =>
    starting(() => startOnce(opening, asked));

  async function startOnce(opening: RecoveryOpening, asked?: Asked): Promise<void> {
    if (asked != null) {
      setView({ kind: 'request', opening, ...asked });
      return;
    }

    if (challenge == null) {
      setView({ kind: 'signIn' });
      return;
    }

    setView({ kind: 'start', opening, limitedUntil: null, sending: true });

    try {
      const started = await api.startRecovery(challenge);
      holdRecovery(started.recovery);
      setView({ kind: 'request', opening, ...started });
    } catch (refusal) {
      if (refusal instanceof ApiError && refusal.is('too_many_attempts')) {
        setView({
          kind: 'start',
          opening,
          limitedUntil: refusal instanceof ApiError ? (refusal.problem.retryAt ?? '') : '',
          sending: false,
        });
      } else if (refusal instanceof ApiError && refusal.is('recovery_nobody_to_approve')) {
        setView({ kind: 'nobody', supportAddress: opening.supportAddress });
      } else if (refusal instanceof ApiError && refusal.is('two_factor_challenge_invalid')) {
        setView({ kind: 'timedOut' });
      } else {
        setView({ kind: 'failed' });
      }
    }
  }

  if (view.kind === 'signIn') return <Navigate to="/sign-in" replace />;
  if (view.kind === 'timedOut')
    return (
      <Navigate to="/sign-in" replace state={{ email: signingIn?.email, codeTimedOut: true }} />
    );
  if (view.kind === 'loading') return <Pending />;

  return (
    <AuthPage bare end={null}>
      {view.kind === 'start' && (
        <Start
          opening={view.opening}
          limitedUntil={view.limitedUntil}
          sending={view.sending}
          onSend={() => void start(view.opening, view.asked)}
          onBack={() => void navigate('/sign-in/code', { state: signingIn })}
        />
      )}
      {view.kind === 'nobody' && <Nobody supportAddress={view.supportAddress} />}
      {view.kind === 'replaced' && <Replaced onStartAgain={() => void startAgain()} />}
      {view.kind === 'request' && (
        <Request
          recovery={view.recovery}
          state={view.state}
          onState={(state) => setView({ ...view, state })}
          onBack={
            view.opening == null
              ? undefined
              : () =>
                  setView({
                    kind: 'start',
                    opening: view.opening!,
                    limitedUntil: null,
                    sending: false,
                    asked: { recovery: view.recovery, state: view.state },
                  })
          }
          onNobody={() => {
            dropRecovery();
            setView({ kind: 'nobody', supportAddress: view.state.supportAddress });
          }}
          onAskAgain={() => {
            dropRecovery();
            reload();
          }}
          onReplaced={() => {
            dropRecovery();
            setView({ kind: 'replaced' });
          }}
        />
      )}
      {view.kind === 'failed' && <Failed onRetry={reload} />}
    </AuthPage>
  );
}

function Heading({
  title,
  intro,
  done = false,
  children,
}: {
  title: string;
  intro: string;
  done?: boolean;
  /** A notice, under the title's lines. */
  children?: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => heading.current?.focus(), [title]);

  const h1 = (
    <h1 ref={heading} tabIndex={-1}>
      {title}
    </h1>
  );

  return (
    <div className="auth-heading">
      {done ? (
        <div className="auth-done">
          <Tick size={26} />
          {h1}
        </div>
      ) : (
        h1
      )}
      <p>{intro}</p>
      {children}
    </div>
  );
}

function Notice({ title, body, alert = false }: { title: string; body: string; alert?: boolean }) {
  return (
    <div className="auth-notice" role={alert ? 'alert' : 'status'}>
      <p className="auth-notice-title">{title}</p>
      <p>{body}</p>
    </div>
  );
}

/** A newer request was started on another device (pm #1267): its codes went there, so this one starts again. */
function Replaced({ onStartAgain }: { onStartAgain: () => void }) {
  const { t } = useTranslation();

  return (
    <>
      <Heading title={t('lostTwoFactor.replacedTitle')} intro={t('lostTwoFactor.replacedIntro')} />
      <p className="field-help">{t('lostTwoFactor.replacedNote')}</p>
      <button className="button button-primary" type="button" onClick={onStartAgain}>
        {t('lostTwoFactor.startAgain')}
      </button>
      <BackToSignIn />
    </>
  );
}

function replacedElsewhere(refusal: unknown): boolean {
  return refusal instanceof ApiError && refusal.is('recovery_request_replaced');
}

function BackToSignIn() {
  const { t } = useTranslation();

  return (
    <Link className="link-button" to="/sign-in" onClick={() => dropRecovery()}>
      {t('lostTwoFactor.back')}
    </Link>
  );
}

function Start({
  opening,
  limitedUntil,
  sending,
  onSend,
  onBack,
}: {
  opening: RecoveryOpening;
  limitedUntil: string | null;
  sending: boolean;
  onSend: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const organisations = listed(opening.organisations, 'disjunction');

  return (
    <>
      <ColumnBack onClick={onBack} />
      <Heading title={t('lostTwoFactor.startTitle')} intro={t('lostTwoFactor.startIntro')}>
        {limitedUntil != null && (
          <Notice
            title={t('lostTwoFactor.limitedTitle')}
            body={
              limitedUntil === ''
                ? t('lostTwoFactor.limitedBodyLater')
                : t('lostTwoFactor.limitedBody', { when: limitedUntil })
            }
            alert
          />
        )}
      </Heading>

      <ol className="steps-list">
        <li>
          <span className="step-mark" aria-hidden="true">
            1
          </span>
          <span>
            {opening.phone == null
              ? t('lostTwoFactor.step1EmailOnly', { email: opening.email })
              : t('lostTwoFactor.step1', {
                  email: opening.email,
                  phone: formatPhone(opening.phone),
                })}
          </span>
        </li>
        <li>
          <span className="step-mark" aria-hidden="true">
            2
          </span>
          <span>{t('lostTwoFactor.step2')}</span>
        </li>
        <li>
          <span className="step-mark" aria-hidden="true">
            3
          </span>
          <span>{t('lostTwoFactor.step3', { organisations })}</span>
        </li>
      </ol>
      <p className="field-help">{t('lostTwoFactor.startNote')}</p>

      <button
        className="button button-primary"
        type="button"
        aria-busy={sending}
        {...offButton(limitedUntil != null)}
        onClick={onSend}
      >
        {sending ? t('lostTwoFactor.sending') : t('lostTwoFactor.send')}
      </button>
      <BackToSignIn />
    </>
  );
}

function Nobody({ supportAddress }: { supportAddress: string }) {
  const { t } = useTranslation();

  return (
    <>
      <Heading title={t('lostTwoFactor.nobodyTitle')} intro={t('lostTwoFactor.nobodyIntro')} />
      <a className="button button-primary" href={`mailto:${supportAddress}`}>
        {t('lostTwoFactor.emailSupport', { address: supportAddress })}
      </a>
      <BackToSignIn />
    </>
  );
}

function Failed({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <>
      <Notice title={t('lostTwoFactor.failedTitle')} body={t('lostTwoFactor.failedBody')} alert />
      <button className="button" type="button" onClick={onRetry}>
        {t('lostTwoFactor.retry')}
      </button>
      <BackToSignIn />
    </>
  );
}

function Request({
  recovery,
  state,
  onState,
  onNobody,
  onAskAgain,
  onReplaced,
  onBack,
}: {
  recovery: string;
  state: RecoveryState;
  onState: (state: RecoveryState) => void;
  onNobody: () => void;
  onAskAgain: () => void;
  onReplaced: () => void;
  onBack: (() => void) | undefined;
}) {
  const supportAddress = state.supportAddress;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const organisations = listed(state.organisations, 'conjunction');
  const anyOf = listed(state.organisations, 'disjunction');
  const waiting = state.status === 'waiting';

  // Waiting, the answer arrives on its own; the page follows it within half a minute.
  useEffect(() => {
    if (!waiting) return;

    const watching = setInterval(() => {
      api
        .recoveryState(recovery)
        .then(onState)
        .catch((refusal: unknown) => {
          if (replacedElsewhere(refusal)) onReplaced();
        });
    }, 20_000);

    return () => clearInterval(watching);
  }, [waiting, recovery, onState, onReplaced]);

  if (state.status === 'proving') {
    return (
      <Codes
        recovery={recovery}
        state={state}
        onState={onState}
        onNobody={onNobody}
        onReplaced={onReplaced}
        onBack={onBack}
      />
    );
  }

  if (waiting) {
    return (
      <>
        <Heading
          title={t('lostTwoFactor.waitingTitle')}
          intro={t(recoveryIntroKey('waiting', state.nobody), { organisations })}
        />
        <div className="auth-lines">
          <p>{t('lostTwoFactor.asked', { when: state.asked })}</p>
          <p className="muted">{t('lostTwoFactor.endsBy', { when: state.expires })}</p>
        </div>
        <p className="muted">{t('lostTwoFactor.stayOut', { email: state.email })}</p>
        {state.nobody && supportAddress !== '' && (
          <a className="button" href={`mailto:${supportAddress}`}>
            {t('lostTwoFactor.emailSupport', { address: supportAddress })}
          </a>
        )}
        <p className="auth-aside">
          <span>{t('lostTwoFactor.notYou')}</span>
          <button
            className="link-button"
            type="button"
            onClick={() => {
              api
                .cancelRecovery(recovery)
                .then(onState)
                .catch((refusal: unknown) => {
                  if (replacedElsewhere(refusal)) onReplaced();
                });
            }}
          >
            {t('lostTwoFactor.cancel')}
          </button>
        </p>
        <BackToSignIn />
      </>
    );
  }

  if (state.status === 'approved') {
    return (
      <>
        <Heading
          title={t('lostTwoFactor.approvedTitle')}
          intro={t(recoveryIntroKey('approved', state.nobody), { organisations: anyOf })}
          done
        />
        <button
          className="button button-primary"
          type="button"
          onClick={() => {
            dropRecovery();
            navigate('/sign-in', { replace: true });
          }}
        >
          {t('lostTwoFactor.signIn')}
        </button>
      </>
    );
  }

  if (state.status === 'turned_down') {
    return (
      <>
        <Heading
          title={t('lostTwoFactor.turnedDownTitle')}
          intro={t(recoveryIntroKey('turned_down', state.nobody), { organisations: anyOf })}
        />
        {supportAddress !== '' && (
          <a className="button" href={`mailto:${supportAddress}`}>
            {t('lostTwoFactor.emailSupport', { address: supportAddress })}
          </a>
        )}
        <BackToSignIn />
      </>
    );
  }

  if (state.status === 'expired') {
    return (
      <>
        <Heading
          title={t('lostTwoFactor.endedTitle')}
          intro={t(recoveryIntroKey('expired', state.nobody))}
        />
        {state.nobody && supportAddress !== '' && (
          <a className="button" href={`mailto:${supportAddress}`}>
            {t('lostTwoFactor.emailSupport', { address: supportAddress })}
          </a>
        )}
        {!state.nobody && (
          <button className="button button-primary" type="button" onClick={onAskAgain}>
            {t('lostTwoFactor.askAgain')}
          </button>
        )}
        <BackToSignIn />
      </>
    );
  }

  return (
    <>
      <Heading
        title={t('lostTwoFactor.cancelledTitle')}
        intro={t('lostTwoFactor.cancelledIntro')}
      />
      <BackToSignIn />
    </>
  );
}

type Field = 'emailCode' | 'phoneCode';

function Codes({
  recovery,
  state,
  onState,
  onNobody,
  onReplaced,
  onBack,
}: {
  recovery: string;
  state: RecoveryState;
  onState: (state: RecoveryState) => void;
  onNobody: () => void;
  onReplaced: () => void;
  onBack: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  const codes = state.codes;
  const wording = codeWording(codes?.route ?? null);
  const hasPhone = state.phone != null;
  const number = state.phone == null ? '' : formatPhone(state.phone);
  const [typed, setTyped] = useState<Record<Field, string>>({ emailCode: '', phoneCode: '' });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [textingFailed, setTextingFailed] = useState(false);
  const resending = useResendCountdown(
    { resend: 'lostTwoFactor.resend', resendIn: 'lostTwoFactor.resendIn' },
    codes?.cooldownSeconds ?? 0,
  );

  // While the phone's code is on WhatsApp, the server may hand it to SMS: the line follows.
  useEffect(() => {
    if (!wording.watch) return;

    const watching = setInterval(() => {
      api
        .recoveryState(recovery)
        .then(onState)
        .catch((refusal: unknown) => {
          if (replacedElsewhere(refusal)) onReplaced();
        });
    }, 5000);

    return () => clearInterval(watching);
  }, [wording.watch, recovery, onState, onReplaced]);

  const blank: Record<Field, string> = {
    emailCode: t('lostTwoFactor.emailBlank'),
    phoneCode: wording.fromWhatsApp
      ? t('lostTwoFactor.phoneBlankWhatsApp')
      : t('lostTwoFactor.phoneBlank'),
  };
  const wrong: Record<Field, string> = {
    emailCode: t('lostTwoFactor.emailWrong'),
    phoneCode: wording.fromWhatsApp
      ? t('lostTwoFactor.phoneWrongWhatsApp')
      : t('lostTwoFactor.phoneWrong'),
  };
  const fields: Field[] = hasPhone ? ['emailCode', 'phoneCode'] : ['emailCode'];
  const sent = {
    whatsapp: t('lostTwoFactor.sentWhatsApp', { number }),
    fallback: t('lostTwoFactor.sentFallback', { number }),
    chosen: t('lostTwoFactor.sentChosen', { number }),
    texted: t('lostTwoFactor.sentText', { number }),
  }[wording.line];

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (asking) return;

    const found: Partial<Record<Field, string>> = {};

    for (const field of fields) {
      const problem = codeProblem(typed[field]);
      if (problem != null)
        found[field] = problem === 'short' ? t('lostTwoFactor.codeShort') : blank[field];
    }

    setErrors(found);
    const first = fields.find((field) => found[field] != null);

    if (first != null) {
      document.getElementById(first)?.focus();
      return;
    }

    setAsking(true);
    setFailed(false);
    const land = focusWhereSent();

    try {
      onState(
        await api.proveRecovery(
          recovery,
          cleanCode(typed.emailCode),
          hasPhone ? cleanCode(typed.phoneCode) : null,
        ),
      );
    } catch (refusal) {
      setAsking(false);

      if (replacedElsewhere(refusal)) {
        onReplaced();
        return;
      }

      // The last approver left while the codes were out: the request is cancelled, nobody is told.
      if (refusal instanceof ApiError && refusal.is('recovery_nobody_to_approve')) {
        onNobody();
        return;
      }

      if (refusal instanceof ApiError && refusal.is('verification_code_invalid')) {
        const marked: Partial<Record<Field, string>> = {};

        for (const violation of refusal.problem.violations ?? []) {
          const field = violation.propertyPath as Field;
          if (fields.includes(field)) marked[field] = wrong[field];
        }

        setErrors(marked);
        const wrongFirst = fields.find((field) => marked[field] != null);
        if (wrongFirst != null) land(wrongFirst);
        return;
      }

      if (
        refusal instanceof ApiError &&
        (refusal.is('verification_code_expired') ||
          refusal.is('verification_code_exhausted') ||
          refusal.is('recovery_request_proved'))
      ) {
        onState(await api.recoveryState(recovery).catch(() => state));
        return;
      }

      setFailed(true);
    }
  }

  const resend = (): Promise<void> => resending.once(sendOnce);

  async function sendOnce(): Promise<void> {
    try {
      const next = await api.resendRecoveryCodes(recovery);
      setTyped({ emailCode: '', phoneCode: '' });
      setErrors({});
      resending.countDown(next.codes?.cooldownSeconds ?? 0);
      onState(next);
    } catch (refusal) {
      if (replacedElsewhere(refusal)) {
        onReplaced();
        return;
      }

      // Proved from another device meanwhile: the request is waiting, so its screen opens.
      if (refusal instanceof ApiError && refusal.is('recovery_request_proved')) {
        onState(await api.recoveryState(recovery).catch(() => state));
        return;
      }

      const seconds =
        refusal instanceof ApiError ? Number(refusal.response?.headers.get('Retry-After')) : NaN;

      if (Number.isFinite(seconds) && seconds > 0) resending.countDown(seconds);
      else setFailed(true);
    }
  }

  async function textInstead(): Promise<void> {
    setTextingFailed(false);

    try {
      onState(await api.textRecoveryCodeInstead(recovery));
    } catch (refusal) {
      if (replacedElsewhere(refusal)) {
        onReplaced();
        return;
      }

      if (refusal instanceof ApiError && refusal.is('recovery_request_proved')) {
        onState(await api.recoveryState(recovery).catch(() => state));
        return;
      }

      setTextingFailed(true);
    }
  }

  const spent = codes?.state === 'expired' || codes?.state === 'exhausted';

  return (
    <>
      {onBack != null && <ColumnBack onClick={onBack} />}
      <Heading
        title={hasPhone ? t('lostTwoFactor.codesTitle') : t('lostTwoFactor.codesTitleEmailOnly')}
        intro={
          hasPhone
            ? t('lostTwoFactor.codesIntro', { email: state.email, phone: number })
            : t('lostTwoFactor.codesIntroEmailOnly', { email: state.email })
        }
      >
        {spent && (
          <Notice
            title={
              codes?.state === 'expired'
                ? t('lostTwoFactor.expiredTitle')
                : t('lostTwoFactor.exhaustedTitle')
            }
            body={
              codes?.state === 'exhausted'
                ? t('lostTwoFactor.exhaustedBody')
                : hasPhone
                  ? t('lostTwoFactor.expiredBody', {
                      message: wording.fromWhatsApp
                        ? t('lostTwoFactor.lastWhatsApp')
                        : t('lostTwoFactor.lastText'),
                    })
                  : t('lostTwoFactor.expiredBodyEmailOnly')
            }
          />
        )}
        {failed && (
          <Notice
            title={t('lostTwoFactor.failedTitle')}
            body={t('lostTwoFactor.failedBody')}
            alert
          />
        )}
      </Heading>

      {spent ? (
        <button className="button button-primary" type="button" onClick={() => void resend()}>
          {t('lostTwoFactor.resend')}
        </button>
      ) : (
        <>
          <form className="auth-form" noValidate onSubmit={(event) => void submit(event)}>
            <div className="auth-fields">
              {fields.map((field) => (
                <div className={errors[field] == null ? 'field' : 'field field-wrong'} key={field}>
                  <label htmlFor={field}>
                    {field === 'emailCode'
                      ? t('lostTwoFactor.emailLabel')
                      : wording.fromWhatsApp
                        ? t('lostTwoFactor.phoneLabelWhatsApp')
                        : t('lostTwoFactor.phoneLabel')}
                  </label>
                  <input
                    className={
                      errors[field] == null ? 'input code-field' : 'input code-field input-wrong'
                    }
                    id={field}
                    name={field}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={7}
                    value={typed[field]}
                    {...offField(asking)}
                    aria-invalid={errors[field] != null}
                    aria-describedby={[
                      errors[field] == null ? null : `${field}-error`,
                      `${field}-sent`,
                    ]
                      .filter((id) => id != null)
                      .join(' ')}
                    onChange={(event) => {
                      setTyped((now) => ({ ...now, [field]: event.target.value }));
                      setErrors((now) => ({ ...now, [field]: undefined }));
                    }}
                  />
                  {errors[field] != null && (
                    <FieldError id={`${field}-error`} message={errors[field]} />
                  )}
                  {field === 'emailCode' ? (
                    <span className="field-help" id={`${field}-sent`}>
                      {t('lostTwoFactor.sentTo', { email: state.email })}
                    </span>
                  ) : (
                    // One live element whose text changes, so a fallback is announced without moving focus.
                    <span className="field-help" id={`${field}-sent`} aria-live="polite">
                      {sent}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <button className="button button-primary" type="submit" aria-busy={asking}>
              {asking ? t('lostTwoFactor.asking') : t('lostTwoFactor.ask')}
            </button>
          </form>

          <ResendLine
            resending={resending}
            lead={hasPhone ? t('lostTwoFactor.noCodes') : t('onboarding.noCode')}
            note={t('lostTwoFactor.resendNote')}
            onResend={() => void resend()}
          >
            {hasPhone && wording.offerText && (
              <button className="link-button" type="button" onClick={() => void textInstead()}>
                {t('lostTwoFactor.textInstead')}
              </button>
            )}
            {textingFailed && (
              <FieldError id="text-instead-error" message={t('lostTwoFactor.textInsteadFailed')} />
            )}
          </ResendLine>
        </>
      )}

      {onBack == null && <BackToSignIn />}
    </>
  );
}

function listed(names: string[], type: 'conjunction' | 'disjunction'): string {
  return new Intl.ListFormat(currentLocale(), { type }).format(names);
}
