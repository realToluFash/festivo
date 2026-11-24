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
  /** False while a page that shows this beside another load still waits on that one. */
  alongside = true,
): {
  load: ExportLoad;
  show: (page: OrganisationExportPage) => void;
  reload: () => void;
  refreshing: boolean;
} {
  const [load, setLoad] = useState<ExportLoad>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  // Only a load Try again or the connection started says Refreshing…, never the poll (sc-88912).
  const [asked, setAsked] = useState(false);
  const reload = useCallback(() => {
    setLoad((before) => (before.kind === 'failed' ? { kind: 'loading' } : before));
    setAsked(true);
    setAttempt((n) => n + 1);
  }, []);
  const { watch, refreshing } = useOffline({
    loaded: alongside && load.kind === 'loaded',
    reload,
    title,
  });

  useEffect(() => {
    let current = true;

    watch(api.organisationExport(organisationId)).then(
      (page) => {
        if (!current) return;
        setLoad({ kind: 'loaded', page });
        setAsked(false);
      },
      () => {
        if (!current) return;
        setLoad((before) => (before.kind === 'loaded' ? before : { kind: 'failed' }));
        setAsked(false);
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

  return { load, show, reload, refreshing: refreshing && asked };
}
