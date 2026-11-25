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

  return (
    <AuthPage bare end={null}>
      <SecondFactorStep
        intro={t('twoFactor.intro', { email: whose(challenge) })}
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
          lead: t('passkey.signInLead', { email: whose(challenge) }),
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

/** The address the code is for, or on an account with no email its primary number, masked (sc-4235). */
function whose(challenge: TwoFactorChallenge): string {
  return challenge.email === '' && challenge.phone != null
    ? maskedPhone(challenge.phone)
    : challenge.email;
}
