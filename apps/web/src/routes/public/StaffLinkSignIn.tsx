import {
  ApiError,
  type OpenStaffLink,
  type SignInOutcome,
  type TwoFactorChallenge,
} from '@soirely/api-client';
import { formatTimeOfDay, lockLiftsAt, maskedPhone } from '@soirely/domain';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { api } from '../../api.ts';
import { Brand } from '../../components/Brand.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { holdReturn } from '../../heldReturn.ts';
import { dateLocale } from '../../i18n/index.ts';
import { meshFor } from '../../mesh.ts';
import { adoptAccount, useSessionState } from '../../session.ts';
import { useSignOut } from '../../signOut.ts';
import { codePassed } from '../../providerSignIn.ts';
import { MyNightPage } from './MyNight.tsx';
import { PhoneCodeStep, Primary, SignOutLine, Title } from './RedeemPhone.tsx';
import { StaffTwoFactor } from './StaffTwoFactor.tsx';
import '../../components/desk.css';
import './redeem.css';
import './staffSignIn.css';

type Step =
  | { kind: 'confirm'; busy: boolean; told: boolean; signedOut: boolean; failed: boolean }
  | { kind: 'code'; handle: string }
  | { kind: 'twoFactor'; challenge: TwoFactorChallenge }
  | { kind: 'alternative' }
  | { kind: 'tooMany'; when: string | null; words: string };

type Confirm = Extract<Step, { kind: 'confirm' }>;

const CONFIRM: Confirm = {
  kind: 'confirm',
  busy: false,
  told: false,
  signedOut: false,
  failed: false,
};

