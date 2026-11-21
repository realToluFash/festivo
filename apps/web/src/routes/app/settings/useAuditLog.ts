import { ApiError, type AuditLogPage } from '@soirely/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../../../api.ts';
import { type Filters, asQuery } from './auditLog.ts';

export type AuditLoad =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'locked' }
  | { kind: 'forbidden' }
  | { kind: 'loaded'; page: AuditLogPage };

export type More = 'idle' | 'loading' | 'failed';

/** The log's first page for the filters, asked afresh whenever they change; `more` adds the next page under it. */
export function useAuditLog(
  organisationId: string,
  filters: Filters,
): {
  load: AuditLoad;
  more: More;
  showMore: () => void;
  reload: () => void;
  preparing: (email: string) => void;
} {
  const [load, setLoad] = useState<AuditLoad>({ kind: 'loading' });
  const [more, setMore] = useState<More>('idle');
  const [attempt, setAttempt] = useState(0);
  const asked = useRef(0);
  const { person, type, event, from, to } = filters;

  useEffect(() => {
    const ask = ++asked.current;

    api.auditLog(organisationId, asQuery({ person, type, event, from, to })).then(
      (page) => {
        if (ask !== asked.current) return;
        setMore('idle');
        setLoad({ kind: 'loaded', page });
      },
      (error: unknown) => {
        if (ask !== asked.current) return;
        if (error instanceof ApiError && error.is('plan_required')) setLoad({ kind: 'locked' });
        else if (error instanceof ApiError && error.is('permission_required'))
          setLoad({ kind: 'forbidden' });
        else setLoad((before) => (before.kind === 'loaded' ? before : { kind: 'failed' }));
      },
    );
  }, [organisationId, person, type, event, from, to, attempt]);

  const showMore = useCallback(() => {
    if (load.kind !== 'loaded' || load.page.next == null || more === 'loading') return;
    const ask = asked.current;
    const shown = load.page;
    setMore('loading');

    api.auditLog(organisationId, asQuery({ person, type, event, from, to }), shown.next).then(
      (next) => {
        if (ask !== asked.current) return;
        setLoad({
          kind: 'loaded',
          page: { ...next, entries: [...shown.entries, ...next.entries] },
        });
        setMore('idle');
      },
      () => {
        if (ask === asked.current) setMore('failed');
      },
    );
  }, [load, more, organisationId, person, type, event, from, to]);

  const reload = useCallback(() => {
    setLoad((before) => (before.kind === 'failed' ? { kind: 'loading' } : before));
    setAttempt((n) => n + 1);
  }, []);

  const preparing = useCallback(
    (email: string) =>
      setLoad((before) =>
        before.kind === 'loaded'
          ? { ...before, page: { ...before.page, preparing: email } }
          : before,
      ),
    [],
  );

  return { load, more, showMore, reload, preparing };
}
