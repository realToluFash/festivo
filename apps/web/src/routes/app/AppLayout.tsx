import { initials, roleName } from '@soirely/domain';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router';

import { followSavedLanguage } from '../../accountLanguage.ts';
import { Brand } from '../../components/Brand.tsx';
import { CreateOrganisation } from '../../components/CreateOrganisation.tsx';
import { DeskEvents } from '../../components/DeskEvents.tsx';
import { DeskPersonFace, DeskSidebar } from '../../components/DeskSidebar.tsx';
import { ErrorBoundary } from '../../components/ErrorBoundary.tsx';
import { Glyph, type GlyphName } from '../../components/Glyph.tsx';
import { LanguagePicker } from '../../components/LanguagePicker.tsx';
import { OrganisationSwitcher } from '../../components/OrganisationSwitcher.tsx';
import { Pending } from '../../components/Pending.tsx';
import { Unreachable } from '../../components/Unreachable.tsx';
import { LinkedNotice } from '../../components/LinkedNotice.tsx';
import { NotificationsBell } from '../../components/NotificationsBell.tsx';
import { OfflineBand, OfflineProvider } from '../../components/OfflineBand.tsx';
import { SignInRulesNotices } from '../../components/SignInRulesNotices.tsx';
import { AccessPaused } from '../../components/AccessPaused.tsx';
import { Switched } from '../../components/Switched.tsx';
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
import { useSidebarEvents } from '../../sidebarEvents.ts';
import { useWaitingInvitations } from '../../invitations.ts';
import { UNASKED } from '../../pageArrival.ts';
import { useDomainOffer } from '../../joinOffers.ts';
import { NoOrganisation } from './NoOrganisation.tsx';
import { heldRegistration } from '../../pendingRegistration.ts';
import { useTwoFactorStanding } from '../../twoFactorStanding.ts';
import { useDialogKeys } from '../../dialogFocus.ts';
import { PHONE_WIDTH } from '../../phoneWidth.ts';
import { EventNav, useInsideEvent, useShownEventName } from './events/EventNav.tsx';

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

  if (state.status !== 'signedIn') return <Pending late />;

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
  const [creating, setCreating] = useState(false);
  const [choosing, setChoosing] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const sidebar = useRef<HTMLElement>(null);
  const widenedOpen = useRef(false);
  const returnFromMenu = useCallback((opener: HTMLElement | null) => {
    const current = widenedOpen.current
      ? sidebar.current?.querySelector('[aria-current="page"]')
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

  const atSettings = pathname === '/app/settings' || pathname.startsWith('/app/settings/');
  // At an organisation's Settings section the stand-in takes the page beside the Settings list, so the account stays a row away.
  const standIn =
    session.pausedIn != null && !atAccount ? (
      <AccessPaused
        paused={session.pausedIn}
        others={session.organisations}
        onSwitch={(next) => {
          switchOrganisation(next.id);
          setSwitched({ id: next.id, name: next.name, at: pathname, takesFocus: true });
        }}
        onChoose={() => setChoosing((times) => times + 1)}
      />
    ) : organisation != null && overdue && !atAccount ? (
      <TwoFactorOverdue organisation={organisation} />
    ) : null;

  // Every product page would open this page again, so it stands alone: only what works without an organisation, the account pages under the same header.
  if (organisation == null && session.pausedIn == null) {
    return (
      <div className="no-organisation-page">
        <SkipLink />
        <header className="public-header">
          <Brand />
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
                }}
                onStarted={(started) => {
                  switchOrganisation(started.id);
                  setSwitched({
                    id: started.id,
                    name: started.name,
                    at: pathname,
                    takesFocus: true,
                  });
                }}
              />
            </ErrorBoundary>
          </main>
        )}
      </div>
    );
  }

  return (
    <OfflineProvider>
      <div className="shell">
        <SkipLink inert={menuOpen} />

        <aside ref={sidebar} className="shell-sidebar" inert={menuOpen}>
          <DeskSidebar
            label={t('app.name')}
            pill={
              organisation != null && (
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
              )
            }
            foot={<ShellFoot />}
          >
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

            <div className="shell-links">
              <ShellLinks />
            </div>
            <ShellEvents organisationId={organisation?.id ?? null} />
          </DeskSidebar>
        </aside>

        <header className="shell-band" inert={menuOpen}>
          <p className="shell-crumb">
            {organisation?.name ?? session.pausedIn?.name}
            {/* A screen standing in for the page leaves only the organisation (pm, 2 Nov). */}
            {standIn == null && (
              <>
                <span aria-hidden="true"> / </span>
                <b>
                  <Destination />
                </b>
              </>
            )}
          </p>
          <NotificationsBell userId={session.userId} />
          <LanguagePicker automatic={false} pill />
        </header>

        <main id="content" className="shell-content" inert={menuOpen}>
          <OfflineBand />
          <LinkedNotice />
          {organisation != null && session.pausedIn == null && (
            <SignInRulesNotices key={organisation.id} organisation={organisation} />
          )}
          {/* Said on the page it happened on, and gone once the person moves on. */}
          {switched != null && switched.at === pathname && switched.id === organisation?.id && (
            <Switched name={switched.name} takesFocus={switched.takesFocus === true} />
          )}

          <ErrorBoundary>
            {standIn != null && !atSettings ? standIn : <Outlet context={standIn} />}
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
    </OfflineProvider>
  );
}

