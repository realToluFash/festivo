import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { usePhoneWidth } from '../phoneWidth.ts';
import { LanguageChoice } from './LanguageChoice.tsx';

/** Every auth screen's page: the brand, or a way back in its place, then the card; on a phone the languages come last. */
export function AuthPage({ back, children }: { back?: ReactNode; children: ReactNode }) {
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
      </main>

      {phone ? (
        <footer className="auth-foot">
          <LanguageChoice />
        </footer>
      ) : null}
    </div>
  );
}
