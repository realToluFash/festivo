import { useTranslation } from 'react-i18next';

import { SectionNav } from './SectionNav.tsx';

/** Your account's sections, as `Account-*` and `Security-*` draw them above the cards. */
export function AccountSections() {
  const { t } = useTranslation();

  return (
    <SectionNav
      label={t('account.sections')}
      group={t('nav.account')}
      sections={[
        { to: '/app/account', label: t('account.sectionAccount'), end: true },
        { to: '/app/account/security', label: t('account.sectionSecurity') },
      ]}
    />
  );
}
