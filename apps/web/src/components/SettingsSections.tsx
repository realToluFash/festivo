import { useTranslation } from 'react-i18next';

import { can, useSession } from '../session.ts';
import { SectionNav } from './SectionNav.tsx';

/** The organisation's settings; Roles only for a role that can read them, and Sign-in rules for every member. */
export function SettingsSections() {
  const { t } = useTranslation();
  const session = useSession();

  return (
    <SectionNav
      label={t('settings.sections')}
      sections={[
        { to: '/app/settings', label: t('settings.sectionGeneral'), end: true },
        ...(can(session, 'members.read')
          ? [{ to: '/app/settings/roles', label: t('settings.sectionRoles') }]
          : []),
        { to: '/app/settings/sign-in-rules', label: t('settings.sectionSignInRules') },
      ]}
    />
  );
}
