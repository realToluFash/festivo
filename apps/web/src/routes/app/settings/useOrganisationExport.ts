import type { OrganisationExportPage } from '@soirely/api-client';
import { type RefObject, useCallback, useEffect, useState } from 'react';

import { api } from '../../../api.ts';
import { useOffline } from '../../../offline.ts';
import { PREPARING_POLL_MS, isPreparing } from './exportAllData.ts';

export type ExportLoad =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; page: OrganisationExportPage };

/** Where the organisation's export stands, asked again while it prepares; `show` puts an answer in place, `reload` asks afresh. */
export function useOrganisationExport(
  organisationId: string,
  title: RefObject<HTMLElement | null>,
): {
  load: ExportLoad;
  show: (page: OrganisationExportPage) => void;
  reload: () => void;
  refreshing: boolean;
} {
  const [load, setLoad] = useState<ExportLoad>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => {
    setLoad((before) => (before.kind === 'failed' ? { kind: 'loading' } : before));
    setAttempt((n) => n + 1);
  }, []);
  const { watch, refreshing } = useOffline({ loaded: load.kind === 'loaded', reload, title });

  useEffect(() => {
    let current = true;

    watch(api.organisationExport(organisationId)).then(
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

  const preparing = load.kind === 'loaded' && isPreparing(load.page);

  useEffect(() => {
    if (!preparing) return;
    const timer = setTimeout(() => setAttempt((n) => n + 1), PREPARING_POLL_MS);

    return () => clearTimeout(timer);
  }, [preparing, load]);

  const show = useCallback((page: OrganisationExportPage) => setLoad({ kind: 'loaded', page }), []);

  return { load, show, reload, refreshing };
}
