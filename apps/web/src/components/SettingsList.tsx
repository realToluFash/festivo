import { initials } from '@soirely/domain';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router';

import { pageTitle, usePageTitle } from '../pageTitle.ts';
import { can, useSession } from '../session.ts';
import { Glyph } from './Glyph.tsx';
import { PersonalTile } from './SchemeArt.tsx';
import './SettingsParts.css';
import './SettingsList.css';

interface Entry {
  to: string;
  label: string;
  look: string;
  tile: ReactNode;
  end?: boolean;
}

interface Group {
  name: string;
  /** The page title's last part, after the section's name. */
  titled: string;
  entries: Entry[];
}

/** Your account's sections, then the organisation's, as the demo's Settings list draws them; Members only for a role that can read them. */
export function SettingsList() {
  const { t } = useTranslation();
  const session = useSession();
  const { pathname } = useLocation();
  const organisation = session.organisation;
  const glyph = (name: 'shield' | 'bell' | 'users' | 'lock') => <Glyph name={name} size={17} />;

  const groups: Group[] = [
    {
      name: t('nav.account'),
      titled: t('nav.account'),
      entries: [
        {
          to: '/app/account',
          label: t('account.sectionAccount'),
          look: 'account',
          tile: initials(session.name),
          end: true,
        },
        {
          to: '/app/account/security',
          label: t('account.sectionSecurity'),
          look: 'security',
          tile: glyph('shield'),
        },
        {
          to: '/app/account/notifications',
          label: t('account.sectionNotifications'),
          look: 'notifications',
          tile: glyph('bell'),
        },
        {
          to: '/app/account/personalisation',
          label: t('account.sectionPersonalisation'),
          look: 'personalisation',
          tile: <PersonalTile />,
        },
      ],
    },
  ];

  if (organisation != null)
    groups.push({
      name: t('settings.sections'),
      titled: t('nav.settings'),
      entries: [
        {
          to: '/app/settings',
          label: t('settings.sectionGeneral'),
          look: 'general',
          tile: initials(organisation.name),
          end: true,
        },
        ...(can(session, 'members.read')
          ? [
              {
                to: '/app/settings/members',
                label: t('settings.sectionMembers'),
                look: 'members',
                tile: glyph('users'),
              },
            ]
          : []),
        {
          to: '/app/settings/sign-in-rules',
          label: t('settings.sectionSignInRules'),
          look: 'sign-in-rules',
          tile: glyph('lock'),
        },
      ],
    });

  const open = groups
    .flatMap((group) => group.entries.map((entry) => ({ group, entry })))
    .find(
      ({ entry }) =>
        pathname === entry.to || (entry.end !== true && pathname.startsWith(`${entry.to}/`)),
    );

  usePageTitle(
    pageTitle(t, open == null ? [t('nav.settings')] : [open.entry.label, open.group.titled]),
  );

  return (
    <nav className="desk desk-list" aria-label={t('nav.settings')}>
      {groups.map((group) => (
        <div key={group.name} className="desk-group">
          <h2 className="desk-caps">{group.name}</h2>
          <ul className="desk-sections">
            {group.entries.map((entry) => (
              <li key={entry.to}>
                <NavLink
                  className={({ isActive }) => (isActive ? 'desk-section is-on' : 'desk-section')}
                  to={entry.to}
                  end={entry.end ?? false}
                >
                  {entry.look === 'personalisation' ? (
                    entry.tile
                  ) : (
                    <span className={`desk-tile is-${entry.look}`} aria-hidden="true">
                      {entry.tile}
                    </span>
                  )}
                  <span className="desk-section-name">{entry.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
