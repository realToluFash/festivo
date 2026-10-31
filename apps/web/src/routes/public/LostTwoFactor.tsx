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
  RECOVERY_LOOK,
  type RecoveryOutcome,
  recoveryFirstStep,
  recoveryIntroKey,
} from '@soirely/domain';
import { type FormEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';

import { api } from '../../api.ts';
import { AuthPage } from '../../components/AuthPage.tsx';
import { FieldError } from '../../components/FieldError.tsx';
import { offButton } from '../../offButton.ts';
import { focusWhereSent, offField } from '../../offField.ts';
import { useOneAtATime } from '../../oneAtATime.ts';
import { useResendCountdown } from '../../resendCountdown.ts';
import { Pending } from '../../components/Pending.tsx';
import { StatusChip } from '../../components/StatusChip.tsx';
import { dropRecovery, heldRecovery, holdRecovery } from '../../heldRecovery.ts';
import { currentLocale } from '../../i18n/index.ts';

type View =
  | { kind: 'loading' }
  | { kind: 'start'; opening: RecoveryOpening; limitedUntil: string | null; sending: boolean }
  | { kind: 'nobody'; supportAddress: string }
  | { kind: 'request'; recovery: string; state: RecoveryState }
  | { kind: 'replaced' }
  | { kind: 'signIn' }
  | { kind: 'failed' };

/** Lost both the authenticator and the recovery codes (sc-509): nothing on this page signs anybody in. */
export function LostTwoFactor() {
  const challenge = (useLocation().state as TwoFactorChallenge | null)?.challenge ?? null;
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
        return { kind: 'request', ...opening.open };
      }

      return opening.nobody
        ? { kind: 'nobody', supportAddress: opening.supportAddress }
        : { kind: 'start', opening, limitedUntil: null, sending: false };
    } catch (refusal) {
      return refusal instanceof ApiError && refusal.is('two_factor_challenge_invalid')
        ? { kind: 'signIn' }
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
          ? { kind: 'signIn' }
          : { kind: 'failed' },
      );
    }
  }

  const start = (opening: RecoveryOpening): Promise<void> => starting(() => startOnce(opening));

  async function startOnce(opening: RecoveryOpening): Promise<void> {
    if (challenge == null) {
      setView({ kind: 'signIn' });
      return;
    }

    setView({ kind: 'start', opening, limitedUntil: null, sending: true });

    try {
      const started = await api.startRecovery(challenge);
      holdRecovery(started.recovery);
      setView({ kind: 'request', ...started });
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
        setView({ kind: 'signIn' });
      } else {
        setView({ kind: 'failed' });
      }
    }
  }

  if (view.kind === 'signIn') return <Navigate to="/sign-in" replace />;
  if (view.kind === 'loading') return <Pending />;

  return (
    <AuthPage>
      {view.kind === 'start' && (
        <Start
          opening={view.opening}
          limitedUntil={view.limitedUntil}
          sending={view.sending}
          onSend={() => void start(view.opening)}
        />
      )}
      {view.kind === 'nobody' && <Nobody supportAddress={view.supportAddress} />}
      {view.kind === 'replaced' && <Replaced onStartAgain={() => void startAgain()} />}
      {view.kind === 'request' && (
        <Request
          recovery={view.recovery}
          state={view.state}
          onState={(state) => setView({ ...view, state })}
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

function Heading({ title, intro, mark }: { title: string; intro: string; mark?: Mark }) {
  const heading = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => heading.current?.focus(), [title]);

  return (
    <div className="auth-heading">
      {mark != null && (
        <p className="request-state">
          <StatusChip look={RECOVERY_LOOK[mark.outcome]}>{mark.word}</StatusChip>
        </p>
      )}
      <h1 ref={heading} tabIndex={-1}>
        {title}
      </h1>
      <p>{intro}</p>
    </div>
  );
}

interface Mark {
  outcome: RecoveryOutcome;
  word: string;
}

/** A newer request was started on another device (pm #1267): its codes went there, so this one starts again. */
function Replaced({ onStartAgain }: { onStartAgain: () => void }) {
  const { t } = useTranslation();

  return (
    <>
      <Heading
        title={t('lostTwoFactor.replacedTitle')}
        intro={t('lostTwoFactor.replacedIntro')}
        mark={{ outcome: 'ended', word: t('lostTwoFactor.replacedMark') }}
      />
      <p className="muted">{t('lostTwoFactor.replacedNote')}</p>
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
}: {
  opening: RecoveryOpening;
  limitedUntil: string | null;
  sending: boolean;
  onSend: () => void;
}) {
  const { t } = useTranslation();
  const organisations = listed(opening.organisations, 'disjunction');

  return (
    <>
      <Heading title={t('lostTwoFactor.startTitle')} intro={t('lostTwoFactor.startIntro')} />

      {limitedUntil != null && (
        <div className="notice notice-attention" role="status">
          <span className="mark mark-attention" aria-hidden="true">
            !
          </span>
          <div className="notice-body">
            <p className="notice-title">{t('lostTwoFactor.limitedTitle')}</p>
            <p>
              {limitedUntil === ''
                ? t('lostTwoFactor.limitedBodyLater')
                : t('lostTwoFactor.limitedBody', { when: limitedUntil })}
            </p>
          </div>
        </div>
      )}

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
      <p>{t('lostTwoFactor.startNote')}</p>

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
      <div className="notice notice-broken" role="alert">
        <span className="mark mark-broken" aria-hidden="true">
          ✕
        </span>
        <div className="notice-body">
          <p className="notice-title">{t('lostTwoFactor.failedTitle')}</p>
          <p>{t('lostTwoFactor.failedBody')}</p>
        </div>
      </div>
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
}: {
  recovery: string;
  state: RecoveryState;
  onState: (state: RecoveryState) => void;
  onNobody: () => void;
  onAskAgain: () => void;
  onReplaced: () => void;
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
      />
    );
  }

  if (waiting) {
    return (
      <>
        <Heading
          title={t('lostTwoFactor.waitingTitle')}
          intro={t(recoveryIntroKey('waiting', state.nobody), { organisations })}
          mark={{ outcome: 'waiting', word: t('lostTwoFactor.waitingMark') }}
        />
        <div className="notice notice-quiet">
          <div className="notice-body">
            <p>{t('lostTwoFactor.asked', { when: state.asked })}</p>
            <p>{t('lostTwoFactor.endsBy', { when: state.expires })}</p>
          </div>
        </div>
        <p>{t('lostTwoFactor.stayOut', { email: state.email })}</p>
        {state.nobody && supportAddress !== '' && (
          <a className="button" href={`mailto:${supportAddress}`}>
            {t('lostTwoFactor.emailSupport', { address: supportAddress })}
          </a>
        )}
        <div className="auth-footnote">
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
        </div>
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
          mark={{ outcome: 'approved', word: t('lostTwoFactor.approvedMark') }}
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
          mark={{ outcome: 'turned_down', word: t('lostTwoFactor.turnedDownMark') }}
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
          mark={{ outcome: 'ended', word: t('lostTwoFactor.endedMark') }}
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
        mark={{ outcome: 'ended', word: t('lostTwoFactor.cancelledMark') }}
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
}: {
  recovery: string;
  state: RecoveryState;
  onState: (state: RecoveryState) => void;
  onNobody: () => void;
  onReplaced: () => void;
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
      <Heading
        title={hasPhone ? t('lostTwoFactor.codesTitle') : t('lostTwoFactor.codesTitleEmailOnly')}
        intro={
          hasPhone
            ? t('lostTwoFactor.codesIntro', { email: state.email, phone: number })
            : t('lostTwoFactor.codesIntroEmailOnly', { email: state.email })
        }
      />

      {spent && (
        <div className="notice notice-attention" role="status">
          <span className="mark mark-attention" aria-hidden="true">
            !
          </span>
          <div className="notice-body">
            <p className="notice-title">
              {codes?.state === 'expired'
                ? t('lostTwoFactor.expiredTitle')
                : t('lostTwoFactor.exhaustedTitle')}
            </p>
            <p>
              {codes?.state === 'exhausted'
                ? t('lostTwoFactor.exhaustedBody')
                : hasPhone
                  ? t('lostTwoFactor.expiredBody', {
                      message: wording.fromWhatsApp
                        ? t('lostTwoFactor.lastWhatsApp')
                        : t('lostTwoFactor.lastText'),
                    })
                  : t('lostTwoFactor.expiredBodyEmailOnly')}
            </p>
          </div>
        </div>
      )}

      {failed && (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <div className="notice-body">
            <p className="notice-title">{t('lostTwoFactor.failedTitle')}</p>
            <p>{t('lostTwoFactor.failedBody')}</p>
          </div>
        </div>
      )}

      {spent ? (
        <button className="button button-primary" type="button" onClick={() => void resend()}>
          {t('lostTwoFactor.resend')}
        </button>
      ) : (
        <form className="auth-form" noValidate onSubmit={(event) => void submit(event)}>
          {fields.map((field) => (
            <div className="field" key={field}>
              <label htmlFor={field}>
                {field === 'emailCode'
                  ? t('lostTwoFactor.emailLabel')
                  : wording.fromWhatsApp
                    ? t('lostTwoFactor.phoneLabelWhatsApp')
                    : t('lostTwoFactor.phoneLabel')}
              </label>
              {field === 'emailCode' ? (
                <span className="field-help">
                  {t('lostTwoFactor.sentTo', { email: state.email })}
                </span>
              ) : (
                // One live element whose text changes, so a fallback is announced without moving focus.
                <span className="field-help" aria-live="polite">
                  {sent}
                </span>
              )}
              <input
                className={errors[field] == null ? 'code-input' : 'code-input input-wrong'}
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
                aria-describedby={errors[field] == null ? undefined : `${field}-error`}
                onChange={(event) => {
                  setTyped((now) => ({ ...now, [field]: event.target.value }));
                  setErrors((now) => ({ ...now, [field]: undefined }));
                }}
              />
              {errors[field] != null && (
                <FieldError id={`${field}-error`} message={errors[field]} />
              )}
            </div>
          ))}

          <button className="button button-primary" type="submit" aria-busy={asking}>
            {asking ? t('lostTwoFactor.asking') : t('lostTwoFactor.ask')}
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
            <p>{t('lostTwoFactor.resendNote')}</p>
            <span className="visually-hidden" role="status">
              {resending.status}
            </span>
          </div>

          {hasPhone && wording.offerText && (
            <button className="button" type="button" onClick={() => void textInstead()}>
              {t('lostTwoFactor.textInstead')}
            </button>
          )}
          {textingFailed && (
            <FieldError id="text-instead-error" message={t('lostTwoFactor.textInsteadFailed')} />
          )}
        </form>
      )}

      <BackToSignIn />
    </>
  );
}

function listed(names: string[], type: 'conjunction' | 'disjunction'): string {
  return new Intl.ListFormat(currentLocale(), { type }).format(names);
}
