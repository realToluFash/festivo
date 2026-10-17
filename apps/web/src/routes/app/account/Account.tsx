import { useTranslation } from 'react-i18next';

import { AccountSections } from '../../../components/AccountSections.tsx';
import { refreshAccount, useSession } from '../../../session.ts';
import { TimeZoneCard } from './TimeZoneCard.tsx';

/** Your account > Account. Its address and phone cards are sc-113's; the time zone is sc-868's. */
export function Account() {
  const { t } = useTranslation();
  const session = useSession();

  return (
    <div className="account">
      <div className="account-heading">
        <h1>{t('account.title')}</h1>
        <p>{session.email}</p>
      </div>

      <AccountSections />

      <TimeZoneCard timezone={session.timezone} onSaved={() => refreshAccount()} />
    </div>
  );
}
