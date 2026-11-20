import { initials } from '@soirely/domain';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Brand } from './Brand.tsx';
import { Glyph } from './Glyph.tsx';
import './SettingsParts.css';
import './orgMenu.css';
import './noOrganisation.css';

/** The top of You are not in an organisation and of the account pages opened from it: the small logo, and the language on the right. */
export function AloneHeader({
  covered = false,
  children,
}: {
  covered?: boolean;
  children: ReactNode;
}) {
  return (
    <header className="cw-header" inert={covered}>
      <Brand lockup />
      {children}
    </header>
  );
}

/** What the language pill shows: a globe, and the language by its own name. */
export function LanguageFace({ name }: { name: string }) {
  return (
    <>
      <Glyph name="globe" size={16} />
      {name}
    </>
  );
}

/** Who is signed in, with Your account and Sign out side by side under it. */
export function SignedIn({ line, children }: { line: string; children: ReactNode }) {
  return (
    <div className="cw-signed">
      <p>{line}</p>
      <div className="cw-signed-ways">{children}</div>
    </div>
  );
}

/** Invitations, in place of the way on: a hairline between rows. */
export function WaitingList({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <section className="cw-invitations" aria-labelledby="cw-invitations-heading">
      <h2 id="cw-invitations-heading">{t('invitations.heading')}</h2>
      {children}
    </section>
  );
}

/** One invitation waiting: its dashed tile, beside what the switcher says of it. */
export function WaitingRow({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="cw-invitation" role="group" aria-label={name}>
      <span className="cw-invitation-tile" aria-hidden="true">
        <span className="sw-tile is-dashed">{initials(name)}</span>
      </span>
      <div className="cw-invitation-answer">{children}</div>
    </div>
  );
}
