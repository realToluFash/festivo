import { NavLink } from 'react-router';

export interface Section {
  to: string;
  label: string;
  end?: boolean;
}

/** The sections above a page's cards, as `Account-*`, `Security-*`, `OrgGeneral-*` and `Roles-*` draw them. */
export function SectionNav({ label, sections }: { label: string; sections: Section[] }) {
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
