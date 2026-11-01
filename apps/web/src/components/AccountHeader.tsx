import { useTranslation } from 'react-i18next';

import { SectionNav } from './SectionNav.tsx';

/** Your account's band, its title and its three sections, as `Account`, `Security` and `Notifications` draw it. */
export function AccountHeader({ title, email }: { title: string; email?: string }) {
  const { t } = useTranslation();

  return (
    <header className="account-header">
      <div className="account-heading">
        <h1>{title}</h1>
        {email != null && <p>{email}</p>}
      </div>

      <SectionNav
        label={t('account.sections')}
        group={t('nav.account')}
        sections={[
          { to: '/app/account', label: t('account.sectionAccount'), end: true },
          { to: '/app/account/security', label: t('account.sectionSecurity') },
          { to: '/app/account/notifications', label: t('account.sectionNotifications') },
        ]}
      />
    </header>
  );
}
