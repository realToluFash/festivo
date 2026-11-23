import type { OutsideEvent } from '@soirely/api-client';
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
import { LinkedNoticeFor, useLinkedProvider } from '../../components/LinkedNotice.tsx';
import { NotificationsBell } from '../../components/NotificationsBell.tsx';
import { OfflineBand, OfflineBox, OfflineProvider } from '../../components/OfflineBand.tsx';
import { SignInRulesNotices } from '../../components/SignInRulesNotices.tsx';
import { AccessPaused } from '../../components/AccessPaused.tsx';
import { Switched } from '../../components/Switched.tsx';
import { TwoFactorOverdue } from '../../components/TwoFactorOverdue.tsx';
import { SearchRow, ShellSearch } from '../../components/ShellSearch.tsx';
import { SkipLink } from '../../components/SkipLink.tsx';
import {
  canAnywhere,
  joinOrganisation,
  landingFor,
  onMovedOn,
  outsideOn,
  rereadOrganisations,
  restoreSession,
  switchOrganisation,
  useSession,
  useSessionState,
} from '../../session.ts';
import { useSidebarEvents } from '../../sidebarEvents.ts';
import { useInvitationAnswers, useWaitingInvitations } from '../../invitations.ts';
import { UNASKED } from '../../pageArrival.ts';
import { useDomainOffer } from '../../joinOffers.ts';
import { NoOrganisation } from './NoOrganisation.tsx';
import { AloneHeader } from '../../components/NoOrganisationParts.tsx';
import { OutsideShell } from './OutsideShell.tsx';
import { useRoutedEventId } from './outsideRoute.ts';
import { heldRegistration } from '../../pendingRegistration.ts';
import { holdReturn } from '../../heldReturn.ts';
import { useTwoFactorStanding } from '../../twoFactorStanding.ts';
import { useDialogKeys } from '../../dialogFocus.ts';
import { PHONE_WIDTH, usePhoneWidth } from '../../phoneWidth.ts';
import { DeskTopContext, fitsPhone, placesItsNotices } from '../../deskTop.ts';
import { EventNav, type InsideEvent, eventAreaPath, useInsideEvent } from './events/EventNav.tsx';
import { EventHandoff } from './events/EventHandoff.tsx';
import { type Handoff, useHandoff } from './events/handoff.ts';
import { Skeleton } from '../../components/Skeleton.tsx';
import { arriveAt, pageStart } from '../../pageArrival.ts';
import './narrowDesk.css';
import './wideDesk.css';

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
 *
 * Bare, it is the same gate around a page that is not the desk: Preview as
 * guest shows the guest's page as a guest sees it.
 */
