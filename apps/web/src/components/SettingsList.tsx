import { initials } from '@soirely/domain';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';

import { pageTitle, usePageTitle } from '../pageTitle.ts';
import { can, useSession } from '../session.ts';
import { Glyph } from './Glyph.tsx';
import { PersonalTile } from './SchemeArt.tsx';
import './SettingsParts.css';
import './SettingsList.css';

export interface SectionEntry {
  label: string;
  tile: ReactNode;
  /** A section with a page of its own; one without is a button, which `onPress` answers. */
  to?: string;
  onPress?: () => void;
}

export interface SectionGroup {
  name: string;
  entries: SectionEntry[];
}

interface Entry extends SectionEntry {
  to: string;
  end?: boolean;
}

interface Group extends SectionGroup {
  /** The page title's last part, after the section's name. */
  titled: string;
  entries: Entry[];
}

/** A section's square tile, in its own colour. */
export function SectionTile({ look, children }: { look: string; children: ReactNode }) {
  return (
    <span className={`desk-tile is-${look}`} aria-hidden="true">
      {children}
    </span>
  );
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
          tile: <SectionTile look="account">{initials(session.name)}</SectionTile>,
          end: true,
        },
        {
          to: '/app/account/security',
          label: t('account.sectionSecurity'),
          tile: <SectionTile look="security">{glyph('shield')}</SectionTile>,
        },
        {
          to: '/app/account/notifications',
          label: t('account.sectionNotifications'),
          tile: <SectionTile look="notifications">{glyph('bell')}</SectionTile>,
        },
        {
          to: '/app/account/personalisation',
          label: t('account.sectionPersonalisation'),
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
          tile: <SectionTile look="general">{initials(organisation.name)}</SectionTile>,
          end: true,
        },
        ...(can(session, 'members.read')
          ? [
              {
                to: '/app/settings/members',
                label: t('settings.sectionMembers'),
                tile: <SectionTile look="members">{glyph('users')}</SectionTile>,
              },
            ]
          : []),
        {
          to: '/app/settings/sign-in-rules',
          label: t('settings.sectionSignInRules'),
          tile: <SectionTile look="sign-in-rules">{glyph('lock')}</SectionTile>,
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
    <SettingsSections
      className="desk desk-list"
      label={t('nav.settings')}
      groups={groups}
      open={open?.entry}
    />
  );
}

/** The list both the product and its demo draw: each group's caps, then its sections, the open one lit. */
export function SettingsSections({
  className = 'desk-list',
  label,
  groups,
  open,
}: {
  className?: string;
  label: string;
  groups: readonly SectionGroup[];
  open: SectionEntry | undefined;
}) {
  return (
    <nav className={className} aria-label={label}>
      {groups.map((group) => (
        <div key={group.name} className="desk-group">
          <h2 className="desk-caps">{group.name}</h2>
          <ul className="desk-sections">
            {group.entries.map((entry) => (
              <li key={entry.label}>
                {entry.to == null ? (
                  <button type="button" className="desk-section" onClick={entry.onPress}>
                    {entry.tile}
                    <span className="desk-section-name">{entry.label}</span>
                  </button>
                ) : (
                  <Link
                    className={entry === open ? 'desk-section is-on' : 'desk-section'}
                    to={entry.to}
                    aria-current={entry === open ? 'page' : undefined}
                  >
                    {entry.tile}
                    <span className="desk-section-name">{entry.label}</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
