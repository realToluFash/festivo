import { type TwoFactorChallenge } from '@soirely/api-client';
import { maskedPhone } from '@soirely/domain';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router';

import { api } from '../../api.ts';
import { AuthPage } from '../../components/AuthPage.tsx';
import { SecondFactorStep } from '../../components/SecondFactorStep.tsx';
import { codePassed } from '../../providerSignIn.ts';
import { landAfterSignIn } from '../../signedIn.ts';

/** "Enter your code": the second half of a sign-in, reached only with the challenge in hand. */
export function TwoFactorSignIn() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const challenge = useLocation().state as TwoFactorChallenge | null;

  if (challenge?.challenge == null) return <Navigate to="/sign-in" replace />;
  const number = numberOf(challenge);

  return (
    <AuthPage bare end={null}>
      <SecondFactorStep
        intro={
          number == null
            ? t('twoFactor.intro', { email: challenge.email })
            : t('twoFactor.introNumber', { number })
        }
        recoveryIntro={t('twoFactor.recoveryIntro')}
        submitLabel={t('twoFactor.verify')}
        failedTitle={t('signIn.failedTitle')}
        failedBody={t('signIn.failedBody')}
        onVerify={async (factor) =>
          landAfterSignIn(
            codePassed(await api.verifyTwoFactor(challenge.challenge, factor)),
            navigate,
          )
        }
        lostBoth={{ to: '/two-factor/recovery', state: challenge }}
        factors={challenge.factors}
        passkey={{
          lead:
            number == null
              ? t('passkey.signInLead', { email: challenge.email })
              : t('passkey.signInLeadNumber', { number }),
          options: () => api.signInPasskeyOptions(challenge.challenge),
        }}
        onExpired={() =>
          navigate('/sign-in', {
            replace: true,
            state: { email: challenge.email, codeTimedOut: true },
          })
        }
        onBack={() => navigate('/sign-in', { state: { email: challenge.email } })}
      />
    </AuthPage>
  );
}

/** On an account with no email, its primary number, masked (sc-4235). */
function numberOf(challenge: TwoFactorChallenge): string | null {
  return challenge.email === '' && challenge.phone != null ? maskedPhone(challenge.phone) : null;
}
