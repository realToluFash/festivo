import {
  ApiError,
  type CodeOpening,
  type PendingRegistration,
  awaiting,
} from '@soirely/api-client';
import { cleanCode, codeProblem } from '@soirely/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { AuthFrame, AuthHeading } from '../src/components/AuthFrame.tsx';
import {
  BackToAccount,
  BackToAccountButton,
  RemoveInAccount,
} from '../src/components/BackToAccount.tsx';
import { Footnote, PrimaryButton } from '../src/components/Buttons.tsx';
import { CodeForm } from '../src/components/CodeForm.tsx';
import { OnboardingSteps } from '../src/components/OnboardingSteps.tsx';
import { type CodeStatus, codeRefusal, openingStatus, retryAfter } from '../src/kit/code.ts';
import { useFormChecks } from '../src/kit/formChecks.ts';
import { type Landing, landingFor } from '../src/landing.ts';
import { dropRegistration, heldRegistration } from '../src/pendingRegistration.ts';
import { rereadAccount } from '../src/signedIn.ts';

type Status = CodeStatus | { kind: 'verified' };

/** "Check your email": for a sign-up, by its registration handle; for an older unverified account, by its session. */
export default function VerifyEmail() {
  const { t } = useTranslation();
  // An address added from Settings > Account (sc-113), by its id: verified here, then back there.
  const alternative = useLocalSearchParams<{ address?: string }>().address;
  const [pending, setPending] = useState<PendingRegistration | null>(null);
  const [next, setNext] = useState<Landing>('/');
  const [status, setStatus] = useState<Status>({ kind: 'entering' });
  const [cooldown, setCooldown] = useState(0);
  const [address, setAddress] = useState('');
  const codeInput = useRef<TextInput>(null);
  const checks = useFormChecks(
    ['code'] as const,
    (_field, value) => {
      const problem = codeProblem(value);

      if (problem == null) return null;

      return problem === 'blank' ? t('verifyEmail.codeBlank') : t('verifyEmail.codeShort');
    },
    () => codeInput.current?.focus(),
  );

  /** A spent code opens on its banner, so the screen never invites a try it knows is refused. */
  function opened({ cooldownSeconds, codeState }: CodeOpening): void {
    setCooldown(cooldownSeconds);
    setStatus((now) => (now.kind === 'verified' ? now : openingStatus(now, codeState)));
  }

  useEffect(() => {
    let live = true;

    void (async () => {
      const held = alternative == null ? await heldRegistration() : null;

      if (alternative != null) {
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
        if (live && opening != null) opened(opening);

        return;
      }

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

        setAddress(account.emailAddresses.find((one) => one.primary)?.address ?? '');

        // The email is proved even while a phone is still waiting for its code.
        if (awaiting(account) !== 'email') {
          setStatus({ kind: 'verified' });

          return;
        }

        // Started by whichever send came last, the registration email included.
        const opening = await api.verificationOpening();

        if (live) opened(opening);
      } catch {
        if (live) setAddress('');
      }
    })();

    return () => {
      live = false;
    };
  }, [alternative]);

  /** The handle has run out, or was used: the sign-up starts again. */
  async function startAgain(): Promise<void> {
    await dropRegistration();
    router.replace('/register');
  }

  useEffect(() => {
    if (cooldown <= 0) return;

    const tick = setTimeout(() => setCooldown((left) => left - 1), 1000);

    return () => clearTimeout(tick);
  }, [cooldown]);

  async function verify(typed: string): Promise<void> {
    // Neither an empty code nor a short one is sent, so neither costs an attempt.
    if (!checks.passes({ code: typed })) return;

    setStatus({ kind: 'verifying' });

    try {
      if (pending == null) {
        await api.verifyEmail(cleanCode(typed), alternative);
        // Account, under this screen, shows the row verified however it is reached.
        if (alternative != null) void rereadAccount().catch(() => {});
      } else {
        const { account } = await api.confirmRegistration(pending.registration, cleanCode(typed));
        await dropRegistration();
        setNext(landingFor(awaiting(account)));
      }
      setStatus({ kind: 'verified' });
    } catch (error) {
      if (error instanceof ApiError && error.is('registration_expired')) {
        await startAgain();
        return;
      }

      setStatus(codeRefusal(error));
    }
  }

  async function resend(): Promise<void> {
    try {
      setCooldown(
        await (pending == null
          ? api.resendVerification(alternative)
          : api.resendRegistrationCode(pending.registration)),
      );
      setStatus({ kind: 'entering' });
    } catch (error) {
      if (error instanceof ApiError && error.is('registration_expired')) {
        await startAgain();
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

  /** "Not your address?": a sign-up starts again; an older account signs out. */
  async function wrongAddress(): Promise<void> {
    if (pending != null) {
      await startAgain();
      return;
    }

    await api.signOut();
    router.replace('/sign-in');
  }

  const done = status.kind === 'verified';

  return (
    <AuthFrame
      atFoot={done}
      saying={
        <>
          {alternative == null ? (
            <OnboardingSteps at={done ? 'verified' : 'verifying'} />
          ) : (
            <BackToAccount verified={done ? alternative : null} />
          )}
          <AuthHeading
            done={done}
            title={done ? t('verifyEmail.doneTitle') : t('verifyEmail.title')}
            intro={
              !done
                ? t('verifyEmail.intro', { address })
                : alternative == null
                  ? t('verifyEmail.doneBody', { address })
                  : t('verifyEmail.doneBodyAlternative', { address })
            }
          />
        </>
      }
    >
      {status.kind === 'verified' && alternative != null ? (
        <BackToAccountButton verified={alternative} />
      ) : status.kind === 'verified' ? (
        <PrimaryButton
          label={t('verifyEmail.continue')}
          onPress={() => router.replace(next)}
          testID="verifyEmail.continue"
        />
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
          {alternative == null ? (
            <Footnote
              question={t('verifyEmail.wrongAddress')}
              action={pending != null ? t('verifyEmail.registerAgain') : t('verifyEmail.signOut')}
              onPress={() => void wrongAddress()}
              {...(pending != null ? {} : { after: t('verifyEmail.wrongAddressBody') })}
              testID="verifyEmail.signOut"
            />
          ) : (
            <RemoveInAccount kind="email" />
          )}
        </CodeForm>
      )}
    </AuthFrame>
  );
}
