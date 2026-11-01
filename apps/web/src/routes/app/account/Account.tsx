import { useTranslation } from 'react-i18next';

import { AccountHeader } from '../../../components/AccountHeader.tsx';
import { refreshAccount, useSession } from '../../../session.ts';
import { ContactsCards } from './ContactsCard.tsx';
import { NameCard } from './NameCard.tsx';
import { TimeZoneCard } from './TimeZoneCard.tsx';

/** Your account > Account: the name (sc-22741), the address and phone cards (sc-113), then the time zone (sc-868). */
export function Account() {
  const { t } = useTranslation();
  const session = useSession();

  return (
    <div className="account">
      <AccountHeader title={t('account.title')} email={session.email} />

      <NameCard name={session.name} onSaved={() => refreshAccount()} />

      <ContactsCards onPrimaryChanged={() => refreshAccount()} />

      <TimeZoneCard timezone={session.timezone} onSaved={() => refreshAccount()} />
    </div>
  );
}