const PLACES: readonly (readonly [string, 'today' | 'events' | 'calendar', GlyphName])[] = [
  ['/app', 'today', 'today'],
  ['/app/events', 'events', 'events'],
  ['/app/calendar', 'calendar', 'calendar'],
];

function placeLook({ isActive }: { isActive: boolean }): string {
  return isActive ? 'today-place is-on' : 'today-place';
}

/** The sidebar's places, or inside an event its own: in the sidebar on a desk, in the menu on a phone. */
function ShellLinks({ onFollow }: { onFollow?: () => void }) {
  const { t } = useTranslation();
  const inside = useInsideEvent();

  if (inside != null) return <EventNav inside={inside} onFollow={onFollow} />;

  return (
    <ul className="today-places">
      {PLACES.map(([to, word, glyph]) => (
        <li key={to}>
          <NavLink className={placeLook} to={to} end={to === '/app'} onClick={onFollow}>
            <Glyph name={glyph} />
            {t(`nav.${word}`)}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

/** Your events under the places, as Today lists them; an event's page has its own sidebar instead. */
function ShellEvents({ organisationId }: { organisationId: string | null }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const inside = useInsideEvent();
  const events = useSidebarEvents(organisationId, pathname);

  if (inside != null) return null;

  return (
    <DeskEvents
      heading={t('today.yourEvents')}
      events={events}
      to={(id) => `/app/events/${encodeURIComponent(id)}`}
    />
  );
}

/** Settings, and the person at the sidebar's foot, who opens their account. */
function ShellFoot({ onFollow }: { onFollow?: () => void }) {
  const { t } = useTranslation();
  const session = useSession();
  const organisation = session.organisation;
  const role = organisation == null ? null : roleName(t, organisation.role);
  const person = { name: session.name, initials: initials(session.name), role };

  return (
    <>
      <NavLink className={placeLook} to="/app/settings" onClick={onFollow}>
        <Glyph name="settings" />
        {t('nav.settings')}
      </NavLink>
      <NavLink
        className="today-person"
        to="/app/account"
        aria-label={role == null ? session.name : t('nav.person', { name: session.name, role })}
        onClick={onFollow}
      >
        <DeskPersonFace person={person} />
      </NavLink>
    </>
  );
}

/** Where the person is, after the organisation in the band's crumb: inside an event, its name once loaded. */
function Destination() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const inside = useInsideEvent();
  const eventName = useShownEventName(inside?.eventId);

  if (inside != null) return eventName ?? t(`eventNav.${inside.area}`);
  if (pathname.startsWith('/app/account')) return t('nav.account');

  const section = ['events', 'calendar', 'settings'].find((name) =>
    pathname.startsWith(`/app/${name}`),
  );

  return t(`nav.${section ?? 'today'}`);
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
        <Brand />
        <ShellLinks onFollow={onClose} />
        <div className="today-places">
          <ShellFoot onFollow={onClose} />
        </div>
        <LanguagePicker automatic={false} />
      </div>
    </>
  );
}

function switchOf(state: unknown): string | null {
  const switchTo =
    typeof state === 'object' && state != null && 'switchTo' in state ? state.switchTo : null;

  return typeof switchTo === 'string' ? switchTo : null;
}
