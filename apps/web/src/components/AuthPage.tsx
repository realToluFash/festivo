import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { usePhoneWidth } from '../phoneWidth.ts';
import { type AuthBackTo, useAuthBack } from './AuthBack.tsx';
import { LanguageChoice } from './LanguageChoice.tsx';

/** Every auth screen's page; `foot` goes under the card, or after a phone's languages, and `even` spaces the card's every part alike. */
export function AuthPage({
  back,
  foot,
  even = false,
  children,
}: {
  back?: AuthBackTo;
  foot?: ReactNode;
  even?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const phone = usePhoneWidth();
  const control = useAuthBack(back);

  return (
    <div className="auth">
      <header className="auth-header">
        {control ?? <span className="brand">{t('app.name')}</span>}
        {phone ? null : <LanguageChoice />}
      </header>

      <main id="content" className="auth-main">
        <section className={even ? 'auth-card auth-card-even' : 'auth-card'}>{children}</section>
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
