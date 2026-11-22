import { useState } from 'react';

import { api } from './api.ts';
import { forgetSession } from './session.ts';

/** A sign-out that ends the session, or leaves it as it was and says so (sc-11571). */
export function useSignOut(after: () => void): {
  signOut: () => Promise<void>;
  unreached: boolean;
  dismiss: () => void;
} {
  const [unreached, setUnreached] = useState(false);

  async function signOut(): Promise<void> {
    setUnreached(false);

    try {
      await api.signOut();
    } catch {
      setUnreached(true);

      return;
    }

    forgetSession();
    after();
  }

  return { signOut, unreached, dismiss: () => setUnreached(false) };
}
