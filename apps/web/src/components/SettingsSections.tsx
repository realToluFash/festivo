import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';

import { can, useSession } from '../session.ts';

/** The organisation's settings, as `OrgGeneral-*` and `Roles-*` draw them; Roles only for a role that can read them. */
export function SettingsSections() {
  const { t } = useTranslation();
  const session = useSession();

  return (
    <nav className="account-sections" aria-label={t('settings.sections')}>
      <NavLink className="account-section" to="/app/settings" end>
        {t('settings.sectionGeneral')}
      </NavLink>
      {can(session, 'members.read') && (
        <NavLink className="account-section" to="/app/settings/roles">
          {t('settings.sectionRoles')}
        </NavLink>
      )}
    </nav>
  );
}
