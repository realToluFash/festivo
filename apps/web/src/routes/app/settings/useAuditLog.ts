import { ApiError, type AuditLogPage } from '@soirely/api-client';
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../../../api.ts';
import { useOffline } from '../../../offline.ts';
import { type Filters, asQuery } from './auditLog.ts';

export type AuditLoad =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'locked' }
  | { kind: 'forbidden' }
  | { kind: 'loaded'; page: AuditLogPage };

const LOCKED = Symbol('locked');

export type More = 'idle' | 'loading' | 'failed';

/** The log's first page for the filters, asked afresh whenever they change; `more` adds the next page under it. */
export function useAuditLog(
  organisationId: string,
  filters: Filters,
  title: RefObject<HTMLElement | null>,
): {
  load: AuditLoad;
  more: More;
  showMore: () => void;
  reload: () => void;
  preparing: (email: string) => void;
  refreshing: boolean;
} {
  const [load, setLoad] = useState<AuditLoad>({ kind: 'loading' });
  const [more, setMore] = useState<More>('idle');
  const [attempt, setAttempt] = useState(0);
  const asked = useRef(0);
  const { person, type, event, from, to } = filters;
  const reload = useCallback(() => {
    setLoad((before) => (before.kind === 'failed' ? { kind: 'loading' } : before));
    setAttempt((n) => n + 1);
  }, []);
  // The Enterprise lock is a page that loaded, so it says it is offline as the log does.
  const { watch, refreshing } = useOffline({
    loaded: load.kind === 'loaded' || load.kind === 'locked',
    reload,
    title,
  });

  useEffect(() => {
    const ask = ++asked.current;

    // The lock is Soirely's answer, so it reaches the watch as one and the box has its minute.
    const read = api
      .auditLog(organisationId, asQuery({ person, type, event, from, to }))
      .catch((error: unknown): typeof LOCKED => {
        if (error instanceof ApiError && error.is('plan_required')) return LOCKED;
        throw error;
      });

    watch(read).then(
      (page) => {
        if (ask !== asked.current) return;
        setMore('idle');
        setLoad(page === LOCKED ? { kind: 'locked' } : { kind: 'loaded', page });
      },
      (error: unknown) => {
        if (ask !== asked.current) return;
        if (error instanceof ApiError && error.is('permission_required'))
          setLoad({ kind: 'forbidden' });
        else
          setLoad((before) =>
            before.kind === 'loaded' || before.kind === 'locked' ? before : { kind: 'failed' },
          );
      },
    );
  }, [organisationId, person, type, event, from, to, attempt, watch]);

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

  const preparing = useCallback(
    (email: string) =>
      setLoad((before) =>
        before.kind === 'loaded'
          ? { ...before, page: { ...before.page, preparing: email } }
          : before,
      ),
    [],
  );

  return { load, more, showMore, reload, preparing, refreshing };
}
