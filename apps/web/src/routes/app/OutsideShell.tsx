import type { Membership, OutsideEvent } from '@soirely/api-client';
import { initials, outsideEventsInOrder, roleName } from '@soirely/domain';
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router';

import { api } from '../../api.ts';
import { DeskPersonFace, DeskSidebar } from '../../components/DeskSidebar.tsx';
import { ErrorBoundary } from '../../components/ErrorBoundary.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { LinkedNotice } from '../../components/LinkedNotice.tsx';
import { OfflineBand, OfflineBox, OfflineProvider } from '../../components/OfflineBand.tsx';
import { SkipLink } from '../../components/SkipLink.tsx';
import { outsideAreas } from '../../components/eventSideAreas.ts';
import { rereadOutsideEvents, useSession } from '../../session.ts';
import { useSignOut } from '../../signOut.ts';
import { MenuGroup, OrganisationRow, OutsideEventRow } from '../../components/OutsideRows.tsx';
import { EventNav, eventAreaPath, useInsideEvent } from './events/EventNav.tsx';
import { openedFrom, useRoutedEventId } from './outsideRoute.ts';
import '../../components/SettingsParts.css';
import './outside.css';

const EDGE = 12;

/** A member of an organisation inside another's event they hold from outside (sc-68438): their organisations, each opening its Today. */
export interface MemberWay {
  organisations: readonly Membership[];
  onOpen: (organisation: Membership) => void;
}

/** Inside an event held from outside an organisation (sc-71): its level's areas, and from the person at the sidebar's foot the account's other events and, for a member, its organisations (sc-68438), then Your account and Sign out. */
export function OutsideShell({
  events,
  member = null,
  shown = [],
}: {
  events: readonly OutsideEvent[];
  member?: MemberWay | null;
  /** Events the account held when the page was opened, for the shell around a not-found once none is left. */
  shown?: readonly OutsideEvent[];
}) {
  const { t } = useTranslation();
  const { pathname, state } = useLocation();
  const routed = useInsideEvent();
  const routedId = useRoutedEventId();
  const [now] = useState(() => new Date());
  const atAccount = pathname === '/app/account' || pathname.startsWith('/app/account/');
  const held = routedId == null ? null : (events.find((one) => one.id === routedId) ?? null);
  const gone = !atAccount && routedId != null && held == null;
  const from = openedFrom(state);
  const landing = outsideEventsInOrder(events, now)[0] ?? null;
  const event =
    held ??
    (gone
      ? (events.find((one) => one.id === from) ?? shown.find((one) => one.id === from))
      : null) ??
    landing ??
    (gone ? (shown[0] ?? null) : null);
  const heldId = held?.id;

  useEffect(() => {
    if (heldId != null) void rereadOutsideEvents().catch(() => undefined);
  }, [heldId]);

  if (event == null) return <Navigate replace to="/app" />;

  const areas = outsideAreas(event.role);

  if (!atAccount && !gone && (held == null || routed == null || !areas.includes(routed.area))) {
    return <Navigate replace to={eventAreaPath(event.id, 'overview')} />;
  }

  return (
    <OfflineProvider>
      <div className="shell is-bandless">
        <SkipLink />
        <aside className="shell-sidebar">
          <DeskSidebar
            label={t('app.name')}
            pill={null}
            foot={
              <OutsidePerson
                role={t(`eventPeople.role.${event.role}`)}
                groups={
                  member == null && events.length < 2
                    ? null
                    : { events, member, here: held?.id ?? null, now }
                }
              />
            }
          >
            <div className="shell-links">
              <EventNav
                inside={
                  !gone && routed != null
                    ? routed
                    : { eventId: event.id, area: null, onPage: false }
                }
                onFollow={undefined}
                areas={areas}
                back={false}
              />
            </div>
          </DeskSidebar>
        </aside>
        <main id="content" className="shell-content is-card">
          {atAccount ? <OfflineBand /> : <OfflineBox />}
          <LinkedNotice />
          <ErrorBoundary>
            {gone ? <OutsideGone eventId={routedId} /> : <Outlet context={null} />}
          </ErrorBoundary>
        </main>
      </div>
    </OfflineProvider>
  );
}

interface Groups {
  events: readonly OutsideEvent[];
  member: MemberWay | null;
  here: string | null;
  now: Date;
}

function MenuGroups({ groups, close }: { groups: Groups; close: (back: boolean) => void }) {
  const { events, member, here, now } = groups;

  return (
    <>
      {member != null && <MemberGroup member={member} close={close} />}
      {events.length > 1 && <EventsGroup events={events} here={here} now={now} close={close} />}
    </>
  );
}

function MemberGroup({ member, close }: { member: MemberWay; close: (back: boolean) => void }) {
  const { t } = useTranslation();

  return (
    <MenuGroup heading={t('outsideEvent.yourOrganisations')}>
      {member.organisations.map((organisation) => (
        <OrganisationRow
          key={organisation.id}
          id={organisation.id}
          name={organisation.name}
          role={roleName(t, organisation.role)}
          onChoose={() => {
            close(false);
            member.onOpen(organisation);
          }}
        />
      ))}
    </MenuGroup>
  );
}

