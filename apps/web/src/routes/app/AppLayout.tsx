import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Navigate, Outlet } from 'react-router';

import { ErrorBoundary } from '../../components/ErrorBoundary.tsx';
import { LanguagePicker } from '../../components/LanguagePicker.tsx';
import { Pending } from '../../components/Pending.tsx';
import { restoreSession, useSession, useSessionState } from '../../session.ts';

/**
 * The signed-in shell, built for a desk.
 *
 * Planning an event is desktop work — four hundred guests, a seating plan, a
 * budget — so this is a real sidebar and a content area that uses the width,
 * not a phone layout stretched across a monitor. It collapses honestly below
 * the tablet breakpoint rather than pretending to be an app.
 *
 * The error boundary wraps the OUTLET, not the shell: a screen that throws
 * should leave the navigation and the organisation switcher usable, because
 * the way out of a broken screen is the navigation.
 */
export function AppLayout() {
  const state = useSessionState();

  useEffect(() => {
    void restoreSession();
  }, []);

  if (state.status === 'signedOut') {
    return <Navigate to={state.ended ? '/sign-in?signed-out' : '/sign-in'} replace />;
  }

  if (state.status !== 'signedIn') return <Pending />;

  return <Shell />;
}

function Shell() {
  const { t } = useTranslation();
  const session = useSession();

  return (
    <div className="shell">
      <a className="skip-link" href="#content">
        {t('app.skipToContent')}
      </a>

      <aside className="shell-sidebar">
        <div className="brand">{t('app.name')}</div>

        <label className="org-switcher">
          <span className="visually-hidden">{t('nav.switchOrganisation')}</span>
          <select defaultValue={session.organisation.id} aria-label={t('nav.switchOrganisation')}>
            {session.organisations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </label>

        <nav className="shell-nav">
          <NavLink to="/app" end>
            {t('nav.dashboard')}
          </NavLink>
          <NavLink to="/app/events">{t('nav.events')}</NavLink>
          <NavLink to="/app/guests">{t('nav.guests')}</NavLink>
          <NavLink to="/app/settings">{t('nav.settings')}</NavLink>
          <NavLink to="/app/account/security">{t('nav.account')}</NavLink>
        </nav>

        <div className="shell-account">
          <span>{session.name}</span>
          <span className="muted">{session.email}</span>
          <LanguagePicker />
        </div>
      </aside>

      <main id="content" className="shell-content">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
