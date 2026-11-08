import { type KeyboardEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { Brand } from '../components/Brand.tsx';
import { Glyph, type GlyphName } from '../components/Glyph.tsx';
import { Avatar, Chevron, RowWords, type Tell } from '../components/SettingsParts.tsx';
import { Toast } from '../components/Toast.tsx';
import { DOOR_EVENT, DOOR_PLACE } from './doorCode.ts';
import {
  NO_ORG,
  NO_ORG_VENUE,
  type NoOrgArea,
  type NoOrgState,
  levelLine,
  noOrgStart,
  whenLine,
} from './noOrg.ts';
import './today.css';
import '../components/SettingsParts.css';
import './events.css';
import './people.css';
import './doorCode.css';

const GLYPHS: Record<NoOrgArea, GlyphName> = {
  checkIn: 'tick',
  overview: 'overview',
  guests: 'users',
  schedule: 'clock',
  seating: 'seating',
  people: 'people',
};

const PIECES = [1, 2, 3, 4, 5, 6];

/** Inside the event it joined, at a desk, for an account with no organisation: its level's areas only, and Your account and Sign out from the person button (sc-71). */
export function NoOrgEvent({ state }: { state: NoOrgState }) {
  const [start] = useState(() => noOrgStart(state));
  const [told, setTold] = useState<string | null>(null);
  const tell = useCallback<Tell>((words) => setTold(words), []);
  const checkIn = start.areas.includes('checkIn');

  return (
    <div className="today desk">
      <nav className="today-side people-side" aria-label={DOOR_EVENT}>
        <div className="today-logo">
          <Brand lockup />
        </div>
        <div className="people-event">
          <div className="people-event-card">
            <span className="today-cover is-wed people-event-cover" aria-hidden="true" />
            <span className="today-grow">
              <span className="people-event-name">{DOOR_EVENT}</span>
              <span className="people-event-when">{DOOR_PLACE.when}</span>
            </span>
          </div>
        </div>
        <ul className="today-places">
          {start.areas.map((area) => (
            <li key={area}>
              <button
                type="button"
                className={area === 'overview' ? 'today-place is-on' : 'today-place'}
                aria-current={area === 'overview' ? 'page' : undefined}
                onClick={() => area !== 'overview' && tell(NO_ORG.later(NO_ORG[area]))}
              >
                <Glyph name={GLYPHS[area]} />
                {NO_ORG[area]}
              </button>
            </li>
          ))}
        </ul>
        <div className="today-grow" />
        <PersonMenu
          name={start.name}
          initials={start.initials}
          tone={start.tone}
          role={start.code.role}
          opening={start.menu}
          tell={tell}
        />
      </nav>
      <main id="content" className="desk-main">
        <div className="desk-page">
          <div className="desk-column">
            <section className="ev-card today-cover is-wed" aria-labelledby="no-org-event">
              {PIECES.map((piece) => (
                <span key={piece} className={`desk-piece p${piece}`} aria-hidden="true" />
              ))}
              <div className="ev-card-inner">
                <p className="desk-on-card">{whenLine()}</p>
                <h1 id="no-org-event" className="ev-card-name" tabIndex={-1}>
                  {DOOR_EVENT}
                </h1>
                <p className="desk-on-card">{NO_ORG_VENUE}</p>
                <p className="desk-on-card">{levelLine(start.code)}</p>
                {checkIn && (
                  <button
                    type="button"
                    className="desk-step"
                    onClick={() => tell(NO_ORG.later(NO_ORG.checkIn))}
                  >
                    {NO_ORG.checkIn}
                    <Glyph name="arrow" size={16} weight={2.4} />
                  </button>
                )}
              </div>
            </section>
            <ul className="desk-rows has-lead">
              {(
                [
                  ['guests', NO_ORG.guestsLine],
                  ['people', NO_ORG.onEvent(start.onEvent)],
                ] as const
              ).map(([area, line]) => (
                <li key={area}>
                  <button
                    type="button"
                    className="desk-row"
                    onClick={() => tell(NO_ORG.later(NO_ORG[area]))}
                  >
                    <span className="no-org-lead" aria-hidden="true">
                      <Glyph name={GLYPHS[area]} size={20} />
                    </span>
                    <RowWords title={NO_ORG[area]} lines={[line]} />
                    <Chevron />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
      {told != null && <Toast key={told} words={told} onClose={() => setTold(null)} />}
    </div>
  );
}

/** The person button at the sidebar's foot, the desk's version of the app's More: Your account and Sign out, as a menu. */
function PersonMenu({
  name,
  initials,
  tone,
  role,
  opening,
  tell,
}: {
  name: string;
  initials: string;
  tone: number;
  role: string;
  opening: boolean;
  tell: Tell;
}) {
  const id = useId();
  const navigate = useNavigate();
  const [open, setOpen] = useState(opening);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const items = () => [...(menu.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])];
  const close = useCallback((back: boolean) => {
    setOpen(false);
    if (back) button.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !button.current?.contains(target)) close(false);
    };
    document.addEventListener('pointerdown', outside);

    return () => document.removeEventListener('pointerdown', outside);
  }, [open, close]);

  function keys(event: KeyboardEvent): void {
    const all = items();
    const at = all.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'Tab') close(false);
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = at + (event.key === 'ArrowDown' ? 1 : -1);
      all[(next + all.length) % all.length]?.focus();
    }
  }

  return (
    <div className="today-places no-org-person">
      {open && (
        <ul
          ref={menu}
          id={`${id}-menu`}
          className="desk-menu no-org-menu"
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
                close(true);
                tell(NO_ORG.later(NO_ORG.yourAccount));
              }}
            >
              <span className="desk-menu-tick">
                <Glyph name="user" size={17} />
              </span>
              {NO_ORG.yourAccount}
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="desk-menu-item"
              onClick={() => void navigate('/demo/redeem?state=signed-out')}
            >
              <span className="desk-menu-tick">
                <SignOutMark />
              </span>
              {NO_ORG.signOut}
            </button>
          </li>
        </ul>
      )}
      <button
        ref={button}
        id={`${id}-button`}
        type="button"
        className="today-person"
        aria-label={`${name}, ${role}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        <Avatar initials={initials} tone={tone} size="small" />
        <span className="today-grow today-person-words" aria-hidden="true">
          <span className="today-person-name">{name}</span>
          <span className="today-person-role">{role}</span>
        </span>
        <Glyph name="updown" size={15} />
      </button>
    </div>
  );
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
