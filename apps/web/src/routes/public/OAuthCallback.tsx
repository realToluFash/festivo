import { type Provider, ProviderCancelled } from '@soirely/api-client';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

import { Pending } from '../../components/Pending.tsx';
import { PROVIDER_NAMES, finishProviderSignIn } from '../../providerSignIn.ts';
import { landAfterSignIn } from '../../signedIn.ts';

/** Where a provider sends the person back: signed in and on to where the account belongs, or back to sign-in. */
export function OAuthCallback({ provider }: { provider: Provider }) {
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    // The attempt is spent on first use, so a second run would only ever fail.
    if (started.current) return;
    started.current = true;

    finishProviderSignIn(provider, window.location.href)
      .then((outcome) => landAfterSignIn(outcome, navigate))
      .catch((error: unknown) => {
        navigate(
          error instanceof ProviderCancelled
            ? '/sign-in'
            : `/sign-in?provider-failed=${PROVIDER_NAMES[provider]}`,
          { replace: true },
        );
      });
  }, [navigate, provider]);

  return <Pending />;
}
