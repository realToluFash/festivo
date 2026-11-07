import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';

import { chooseLanguage } from '../accountLanguage.ts';
import { DemoLink } from '../demo/DemoEntry.tsx';
import { currentLocale } from '../i18n/index.ts';
import { useSessionState } from '../session.ts';
import { type AuthBackTo, useAuthBack } from './AuthBack.tsx';
import { Brand } from './Brand.tsx';
import { LanguageMenu } from './LanguageMenu.tsx';
import { HaveAccount } from './Onboarding.tsx';

/** Every signed-out page's frame; `bare` drops the card, as sign-in does; `end` replaces the header's right end. */
export function AuthPage({
  back,
  bare = false,
  end,
  children,
}: {
  back?: AuthBackTo;
  bare?: boolean;
  end?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const control = useAuthBack(back);
  const { pathname } = useLocation();
  const status = useSessionState().status;
  const signedIn = status === 'signedIn';

  return (
    <div className={bare ? 'auth auth-bare' : 'auth'}>
      <header className="auth-header">
        {control ?? <Brand lockup />}
        {end !== undefined
          ? end
          : !signedIn &&
            status !== 'unreachable' &&
            (pathname === '/register' ? (
              <HaveAccount />
            ) : (
              <div className="auth-new">
                <span>{t('auth.newTo')}</span>
                <Link className="button auth-new-button" to="/register">
                  {t('signIn.createAccount')}
                </Link>
              </div>
            ))}
      </header>

      <main id="content" className="auth-main">
        <section className={bare ? 'auth-column' : 'auth-card'}>{children}</section>
      </main>

      <footer className="auth-footer">
        <span>{t('auth.copyright', { year: new Date().getFullYear() })}</span>
        <LanguageMenu
          current={currentLocale()}
          onChoose={(code) => void chooseLanguage(code, signedIn)}
        />
      </footer>

      <DemoLink />
    </div>
  );
}
