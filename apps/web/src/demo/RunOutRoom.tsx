import { useEffect, useRef, useState } from 'react';

import { Glyph } from './HowItsGoing.tsx';
import { type RunOut, alertOn, runOutAlert, runOutTables } from './runOut.ts';
import './runOut.css';
import { AlertRow, List, Panel, Plan, Sections } from './ServiceRoom.tsx';
import { BAN_GLYPH } from './serviceGlyphs.ts';
import { type Room, alertsOf, goToTable, roomSeed, tableOf } from './serviceRoom.ts';
import './serviceRoom.css';

/** Plan and List (sc-4026) while an item is run out: a table with anyone waiting for a choice reads Waiting for a choice. */
export function RunOutRoom({
  view,
  ro,
  manage,
  online,
  onChoose,
}: {
  view: 'plan' | 'list';
  ro: RunOut;
  manage: boolean;
  online: boolean;
  onChoose: () => void;
}) {
  const [ui, setUi] = useState<Room>(() => roomSeed('populated'));
  const focusTo = useRef('');

  useEffect(() => {
    if (focusTo.current === '') return;
    document.querySelector<HTMLElement>(focusTo.current)?.focus();
    focusTo.current = '';
  });

  const base = roomSeed('populated').tables;
  const r: Room = {
    ...ui,
    view,
    manage,
    viewer: manage ? ui.viewer : 'Bisi Lawal',
    strip: online ? 'connected' : 'offline',
    tables: runOutTables(base, ro),
  };

  function act(next: Room, focus = ''): void {
    focusTo.current = focus;
    setUi({ ...next, tables: ui.tables });
  }

  const open = tableOf(r, r.open);
  const alerts = alertsOf(r.tables);

  return (
    <div className="sr-room" data-panel={open != null || undefined}>
      <div className="sr-floor">
        <Sections r={r} />
        {view === 'plan' ? <Plan r={r} act={act} /> : <List r={r} act={act} />}
      </div>
      {open != null ? (
        <Panel r={r} t={open} act={act} offline={!online} />
      ) : (
        manage && (
          <section className="hig-card sr-side" aria-labelledby="rout-room-alerts">
            <h2 id="rout-room-alerts" className="hig-card-title">
              Alerts
            </h2>
            <ul className="hig-rows">
              {alertOn(ro) && (
                <li className="hig-alert sr-alert">
                  <span className="hig-alert-icon" aria-hidden="true">
                    <Glyph paths={BAN_GLYPH} size={18} />
                  </span>
                  <div className="hig-alert-words">
                    <strong>{runOutAlert(ro).title}</strong>
                    <span className="hig-meta">{runOutAlert(ro).sub}</span>
                    <button
                      className="button button-primary sr-go"
                      type="button"
                      data-run-out="choose"
                      onClick={onChoose}
                    >
                      Choose
                    </button>
                  </div>
                </li>
              )}
              {alerts.map((a) => (
                <AlertRow
                  key={a.id}
                  a={a}
                  onGo={() => act(goToTable(r, a.id), '#sr-panel-title')}
                />
              ))}
            </ul>
          </section>
        )
      )}
    </div>
  );
}
