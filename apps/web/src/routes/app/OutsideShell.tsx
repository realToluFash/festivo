import type { OutsideEvent } from '@soirely/api-client';
import { initials } from '@soirely/domain';
import { type KeyboardEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router';

import { DeskPersonFace, DeskSidebar } from '../../components/DeskSidebar.tsx';
import { ErrorBoundary } from '../../components/ErrorBoundary.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { LinkedNotice } from '../../components/LinkedNotice.tsx';
import { OfflineBand, OfflineBox, OfflineProvider } from '../../components/OfflineBand.tsx';
import { SkipLink } from '../../components/SkipLink.tsx';
import { outsideAreas } from '../../components/eventSideAreas.ts';
import { useSession } from '../../session.ts';
import { useSignOut } from '../../signOut.ts';
import { EventNav, eventAreaPath, useInsideEvent } from './events/EventNav.tsx';
import '../../components/SettingsParts.css';
import './outside.css';

/** An account with no organisation, inside an event it holds from outside (sc-71): no Today, Events, Calendar or switcher, its level's areas, and Your account and Sign out from the person at the sidebar's foot. */
export function OutsideShell({ events }: { events: readonly [OutsideEvent, ...OutsideEvent[]] }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const routed = useInsideEvent();
  const atAccount = pathname === '/app/account' || pathname.startsWith('/app/account/');
  const held = routed == null ? null : (events.find((one) => one.id === routed.eventId) ?? null);
  const event = held ?? events[0];
  const areas = outsideAreas(event.role);

  if (!atAccount && (held == null || routed == null || !areas.includes(routed.area))) {
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
            foot={<OutsidePerson role={t(`eventPeople.role.${event.role}`)} />}
          >
            <div className="shell-links">
              <EventNav
                inside={routed ?? { eventId: event.id, area: null, onPage: false }}
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
            <Outlet context={null} />
          </ErrorBoundary>
        </main>
      </div>
    </OfflineProvider>
  );
}

/** The desk's version of the app's More: the person button opens Your account and Sign out, as a menu. */
function OutsidePerson({ role }: { role: string }) {
  const { t } = useTranslation();
  const session = useSession();
  const navigate = useNavigate();
  const id = useId();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const { signOut } = useSignOut(() => void navigate('/sign-in'));
  const close = useCallback((back: boolean) => {
    setOpen(false);
    if (back) button.current?.focus();
  }, []);

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
        <ul
          ref={menu}
          id={`${id}-menu`}
          className="desk-menu outside-menu"
          role="menu"
          aria-labelledby={`${id}-button`}
          onKeyDown={keys}
        >
          <li role="none">
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
          </li>
          <li role="none">
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
                <SignOutMark />
              </span>
              {t('nav.signOut')}
            </button>
          </li>
        </ul>
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

function itemsOf(menu: HTMLUListElement | null): HTMLElement[] {
  return [...(menu?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])];
}

function SignOutMark() {
  return (
    <svg
      width={17}
      height={17}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
