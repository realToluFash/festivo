import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Toast } from '../components/Toast.tsx';
import { Glyph } from './Queue.tsx';
import { OFFLINE_GLYPH } from './queue.ts';
import {
  CHOOSE_LINE,
  EMPTY_LINE,
  NEED_LINE,
  NOW,
  PLACES,
  type PlaceKind,
  RIVAL,
  type TeamState,
  type TeamStateName,
  andList,
  candidateLine,
  candidates,
  choiceFor,
  choose,
  chooseMode,
  closeSheet,
  dismiss,
  emptied,
  goOnline,
  initials,
  leavesLine,
  move,
  nameOf,
  onPlace,
  openSheet,
  peopleCount,
  personOf,
  primaryLabel,
  seed,
  stationText,
  stationsOf,
  teamStateOf,
  tryOffline,
} from './team.ts';
import './queue.css';
import './team.css';

const AREAS = ['Overview', 'Guests', 'Seating', 'Menu', 'Service', 'Messages', 'Reports'];
const GROUPS: readonly { title: string; kind: PlaceKind }[] = [
  { title: 'Sections', kind: 'section' },
  { title: 'Kitchen', kind: 'kitchen' },
];
const ARROW_GLYPH = ['M5 12h14', 'm12 5 7 7-7 7'];
const WARN_GLYPH = [
  'M12 9v4',
  'M12 17h.01',
  'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
];

/** /demo/team (sc-36034): the floor lead's Team at 1280 × 800, with the Move panel docked, by ?state=. */
export function TeamPage() {
  const [params] = useSearchParams();
  const name = teamStateOf(params.get('state'));

  return <Team key={name} name={name} />;
}

