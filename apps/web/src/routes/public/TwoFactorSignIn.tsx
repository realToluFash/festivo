import { type TwoFactorChallenge } from '@soirely/api-client';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router';

import { api } from '../../api.ts';
import { AuthPage } from '../../components/AuthPage.tsx';
import { SecondFactorStep } from '../../components/SecondFactorStep.tsx';
import { landAfterSignIn } from '../../signedIn.ts';

/** "Enter your code": the second half of a sign-in, reached only with the challenge in hand. */
export function TwoFactorSignIn() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const challenge = useLocation().state as TwoFactorChallenge | null;

  if (challenge?.challenge == null) return <Navigate to="/sign-in" replace />;

  return (
    <AuthPage>
      <SecondFactorStep
        intro={t('twoFactor.intro', { email: challenge.email })}
        recoveryIntro={t('twoFactor.recoveryIntro')}
        submitLabel={t('twoFactor.verify')}
        onVerify={async (factor) =>
          landAfterSignIn(await api.verifyTwoFactor(challenge.challenge, factor), navigate)
        }
        onExpired={() => navigate('/sign-in', { replace: true })}
      />
    </AuthPage>
  );
}
