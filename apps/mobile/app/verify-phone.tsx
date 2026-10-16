import type { Account } from '@soirely/api-client';
import { formatPhone } from '@soirely/domain';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { AuthFrame, AuthHeading } from '../src/components/AuthFrame.tsx';
import { Footnote, PrimaryButton } from '../src/components/Buttons.tsx';
import { CodeForm } from '../src/components/CodeForm.tsx';
import { OnboardingSteps } from '../src/components/OnboardingSteps.tsx';
import { type CodeStatus, codeProblem, codeRefusal, retryAfter } from '../src/kit/code.ts';

type Status = CodeStatus | { kind: 'verified' };

export default function VerifyPhone() {
  const { t } = useTranslation();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const onboarding = from === 'onboarding';
  const [account, setAccount] = useState<Account | 'none' | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'entering' });
  const [cooldown, setCooldown] = useState(0);
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;

    api
      .me()
      .then((me) => {
        if (live) setAccount(me);
      })
      .catch(() => {
        if (live) setAccount('none');
      });

    api
      .phoneCooldown()
      .then((seconds) => {
        if (live) setCooldown(seconds);
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;

    const tick = setTimeout(() => setCooldown((left) => left - 1), 1000);

    return () => clearTimeout(tick);
  }, [cooldown]);

  if (account === 'none') return <Redirect href="/sign-in" />;
  if (account == null) return null;

  const phone = account.phoneNumbers.find((candidate) => candidate.primary);
  if (phone == null) return <Redirect href={onboarding ? '/phone?from=onboarding' : '/phone'} />;

  const number = formatPhone(phone.number);
  const verified = status.kind === 'verified' || phone.verified;

  async function verify(code: string): Promise<void> {
    const problem = codeProblem(code);

    if (problem != null) {
      setCodeError(t(problem === 'blank' ? 'verifyPhone.codeBlank' : 'verifyPhone.codeShort'));

      return;
    }

    setCodeError(null);
    setStatus({ kind: 'verifying' });

    try {
      await api.verifyPhone(code);
      setStatus({ kind: 'verified' });
    } catch (error) {
      setStatus(codeRefusal(error));
    }
  }

  async function resend(): Promise<void> {
    try {
      setCooldown(await api.resendPhoneCode());
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

  // Saving the details with no number removes the phone, so the gate rests on the email again.
  async function withoutPhone(name: string): Promise<void> {
    try {
      await api.completeProfile({ name });
      router.replace('/');
    } catch {
      setStatus({ kind: 'failed' });
    }
  }

  const fieldError = codeError ?? (status.kind === 'wrong' ? t('verifyPhone.wrong') : null);

  return (
    <AuthFrame
      atFoot={verified}
      saying={
        <>
          {onboarding && <OnboardingSteps at="details" />}
          <AuthHeading
            done={verified}
            title={verified ? t('verifyPhone.doneTitle') : t('verifyPhone.title')}
            intro={
              verified ? t('verifyPhone.doneBody', { number }) : t('verifyPhone.intro', { number })
            }
          />
        </>
      }
    >
      {status.kind === 'verified' || phone.verified ? (
        <PrimaryButton
          label={t('verifyPhone.continue')}
          onPress={() => router.replace('/')}
          testID="verifyPhone.continue"
        />
      ) : (
        <CodeForm
          copy="verifyPhone"
          status={status}
          cooldown={cooldown}
          error={fieldError}
          onTyped={() => setCodeError(null)}
          onVerify={(code) => void verify(code)}
          onResend={() => void resend()}
        >
          <Footnote
            question={t('verifyPhone.wrongNumber')}
            action={t('verifyPhone.changeIt')}
            onPress={() => router.push(onboarding ? '/phone?from=onboarding' : '/phone')}
            testID="verifyPhone.change"
          />

          {onboarding && (
            <Footnote
              question={t('verifyPhone.cantGetTexts')}
              action={t('verifyPhone.carryOnWithout')}
              onPress={() => void withoutPhone(account.name)}
              testID="verifyPhone.carryOn"
            />
          )}
        </CodeForm>
      )}
    </AuthFrame>
  );
}
