import { ProviderCancelled, awaiting } from '@soirely/api-client';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

import { Pending } from '../../components/Pending.tsx';
import { finishGoogleSignIn } from '../../googleSignIn.ts';
import { adoptAccount, landingFor } from '../../session.ts';

/** Where Google sends the person back: signed in and on to where the account belongs, or back to sign-in. */
export function OAuthCallback() {
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    // The attempt is spent on first use, so a second run would only ever fail.
    if (started.current) return;
    started.current = true;

    finishGoogleSignIn(window.location.href)
      .then(async ({ account }) => {
        await adoptAccount(account);
        navigate(landingFor(awaiting(account)), { replace: true });
      })
      .catch((error: unknown) => {
        navigate(
          error instanceof ProviderCancelled ? '/sign-in' : '/sign-in?provider-failed=Google',
          {
            replace: true,
          },
        );
      });
  }, [navigate]);

  return <Pending />;
}
