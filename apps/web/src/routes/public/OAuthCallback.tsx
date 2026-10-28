import { type Provider, ProviderCancelled } from '@soirely/api-client';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

import { Pending } from '../../components/Pending.tsx';
import {
  PROVIDER_NAMES,
  finishProviderSignIn,
  keepProviderReturn,
  type ReturnPurpose,
  returnPurpose,
} from '../../providerSignIn.ts';
import { landAfterSignIn } from '../../signedIn.ts';

const BACK_TO: Partial<Record<ReturnPurpose['kind'], string>> = {
  makePrimary: '/app/account',
  makeOwner: '/app/settings/members',
};

/** Where a provider sends the person back: signed in and on to where the account belongs, or back to sign-in. */
export function OAuthCallback({ provider }: { provider: Provider }) {
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    // The attempt is spent on first use, so a second run would only ever fail.
    if (started.current) return;
    started.current = true;

    // A trip Settings started, to confirm it is you or to choose the account to link: it finishes where it began.
    const purpose = returnPurpose(provider);
    if (purpose != null) {
      keepProviderReturn(provider, window.location.href);
      navigate(BACK_TO[purpose.kind] ?? '/app/account/security', { replace: true });

      return;
    }

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
