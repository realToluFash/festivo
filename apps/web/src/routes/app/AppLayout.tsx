import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router';

import { CreateOrganisation } from '../../components/CreateOrganisation.tsx';
import { ErrorBoundary } from '../../components/ErrorBoundary.tsx';
import { LanguagePicker } from '../../components/LanguagePicker.tsx';
import { OrganisationSwitcher } from '../../components/OrganisationSwitcher.tsx';
import { Pending } from '../../components/Pending.tsx';
import { Unreachable } from '../../components/Unreachable.tsx';
import { LinkedNotice } from '../../components/LinkedNotice.tsx';
import { SignInRulesNotices } from '../../components/SignInRulesNotices.tsx';
import { AccessPaused } from '../../components/AccessPaused.tsx';
import { TwoFactorOverdue } from '../../components/TwoFactorOverdue.tsx';
import {
  joinOrganisation,
  landingFor,
  restoreSession,
  switchOrganisation,
  useSession,
  useSessionState,
} from '../../session.ts';
import { useWaitingInvitations } from '../../invitations.ts';
import { useStepFocus } from '../../stepFocus.ts';
import { useDomainOffer } from '../../joinOffers.ts';
import { NoOrganisation } from './NoOrganisation.tsx';
import { heldRegistration } from '../../pendingRegistration.ts';
import { useTwoFactorStanding } from '../../twoFactorStanding.ts';

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
    // A sign-up waiting on its code has no session yet: it goes back to its code, not to sign-in.
    if (heldRegistration() != null) return <Navigate to="/verify-email" replace />;

    return (
      <Navigate
        to={state.ended ? '/sign-in?signed-out' : '/sign-in'}
        state={
          state.timedOut == null && state.providerOnly == null
            ? undefined
            : { timedOut: state.timedOut, providerOnly: state.providerOnly }
        }
        replace
      />
    );
  }

  if (state.status === 'unreachable') return <Unreachable />;

  if (state.status !== 'signedIn') return <Pending />;

  // The product is behind the onboarding gate: verified, then complete.
  const landing = landingFor(state.session.awaiting);
  if (landing !== '/app') return <Navigate to={landing} replace />;

  return <Shell />;
}

function Shell() {
  const { t } = useTranslation();
  const session = useSession();
  const location = useLocation();
  const { pathname } = location;
  const navigate = useNavigate();
  const [switched, setSwitched] = useState<{
    id: string;
    name: string;
    at: string;
    takesFocus?: boolean;
  } | null>(null);
  const [switchedNotice, arriveAtSwitched] = useStepFocus<HTMLDivElement>();
  const [creating, setCreating] = useState(false);
  const [choosing, setChoosing] = useState(0);
  const organisation = session.organisation;
  const waiting = useWaitingInvitations();
  const closeCreate = useCallback(() => setCreating(false), []);
  const offer = useDomainOffer();
  const overdue = useTwoFactorStanding(organisation) === 'overdue';
  const switchTo = switchOf(location.state);

  function switchInto(next: { id: string; name: string }): void {
    setSwitched({ id: next.id, name: next.name, at: pathname });
    void navigate(
      { pathname, search: location.search, hash: location.hash },
      { replace: true, state: { switchTo: next.id } },
    );
  }

  // The switch is a navigation, so a form with unsaved changes can ask first; the state goes once the page has the new organisation.
  useEffect(() => {
    if (switchTo == null) return;

    if (organisation?.id !== switchTo || session.pausedIn != null) {
      switchOrganisation(switchTo);
      return;
    }

    void navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: true, state: null },
    );
  }, [switchTo, organisation?.id, session.pausedIn, location, navigate]);

  return (
    <div className="shell">
      <a className="skip-link" href="#content">
        {t('app.skipToContent')}
      </a>

      <aside className="shell-sidebar">
        <div className="brand">{t('app.name')}</div>

        {organisation != null && (
          <OrganisationSwitcher
            current={organisation}
            organisations={session.organisations}
            waiting={waiting}
            offer={offer}
            email={session.email}
            paused={session.pausedIn != null}
            opened={choosing}
            onSwitch={switchInto}
            onCreate={() => setCreating(true)}
          />
        )}

        <nav className="shell-nav">
          <NavLink to="/app" end>
            {t('nav.dashboard')}
          </NavLink>
          <NavLink to="/app/events">{t('nav.events')}</NavLink>
          <NavLink to="/app/guests">{t('nav.guests')}</NavLink>
          <NavLink to="/app/settings">{t('nav.settings')}</NavLink>
          <NavLink to="/app/account">{t('nav.account')}</NavLink>
        </nav>

        <div className="shell-account">
          <span>{session.name}</span>
          <span className="muted">{session.email}</span>
          <LanguagePicker />
        </div>
      </aside>

      <main id="content" className="shell-content">
        <LinkedNotice />
        {organisation != null && session.pausedIn == null && (
          <SignInRulesNotices key={organisation.id} organisation={organisation} />
        )}
        {/* Said on the page it happened on, and gone once the person moves on. */}
        {switched != null && switched.at === pathname && switched.id === organisation?.id && (
          <div
            className="notice notice-done"
            role={switched.takesFocus === true ? undefined : 'status'}
            ref={switchedNotice}
            tabIndex={switched.takesFocus === true ? -1 : undefined}
          >
            <span className="mark mark-done" aria-hidden="true">
              ✓
            </span>
            <p className="notice-title" data-notice-lead tabIndex={-1}>
              {t('switcher.switched', { name: switched.name })}
            </p>
          </div>
        )}

        <ErrorBoundary>
          {session.pausedIn != null && !pathname.startsWith('/app/account') ? (
            <AccessPaused
              paused={session.pausedIn}
              others={session.organisations}
              onSwitch={(next) => {
                switchOrganisation(next.id);
                setSwitched({ id: next.id, name: next.name, at: pathname, takesFocus: true });
                arriveAtSwitched();
              }}
              onChoose={() => setChoosing((times) => times + 1)}
            />
          ) : organisation == null && !pathname.startsWith('/app/account') ? (
            <NoOrganisation
              waiting={waiting}
              onOpen={(id) => {
                const joined = session.organisations.find((membership) => membership.id === id);

                switchOrganisation(id);
                if (joined == null) return;
                setSwitched({ id, name: joined.name, at: pathname, takesFocus: true });
                arriveAtSwitched();
              }}
              onStarted={(started) => {
                switchOrganisation(started.id);
                setSwitched({ id: started.id, name: started.name, at: pathname, takesFocus: true });
                arriveAtSwitched();
              }}
            />
          ) : organisation != null && overdue && !pathname.startsWith('/app/account') ? (
            <TwoFactorOverdue organisation={organisation} />
          ) : (
            <Outlet />
          )}
        </ErrorBoundary>
      </main>

      {creating && (
        <CreateOrganisation
          email={session.email}
          onCancel={closeCreate}
          onCreated={(created) => {
            setCreating(false);
            joinOrganisation(created);
            switchInto(created);
          }}
        />
      )}
    </div>
  );
}

function switchOf(state: unknown): string | null {
  const switchTo =
    typeof state === 'object' && state != null && 'switchTo' in state ? state.switchTo : null;

  return typeof switchTo === 'string' ? switchTo : null;
}