export function AppLayout({ bare = false }: { bare?: boolean }) {
  const state = useSessionState();
  const { pathname, search } = useLocation();

  useEffect(() => {
    void restoreSession();
  }, []);

  if (state.status === 'signedOut') {
    // A sign-up waiting on its code has no session yet: it goes back to its code, not to sign-in.
    if (heldRegistration() != null) return <Navigate to="/verify-email" replace />;
    // A link opened signed out comes back after sign-in; a session left or ended here does not.
    if (state.arrived) holdReturn(`${pathname}${search}`);

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

  if (bare) return <Outlet />;

  const { organisation, pausedIn } = state.session;

  return (
    <ShellSearch organisationId={pausedIn == null ? (organisation?.id ?? null) : null}>
      <Shell />
    </ShellSearch>
  );
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
  const routedEvent = useRoutedEventId();
  const answers = useInvitationAnswers();
  const waiting = useWaitingInvitations(answers);
  const closeCreate = useCallback(() => setCreating(false), []);
  const [provider, dropProvider] = useLinkedProvider();
  const linked = <LinkedNoticeFor provider={provider} onDismiss={dropProvider} />;
  const offer = useDomainOffer();
  const overdue = useTwoFactorStanding(organisation) === 'overdue';
  const switchTo = switchOf(location.state);
  const atPhone = usePhoneWidth();
  const fits = fitsPhone(pathname);
  // Wider than a phone no page has the band (sc-39509, sc-60699): each page's own top carries the bell, as Today, Events and Calendar do in a phone's window (sc-57468).
  const bandless = !atPhone || fits;
  const ownNotices = placesItsNotices(pathname);
  // An event's areas at a desk say they are offline in Events' amber box, above their crumb row (sc-65646).
  const boxed = bandless && !ownNotices && pathname.startsWith('/app/events/');

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
      <TwoFactorOverdue
        organisation={organisation}
        others={session.organisations.filter((other) => other.id !== organisation.id)}
      />
    ) : null;

  const { handoff, showAnyway } = useHandoff(pathname, organisation?.id ?? null, standIn == null);
  useArrivesFromHandoff(handoff);

  // Said on the page it happened on, and gone once the person moves on.
  const said = switched != null && switched.at === pathname && switched.id === organisation?.id && (
    <Switched name={switched.name} takesFocus={switched.takesFocus === true} />
  );
  const rules = organisation != null && session.pausedIn == null && (
    <SignInRulesNotices key={organisation.id} organisation={organisation} />
  );

  const [landing, ...others] = session.outsideEvents ?? [];
  const [lastHeld, setLastHeld] = useState<readonly OutsideEvent[]>([]);
  if (session.outsideEvents != null && landing != null && session.outsideEvents !== lastHeld)
    setLastHeld(session.outsideEvents);
  if (organisation == null && session.pausedIn == null && landing != null) {
    return <OutsideShell events={[landing, ...others]} />;
  }

  // The last grant gone while its event was open: the not-found page still stands in the shell it was opened from, its way on Continue (sc-68438).
  if (
    organisation == null &&
    session.pausedIn == null &&
    routedEvent != null &&
    !atAccount &&
    lastHeld.length > 0
  ) {
    return <OutsideShell events={[]} shown={lastHeld} />;
  }

  // A member inside another organisation's event they hold from outside sees none of either organisation's places beside it (sc-68438).
  if (organisation != null && session.pausedIn == null && outsideOn(session, routedEvent) != null) {
    return (
      <OutsideShell
        events={session.outsideEvents ?? []}
        member={{
          organisations: session.organisations,
          onOpen: (next) => {
            switchOrganisation(next.id);
            void navigate('/app');
          },
        }}
      />
    );
  }

  // Every product page would open this page again, so it stands alone: only what works without an organisation, the account pages under the same header.
  if (organisation == null && session.pausedIn == null) {
    return (
      <div className={atAccount ? 'no-organisation-page' : 'cw-alone desk'}>
        <SkipLink />
        <AloneHeader>
          <LanguagePicker automatic={false} desk />
        </AloneHeader>
        {atAccount ? (
          <main id="content" className="shell-content no-organisation-account">
            {linked}
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
            {linked}
            <ErrorBoundary>
              <NoOrganisation
                waiting={answers}
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
      <div
        className={['shell', bandless && 'is-bandless', fits && 'fits-phone']
          .filter(Boolean)
          .join(' ')}
      >
        <SkipLink inert={menuOpen} />

        <aside ref={sidebar} className="shell-sidebar" inert={menuOpen}>
          <DeskSidebar
            label={t('app.name')}
            pill={
              (organisation != null || session.pausedIn != null) && (
                <OrganisationSwitcher
                  current={organisation}
                  organisations={session.organisations}
                  waiting={waiting}
                  offer={offer}
                  email={session.email}
                  paused={session.pausedIn ?? null}
                  opened={choosing}
                  outside={session.outsideEvents ?? []}
                  onSwitch={switchInto}
                  onOutside={(id) => void navigate(eventAreaPath(id, 'overview'))}
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
              <SearchRow />
              <ShellLinks />
            </div>
            <ShellEvents organisationId={organisation?.id ?? null} />
          </DeskSidebar>
        </aside>

        {!bandless && (
          <header className="shell-band" inert={menuOpen}>
            <NotificationsBell userId={session.userId} />
          </header>
        )}

        <main
          id={handoff.kind === 'shown' ? undefined : 'content'}
          className={bandless ? 'shell-content is-card' : 'shell-content'}
          inert={menuOpen}
        >
          {boxed ? <OfflineBox /> : !(bandless && ownNotices) && <OfflineBand />}
          {!(bandless && ownNotices) && linked}
          {!(bandless && ownNotices) && rules}
          {!(bandless && ownNotices) && said}

          <DeskTopContext
            value={
              bandless
                ? {
                    bell: <NotificationsBell userId={session.userId} look="desk" />,
                    said: ownNotices ? said : null,
                    above: ownNotices ? (
                      <>
                        <OfflineBox />
                        {linked}
                        {rules}
                      </>
                    ) : null,
                  }
                : NO_DESK_TOP
            }
          >
            <ErrorBoundary>
              {handoff.kind === 'shown' ? (
                <EventHandoff page={handoff.page} name={handoff.name} onShowAnyway={showAnyway} />
              ) : handoff.kind === 'loading' ? (
                <Skeleton words={t('eventPage.loading')} shape="rows" rowHeight={56} />
              ) : standIn != null && !atSettings ? (
                <>
                  {bandless && ownNotices && (
                    <>
                      <OfflineBox />
                      {linked}
                      {rules}
                      {said}
                    </>
                  )}
                  {standIn}
                </>
              ) : (
                <Outlet context={standIn} />
              )}
            </ErrorBoundary>
          </DeskTopContext>
        </main>

        {menuOpen && (
          <ShellMenu
            id={menuId}
            onClose={closeMenu}
            returnFocus={returnFromMenu}
            inside={handoffInside(handoff)}
          />
        )}

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

const NO_DESK_TOP = { bell: null, said: null, above: null };

/** The run page marks no area, and its handoff's Menu still lists the event's areas, none lit (`EventHandoff.dc.html`). */
function handoffInside(handoff: Handoff): ShownInside | undefined {
  if (handoff.kind !== 'shown' || handoff.page.kind !== 'event' || handoff.page.area != null)
    return undefined;

  return { eventId: handoff.page.eventId, area: null, onPage: false };
}

/** The page that takes the handoff's place, on Show this page anyway or a wider window, is arrived at as one opened from a link. */
function useArrivesFromHandoff(handoff: Handoff): void {
  const was = useRef(handoff.kind);

  useEffect(() => {
    const before = was.current;
    was.current = handoff.kind;
    if (before !== 'shown' || handoff.kind !== 'none') return;

    return arriveAt(pageStart, () => undefined);
  }, [handoff.kind]);
}

type ShownInside = Omit<InsideEvent, 'area'> & { area: InsideEvent['area'] | null };

const PLACES: readonly (readonly [
  string,
  'today' | 'events' | 'calendar' | 'menuLibrary',
  GlyphName,
  string | null,
])[] = [
  ['/app', 'today', 'today', null],
  ['/app/events', 'events', 'events', null],
  ['/app/calendar', 'calendar', 'calendar', null],
  ['/app/menu-library', 'menuLibrary', 'menu', 'menu.read'],
];

function placeLook({ isActive }: { isActive: boolean }): string {
  return isActive ? 'today-place is-on' : 'today-place';
}

/** The sidebar's places, or inside an event its own: in the sidebar on a desk, in the menu on a phone. */
function ShellLinks({
  onFollow,
  shown,
}: {
  onFollow?: () => void;
  shown?: ShownInside | undefined;
}) {
  const { t } = useTranslation();
  const session = useSession();
  const routed = useInsideEvent();
  const inside = shown ?? routed;

  if (inside != null) return <EventNav inside={inside} onFollow={onFollow} />;

  return (
    <ul className="today-places">
      {PLACES.filter(([, , , needs]) => needs == null || canAnywhere(session, needs)).map(
        ([to, word, glyph]) => (
          <li key={to}>
            <NavLink className={placeLook} to={to} end={to === '/app'} onClick={onFollow}>
              <Glyph name={glyph} />
              {t(`nav.${word}`)}
            </NavLink>
          </li>
        ),
      )}
    </ul>
  );
}

/** Your events under the places, as Today lists them; an event's page has its own sidebar instead. */
function ShellEvents({ organisationId }: { organisationId: string | null }) {
  const { t } = useTranslation();
  const inside = useInsideEvent();
  const events = useSidebarEvents(organisationId, inside == null);

  if (inside != null) return null;

  return (
    <DeskEvents
      heading={t('today.yourEvents')}
      events={events}
      to={(id) => `/app/events/${encodeURIComponent(id)}`}
    />
  );
}

/** Settings, and the person at the sidebar's foot, who opens their account. A paused membership holds no role, so the person is named alone while the pill names it (sc-86077). */
function ShellFoot({ onFollow }: { onFollow?: () => void }) {
  const { t } = useTranslation();
  const session = useSession();
  const organisation = session.pausedIn == null ? session.organisation : null;
  const role = organisation == null ? null : roleName(t, organisation.role);
  const person = { name: session.name, initials: initials(session.name), role };
  const atAccount = useLocation().pathname.startsWith('/app/account');

  return (
    <>
      <NavLink
        className={({ isActive }) => placeLook({ isActive: isActive || atAccount })}
        to="/app/settings"
        onClick={onFollow}
      >
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

/** `AppShell-Phone`'s sheet: a modal dialog, so focus goes back to Menu when it closes. */
function ShellMenu({
  id,
  onClose,
  returnFocus,
  inside,
}: {
  id: string;
  onClose: () => void;
  returnFocus: (opener: HTMLElement | null) => void;
  inside: ShownInside | undefined;
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
        <ShellLinks onFollow={onClose} shown={inside} />
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
