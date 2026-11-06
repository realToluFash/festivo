import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Toast } from '../components/Toast.tsx';
import { Glyph, type GlyphName } from './Glyph.tsx';
import {
  type Drawn,
  type Section,
  SECTION_NAMES,
  SIDEBAR_EVENTS,
  type Viewer,
  groupsFor,
  isDrawn,
  settingsPath,
  viewerOf,
} from './settings.ts';
import { Account } from './Account.tsx';
import { General } from './General.tsx';
import { LayersContext } from './layers.ts';
import { Members } from './Members.tsx';
import { Notifications } from './Notifications.tsx';
import { AccessPaused } from './OrgSwitcher.tsx';
import { Security } from './Security.tsx';
import { SignInRules } from './SignInRules.tsx';
import type { Tell } from './TodayParts.tsx';
import { TodaySidebar } from './TodaySidebar.tsx';
import { usePaused, useSwitcherStart } from './switcher.ts';
import './today.css';
import './settings.css';

const TILES: Record<Exclude<Section, 'account' | 'general'>, GlyphName> = {
  security: 'shield',
  notifications: 'bell',
  members: 'users',
  roles: 'key',
  signInRules: 'lock',
};

/** Settings at a desk in B · Summary first (Web-Settings.dc.html, page 29), on sample data. */
export function Settings({ open = 'members' }: { open?: Drawn }) {
  const [params] = useSearchParams();
  const viewer = viewerOf(params.get('as'));
  const state = params.get('state') ?? '';
  useSwitcherStart();
  const paused = usePaused();
  const [told, setTold] = useState<string | null>(null);
  const tell = useCallback<Tell>((words) => setTold(words), []);
  const [stack, setStack] = useState<readonly string[]>([]);
  const push = useCallback(
    (id: string) => setStack((now) => [...now.filter((one) => one !== id), id]),
    [],
  );
  const pop = useCallback((id: string) => setStack((now) => now.filter((one) => one !== id)), []);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const layers = useMemo(() => ({ stack, push, pop, host }), [stack, push, pop, host]);
  const covered = stack.length > 0;

  useEffect(() => {
    const search = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return;

      event.preventDefault();
      tell('Search has its own design.');
    };

    window.addEventListener('keydown', search);

    return () => window.removeEventListener('keydown', search);
  }, [tell]);

  return (
    <LayersContext value={layers}>
      <div className="today desk">
        <TodaySidebar
          events={SIDEBAR_EVENTS}
          tell={tell}
          settings
          person={viewer}
          inert={covered}
        />
        <main id="content" className="desk-main" inert={covered}>
          {paused && open !== 'account' ? (
            <div className="desk-page">
              <AccessPaused />
            </div>
          ) : (
            <>
              <SettingsList
                open={open !== 'members' || viewer.reads ? open : null}
                viewer={viewer}
                tell={tell}
              />
              {open === 'account' ? (
                <Account key={`${viewer.key}:${state}`} viewer={viewer} state={state} tell={tell} />
              ) : open === 'security' ? (
                <Security
                  key={`${viewer.key}:${state}`}
                  viewer={viewer}
                  state={state}
                  tell={tell}
                />
              ) : open === 'notifications' ? (
                <Notifications key={`${viewer.key}:${state}`} state={state} tell={tell} />
              ) : open === 'general' ? (
                <General key={`${viewer.key}:${state}`} viewer={viewer} state={state} tell={tell} />
              ) : open === 'signInRules' ? (
                <SignInRules
                  key={`${viewer.key}:${state}`}
                  viewer={viewer}
                  state={state}
                  tell={tell}
                />
              ) : viewer.reads ? (
                <Members
                  key={`${open}:${viewer.key}:${state}`}
                  viewer={viewer}
                  state={state}
                  tell={tell}
                />
              ) : (
                <div className="desk-page" />
              )}
            </>
          )}
        </main>
        <div ref={setHost} className="desk-layers" />
        {told != null && <Toast key={told} words={told} onClose={() => setTold(null)} />}
      </div>
    </LayersContext>
  );
}

/** Your account's sections, then the organisation's: a tile and the name, the open one Tint with a Violet ring. */
function SettingsList({ open, viewer, tell }: { open: Drawn | null; viewer: Viewer; tell: Tell }) {
  return (
    <nav className="desk-list" aria-label="Settings">
      {groupsFor(viewer).map((group) => (
        <div key={group.name} className="desk-group">
          <h2 className="desk-caps">{group.name}</h2>
          <ul className="desk-sections">
            {group.sections.map((section) => (
              <li key={section}>
                {isDrawn(section) ? (
                  <Link
                    className={section === open ? 'desk-section is-on' : 'desk-section'}
                    to={settingsPath(section, viewer)}
                    aria-current={section === open ? 'page' : undefined}
                  >
                    <Tile section={section} viewer={viewer} />
                    <span className="today-grow">{SECTION_NAMES[section]}</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="desk-section"
                    onClick={() => tell(`${SECTION_NAMES[section]} has its own design.`)}
                  >
                    <Tile section={section} viewer={viewer} />
                    <span className="today-grow">{SECTION_NAMES[section]}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Tile({ section, viewer }: { section: Section; viewer: Viewer }) {
  if (section === 'account')
    return (
      <span className="desk-tile is-account" aria-hidden="true">
        {viewer.initials}
      </span>
    );
  if (section === 'general')
    return (
      <span className="desk-tile is-general" aria-hidden="true">
        IE
      </span>
    );

  return (
    <span
      className={`desk-tile is-${section === 'signInRules' ? 'sign-in-rules' : section}`}
      aria-hidden="true"
    >
      <Glyph name={TILES[section]} size={17} />
    </span>
  );
}
