import { type RefObject, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { offButton } from '../offButton.ts';
import {
  CONTROLS,
  type Control,
  OFFLINE_LINE,
  type QueueState,
  type QueueStateName,
  RIVAL,
  SECTIONS,
  type Section,
  type Tag,
  buildWords,
  cancelBuild,
  conflictLine,
  drawn,
  goOnline,
  move,
  onIt,
  pick,
  placeLine,
  queueStateOf,
  save,
  sectionOf,
  seed,
  select,
  startBuild,
  tagsFor,
  upNext,
} from './queue.ts';
import './queue.css';

const AREAS = ['Overview', 'Guests', 'Seating', 'Menu', 'Service', 'Messages', 'Reports'];

const CONTROL_WORDS: Record<Control, { title: string; label: (name: string) => string }> = {
  front: { title: 'Bring forward', label: (name) => `Bring ${name} forward` },
  up: { title: 'Move up', label: (name) => `Move ${name} up` },
  down: { title: 'Move down', label: (name) => `Move ${name} down` },
};

const CONTROL_GLYPH: Record<Control, readonly string[]> = {
  front: ['M5 4h14', 'M12 20V9', 'm7 13 5-5 5 5'],
  up: ['m18 15-6-6-6 6'],
  down: ['m6 9 6 6 6-6'],
};

const TAG_GLYPH: Record<Tag['kind'], readonly string[]> = {
  next: ['M5 12h14', 'm12 5 7 7-7 7'],
  tray: ['M4 16h16', 'M6 16a6 6 0 0 1 12 0'],
  served: ['M20 6 9 17l-5-5'],
  owed: ['M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z', 'M12 6v6l4 2'],
};

const OFFLINE_GLYPH = [
  'M2 2l20 20',
  'M8.5 16.5a5 5 0 0 1 7 0',
  'M2 8.82a15 15 0 0 1 4.17-2.65',
  'M10.66 5c4.01-.36 8.14.9 11.34 3.76',
  'M16.85 11.25a10 10 0 0 1 2.22 1.68',
  'M5 13a10 10 0 0 1 5.24-2.76',
  'M12 20h.01',
];
const INFO_GLYPH = ['M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z', 'M12 16v-4', 'M12 8h.01'];
const FLAG_GLYPH = ['M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z', 'M4 22v-7'];

type After = 'move' | 'build' | 'leave' | null;

/** /demo/queue (sc-36033): the floor lead's section queue at 1280 × 800, beside the sections, by ?state=. */
export function QueuePage() {
  const [params] = useSearchParams();
  const name = queueStateOf(params.get('state'));

  return <Queue key={name} name={name} />;
}

function Queue({ name }: { name: QueueStateName }) {
  const [state, setState] = useState(() => seed(name));
  const after = useRef<After>(null);
  const controls = useRef(new Map<string, HTMLButtonElement>());
  const buildButton = useRef<HTMLButtonElement>(null);
  const firstPick = useRef<HTMLButtonElement>(null);

  function act(next: QueueState, then: After = null): void {
    after.current = then;
    setState(next);
  }

  useEffect(() => {
    const then = after.current;
    after.current = null;
    if (then === 'build') firstPick.current?.focus();
    if (then === 'leave') buildButton.current?.focus();
    if (then === 'move' && state.focus != null)
      controls.current.get(`${state.focus.place}|${state.focus.control}`)?.focus();
  }, [state]);

  const section = sectionOf(state.selected);
  const queue = state.queues[section.id];
  const count = queue.length;
  const build = state.build?.section === section.id ? state.build : null;
  const notice =
    state.notice?.kind === 'offline'
      ? OFFLINE_LINE
      : state.notice?.kind === 'conflict' && state.notice.section === section.id
        ? conflictLine(state.notice.by)
        : null;

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
              <h1>Service</h1>
              <p className="queue-meta">Mains · 212 guests at 24 tables</p>
            </div>
            <div className="queue-status" role="status" data-offline={!state.online || undefined}>
              {state.online ? (
                <>
                  <span className="queue-status-dot" aria-hidden="true" />
                  <span>{state.started ? 'Live · updated 20:41' : 'Not started yet'}</span>
                </>
              ) : (
                <>
                  <Glyph paths={OFFLINE_GLYPH} size={16} />
                  <span>Offline · showing the room as of 20:41</span>
                </>
              )}
            </div>
          </header>
          <div className="queue-body">
            <nav className="queue-sections" aria-labelledby="queue-sections-heading">
              <h2 id="queue-sections-heading">Sections</h2>
              {SECTIONS.map((each) => (
                <button
                  key={each.id}
                  className="queue-section"
                  type="button"
                  aria-current={each.id === section.id || undefined}
                  onClick={() => act(select(state, each.id))}
                >
                  <span className="queue-section-name">{each.name}</span>
                  <span className="queue-meta">{sectionLine(each)}</span>
                </button>
              ))}
            </nav>
            <div className="queue-panel">
              <div>
                <h2 className="queue-panel-title">{section.name}</h2>
                <p className="queue-meta">{sectionLine(section)}</p>
              </div>
              <section className="queue-card" aria-labelledby="queue-on-it">
                <h2 id="queue-on-it" className="queue-label">
                  On it
                </h2>
                {onIt(state, section.id).map((person) => (
                  <div key={person.name} className="queue-person">
                    <span className="queue-initials" aria-hidden="true">
                      {person.initials}
                    </span>
                    <span className="queue-person-words">
                      <strong>{person.name}</strong>
                      <span className="queue-meta">{person.line}</span>
                    </span>
                  </div>
                ))}
              </section>
              {count === 0 && (
                <p className="queue-empty">
                  No tables in {section.name} yet. A table added to it joins the end of its queue.
                </p>
              )}
              {state.manage && count > 0 && (
                <section className="queue-card" aria-labelledby="queue-heading">
                  <div className="queue-card-head">
                    <h2 id="queue-heading" className="queue-label">
                      Queue
                    </h2>
                    {build == null && count > 1 && (
                      <button
                        ref={buildButton}
                        className="button queue-build"
                        type="button"
                        onClick={() => {
                          const next = startBuild(state, section.id);
                          act(next, next.build == null ? null : 'build');
                        }}
                      >
                        Build the queue
                      </button>
                    )}
                  </div>
                  <p className="queue-meta">
                    Each tray goes to the first table here with someone to serve. Owed plates go
                    first, oldest first, and a tray already out carries on.
                  </p>
                  {notice != null && (
                    <div className="queue-notice" role="status">
                      <Glyph
                        paths={state.notice?.kind === 'offline' ? OFFLINE_GLYPH : INFO_GLYPH}
                        size={18}
                      />
                      <span>{notice}</span>
                    </div>
                  )}
                  {build == null ? (
                    <ol className="queue-rows">
                      {queue.map((place, index) => {
                        const p = state.places[place];
                        if (p == null) return null;

                        return (
                          <li key={place} className="queue-row">
                            <span
                              className="queue-n"
                              data-next={upNext(state, section.id) === place || undefined}
                              aria-hidden="true"
                            >
                              {index + 1}
                            </span>
                            <div className="queue-what">
                              <div className="queue-title">
                                <span className="visually-hidden">
                                  {index + 1} of {count}.{' '}
                                </span>
                                <strong>{place}</strong>
                                {tagsFor(state, section.id, place).map((tag) => (
                                  <span key={tag.kind} className="queue-tag" data-kind={tag.kind}>
                                    <Glyph paths={TAG_GLYPH[tag.kind]} size={13} />
                                    {tag.label}
                                  </span>
                                ))}
                              </div>
                              <div className="queue-meta">{placeLine(p)}</div>
                              {p.flag !== '' && (
                                <div className="queue-flag">
                                  <Glyph paths={FLAG_GLYPH} size={12} />
                                  {p.flag}
                                </div>
                              )}
                            </div>
                            {count > 1 && (
                              <div className="queue-controls">
                                {CONTROLS.map((control) => {
                                  if (!drawn(control, index, count))
                                    return (
                                      <span
                                        key={control}
                                        className="queue-gap"
                                        aria-hidden="true"
                                      />
                                    );
                                  const key = `${place}|${control}`;

                                  return (
                                    <button
                                      key={control}
                                      ref={(element) => {
                                        if (element == null) controls.current.delete(key);
                                        else controls.current.set(key, element);
                                      }}
                                      className="queue-control"
                                      type="button"
                                      aria-label={CONTROL_WORDS[control].label(place)}
                                      title={CONTROL_WORDS[control].title}
                                      onClick={() =>
                                        act(move(state, section.id, place, control), 'move')
                                      }
                                    >
                                      <Glyph paths={CONTROL_GLYPH[control]} size={20} />
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  ) : (
                    <Build
                      state={state}
                      queue={queue}
                      picked={build.picked}
                      firstPick={firstPick}
                      act={act}
                    />
                  )}
                </section>
              )}
            </div>
          </div>
        </main>
      </div>
      <div className="visually-hidden" aria-live="polite">
        {state.say}
      </div>
      <section className="queue-demo" aria-labelledby="queue-demo-heading">
        <h2 id="queue-demo-heading" className="queue-label">
          Try it · the board’s own switches, not in the product
        </h2>
        <div className="queue-demo-buttons">
          <button className="button demo-dense" type="button" onClick={() => act(seed(name))}>
            Start again
          </button>
          <button
            className="button demo-dense"
            type="button"
            onClick={() => act(goOnline(state, !state.online))}
          >
            {state.online ? 'Go offline' : 'Back online'}
          </button>
          <button
            className="button demo-dense"
            type="button"
            onClick={() => act({ ...state, rivalFirst: !state.rivalFirst })}
          >
            {state.rivalFirst
              ? `${RIVAL} will change it first · on`
              : 'Another lead changes the queue first'}
          </button>
          <button
            className="button demo-dense"
            type="button"
            onClick={() => act({ ...state, manage: !state.manage })}
          >
            {state.manage ? 'View without service.manage' : 'View with service.manage'}
          </button>
        </div>
      </section>
    </div>
  );
}

function Build({
  state,
  queue,
  picked,
  firstPick,
  act,
}: {
  state: QueueState;
  queue: readonly string[];
  picked: readonly string[];
  firstPick: RefObject<HTMLButtonElement | null>;
  act: (next: QueueState, then?: After) => void;
}) {
  const words = buildWords(queue, picked);

  return (
    <>
      <p className="queue-build-line">{words.line}</p>
      <ol className="queue-rows">
        {queue.map((place, index) => {
          const at = picked.indexOf(place);
          const p = state.places[place];

          return (
            <li key={place}>
              <button
                ref={index === 0 ? firstPick : undefined}
                className="queue-pick"
                type="button"
                aria-pressed={at >= 0}
                aria-label={
                  at >= 0
                    ? `${place}, number ${at + 1} in the new queue`
                    : `${place}, not placed yet`
                }
                onClick={() => act(pick(state, place))}
              >
                <span className="queue-pick-n" data-on={at >= 0 || undefined} aria-hidden="true">
                  {at >= 0 ? at + 1 : ''}
                </span>
                <span className="queue-what" aria-hidden="true">
                  <strong>{place}</strong>
                  {p != null && <span className="queue-meta">{placeLine(p)}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="queue-build-foot">
        <button
          className="button button-primary"
          type="button"
          {...offButton(!words.canSave)}
          onClick={() => {
            const next = save(state);
            act(next, next.build == null ? 'leave' : null);
          }}
        >
          {words.saveLabel}
        </button>
        <button className="button" type="button" onClick={() => act(cancelBuild(state), 'leave')}>
          Cancel
        </button>
      </div>
    </>
  );
}

function sectionLine(section: Section): string {
  const n = section.places.length;
  const tables = n === 0 ? 'No tables' : n === 1 ? '1 table' : `${n} tables`;

  return `${section.on.length > 0 ? section.on.join(', ') : 'Nobody on it'} · ${tables}`;
}

export function Glyph({ paths, size }: { paths: readonly string[]; size: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className="queue-glyph">
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
