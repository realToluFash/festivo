import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router';

import { followSavedLanguage } from '../../accountLanguage.ts';
import { CreateOrganisation } from '../../components/CreateOrganisation.tsx';
import { ErrorBoundary } from '../../components/ErrorBoundary.tsx';
import { LanguagePicker } from '../../components/LanguagePicker.tsx';
import { OrganisationSwitcher } from '../../components/OrganisationSwitcher.tsx';
import { Pending } from '../../components/Pending.tsx';
import { Unreachable } from '../../components/Unreachable.tsx';
import { LinkedNotice } from '../../components/LinkedNotice.tsx';
import { NotificationsBell } from '../../components/NotificationsBell.tsx';
import { SignInRulesNotices } from '../../components/SignInRulesNotices.tsx';
import { AccessPaused } from '../../components/AccessPaused.tsx';
import { TwoFactorOverdue } from '../../components/TwoFactorOverdue.tsx';
import { SkipLink } from '../../components/SkipLink.tsx';
import {
  joinOrganisation,
  landingFor,
  onMovedOn,
  rereadOrganisations,
  restoreSession,
  switchOrganisation,
  useSession,
  useSessionState,
} from '../../session.ts';
import { useWaitingInvitations } from '../../invitations.ts';
import { useStepFocus } from '../../stepFocus.ts';
import { UNASKED } from '../../pageArrival.ts';
import { useDomainOffer } from '../../joinOffers.ts';
import { NoOrganisation } from './NoOrganisation.tsx';
import { heldRegistration } from '../../pendingRegistration.ts';
import { useTwoFactorStanding } from '../../twoFactorStanding.ts';
import { useDialogKeys } from '../../dialogFocus.ts';
import { PHONE_WIDTH } from '../../phoneWidth.ts';

