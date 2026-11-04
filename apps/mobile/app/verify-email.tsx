import {
  ApiError,
  type CodeOpening,
  type PendingRegistration,
  awaiting,
} from '@soirely/api-client';
import { cleanCode, codeProblem } from '@soirely/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { TextInputInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { nextAfterRegistration } from '../src/challenge.ts';
import { AuthFrame, AuthHeading } from '../src/components/AuthFrame.tsx';
import {
  BackToAccount,
  BackToAccountButton,
  RemoveInAccount,
} from '../src/components/BackToAccount.tsx';
import { CodeForm } from '../src/components/CodeForm.tsx';
import { focusChecked, keysStayDown } from '../src/components/Field.tsx';
import { type CodeStatus, codeRefusal, openingStatus, retryAfter } from '../src/kit/code.ts';
import { useFormChecks } from '../src/kit/formChecks.ts';
import { type Landing } from '../src/landing.ts';
import { dropRegistration, heldRegistration } from '../src/pendingRegistration.ts';
import { rereadAccount } from '../src/signedIn.ts';
import { CodeStep, type CodeStepStatus, NEXT_STEP_MS } from '../src/steps/CodeStep.tsx';
import { NavBar, StepScreen } from '../src/steps/StepScreen.tsx';
import { useCountdown } from '../src/steps/useCountdown.ts';

/** "Check your email": a new account's step, or an address added from Settings > Account (sc-113), by its id. */
export default function VerifyEmail() {
  const alternative = useLocalSearchParams<{ address?: string }>().address;

  return alternative == null ? <SignUpCode /> : <AddedAddress alternative={alternative} />;
}

/** The second of four steps: by the sign-up's registration handle, or, for an older unverified account, by its session. */
function SignUpCode() {
  const { t } = useTranslation();
  // Undefined while it is read; null for an account that is signed in, with no handle.
  const [pending, setPending] = useState<PendingRegistration | null | undefined>(undefined);
  const [status, setStatus] = useState<CodeStepStatus>({ kind: 'entering' });
  const { left: cooldown, restart: setCooldown } = useCountdown(0);
  const [address, setAddress] = useState('');

  useEffect(() => {
    let live = true;

    function opened({ cooldownSeconds, codeState }: CodeOpening): void {
      setCooldown(cooldownSeconds);
      setStatus((now) => (now.kind === 'verified' ? now : openingStatus(now, codeState)));
    }

    void (async () => {
      const held = await heldRegistration();

      if (held != null) {
        if (!live) return;
        setPending(held);
        setAddress(held.email);
        const opening = await api.registrationOpening(held.registration).catch(() => null);
        if (live && opening != null) opened(opening);

        return;
      }

      try {
        const account = await api.me();
        if (!live) return;

        setPending(null);
        setAddress(account.emailAddresses.find((one) => one.primary)?.address ?? '');

        // The email is proved even while a phone is still waiting for its code.
        if (awaiting(account) !== 'email') {
          router.replace('/');
          return;
        }

        // Started by whichever send came last, the registration email included.
        const opening = await api.verificationOpening();
        if (live) opened(opening);
      } catch {
        if (live) router.replace('/sign-in');
      }
    })();

    return () => {
      live = false;
    };
  }, [setCooldown]);

  /** Back to Create your account, the address there to fix: "Not your address?" folded into Back. */
  async function fixAddress(): Promise<void> {
    await dropRegistration();
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/register', params: { email: address } });
  }

  async function signOut(): Promise<void> {
    await api.signOut();
    router.replace('/sign-in');
  }

  async function verify(code: string): Promise<void> {
    keysStayDown();
    setStatus({ kind: 'verifying' });

    try {
      let next: Landing | `/join/${string}` = '/';
      if (pending == null) {
        await api.verifyEmail(code);
      } else {
        const { account } = await api.confirmRegistration(pending.registration, code);
        await dropRegistration();
        next = await nextAfterRegistration(account);
      }
      setStatus({ kind: 'verified' });
      setTimeout(() => router.replace(next), NEXT_STEP_MS);
    } catch (error) {
      if (error instanceof ApiError && error.is('registration_expired')) {
        await fixAddress();
        return;
      }

      setStatus(codeRefusal(error));
    }
  }

  async function resend(): Promise<void> {
    try {
      setCooldown(
        await (pending == null
          ? api.resendVerification()
          : api.resendRegistrationCode(pending.registration)),
      );
      setStatus({ kind: 'entering' });
    } catch (error) {
      if (error instanceof ApiError && error.is('registration_expired')) {
        await fixAddress();
        return;
      }

      const seconds = retryAfter(error);
      if (seconds == null) {
        setStatus({ kind: 'failed' });
        return;
      }

      setCooldown(seconds);
      setStatus({ kind: 'entering' });
    }
  }

  if (pending === undefined) return null;

  const done = status.kind === 'verified';

  return (
    <StepScreen
      nav={
        <NavBar
          left={
            pending == null ? { label: t('steps.signOut'), onPress: () => void signOut() } : 'back'
          }
          onLeft={() => void fixAddress()}
          step={[done ? 2.5 : 2, 4]}
          testID="verifyEmail"
        />
      }
    >
      <CodeStep
        copy="verifyEmail"
        title={t('verifyEmail.title')}
        intro={t('steps.emailIntro', { address })}
        wrong={t('verifyEmail.wrong')}
        status={status}
        cooldown={cooldown}
        onCode={(code) => void verify(code)}
        onResend={() => void resend()}
        testID="verifyEmail"
      />
    </StepScreen>
  );
}

