import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../api.ts';
import { keepsWhatLoaded, useOffline } from '../../offline.ts';
import { useSession } from '../../session.ts';
import { Refreshing } from '../../components/OfflineBand.tsx';
import { ArrivalNotice } from '../../components/PageArrival.tsx';
import { Skeleton } from '../../components/Skeleton.tsx';
import { useFocusOnceShown } from '../../stepFocus.ts';

export function Dashboard() {
  const { t } = useTranslation();
  const session = useSession();
  const organisationId = session.organisation?.id;
  const [attempt, setAttempt] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [counted, setCounted] = useState<{
    organisationId: string;
    attempt: number;
    count: number | 'failed';
  } | null>(null);
  const count = useRef<HTMLParagraphElement>(null);
  const failedLine = useRef<HTMLParagraphElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const land = useFocusOnceShown();
  const shows =
    counted != null &&
    counted.organisationId === organisationId &&
    counted.attempt === attempt &&
    counted.count !== 'failed';
  const { watch, refreshing } = useOffline({
    loaded: shows,
    reload: () => setRefresh((n) => n + 1),
    title,
  });

  useEffect(() => {
    if (organisationId == null) return;
    let current = true;

    watch(
      Promise.all([
        api.events(organisationId, { itemsPerPage: 1 }),
        api.events(organisationId, { finished: true, itemsPerPage: 1 }),
      ]),
    ).then(
      ([unfinished, finished]) =>
        current &&
        setCounted({ organisationId, attempt, count: unfinished.total + finished.total }),
      (error: unknown) =>
        current &&
        setCounted((was) =>
          was?.organisationId === organisationId &&
          was.attempt === attempt &&
          was.count !== 'failed' &&
          keepsWhatLoaded(error)
            ? was
            : { organisationId, attempt, count: 'failed' },
        ),
    );

    return () => {
      current = false;
    };
  }, [organisationId, attempt, refresh, watch]);

  return (
    <div className="dashboard">
      {session.organisation != null && (
        <p className="dashboard-organisation">{session.organisation.name}</p>
      )}
      <div className="dashboard-title">
        <h1 ref={title} tabIndex={-1}>
          {t('nav.dashboard')}
        </h1>
        {refreshing && <Refreshing />}
      </div>
      <p className="muted">{t('nav.signedInAs', { name: session.name })}</p>
      {organisationId != null &&
        (counted?.organisationId !== organisationId || counted.attempt !== attempt ? (
          <Skeleton key={organisationId} words={t('pending.loading')} shape="line" />
        ) : counted.count === 'failed' ? (
          <ArrivalNotice
            role={attempt > 0 ? undefined : 'alert'}
            line={t('events.failed')}
            lineRef={failedLine}
            focusable
            retry={t('events.retry')}
            onRetry={() => {
              setAttempt((n) => n + 1);
              land(() => count.current ?? failedLine.current);
            }}
          />
        ) : (
          <p ref={count} className="arrives dashboard-count" tabIndex={-1}>
            {t('nav.eventCount', { count: counted.count })}
          </p>
        ))}
    </div>
  );
}
