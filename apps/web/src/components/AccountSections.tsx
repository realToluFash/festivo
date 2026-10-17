import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';

/** Your account's sections, as `Account-*` and `Security-*` draw them above the cards. */
export function AccountSections() {
  const { t } = useTranslation();

  return (
    <nav className="account-sections" aria-label={t('account.sections')}>
      <NavLink className="account-section" to="/app/account" end>
        {t('account.sectionAccount')}
      </NavLink>
      <NavLink className="account-section" to="/app/account/security">
        {t('account.sectionSecurity')}
      </NavLink>
    </nav>
  );
}