function Team({ name }: { name: TeamStateName }) {
  const [state, setState] = useState(() => seed(name));
  const movers = useRef(new Map<string, HTMLButtonElement>());
  const heading = useRef<HTMLHeadingElement>(null);
  const opened = state.sheet?.place ?? null;

  useEffect(() => {
    if (state.focus != null) movers.current.get(state.focus)?.focus();
  }, [state.focus, state.say]);

  useEffect(() => {
    if (opened != null) heading.current?.focus();
  }, [opened]);

  const offline = !state.online;
  const list = state.manage && !state.empty;

  return (
    <div className="queue-page">
      <div className="queue-desk">
        <nav className="queue-side" aria-label="Event">
          <div className="queue-org">
            <span className="queue-org-mark" aria-hidden="true">
              IE
            </span>
            <span>Ire Events</span>
          </div>
          <Link className="queue-side-link" to="/demo">
            ‹ All states in the demo
          </Link>
          <div className="queue-event">
            <strong>Adaeze &amp; Tunde’s wedding</strong>
            <span className="queue-live-pill">Live · today</span>
          </div>
          <ul className="queue-areas">
            {AREAS.map((area) => (
              <li
                key={area}
                className="queue-area"
                aria-current={area === 'Service' ? 'page' : undefined}
              >
                {area}
              </li>
            ))}
          </ul>
        </nav>
        <main id="content" className="queue-main">
          <header className="queue-header">
            <div>
              <h1>{state.manage ? 'Team' : 'Service'}</h1>
              <p className="queue-meta">
                {list
                  ? `Mains · ${PLACES.length} places · ${peopleCount(state)} people on them`
                  : 'Mains'}
              </p>
            </div>
            <div className="queue-status" role="status" data-offline={offline || undefined}>
              {offline ? (
                <>
                  <Glyph paths={OFFLINE_GLYPH} size={16} />
                  <span>No connection · as of {NOW}</span>
                </>
              ) : (
                <>
                  <span className="queue-status-dot" aria-hidden="true" />
                  <span>Connected · up to date {NOW}</span>
                </>
              )}
            </div>
          </header>
          <div className="team-tabs-bar">
            <ul className="team-tabs" aria-label="Service">
              {(state.manage
                ? ['Next', 'Floor', 'Service', 'Team']
                : ['Next', 'Floor', 'Service']
              ).map((tab) => (
                <li
                  key={tab}
                  className="team-tab"
                  aria-current={tab === (state.manage ? 'Team' : 'Service') ? 'page' : undefined}
                >
                  {tab}
                </li>
              ))}
            </ul>
          </div>
          <div className="queue-body">
            {!state.manage ? (
              <p className="queue-empty">
                Without service.manage there is no Team tab: Next, Floor and Service only.
              </p>
            ) : state.empty ? (
              <p className="team-empty">{EMPTY_LINE}</p>
            ) : (
              <>
                <div className="team-list">
                  {state.notice?.kind === 'conflict' && (
                    <div className="team-alert" role="alert">
                      <strong>{state.notice.who} wasn’t moved</strong>
                      <span>
                        {state.notice.by} has just put {state.notice.who} on{' '}
                        {nameOf(state.notice.to)}. Team shows where they are now.
                      </span>
                      <button
                        className="button demo-dense"
                        type="button"
                        onClick={() => setState(dismiss(state))}
                      >
                        Got it
                      </button>
                    </div>
                  )}
                  {GROUPS.map((group) => (
                    <section
                      key={group.kind}
                      className="queue-card"
                      aria-labelledby={`team-${group.kind}`}
                    >
                      <h2 id={`team-${group.kind}`} className="queue-label">
                        {group.title}
                      </h2>
                      <ul className="queue-rows">
                        {PLACES.filter((p) => p.kind === group.kind).map((p) => (
                          <PlaceRow
                            key={p.id}
                            state={state}
                            id={p.id}
                            movers={movers}
                            act={setState}
                          />
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
                {state.sheet != null && (
                  <MovePanel state={state} heading={heading} act={setState} />
                )}
              </>
            )}
          </div>
        </main>
      </div>
      <div className="visually-hidden" aria-live="polite">
        {state.say === state.toast ? '' : state.say}
      </div>
      {state.toast !== '' && (
        <Toast
          key={state.toast}
          words={state.toast}
          onClose={() => setState((x) => ({ ...x, toast: '' }))}
        />
      )}
      <section className="queue-demo" aria-labelledby="team-demo-heading">
        <h2 id="team-demo-heading" className="queue-label">
          Try it · the board’s own switches, not in the product
        </h2>
        <div className="queue-demo-buttons">
          <button className="button demo-dense" type="button" onClick={() => setState(seed(name))}>
            Start again
          </button>
          <button
            className="button demo-dense"
            type="button"
            onClick={() => setState(goOnline(state, !state.online))}
          >
            {state.online ? 'Lose the connection' : 'Come back online'}
          </button>
          <button
            className="button demo-dense"
            type="button"
            onClick={() => setState({ ...state, rival: !state.rival })}
          >
            {state.rival
              ? `${RIVAL} moves Grace Udo first · on`
              : 'Another lead moves Grace Udo first'}
          </button>
          <button
            className="button demo-dense"
            type="button"
            onClick={() => setState({ ...state, manage: !state.manage, sheet: null })}
          >
            {state.manage ? 'View without service.manage' : 'View with service.manage'}
          </button>
          <button
            className="button demo-dense"
            type="button"
            onClick={() => setState({ ...state, empty: !state.empty, sheet: null })}
          >
            {state.empty ? 'Give the event its places' : 'An event with no places'}
          </button>
        </div>
      </section>
    </div>
  );
}

function PlaceRow({
  state,
  id,
  movers,
  act,
}: {
  state: TeamState;
  id: string;
  movers: React.RefObject<Map<string, HTMLButtonElement>>;
  act: (next: TeamState) => void;
}) {
  const name = nameOf(id);
  const on = onPlace(state, id);
  const offline = !state.online;
  const need = offline && state.notice?.kind === 'need' && state.notice.place === id;
  const key = `row|${id}`;

  return (
    <li
      className="team-row"
      data-open={state.sheet?.place === id || state.opened === id || undefined}
    >
      <div className="queue-what">
        <strong className="team-place">{name}</strong>
        {on.length === 0 ? (
          <span className="queue-meta">Nobody on {name}</span>
        ) : (
          <ul className="team-people">
            {on.map((n) => {
              const also = stationsOf(state, n).filter((x) => x !== id);
              const you = personOf(n)?.you === true;
              return (
                <li key={n} className="queue-person">
                  <span className="queue-initials" data-you={you || undefined} aria-hidden="true">
                    {initials(n)}
                  </span>
                  <span className="queue-person-words">
                    <strong>{you ? `${n} · you` : n}</strong>
                    {also.length > 0 && (
                      <span className="queue-meta">also on {stationText(also)}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="team-move-cell">
        <button
          ref={(element) => {
            if (element == null) movers.current.delete(key);
            else movers.current.set(key, element);
          }}
          className="team-move"
          type="button"
          data-offline={offline || undefined}
          aria-disabled={offline || undefined}
          aria-describedby={need ? `team-need-${id}` : undefined}
          aria-label={`Move someone to ${name}`}
          onClick={() => act(offline ? tryOffline(state, id) : openSheet(state, id))}
        >
          <Glyph paths={ARROW_GLYPH} size={16} />
          Move someone here
        </button>
        {need && (
          <span id={`team-need-${id}`} className="team-need">
            <Glyph paths={OFFLINE_GLYPH} size={14} />
            {NEED_LINE}
          </span>
        )}
      </div>
    </li>
  );
}

function MovePanel({
  state,
  heading,
  act,
}: {
  state: TeamState;
  heading: React.RefObject<HTMLHeadingElement | null>;
  act: (next: TeamState) => void;
}) {
  const sheet = state.sheet;
  if (sheet == null) return null;
  const name = nameOf(sheet.place);
  const on = onPlace(state, sheet.place);
  const people = candidates(state, sheet.place);
  const choice = choiceFor(state);
  const refused = sheet.refused && sheet.who === '';

  return (
    <aside className="team-panel" aria-labelledby="team-panel-heading">
      <h2 id="team-panel-heading" ref={heading} tabIndex={-1} className="queue-panel-title">
        Move someone to {name}
      </h2>
      <p className="queue-meta">
        {on.length > 0
          ? `${andList(on)} ${on.length > 1 ? 'are' : 'is'} on it now`
          : `Nobody on ${name} now`}
      </p>
      {people.length === 0 ? (
        <p>Nobody in Here can work {name}.</p>
      ) : (
        <fieldset
          className="team-choices"
          aria-invalid={refused || undefined}
          aria-describedby={refused ? 'team-choose' : undefined}
        >
          <legend className="visually-hidden">Who to move</legend>
          {people.map((p) => {
            const line = candidateLine(state, p);
            const leaves =
              stationsOf(state, p.name).length >= 2
                ? leavesLine(emptied(state, p.name, sheet.place, 'instead'))
                : '';
            return (
              <label key={p.name} className="team-choice">
                <input
                  type="radio"
                  name="team-who"
                  checked={sheet.who === p.name}
                  onChange={() => act(choose(state, p.name))}
                />
                <span className="queue-initials" data-you={p.you || undefined} aria-hidden="true">
                  {initials(p.name)}
                </span>
                <span className="queue-person-words">
                  <strong>{p.name}</strong>
                  <span className="queue-meta">{line}</span>
                  {leaves !== '' && <Warn words={leaves} />}
                </span>
              </label>
            );
          })}
        </fieldset>
      )}
      {refused && (
        <p id="team-choose" className="team-refused" role="alert">
          {CHOOSE_LINE}
        </p>
      )}
      {choice != null && (
        <div className="team-choice-block">
          <strong>{choice.label}</strong>
          <div className="team-modes" role="radiogroup" aria-label="As well or Instead">
            {choice.modes.map((m) => (
              <button
                key={m}
                className="team-mode"
                type="button"
                role="radio"
                aria-checked={choice.mode === m}
                onClick={() => act(chooseMode(state, m))}
              >
                {m === 'well' ? 'As well' : 'Instead'}
              </button>
            ))}
          </div>
          <p className="queue-meta">{choice.helper}</p>
          {choice.leaves !== '' && <Warn words={choice.leaves} />}
          {choice.tray !== '' && <p className="queue-meta">{choice.tray}</p>}
        </div>
      )}
      <div className="team-panel-foot">
        <button className="button" type="button" onClick={() => act(closeSheet(state))}>
          Cancel
        </button>
        <button className="button button-primary" type="button" onClick={() => act(move(state))}>
          {primaryLabel(state)}
        </button>
      </div>
    </aside>
  );
}

function Warn({ words }: { words: string }) {
  return (
    <span className="team-warn">
      <Glyph paths={WARN_GLYPH} size={14} />
      {words}
    </span>
  );
}