/**
 * The signed-in shell, built for a desk.
 *
 * Planning an event is desktop work — four hundred guests, a seating plan, a
 * budget — so this is a real sidebar and a content area that uses the width,
 * not a phone layout stretched across a monitor. It collapses honestly below
 * the tablet breakpoint rather than pretending to be an app, and at a phone's
 * width the sidebar is one bar, its links behind Menu (sc-13413).
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
        state={{
          ...(state.ended ? UNASKED : {}),
          ...(state.timedOut == null && state.providerOnly == null
            ? {}
            : { timedOut: state.timedOut, providerOnly: state.providerOnly }),
        }}
        replace
      />
    );
  }

  if (state.status === 'unreachable') return <Unreachable signedIn />;

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
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const sidebarLinks = useRef<HTMLDivElement>(null);
  const widenedOpen = useRef(false);
  const returnFromMenu = useCallback((opener: HTMLElement | null) => {
    const current = widenedOpen.current
      ? sidebarLinks.current?.querySelector('[aria-current="page"]')
      : null;

    widenedOpen.current = false;
    // Menu is hidden once the sidebar is back, so focus goes to where the person was in it.
    (current instanceof HTMLElement ? current : opener)?.focus();
  }, []);
  const menuId = useId();
  const organisation = session.organisation;
  const waiting = useWaitingInvitations();
  const closeCreate = useCallback(() => setCreating(false), []);
  const offer = useDomainOffer();
  const overdue = useTwoFactorStanding(organisation) === 'overdue';
  const switchTo = switchOf(location.state);

  // Before the first paint, so the first signed-in screen is already in the account's language.
  useLayoutEffect(() => {
    void followSavedLanguage();
  }, []);

  // Wider than a phone the links are in the sidebar again, so a menu left open has nothing to add.
  useEffect(() => {
    if (!menuOpen) return;

    const phone = window.matchMedia(PHONE_WIDTH);
    const widened = (): void => {
      if (phone.matches) return;
      widenedOpen.current = true;
      closeMenu();
    };

    phone.addEventListener('change', widened);

    return () => phone.removeEventListener('change', widened);
  }, [menuOpen, closeMenu]);

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

  const arrivedAt = useRef(pathname);

  // The page was read when it loaded; each move after that reads the organisations again (sc-16229).
  useEffect(() => {
    if (arrivedAt.current === pathname) return;

    arrivedAt.current = pathname;
    void rereadOrganisations();
  }, [pathname]);

  useEffect(
    () =>
      onMovedOn((next) => {
        setSwitched({ id: next.id, name: next.name, at: arrivedAt.current });
      }),
    [],
  );

  const atAccount = pathname.startsWith('/app/account');

  // Every product page would open this page again, so it stands alone: only what works without an organisation, the account pages under the same header.
  if (organisation == null && session.pausedIn == null) {
    return (
      <div className="no-organisation-page">
        <SkipLink />
        <header className="public-header">
          <span className="brand">{t('app.name')}</span>
          <LanguagePicker automatic={false} />
        </header>
        {atAccount ? (
          <main id="content" className="shell-content no-organisation-account">
            <LinkedNotice />
            <Link className="link-button back-link" to="/app">
              <span aria-hidden="true">←</span>
              <span>{t('noOrganisation.wayBack')}</span>
            </Link>
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </main>
        ) : (
          <main id="content" className="no-organisation-main">
            <LinkedNotice />
            <ErrorBoundary>
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
                  setSwitched({
                    id: started.id,
                    name: started.name,
                    at: pathname,
                    takesFocus: true,
                  });
                  arriveAtSwitched();
                }}
              />
            </ErrorBoundary>
          </main>
        )}
      </div>
    );
  }

  return (
    <div className="shell">
      <SkipLink inert={menuOpen} />

      <aside className="shell-sidebar" inert={menuOpen}>
        <div className="shell-brand-row">
          <div className="brand">{t('app.name')}</div>
          <NotificationsBell userId={session.userId} />
        </div>

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

        <button
          type="button"
          className="shell-menu-button"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? menuId : undefined}
          onClick={() => setMenuOpen(true)}
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M2 4h12M2 8h12M2 12h12" strokeLinecap="round" />
          </svg>
          {t('nav.menu')}
        </button>

        <div ref={sidebarLinks} className="shell-links">
          <ShellLinks />
        </div>
      </aside>

      <main id="content" className="shell-content" inert={menuOpen}>
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
          {session.pausedIn != null && !atAccount ? (
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
          ) : organisation != null && overdue && !atAccount ? (
            <TwoFactorOverdue organisation={organisation} />
          ) : (
            <Outlet />
          )}
        </ErrorBoundary>
      </main>

      {menuOpen && <ShellMenu id={menuId} onClose={closeMenu} returnFocus={returnFromMenu} />}

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

/** The sidebar's links, the account and its language: in the sidebar on a desk, in the menu on a phone. */
function ShellLinks({ onFollow }: { onFollow?: () => void }) {
  const { t } = useTranslation();
  const session = useSession();

  return (
    <>
      <nav className="shell-nav">
        <NavLink to="/app" end onClick={onFollow}>
          {t('nav.dashboard')}
        </NavLink>
        <NavLink to="/app/events" onClick={onFollow}>
          {t('nav.events')}
        </NavLink>
        <NavLink to="/app/guests" onClick={onFollow}>
          {t('nav.guests')}
        </NavLink>
        <NavLink to="/app/settings" onClick={onFollow}>
          {t('nav.settings')}
        </NavLink>
        <NavLink to="/app/account" onClick={onFollow}>
          {t('nav.account')}
        </NavLink>
      </nav>

      <div className="shell-account">
        <span>{session.name}</span>
        <span className="muted">{session.email}</span>
        <LanguagePicker automatic={false} />
      </div>
    </>
  );
}

/** `AppShell-Phone`'s sheet: a modal dialog, so focus goes back to Menu when it closes. */
function ShellMenu({
  id,
  onClose,
  returnFocus,
}: {
  id: string;
  onClose: () => void;
  returnFocus: (opener: HTMLElement | null) => void;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement;

    close.current?.focus();

    return () => returnFocus(opener instanceof HTMLElement ? opener : null);
  }, [returnFocus]);

  useDialogKeys(dialog, onClose, false);

  return (
    <>
      <button
        type="button"
        className="dialog-scrim"
        tabIndex={-1}
        aria-label={t('nav.closeMenu')}
        onClick={onClose}
      />
      <div
        ref={dialog}
        id={id}
        className="shell-menu"
        role="dialog"
        aria-modal="true"
        aria-label={t('nav.menu')}
        tabIndex={-1}
      >
        <button
          ref={close}
          type="button"
          className="dialog-close"
          aria-label={t('nav.closeMenu')}
          onClick={onClose}
        >
          ✕
        </button>
        <div className="brand">{t('app.name')}</div>
        <ShellLinks onFollow={onClose} />
      </div>
    </>
  );
}

function switchOf(state: unknown): string | null {
  const switchTo =
    typeof state === 'object' && state != null && 'switchTo' in state ? state.switchTo : null;

  return typeof switchTo === 'string' ? switchTo : null;
}
