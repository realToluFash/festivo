import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router';

import { pageTitle, usePageTitle } from '../pageTitle.ts';

export interface Section {
  to: string;
  label: string;
  end?: boolean;
}

/** The sections above a page's cards, as `Account-*`, `Security-*`, `OrgGeneral-*` and `Roles-*` draw them. */
export function SectionNav({
  label,
  group,
  sections,
}: {
  label: string;
  group: string;
  sections: Section[];
}) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const current = sections.find(
    (section) =>
      pathname === section.to || (section.end !== true && pathname.startsWith(`${section.to}/`)),
  );

  usePageTitle(pageTitle(t, current == null ? [group] : [current.label, group]));

  return (
    <nav className="account-sections" aria-label={label}>
      {sections.map((section) => (
        <NavLink
          key={section.to}
          className="account-section"
          to={section.to}
          end={section.end ?? false}
        >
          {section.label}
        </NavLink>
      ))}
    </nav>
  );
}
