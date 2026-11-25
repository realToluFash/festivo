import { maskedPhone } from '@soirely/domain';
import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { heldChallenge, nextAfterSignIn } from '../challenge.ts';
import { codePassed } from '../providerSignIn.ts';
import { backToSignIn } from './backToSignIn.ts';
import { leaveTimedOutSignIn } from './leaveTimedOutSignIn.ts';
import { TwoFactorStep } from './TwoFactorStep.tsx';

/** "Enter your code", or with `recovery`, "Enter a recovery code": the second half of a sign-in, reached only with a challenge held. */
export function SignInSecondFactor({ recovery = false }: { recovery?: boolean }) {
  const { t } = useTranslation();
  const challenge = heldChallenge();

  if (challenge == null) return <Redirect href="/sign-in" />;

  return (
    <TwoFactorStep
      mode={recovery ? 'recovery' : 'app'}
      intro={
        recovery
          ? t('twoFactor.recoveryIntro')
          : challenge.email === '' && challenge.phone != null
            ? t('twoFactor.introNumber', { number: maskedPhone(challenge.phone) })
            : t('twoFactor.intro', { email: challenge.email })
      }
      failedTitle={t('signIn.failedTitle')}
      failedBody={t('signIn.failedBody')}
      onVerify={async (factor) =>
        nextAfterSignIn(codePassed(await api.verifyTwoFactor(challenge.challenge, factor)))
      }
      onPassed={(next) => {
        // Enter a recovery code sits on Enter your code, and neither is left under the account.
        if (recovery && router.canDismiss()) router.dismiss();
        router.replace(next);
      }}
      onExpired={leaveTimedOutSignIn}
      onOtherWay={() => (recovery ? router.back() : router.push('/sign-in-recovery'))}
      onLostBoth={() => router.push('/lost-two-factor')}
      onBack={recovery ? () => router.back() : backToSignIn}
    />
  );
}
