import { awaiting } from '@soirely/api-client';
import { cleanCode, codeProblem } from '@soirely/domain';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { AuthFrame, AuthHeading } from '../src/components/AuthFrame.tsx';
import { Footnote, PrimaryButton } from '../src/components/Buttons.tsx';
import { CodeForm } from '../src/components/CodeForm.tsx';
import { OnboardingSteps } from '../src/components/OnboardingSteps.tsx';
import { type CodeStatus, codeRefusal, retryAfter } from '../src/kit/code.ts';
import { useFormChecks } from '../src/kit/formChecks.ts';

type Status = CodeStatus | { kind: 'verified' };

export default function VerifyEmail() {
  const { t } = useTranslation();
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

  useEffect(() => {
    let live = true;

    api
      .me()
      .then(async (account) => {
        if (!live) return;

        setAddress(account.emailAddresses.find((one) => one.primary)?.address ?? '');

        // The email is proved even while a phone is still waiting for its code.
        if (awaiting(account) !== 'email') {
          setStatus({ kind: 'verified' });

          return;
        }

        // Started by whichever send came last, the registration email included.
        const seconds = await api.verificationCooldown();

        if (live) setCooldown(seconds);
      })
      .catch(() => {
        if (live) setAddress('');
      });

    return () => {
      live = false;
    };
  }, []);

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
      await api.verifyEmail(cleanCode(typed));
      setStatus({ kind: 'verified' });
    } catch (error) {
      setStatus(codeRefusal(error));
    }
  }

  async function resend(): Promise<void> {
    try {
      setCooldown(await api.resendVerification());
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

  async function signOut(): Promise<void> {
    await api.signOut();
    router.replace('/sign-in');
  }

  const done = status.kind === 'verified';

  return (
    <AuthFrame
      atFoot={done}
      saying={
        <>
          <OnboardingSteps at={done ? 'verified' : 'verifying'} />
          <AuthHeading
            done={done}
            title={done ? t('verifyEmail.doneTitle') : t('verifyEmail.title')}
            intro={
              done ? t('verifyEmail.doneBody', { address }) : t('verifyEmail.intro', { address })
            }
          />
        </>
      }
    >
      {status.kind === 'verified' ? (
        <PrimaryButton
          label={t('verifyEmail.continue')}
          onPress={() => router.replace('/')}
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
          <Footnote
            question={t('verifyEmail.wrongAddress')}
            action={t('verifyEmail.signOut')}
            onPress={() => void signOut()}
            after={t('verifyEmail.wrongAddressBody')}
            testID="verifyEmail.signOut"
          />
        </CodeForm>
      )}
    </AuthFrame>
  );
}
