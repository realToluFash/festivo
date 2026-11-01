import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { type AuthBackTo, useAuthBack } from './AuthBack.tsx';
import { LanguageChoice } from './LanguageChoice.tsx';

/** Every auth screen's page: the brand, or the back control, and the language switcher in the header, the card under it. */
export function AuthPage({ back, children }: { back?: AuthBackTo; children: ReactNode }) {
  const { t } = useTranslation();
  const control = useAuthBack(back);

  return (
    <div className="auth">
      <header className="auth-header">
        {control ?? <span className="brand">{t('app.name')}</span>}
        <LanguageChoice />
      </header>

      <main id="content" className="auth-main">
        <section className="auth-card">{children}</section>
      </main>
    </div>
  );
}
