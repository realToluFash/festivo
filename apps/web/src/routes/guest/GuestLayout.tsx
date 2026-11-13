import { useEffect, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useParams } from 'react-router';

import lockupUrl from '../../brand/lockup.svg';
import { holdScheme } from '../../colourScheme.ts';
import { LanguageMenu } from '../../components/LanguageMenu.tsx';
import { config } from '../../config.ts';
import { currentLocale, showLanguage } from '../../i18n/index.ts';
import { InvalidInvitation } from './InvalidInvitation.tsx';
import { chooseGuestLanguage, leaveGuestPage, useGuestLanguage } from './guestLanguage.ts';
import '../../components/desk.css';
import '../../components/eventsDesk.css';
import '../../components/EventsList.css';
import './guestPage.css';

/** Shape only: whether a token opens a guest is the API's answer. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{16,128}$/;

export function GuestLayout() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const valid = token != null && TOKEN_SHAPE.test(token);
  const { said } = useGuestLanguage();

  useLayoutEffect(() => holdScheme(config().scheme), []);
  useEffect(() => leaveGuestPage, []);

  return (
    <div className="guest-page desk">
      <meta name="robots" content="noindex, nofollow" />
      <meta name="referrer" content="no-referrer" />
      <header className="gp-header">
        <img className="gp-lockup" src={lockupUrl} alt={t('app.name')} />
        <LanguageMenu
          look="guest"
          current={currentLocale()}
          onChoose={(code) => {
            if (token != null && valid) void chooseGuestLanguage(token, code);
            else void showLanguage(code);
          }}
        />
      </header>
      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {said > 0 && <span key={said}>{t('guest.languageSwitched')}</span>}
      </p>
      <main id="content" className="gp-main">
        {valid ? <Outlet context={token} /> : <InvalidInvitation />}
      </main>
    </div>
  );
}
