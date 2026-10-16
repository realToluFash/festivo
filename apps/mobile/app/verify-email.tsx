import { awaiting } from '@soirely/api-client';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { AuthFrame, AuthHeading } from '../src/components/AuthFrame.tsx';
import { Footnote, PrimaryButton } from '../src/components/Buttons.tsx';
import { CodeForm } from '../src/components/CodeForm.tsx';
import { OnboardingSteps } from '../src/components/OnboardingSteps.tsx';
import { type CodeStatus, codeRefusal, retryAfter } from '../src/kit/code.ts';

type Status = CodeStatus | { kind: 'verified' };

export default function VerifyEmail() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>({ kind: 'entering' });
  const [cooldown, setCooldown] = useState(0);
  const [address, setAddress] = useState('');

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

  async function verify(code: string): Promise<void> {
    setStatus({ kind: 'verifying' });

    try {
      await api.verifyEmail(code);
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
          error={status.kind === 'wrong' ? t('verifyEmail.wrong') : null}
          onTyped={() => {}}
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
