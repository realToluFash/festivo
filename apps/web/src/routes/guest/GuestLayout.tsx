import { useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useParams } from 'react-router';

import lockupUrl from '../../brand/lockup.svg';
import { holdScheme } from '../../colourScheme.ts';
import { LanguagePicker } from '../../components/LanguagePicker.tsx';
import { config } from '../../config.ts';
import { InvalidInvitation } from './InvalidInvitation.tsx';
import '../../components/desk.css';
import '../../components/eventsDesk.css';
import '../../components/EventsList.css';
import './guestPage.css';

/** Shape only: whether a token opens a guest is the API's answer. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{16,128}$/;

export function GuestLayout() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();

  useLayoutEffect(() => holdScheme(config().scheme), []);

  return (
    <div className="gp desk">
      <meta name="robots" content="noindex, nofollow" />
      <meta name="referrer" content="no-referrer" />
      <header className="gp-header">
        <img className="gp-lockup" src={lockupUrl} alt={t('app.name')} />
        <LanguagePicker />
      </header>
      <main id="content" className="gp-main">
        {token == null || !TOKEN_SHAPE.test(token) ? (
          <InvalidInvitation />
        ) : (
          <Outlet context={token} />
        )}
      </main>
    </div>
  );
}
