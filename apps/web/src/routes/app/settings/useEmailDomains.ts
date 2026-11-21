import type { EmailDomainsPage } from '@soirely/api-client';
import { useCallback, useEffect, useState } from 'react';

import { api } from '../../../api.ts';

export type DomainsLoad =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; page: EmailDomainsPage };

/** The organisation's email domains; `show` puts an answer in place, `reload` asks afresh. */
export function useEmailDomains(organisationId: string): {
  load: DomainsLoad;
  show: (page: EmailDomainsPage) => void;
  reload: () => void;
} {
  const [load, setLoad] = useState<DomainsLoad>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;

    api.emailDomains(organisationId).then(
      (page) => {
        if (current) setLoad({ kind: 'loaded', page });
      },
      () => {
        if (current) setLoad((before) => (before.kind === 'loaded' ? before : { kind: 'failed' }));
      },
    );

    return () => {
      current = false;
    };
  }, [organisationId, attempt]);

  const show = useCallback((page: EmailDomainsPage) => setLoad({ kind: 'loaded', page }), []);
  const reload = useCallback(() => {
    setLoad((before) => (before.kind === 'failed' ? { kind: 'loading' } : before));
    setAttempt((n) => n + 1);
  }, []);

  return { load, show, reload };
}
