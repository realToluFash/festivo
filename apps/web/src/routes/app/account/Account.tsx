import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AccountHeader } from '../../../components/AccountHeader.tsx';
import { Refreshing } from '../../../components/OfflineBand.tsx';
import { useOffline } from '../../../offline.ts';
import { refreshAccount, useSession } from '../../../session.ts';
import { ContactsCards } from './ContactsCard.tsx';
import { NameCard } from './NameCard.tsx';
import { TimeZoneCard } from './TimeZoneCard.tsx';

/** Your account > Account: the name (sc-22741), the address and phone cards (sc-113), then the time zone (sc-868). */
export function Account() {
  const { t } = useTranslation();
  const session = useSession();
  const title = useRef<HTMLHeadingElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const { watch, refreshing } = useOffline({
    loaded,
    reload: () => setRefresh((n) => n + 1),
    title,
  });

  return (
    <div className="account">
      <AccountHeader title={t('account.title')} email={session.email} titleRef={title} />
      {refreshing && <Refreshing />}

      <NameCard name={session.name} onSaved={() => refreshAccount()} />

      <ContactsCards
        onPrimaryChanged={() => refreshAccount()}
        watch={watch}
        refresh={refresh}
        onLoaded={setLoaded}
      />

      <TimeZoneCard timezone={session.timezone} onSaved={() => refreshAccount()} />
    </div>
  );
}