/** An open link (sc-4235): Confirm it's you and a code to the roster's number, then the link signed in; as the web demo's staff sign-in draws it. */
export function StaffLinkSignIn({
  token,
  link,
  onGone,
  onSignedIn,
}: {
  token: string;
  link: OpenStaffLink;
  onGone: () => void;
  onSignedIn: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const session = useSessionState();
  const [step, setStep] = useState<Step>(CONFIRM);
  const [signedOut, setSignedOut] = useState(false);
  const reader = signedOut ? null : link.reader;
  const [focus, setFocus] = useState<{ to: 'title' | 'field'; n: number }>({ to: 'title', n: 0 });
  const title = useRef<HTMLHeadingElement>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (focus.to === 'title' ? title : field).current?.focus();
  }, [focus]);

  const go = (next: Step, to: 'title' | 'field' = 'title') => {
    setStep(next);
    setFocus((was) => ({ to, n: was.n + 1 }));
  };

  const { signOut } = useSignOut(() => {
    setSignedOut(true);
    go({ ...CONFIRM, signedOut: true });
  });

  async function signedIn(outcome: SignInOutcome): Promise<void> {
    if ('challenge' in outcome) {
      // An authenticator alone is asked here; a passkey is sign-in's, then back to this link signed in.
      if (outcome.factors.app && !outcome.factors.passkeys) {
        go({ kind: 'twoFactor', challenge: outcome }, 'field');
        return;
      }
      holdReturn(`/w/${token}`);
      void navigate('/sign-in/code', { replace: true, state: outcome });
      return;
    }
    await adoptAccount(outcome.account);
    await onSignedIn();
    setSignedOut(false);
    setFocus((was) => ({ to: 'title', n: was.n + 1 }));
  }

  async function send(): Promise<void> {
    setStep({ ...CONFIRM, busy: true });
    try {
      const { handle } = await api.sendStaffLinkSignIn(token);
      go({ kind: 'code', handle }, 'field');
    } catch (error) {
      refused(error);
    }
  }

  function refused(error: unknown): void {
    if (error instanceof ApiError && error.status === 404) onGone();
    else if (error instanceof ApiError && error.status === 429) go(tooMany(error));
    else setStep({ ...CONFIRM, failed: true });
  }

  const masked = link.mobile == null ? '' : maskedPhone(link.mobile);
  const name = session.status === 'signedIn' ? session.session.name : '';

  if (reader === 'yours')
    return (
      <MyNightPage
        token={token}
        name={name}
        onSignOut={() => void signOut()}
        onLost={() => void onSignedIn()}
      />
    );

  function body(): ReactNode {
    if (reader === 'other')
      return (
        <>
          <Title titleRef={title}>{t('staffLink.signIn.linkFor', { name: link.name ?? '' })}</Title>
          <LinkCard link={link} />
          <p className="rd-intro">{t('redeem.signedInAs', { name })}</p>
          <Primary onClick={() => void signOut()}>{t('staffLink.signIn.signOutContinue')}</Primary>
        </>
      );
    if (link.mobile == null)
      return (
        <>
          <Title titleRef={title}>{link.event}</Title>
          <LinkCard link={link} named={false} />
          <p className="ss-told">{t('staffLink.signIn.askToAdd')}</p>
        </>
      );

    switch (step.kind) {
      case 'confirm':
        return (
          <>
            {step.signedOut && (
              <p className="rd-signed-out" role="status">
                <SignOutLine size={26} />
                {t('redeem.signedOut')}
              </p>
            )}
            <Title titleRef={title}>{t('staffLink.signIn.confirm')}</Title>
            <LinkCard link={link} />
            {step.failed && (
              <p className="rd-alert" role="alert">
                <Glyph name="alert" size={17} weight={2.2} />
                {t('redeem.line.failed')}
              </p>
            )}
            <p className="rd-intro ss-send">{t('staffLink.signIn.sendTo', { number: masked })}</p>
            <Primary busy={step.busy} onClick={() => void send()}>
              {t('redeem.phone.sendCode')}
            </Primary>
            <button
              type="button"
              className="rd-quiet is-centre"
              aria-expanded={step.told}
              aria-controls="ss-not-yours"
              onClick={() => setStep({ ...step, told: !step.told })}
            >
              {t('staffLink.signIn.notYours')}
            </button>
            <p id="ss-not-yours" className="ss-told" role="status">
              {step.told ? t('staffLink.signIn.askToChange') : ''}
            </p>
          </>
        );
      case 'code':
        return (
          <PhoneCodeStep
            signIn={(typed) => api.staffLinkSignIn(token, step.handle, typed)}
            handle={step.handle}
            number={masked}
            titleRef={title}
            fieldRef={field}
            action={{ idle: t('staffLink.signIn.signIn'), busy: t('staffLink.signIn.signingIn') }}
            onLeave={(leave) => {
              if (leave.kind === 'alternative') go({ kind: 'alternative' });
              else if (leave.kind === 'refused') refused(leave.error);
              else void signedIn(leave.signedIn);
            }}
          />
        );
      case 'twoFactor':
        return (
          <StaffTwoFactor
            challenge={step.challenge}
            titleRef={title}
            fieldRef={field}
            onPassed={(passed) => signedIn(codePassed(passed))}
            onExpired={() => go(CONFIRM)}
            onRecovery={() => {
              holdReturn(`/w/${token}`);
              void navigate('/sign-in/code', {
                replace: true,
                state: { ...step.challenge, opensOn: 'recovery' },
              });
            }}
          />
        );
      case 'alternative':
        return (
          <>
            <Title titleRef={title}>{t('staffLink.signIn.confirm')}</Title>
            <LinkCard link={link} />
            <p className="ss-told">{t('staffLink.signIn.alternative')}</p>
          </>
        );
      case 'tooMany':
        return (
          <>
            <Title titleRef={title}>{t('redeem.tooMany')}</Title>
            <p className="rd-intro">
              {step.when == null ? step.words : t('staffLink.signIn.tryAt', { time: step.when })}
            </p>
          </>
        );
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
    </main>
  );
}

/** "Staff link", the event and the job: all a link shows before its code is accepted. */
function LinkCard({ link, named = true }: { link: OpenStaffLink; named?: boolean }) {
  const { t } = useTranslation();

  return (
    <div className="ss-card">
      <span className={`rd-tile today-cover is-${meshFor(link.event)}`} aria-hidden="true" />
      <div className="ss-card-lines">
        <p className="ss-card-label">{t('staffLink.signIn.staffLink')}</p>
        {named && <p className="ss-card-event">{link.event}</p>}
        {link.job != null && <p className="ss-card-job">{link.job}</p>}
      </div>
    </div>
  );
}

function tooMany(error: ApiError): Step {
  const lifts = lockLiftsAt(Number(error.response?.headers.get('Retry-After')));
  const words = error.problem.detail ?? error.problem.title;

  return {
    kind: 'tooMany',
    when: lifts == null ? null : formatTimeOfDay(lifts, dateLocale()),
    words,
  };
}