type Status = CodeStatus | { kind: 'verified'; tapped?: boolean };

/** Verified here, then back to Account. */
function AddedAddress({ alternative }: { alternative: string }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>({ kind: 'entering' });
  const { left: cooldown, restart: setCooldown } = useCountdown(0);
  const [address, setAddress] = useState('');
  const codeInput = useRef<TextInputInstance>(null);
  const checks = useFormChecks(
    ['code'] as const,
    (_field, value) => {
      const problem = codeProblem(value);

      if (problem == null) return null;

      return problem === 'blank' ? t('verifyEmail.codeBlank') : t('verifyEmail.codeShort');
    },
    () => focusChecked(codeInput),
  );

  useEffect(() => {
    let live = true;

    void (async () => {
      const account = await api.me().catch(() => null);
      const added = account?.emailAddresses.find((one) => one.id === alternative);
      if (!live) return;
      if (added == null) {
        router.replace('/settings/account');
        return;
      }

      setAddress(added.address);
      if (added.verified) setStatus({ kind: 'verified' });
      const opening = await api.verificationOpening(alternative).catch(() => null);
      if (!live || opening == null) return;
      // A spent code opens on its banner, so the screen never invites a try it knows is refused.
      setCooldown(opening.cooldownSeconds);
      setStatus((now) => (now.kind === 'verified' ? now : openingStatus(now, opening.codeState)));
    })();

    return () => {
      live = false;
    };
  }, [alternative, setCooldown]);

  async function verify(typed: string): Promise<void> {
    // Neither an empty code nor a short one is sent, so neither costs an attempt.
    if (!checks.passes({ code: typed })) return;

    keysStayDown();
    setStatus({ kind: 'verifying' });

    try {
      await api.verifyEmail(cleanCode(typed), alternative);
      // Account, under this screen, shows the row verified however it is reached.
      void rereadAccount().catch(() => {});
      setStatus({ kind: 'verified', tapped: true });
    } catch (error) {
      setStatus(codeRefusal(error));
    }
  }

  async function resend(): Promise<void> {
    try {
      setCooldown(await api.resendVerification(alternative));
      setStatus({ kind: 'entering' });
    } catch (error) {
      const seconds = retryAfter(error);

      if (seconds == null) {
        setStatus({ kind: 'failed' });

        return;
      }

      setCooldown(seconds);
      setStatus({ kind: 'entering' });
    }
  }

  const done = status.kind === 'verified';

  return (
    <AuthFrame
      atFoot={done}
      saying={
        <>
          {!done && <BackToAccount />}
          <AuthHeading
            done={done}
            title={done ? t('verifyEmail.doneTitle') : t('verifyEmail.title')}
            intro={
              done
                ? t('verifyEmail.doneBodyAlternative', { address })
                : t('verifyEmail.intro', { address })
            }
            answer={status.kind === 'verified' && status.tapped === true ? status : undefined}
          />
        </>
      }
    >
      {status.kind === 'verified' ? (
        <BackToAccountButton verified={alternative} />
      ) : (
        <CodeForm
          copy="verifyEmail"
          status={status}
          cooldown={cooldown}
          error={checks.errors.code ?? (status.kind === 'wrong' ? t('verifyEmail.wrong') : null)}
          onTyped={(code) => checks.edited('code', code)}
          onLeft={(code) => checks.left('code', code)}
          inputRef={codeInput}
          onVerify={(code) => void verify(code)}
          onResend={() => void resend()}
        >
          <RemoveInAccount kind="email" />
        </CodeForm>
      )}
    </AuthFrame>
  );
}
