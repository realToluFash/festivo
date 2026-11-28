import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { Pending } from '../../components/Pending.tsx';
import { landAfterSignIn } from '../../signedIn.ts';
import { finishSingleSignOn } from '../../ssoSignIn.ts';

/** Where the API sends the browser after the identity provider (sc-610): the one-time handle for a session, or back to sign-in. */
export function SingleSignOnReturn() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const handle = params.get('handle');
  const started = useRef(false);

  useEffect(() => {
    // The handle is spent on first use, so a second run would only ever fail.
    if (started.current) return;
    started.current = true;

    const failed = () => void navigate('/sign-in', { replace: true, state: { ssoFailed: true } });

    if (handle == null) failed();
    else
      finishSingleSignOn(handle)
        .then((outcome) => landAfterSignIn(outcome, navigate))
        .catch(failed);
  }, [handle, navigate]);

  return <Pending />;
}
