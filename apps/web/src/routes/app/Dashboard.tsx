import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../api.ts';
import { useSession } from '../../session.ts';
import { Skeleton } from '../../components/Skeleton.tsx';

export function Dashboard() {
  const { t } = useTranslation();
  const session = useSession();
  const organisationId = session.organisation?.id;
  const [counted, setCounted] = useState<{
    organisationId: string;
    count: number | 'failed';
  } | null>(null);

  useEffect(() => {
    if (organisationId == null) return;
    let current = true;

    Promise.all([
      api.events(organisationId, { itemsPerPage: 1 }),
      api.events(organisationId, { finished: true, itemsPerPage: 1 }),
    ]).then(
      ([unfinished, finished]) =>
        current && setCounted({ organisationId, count: unfinished.total + finished.total }),
      () => current && setCounted({ organisationId, count: 'failed' }),
    );

    return () => {
      current = false;
    };
  }, [organisationId]);

  return (
    <>
      <h1 tabIndex={-1}>{t('nav.dashboard')}</h1>
      <p className="muted">{t('nav.signedInAs', { name: session.name })}</p>
      {organisationId != null &&
        (counted?.organisationId !== organisationId ? (
          <Skeleton key={organisationId} words={t('pending.loading')} shape="line" />
        ) : (
          counted.count !== 'failed' && (
            <p className="arrives">{t('nav.eventCount', { count: counted.count })}</p>
          )
        ))}
    </>
  );
}
