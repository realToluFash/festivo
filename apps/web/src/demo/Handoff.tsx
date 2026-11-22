import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { LOCALES } from '@soirely/domain';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';

import { Brand } from '../components/Brand.tsx';
import { DeskPersonFace, DeskSidebar } from '../components/DeskSidebar.tsx';
import { Glyph } from '../components/Glyph.tsx';
import { Toast } from '../components/Toast.tsx';
import { SIDE_AREA_GLYPHS } from '../components/eventSideAreas.ts';
import { useDialogKeys } from '../dialogFocus.ts';
import { PHONE_WIDTH, usePhoneWidth } from '../phoneWidth.ts';
import { DemoBell } from './DemoBell.tsx';
import { NotFound } from '../routes/public/NotFound.tsx';
import { AREAS } from './events.ts';
import {
  type Handoff,
  HW,
  areaName,
  handoffAt,
  handoffOf,
  pageOf,
  showAnyway,
  shownAnyway,
} from './handoff.ts';
import { OrgSwitcher } from './OrgSwitcher.tsx';
import { VIEWERS, settingsPath } from './settings.ts';
import '../components/eventSide.css';
import './handoff.css';

const PLACES = [
  ['/demo/today', 'Today', 'today'],
  ['/demo/events', 'Events', 'events'],
  ['/demo/calendar', 'Calendar', 'calendar'],
] as const;

/** sc-55397: at 640 px or narrower an event's page opens on this, in the shell's phone bar; wider, or once shown anyway, the page itself. */
export function HandoffPage() {
  const [params] = useSearchParams();
  const handoff = handoffOf(params);
  const [openedNarrow] = useState(() => window.matchMedia(PHONE_WIDTH).matches);
  const narrow = usePhoneWidth();

  if (handoff == null) return <NotFound />;
  if (!openedNarrow || !narrow || shownAnyway()) return <Navigate to={pageOf(handoff)} replace />;

  return <Shell key={params.toString()} handoff={handoff} params={params} />;
}

function Shell({ handoff, params }: { handoff: Handoff; params: URLSearchParams }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [told, setTold] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    menuButton.current?.focus();
  }, []);

  useEffect(() => heading.current?.focus(), []);

  const area = handoff.kind === 'event' && handoff.area != null ? areaName(handoff.area) : null;

  return (
    <div className="shell ho">
      <a className="skip-link" href="#content" inert={menuOpen}>
        {HW.skip}
      </a>

      <aside className="shell-sidebar" inert={menuOpen}>
        <DeskSidebar
          label="Soirely"
          pill={
            <div className="org-switcher">
              <OrgSwitcher tell={setTold} />
            </div>
          }
          foot={null}
        >
          <button
            ref={menuButton}
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
            {HW.menu}
          </button>
        </DeskSidebar>
      </aside>

      <header className="shell-band" inert={menuOpen}>
        <DemoBell tell={setTold} />
      </header>

      <main className="shell-content ho-main" inert={menuOpen}>
        <div className="ho-card">
          <span className="ho-glyph" aria-hidden="true">
            <Glyph name="device" size={22} />
          </span>
          {area != null && <p className="ho-area">{area}</p>}
          <h1 ref={heading} id="content" className="ho-title" tabIndex={-1}>
            {handoff.kind === 'new' ? HW.newEvent : handoff.name}
          </h1>
          <p className="ho-line">{HW.line}</p>
          <button
            type="button"
            className="button ho-anyway"
            onClick={() => {
              showAnyway();
              void navigate(pageOf(handoff), { replace: true });
            }}
          >
            {HW.anyway}
          </button>
        </div>
      </main>

      {menuOpen && (
        <HandoffMenu
          id={menuId}
          handoff={handoff}
          params={params}
          onClose={closeMenu}
          tell={setTold}
        />
      )}
      {told != null && <Toast key={told} words={told} onClose={() => setTold(null)} />}
    </div>
  );
}

/** Menu's sheet as the shell draws it (sc-13413); inside an event it lists the event's areas, each opening its own handoff. */
function HandoffMenu({
  id,
  handoff,
  params,
  onClose,
  tell,
}: {
  id: string;
  handoff: Handoff;
  params: URLSearchParams;
  onClose: () => void;
  tell: (words: string) => void;
}) {
  const [language, setLanguage] = useState('en');
  const you = VIEWERS.folake;

  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => close.current?.focus(), []);
  useDialogKeys(dialog, onClose, false);

  return (
    <>
      <button
        type="button"
        className="dialog-scrim"
        tabIndex={-1}
        aria-label={HW.closeMenu}
        onClick={onClose}
      />
      <div
        ref={dialog}
        id={id}
        className="shell-menu"
        role="dialog"
        aria-modal="true"
        aria-label={HW.menu}
        tabIndex={-1}
      >
        <button
          ref={close}
          type="button"
          className="dialog-close"
          aria-label={HW.closeMenu}
          onClick={onClose}
        >
          ✕
        </button>
        <Brand />
        {handoff.kind === 'event' ? (
          <nav className="ev-side-nav" aria-label={handoff.name}>
            <Link className="today-place ev-side-back" to="/demo/events">
              <Glyph name="back" size={17} weight={2.4} />
              {HW.events}
            </Link>
            <ul className="today-places">
              {AREAS.map((one) => {
                const current = one.area === handoff.area;

                return (
                  <li key={one.area}>
                    <Link
                      className={current ? 'today-place is-on' : 'today-place'}
                      to={handoffAt(handoff, one.area, params)}
                      aria-current={current ? 'page' : undefined}
                      onClick={onClose}
                    >
                      <Glyph name={SIDE_AREA_GLYPHS[one.area]} />
                      {one.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : (
          <ul className="today-places">
            {PLACES.map(([to, name, glyph]) => (
              <li key={to}>
                <Link
                  className={to === '/demo/events' ? 'today-place is-on' : 'today-place'}
                  to={to}
                >
                  <Glyph name={glyph} />
                  {name}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="today-places">
          <Link className="today-place" to="/demo/settings">
            <Glyph name="settings" />
            Settings
          </Link>
          <Link
            className="today-person"
            to={settingsPath('account', you)}
            aria-label={`${you.name}, ${you.role}`}
          >
            <DeskPersonFace person={you} />
          </Link>
        </div>
        <label className="language-picker">
          <span className="visually-hidden">{HW.language}</span>
          <select
            value={language}
            aria-label={HW.language}
            onChange={(e) => {
              setLanguage(e.target.value);
              tell(HW.languageSaved);
            }}
          >
            {LOCALES.map((locale) => (
              <option key={locale.code} value={locale.code}>
                {locale.nativeName}
              </option>
            ))}
          </select>
        </label>
      </div>
    </>
  );
}
