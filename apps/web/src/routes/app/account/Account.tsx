import { useTranslation } from 'react-i18next';

import { AccountSections } from '../../../components/AccountSections.tsx';
import { refreshAccount, useSession } from '../../../session.ts';
import { ContactsCards } from './ContactsCard.tsx';
import { TimeZoneCard } from './TimeZoneCard.tsx';

/** Your account > Account: the address and phone cards (sc-113), then the time zone (sc-868). */
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

      <ContactsCards onPrimaryChanged={() => refreshAccount()} />

      <TimeZoneCard timezone={session.timezone} onSaved={() => refreshAccount()} />
    </div>
  );
}
