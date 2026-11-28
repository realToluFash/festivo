import type { EmailDomainsPage } from '@soirely/api-client';
import { type RefObject, useCallback, useEffect, useState } from 'react';

import { api } from '../../../api.ts';
import { useOffline } from '../../../offline.ts';

export type DomainsLoad =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; page: EmailDomainsPage };

/** The organisation's email domains; `show` puts an answer in place, `reload` asks afresh. */
export function useEmailDomains(
  organisationId: string,
  title: RefObject<HTMLElement | null>,
  /** False while a page that shows this beside another load still waits on that one. */
  alongside = true,
): {
  load: DomainsLoad;
  show: (page: EmailDomainsPage) => void;
  reload: () => void;
  refreshing: boolean;
} {
  const [load, setLoad] = useState<DomainsLoad>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => {
    setLoad((before) => (before.kind === 'failed' ? { kind: 'loading' } : before));
    setAttempt((n) => n + 1);
  }, []);
  const { watch, refreshing } = useOffline({
    loaded: alongside && load.kind === 'loaded',
    reload,
    title,
  });

  useEffect(() => {
    let current = true;

    watch(api.emailDomains(organisationId)).then(
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
  }, [organisationId, attempt, watch]);

  const show = useCallback((page: EmailDomainsPage) => setLoad({ kind: 'loaded', page }), []);

  return { load, show, reload, refreshing };
}
