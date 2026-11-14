import type { ReactNode } from 'react';

import { Brand } from './Brand.tsx';
import { Glyph } from './Glyph.tsx';
import './desk.css';

export interface DeskPerson {
  name: string;
  initials: string;
  /** The role in the organisation the person is in; none outside one. */
  role: string | null;
}

/** The desk frame's sidebar, as Today's demo draws it: the logo, the organisation pill, the places, and Settings and the person at its foot. */
export function DeskSidebar({
  label,
  inert = false,
  pill,
  children,
  foot,
}: {
  label: string;
  inert?: boolean;
  pill: ReactNode;
  children: ReactNode;
  foot: ReactNode;
}) {
  return (
    <nav className="today-side" aria-label={label} inert={inert}>
      <div className="today-logo">
        <Brand lockup />
      </div>
      {pill}
      {children}
      <div className="today-side-gap" />
      <div className="today-places">{foot}</div>
    </nav>
  );
}

/** What the person at the sidebar's foot shows: their initials, their name and their role. A screen reader hears the name and role once, from the control's own name. */
export function DeskPersonFace({ person }: { person: DeskPerson }) {
  return (
    <>
      <span className="today-avatar today-cover is-draft" aria-hidden="true">
        {person.initials}
      </span>
      <span className="today-person-words" aria-hidden="true">
        <span className="today-person-name">{person.name}</span>
        {person.role != null && <span className="today-person-role">{person.role}</span>}
      </span>
      <Glyph name="updown" size={15} />
    </>
  );
}
