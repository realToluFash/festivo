import { useTranslation } from 'react-i18next';

import { useSession } from '../../session.ts';

export function Dashboard() {
  const { t } = useTranslation();
  const session = useSession();

  return (
    <>
      <h1>{t('nav.dashboard')}</h1>
      <p className="muted">{t('nav.signedInAs', { name: session.name })}</p>
      {/* A plural family rather than a built sentence: `${n} events` is English
          grammar hard-coded into the layout. */}
      <p>{t('nav.eventCount', { count: 0 })}</p>
    </>
  );
}
