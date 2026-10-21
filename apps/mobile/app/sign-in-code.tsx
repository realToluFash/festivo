import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { heldChallenge, nextAfterSignIn } from '../src/challenge.ts';
import { SecondFactorStep } from '../src/components/SecondFactorStep.tsx';
import { codePassed } from '../src/providerSignIn.ts';

/** "Enter your code": the second half of a sign-in, reached only with a challenge held. */
export default function SignInCode() {
  const { t } = useTranslation();
  const challenge = heldChallenge();

  if (challenge == null) return <Redirect href="/sign-in" />;

  return (
    <SecondFactorStep
      intro={t('twoFactor.intro', { email: challenge.email })}
      recoveryIntro={t('twoFactor.recoveryIntro')}
      submitLabel={t('twoFactor.verify')}
      onVerify={async (factor) => {
        router.replace(
          await nextAfterSignIn(codePassed(await api.verifyTwoFactor(challenge.challenge, factor))),
        );
      }}
      onLostBoth={() => router.push('/lost-two-factor')}
      onExpired={() => router.replace('/sign-in')}
    />
  );
}