function EventsGroup({
  events,
  here,
  now,
  close,
}: {
  events: readonly OutsideEvent[];
  here: string | null;
  now: Date;
  close: (back: boolean) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <MenuGroup heading={t('outsideEvent.yourEvents')}>
      {outsideEventsInOrder(events, now).map((one) => (
        <OutsideEventRow
          key={one.id}
          event={one}
          here={one.id === here}
          now={now}
          role="menuitem"
          className="desk-menu-item oe-row"
          onChoose={() => {
            close(one.id === here);
            if (one.id !== here)
              void navigate(eventAreaPath(one.id, 'overview'), { state: { from: here } });
          }}
        />
      ))}
    </MenuGroup>
  );
}

/** The product's not-found for an event, for an account with no organisation: no Events to go back to, so back to the event it came from, else the one it would land on, else on to the no-organisation home (sc-68438). */
export function OutsideGone({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const session = useSession();
  const navigate = useNavigate();
  const from = openedFrom(useLocation().state);
  const [live, setLive] = useState<readonly OutsideEvent[] | null>(null);
  const [now] = useState(() => new Date());
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => heading.current?.focus(), [eventId]);

  useEffect(() => {
    let current = true;
    api.me().then(
      (account) => current && setLive(account.outsideEvents),
      () => undefined,
    );

    return () => {
      current = false;
    };
  }, [eventId]);

  const others = (live ?? session.outsideEvents ?? []).filter((one) => one.id !== eventId);
  const back = others.find((one) => one.id === from) ?? outsideEventsInOrder(others, now)[0];

  return (
    <section className="card oe-gone">
      <h1 ref={heading} tabIndex={-1}>
        {t('eventPage.notFound')}
      </h1>
      <button
        type="button"
        className="button"
        onClick={() => {
          void rereadOutsideEvents()
            .catch(() => undefined)
            .then(() => navigate(back == null ? '/app' : eventAreaPath(back.id, 'overview')));
        }}
      >
        {back == null ? t('outsideEvent.continue') : t('outsideEvent.backTo', { name: back.name })}
      </button>
    </section>
  );
}

/** The desk's version of the app's More: the person button opens the account's groups, then Your account and Sign out, as a menu. */
function OutsidePerson({ role, groups }: { role: string; groups: Groups | null }) {
  const { t } = useTranslation();
  const session = useSession();
  const navigate = useNavigate();
  const id = useId();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const wide = groups != null;
  const { signOut } = useSignOut(() => void navigate('/sign-in'));
  const close = useCallback((back: boolean) => {
    setOpen(false);
    if (back) button.current?.focus();
  }, []);

  useLayoutEffect(() => {
    const drop = menu.current;
    const opener = button.current;
    if (!open || !wide || drop == null || opener == null) return;

    const place = (): void => {
      const box = opener.getBoundingClientRect();
      drop.style.setProperty('left', `${box.left}px`);
      drop.style.setProperty('bottom', `${window.innerHeight - box.top + 4}px`);
      drop.style.setProperty('max-height', `${Math.max(0, box.top - EDGE)}px`);
    };
    place();
    window.addEventListener('resize', place);

    return () => window.removeEventListener('resize', place);
  }, [open, wide]);

  useEffect(() => {
    if (!open) return;
    itemsOf(menu.current)[0]?.focus();
    const away = (event: PointerEvent): void => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !button.current?.contains(target)) close(false);
    };
    document.addEventListener('pointerdown', away);

    return () => document.removeEventListener('pointerdown', away);
  }, [open, close]);

  function keys(event: KeyboardEvent): void {
    const all = itemsOf(menu.current);
    const at = all.indexOf(document.activeElement as HTMLElement);

    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'Tab') close(false);
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = at + (event.key === 'ArrowDown' ? 1 : -1);
      all[(next + all.length) % all.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      (event.key === 'Home' ? all[0] : all.at(-1))?.focus();
    }
  }

  return (
    <div className="outside-person">
      {open && (
        <div
          ref={menu}
          id={`${id}-menu`}
          className={wide ? 'desk-menu outside-menu is-wide' : 'desk-menu outside-menu'}
          role="menu"
          tabIndex={-1}
          aria-labelledby={`${id}-button`}
          onKeyDown={keys}
        >
          {groups != null && <MenuGroups groups={groups} close={close} />}
          <div role="none" className="oe-group">
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="desk-menu-item"
              onClick={() => {
                close(false);
                void navigate('/app/account');
              }}
            >
              <span className="desk-menu-tick">
                <Glyph name="user" size={17} />
              </span>
              {t('nav.account')}
            </button>
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="desk-menu-item"
              onClick={() => {
                close(false);
                void signOut();
              }}
            >
              <span className="desk-menu-tick">
                <Glyph name="signOut" size={17} />
              </span>
              {t('nav.signOut')}
            </button>
          </div>
        </div>
      )}
      <button
        ref={button}
        id={`${id}-button`}
        type="button"
        className="today-person"
        aria-label={t('nav.person', { name: session.name, role })}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        <DeskPersonFace person={{ name: session.name, initials: initials(session.name), role }} />
      </button>
    </div>
  );
}

function itemsOf(menu: HTMLDivElement | null): HTMLElement[] {
  return [...(menu?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])];
}
