import { type FormEvent, type ReactNode, useEffect, useEffectEvent, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { Brand } from '../components/Brand.tsx';
import { Toast } from '../components/Toast.tsx';
import { BUSY_MS, HOLD_MS } from './doorCode.ts';
import { CodeStep, Field, Primary, Says, SignOutLine, Title } from './Redeem.tsx';
import { Providers } from './BoardPage.tsx';
import { PROVIDER_ORG, providerOnlyLine, providerOnlyTitle } from './providerOnly.ts';
import { MESH, phoneCodeLine, rightPhoneCode } from './redeem.ts';
import { TRIES } from './rules.ts';
import {
  LINK_EVENT,
  LINK_JOB,
  type LinkState,
  type LinkStep,
  MASKED,
  OTHER_ACCOUNT,
  RETRY_AT,
  ROSTER_NAME,
  S,
  SHIFT_HREF,
  authenticatorLine,
  freshCode,
  freshTwoFactor,
  linkStart,
  linkStateOf,
  refusedStep,
  rightAuthenticator,
  twoFactorFor,
} from './staffSignIn.ts';
import './today.css';
import './redeem.css';
import './staffSignIn.css';

/** A personal staff link in a browser, not signed in (sc-4235): 390 first, one centred column wider, as the redeem page. */
export function StaffSignIn() {
  const [params] = useSearchParams();
  const state = linkStateOf(params.get('state'));

  return <LinkPage key={state} state={state} />;
}

type Want = 'title' | 'field' | 'select' | null;

/** Focus starts in the field being typed in, on the heading otherwise, and nowhere on "Signed out." (a status). */
function firstFocus(state: LinkState): Want {
  if (state === 'signed-out') return null;
  if (state === 'code-wrong' || state === 'two-factor-wrong') return 'select';
  if (state === 'code-expired' || state === 'code-exhausted') return 'title';
  if (state.startsWith('code') || state.startsWith('two-factor')) return 'field';

  return 'title';
}

function LinkPage({ state }: { state: LinkState }) {
  const navigate = useNavigate();
  const [start] = useState(() => linkStart(state));
  const [step, setStep] = useState<LinkStep>(start.step);
  const [told, setTold] = useState<string | null>(null);
  const [want, setWant] = useState<{ to: Want; n: number }>({ to: firstFocus(state), n: 0 });
  const title = useRef<HTMLHeadingElement>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const to = want.to === 'title' ? title.current : want.to == null ? null : field.current;
    to?.focus();
    if (want.to === 'select') field.current?.select();
  }, [want]);

  const go = (next: LinkStep, to: Want = 'title') => {
    setStep(next);
    setWant((was) => ({ to, n: was.n + 1 }));
  };

  const arrive = useEffectEvent(() => {
    if (step.kind === 'confirm') {
      go(freshCode(), 'field');
      return;
    }
    if (step.kind === 'code') {
      if (rightPhoneCode(step.digits)) {
        if (start.alternative === true) go({ kind: 'alternative' });
        else if (start.providers != null) go(refusedStep(start.providers));
        else if (start.twoFactor) go(freshTwoFactor(), 'field');
        else void navigate(SHIFT_HREF);
        return;
      }
      const wrongs = step.wrongs + 1;
      if (wrongs >= TRIES) {
        go({ ...step, digits: '', problem: 'exhausted', busy: 'no', wrongs, resend: 0 });
        return;
      }
      go({ ...step, problem: 'wrong', busy: 'no', wrongs }, 'select');
      return;
    }
    // Google or Apple signs them in, and the link opens signed in: its shift, with no code asked (sc-94849).
    if (step.kind === 'providerOnly') {
      void navigate(SHIFT_HREF);
      return;
    }
    if (step.kind === 'twoFactor') {
      if (rightAuthenticator(step.digits)) void navigate(SHIFT_HREF);
      else go({ ...step, wrong: true, busy: 'no' }, 'select');
    }
  });

  const busy = 'busy' in step ? step.busy : 'no';
  useEffect(() => {
    if (busy === 'no') return;
    const timer = setTimeout(arrive, busy === 'held' ? HOLD_MS : BUSY_MS);

    return () => clearTimeout(timer);
  }, [busy]);

  const resend = step.kind === 'code' ? step.resend : 0;
  useEffect(() => {
    if (resend <= 0) return;
    const timer = setTimeout(
      () => setStep((was) => (was.kind === 'code' ? { ...was, resend: was.resend - 1 } : was)),
      1000,
    );

    return () => clearTimeout(timer);
  }, [resend]);

  function body(): ReactNode {
    switch (step.kind) {
      case 'confirm':
        return (
          <>
            {step.signedOut && (
              <p className="rd-signed-out" role="status">
                <SignOutLine size={26} />
                {S.signedOut}
              </p>
            )}
            <Title titleRef={title}>{S.confirm}</Title>
            <LinkCard />
            <p className="rd-intro ss-send">{S.sendTo(MASKED)}</p>
            <Primary busy={step.busy !== 'no'} onClick={() => setStep({ ...step, busy: 'busy' })}>
              {S.sendCode}
            </Primary>
            <button
              type="button"
              className="rd-quiet is-centre"
              aria-expanded={step.told}
              aria-controls="ss-not-yours"
              onClick={() => setStep({ ...step, told: !step.told })}
            >
              {S.notYours}
            </button>
            <p id="ss-not-yours" className="ss-told" role="status">
              {step.told ? S.askToChange : ''}
            </p>
          </>
        );
      case 'noMobile':
        return (
          <>
            <Title titleRef={title}>{LINK_EVENT}</Title>
            <LinkCard named={false} />
            <p className="ss-told">{S.askToAdd}</p>
          </>
        );
      case 'tooMany':
        return (
          <>
            <Title titleRef={title}>{S.tooMany}</Title>
            <p className="rd-intro">{S.tryAt(RETRY_AT)}</p>
          </>
        );
      case 'wrongAccount':
        return (
          <>
            <Title titleRef={title}>{S.linkFor(ROSTER_NAME)}</Title>
            <LinkCard />
            <p className="rd-intro">{S.signedInAs(OTHER_ACCOUNT)}</p>
            <Primary
              onClick={() => go({ kind: 'confirm', busy: 'no', told: false, signedOut: true })}
            >
              {S.signOutContinue}
            </Primary>
          </>
        );
      case 'alternative':
        return (
          <>
            <Title titleRef={title}>{S.confirm}</Title>
            <LinkCard />
            <p className="ss-told">{S.alternative}</p>
          </>
        );
      case 'providerOnly':
        return (
          <>
            <Title titleRef={title}>{providerOnlyTitle(PROVIDER_ORG)}</Title>
            <LinkCard />
            <p className="ss-told">{providerOnlyLine(PROVIDER_ORG, step.providers)}</p>
            <Providers
              only={step.providers}
              apple="black"
              className="rd-providers"
              buttonClassName="rd-provider"
              busy={step.busy !== 'no'}
              onChoose={() => setStep({ ...step, busy: 'busy' })}
            />
          </>
        );
      case 'code':
        return (
          <CodeStep
            step={step}
            number={MASKED}
            titleRef={title}
            fieldRef={field}
            action={{ idle: S.signIn, busy: S.signingIn }}
            onDigits={(digits) =>
              setStep({
                ...step,
                digits,
                line: null,
                problem: step.problem === 'wrong' ? null : step.problem,
              })
            }
            onVerify={() => {
              const line = phoneCodeLine(step.digits);
              if (line != null) {
                setStep({ ...step, line, problem: null });
                field.current?.focus();
                return;
              }
              setStep({ ...step, line: null, busy: 'busy' });
            }}
            onText={() => go({ ...freshCode(), via: 'text' }, 'field')}
            onSendNew={() => go({ ...freshCode(), via: step.via }, 'field')}
          />
        );
      case 'twoFactor': {
        const said = step.line ?? (step.wrong ? S.tfWrong : null);
        const submit = (event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          if (step.busy !== 'no') return;
          const line = authenticatorLine(step.digits);
          if (line != null) {
            setStep({ ...step, line, wrong: false });
            field.current?.focus();
            return;
          }
          setStep({ ...step, busy: 'busy' });
        };

        return (
          <div className="rd-form">
            <Title titleRef={title}>{S.tfTitle}</Title>
            <p className="rd-intro">{S.tfIntro(twoFactorFor(state))}</p>
            <form className="rd-form" noValidate onSubmit={submit}>
              <div className="rd-group">
                <Field
                  id="ss-authenticator"
                  label={S.tfCode}
                  value={step.digits}
                  wrong={said != null}
                  told={said == null ? undefined : 'ss-authenticator-line'}
                  inputRef={field}
                  code
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(typed) =>
                    setStep({
                      ...step,
                      digits: typed.replace(/\D/gu, '').slice(0, 6),
                      line: null,
                      wrong: false,
                    })
                  }
                />
                {said != null && (
                  <Says id="ss-authenticator-line" alert={step.wrong}>
                    {said}
                  </Says>
                )}
              </div>
              <Primary submit busy={step.busy !== 'no'}>
                {step.busy === 'no' ? S.tfVerify : S.tfVerifying}
              </Primary>
            </form>
            <button type="button" className="rd-quiet" onClick={() => setTold(S.recoveryLater)}>
              {S.tfRecovery}
            </button>
          </div>
        );
      }
    }
  }

  return (
    <main id="content" className="rd ss">
      <div className="rd-column" data-step={step.kind}>
        <div className="rd-brand">
          <Brand />
        </div>
        {body()}
      </div>
      {told != null && <Toast key={told} words={told} onClose={() => setTold(null)} />}
    </main>
  );
}

/** "Staff link", the event and the job: all a link shows before its code is accepted. */
function LinkCard({ named = true }: { named?: boolean }) {
  return (
    <div className="ss-card">
      <span className={`rd-tile today-cover is-${MESH}`} aria-hidden="true" />
      <div className="ss-card-lines">
        <p className="ss-card-label">{S.staffLink}</p>
        {named && <p className="ss-card-event">{LINK_EVENT}</p>}
        <p className="ss-card-job">{LINK_JOB}</p>
      </div>
    </div>
  );
}
