import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { LanguageChoice } from './LanguageChoice.tsx';

/** Every auth screen's page: the brand and the language switcher in the header, the card under it. */
export function AuthPage({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <div className="auth">
      <header className="auth-header">
        <span className="brand">{t('app.name')}</span>
        <LanguageChoice />
      </header>

      <main id="content" className="auth-main">
        <section className="auth-card">{children}</section>
      </main>
    </div>
  );
}
