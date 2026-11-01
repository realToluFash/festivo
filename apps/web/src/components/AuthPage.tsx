import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { usePhoneWidth } from '../phoneWidth.ts';
import { LanguageChoice } from './LanguageChoice.tsx';

/** Every auth screen's page; `foot` goes under the card, or after a phone's languages. */
export function AuthPage({
  back,
  foot,
  children,
}: {
  back?: ReactNode;
  foot?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const phone = usePhoneWidth();

  return (
    <div className="auth">
      <header className="auth-header">
        {back ?? <span className="brand">{t('app.name')}</span>}
        {phone ? null : <LanguageChoice />}
      </header>

      <main id="content" className="auth-main">
        <section className="auth-card">{children}</section>
        {!phone && foot != null && <div className="auth-after">{foot}</div>}
      </main>

      {phone ? (
        <footer className="auth-foot">
          <LanguageChoice labelled />
          {foot}
        </footer>
      ) : null}
    </div>
  );
}
