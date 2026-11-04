import type { ReactNode } from 'react';

import { Glyph } from './Glyph.tsx';
import type { Tell } from './TodayParts.tsx';

export function Bell({ tell }: { tell: Tell }) {
  return (
    <button
      type="button"
      className="desk-bell"
      aria-label="Notifications, 3 unread"
      onClick={() => tell('Notifications have their own design.')}
    >
      <Glyph name="bell" size={19} />
      <span className="today-unread" aria-hidden="true" />
    </button>
  );
}

/** The page's title, its one header action, and the bell. */
export function TitleRow({
  title,
  action,
  tell,
}: {
  title: string;
  action?: ReactNode;
  tell: Tell;
}) {
  return (
    <header className="desk-top">
      <h1 className="desk-title" tabIndex={-1}>
        {title}
      </h1>
      {action}
      <Bell tell={tell} />
    </header>
  );
}

/** ‹ Members or ‹ Roles, where a person or a role opened in the list's place. */
export function BackRow({ to, onBack, tell }: { to: string; onBack: () => void; tell: Tell }) {
  return (
    <div className="desk-top">
      <button type="button" className="desk-back" onClick={onBack}>
        <Glyph name="back" size={17} weight={2.4} />
        {to}
      </button>
      <span className="today-grow" />
      <Bell tell={tell} />
    </div>
  );
}
