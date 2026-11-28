import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { ActionPair } from '../components/ActionPair.tsx';
import { useDialogKeys } from '../dialogFocus.ts';

import { Glyph } from './HowItsGoing.tsx';
import './howItsGoing.css';
import './serviceFire.css';
import {
  AS_OF,
  COURSES,
  ENDED_LINE,
  EVENT,
  type FireState,
  type FireStateName,
  NOTHING_TICKED,
  NOW,
  NO_MENU_LINE,
  SECTIONS,
  type Scope,
  THRESHOLD_MAX,
  THRESHOLD_MIN,
  askNext,
  canFire,
  choiceLine,
  closeConfirm,
  closeFire,
  confirm,
  confirmLine,
  confirmTitle,
  confirmWords,
  controls,
  courseName,
  courseOffer,
  courseWord,
  cues,
  dismissPrompt,
  fireFrom,
  fireLabel,
  fireStateOf,
  firstTickable,
  isFired,
  notYet,
  notYetLine,
  offlineLine,
  offlineTry,
  openFire,
  pickCourse,
  pickScope,
  pressFire,
  promptLine,
  RUN_COURSE,
  RUN_ITEM,
  runStarts,
  scopeLine,
  scopeName,
  seed,
  serveAll,
  serviceLine,
  setOnline,
  startService,
  step,
  steppable,
  suggestionLine,
  suggestionWhy,
  tableLine,
  threshold,
  toggle,
} from './serviceFire.ts';
import { CHECK_GLYPH, INFO_GLYPH, OFFLINE_GLYPH } from './serviceGlyphs.ts';

const AREAS = ['Overview', 'Guests', 'Seating', 'Menu', 'Service', 'Messages', 'Reports'];

const FLAME_GLYPH = [
  'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z',
];
const LOCK_GLYPH = ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 8 0v4'];

type View = 'going' | 'plan' | 'list';

const VIEW_WORDS: Record<View, string> = { going: 'How it’s going', plan: 'Plan', list: 'List' };
const VIEW_OWNER: Record<View, { story: string; to: string }> = {
  going: { story: 'sc-34107', to: '/demo/how-its-going' },
  plan: { story: 'sc-4026', to: '/demo/service-room?state=plan' },
  list: { story: 'sc-4026', to: '/demo/service-room?state=list' },
};

const idOf = (name: string) => `sf-t-${name.replace(/\s+/g, '-')}`;

/** /demo/service-fire (sc-4009): starting service and firing each course, in Service's header, at 1280 × 800. */
export function ServiceFirePage() {
  const [params] = useSearchParams();
  const name = fireStateOf(params.get('state'));

  return <ServiceFire key={name} name={name} />;
}

function ServiceFire({ name }: { name: FireStateName }) {
  const [s, setS] = useState<FireState>(() => seed(name));
  const [view, setView] = useState<View>('going');
  const focusTo = useRef('');

  useEffect(() => {
    if (focusTo.current === '') return;
    document.querySelector<HTMLElement>(focusTo.current)?.focus();
    focusTo.current = '';
  });

  function act(next: FireState, focus = ''): void {
    focusTo.current = focus;
    setS(next);
  }

  const off = !s.online;
  const { prompt, suggest } = cues(s);
  const later = notYetLine(s);

  return (
    <div className="hig-page">
      <div className="hig-desk">
        <nav className="hig-side" aria-label="Event">
          <div className="hig-org">
            <span className="hig-org-mark" aria-hidden="true">
              IE
            </span>
            <span>Ire Events</span>
          </div>
          <Link className="hig-side-link" to="/demo">
            ‹ All states in the demo
          </Link>
          <div className="hig-event">
            <strong>{EVENT}</strong>
            <span className="hig-live-pill sf-paused" data-paused={s.paused || undefined}>
              {s.paused ? 'Paused · today' : 'Live · today'}
            </span>
          </div>
          <ul className="hig-areas">
            {AREAS.map((area) => (
              <li
                key={area}
                className="hig-area"
                aria-current={area === 'Service' ? 'page' : undefined}
              >
                {area}
              </li>
            ))}
          </ul>
        </nav>
        <main id="content" className="hig-main">
          <header className="hig-header sf-header">
            <div className="sf-head-row">
              <div>
                <h1>Service</h1>
                <p className="hig-meta">{EVENT}</p>
              </div>
              <div className="hig-status" role="status" data-offline={off || undefined}>
                {off ? (
                  <>
                    <Glyph paths={OFFLINE_GLYPH} size={16} />
                    <span>No connection · as of {AS_OF}</span>
                  </>
                ) : (
                  <>
                    <span className="hig-status-dot" aria-hidden="true" />
                    <span>Connected · up to date at {NOW}</span>
                  </>
                )}
              </div>
            </div>
            <ServiceBar s={s} act={act} />
          </header>
          <div className="hig-views" role="group" aria-label="Show">
            {(['going', 'plan', 'list'] as const).map((v) => (
              <button
                key={v}
                type="button"
                className="hig-view"
                aria-pressed={view === v}
                onClick={() => setView(v)}
              >
                {VIEW_WORDS[v]}
              </button>
            ))}
          </div>
          <div className="hig-scroll">
            {s.result.length > 0 && (
              <div className="sf-result">
                <Glyph paths={CHECK_GLYPH} size={18} />
                <div>
                  {s.result.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
            )}
            {prompt && (
              <section className="sf-cue" aria-labelledby="sf-prompt">
                <Glyph paths={FLAME_GLYPH} size={20} />
                <div className="sf-cue-words">
                  <h2 id="sf-prompt" className="sf-cue-title">
                    {promptLine()}
                  </h2>
                  <p className="hig-meta">
                    The run of show links {RUN_ITEM} to {courseWord(RUN_COURSE)}.
                  </p>
                  <span className="sf-pill">AC, not yet built</span>
                </div>
                <ActionPair
                  className="sf-cue-actions"
                  stacks={false}
                  dismiss={
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => act(dismissPrompt(s), '[data-sf="fire"]')}
                    >
                      Not now
                    </button>
                  }
                  confirm={
                    <button
                      type="button"
                      className="button button-primary"
                      data-sf="prompt"
                      onClick={() => act(fireFrom(s, RUN_COURSE, true))}
                    >
                      Fire {courseWord(RUN_COURSE)} now
                    </button>
                  }
                />
              </section>
            )}
            {suggest && (
              <section className="sf-cue" aria-labelledby="sf-suggest">
                <Glyph paths={FLAME_GLYPH} size={20} />
                <div className="sf-cue-words">
                  <h2 id="sf-suggest" className="sf-cue-title">
                    {suggestionLine(s)}
                  </h2>
                  <p className="hig-meta">{suggestionWhy(s)}</p>
                </div>
                <ActionPair
                  className="sf-cue-actions"
                  stacks={false}
                  dismiss={
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => act(notYet(s), '[data-sf="fire"]')}
                    >
                      Not yet
                    </button>
                  }
                  confirm={
                    <button
                      type="button"
                      className="button button-primary"
                      data-sf="suggest"
                      onClick={() => act(fireFrom(s, s.current + 1, false))}
                    >
                      Fire {courseWord(s.current + 1)} now
                    </button>
                  }
                />
              </section>
            )}
            {later !== '' && !suggest && (
              <p className="sf-later">
                <Glyph paths={INFO_GLYPH} size={16} />
                <span>{later}</span>
              </p>
            )}
            <section className="hig-card hig-placeholder" aria-labelledby="sf-view">
              <h2 id="sf-view" className="hig-card-title">
                {VIEW_WORDS[view]}
              </h2>
              <p className="hig-meta">
                {VIEW_WORDS[view]} is {VIEW_OWNER[view].story}’s, built at{' '}
                <Link to={VIEW_OWNER[view].to}>{VIEW_OWNER[view].to}</Link>. It reads a fire’s
                orders as it reads any other; nothing else on it changes.
              </p>
            </section>
          </div>
        </main>
      </div>
      {s.fire != null && <FireDialog s={s} act={act} />}
      {s.confirm != null && <ConfirmDialog s={s} act={act} />}
      <div className="visually-hidden" aria-live="polite">
        {s.say}
      </div>
      <section className="hig-demo" aria-labelledby="sf-demo-heading">
        <h2 id="sf-demo-heading" className="hig-label">
          Try it · the board’s own switches, not in the product
        </h2>
        <div className="hig-demo-buttons">
          <button className="button demo-dense" type="button" onClick={() => act(seed(name))}>
            Start again
          </button>
          <button
            className="button demo-dense"
            type="button"
            onClick={() => act(setOnline(s, off))}
          >
            {off ? 'Back online' : 'Go offline'}
          </button>
          <button
            className="button demo-dense"
            type="button"
            onClick={() => act({ ...s, manage: !s.manage, fire: null, confirm: null })}
          >
            {s.manage ? 'View without service.manage' : 'View with service.manage'}
          </button>
          {s.phase === 'on' && (
            <>
              <button className="button demo-dense" type="button" onClick={() => act(serveAll(s))}>
                Every table fired for {courseWord(s.current)} is served
              </button>
              <button
                className="button demo-dense"
                type="button"
                onClick={() => act(runStarts({ ...s, promptDone: false }))}
              >
                Speeches starts on the run of show
              </button>
              <button
                className="button demo-dense"
                type="button"
                onClick={() => act({ ...s, notYetUntil: null })}
              >
                Five minutes pass
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function ServiceBar({ s, act }: { s: FireState; act: (n: FireState, f?: string) => void }) {
  const c = controls(s);
  const off = !s.online;
  const offProps = off ? { 'aria-disabled': true, 'data-off': true } : {};
  const steps = steppable(s);

  return (
    <div className="sf-bar">
      <div className="sf-bar-row">
        <p className="sf-line" data-phase={s.phase}>
          <span className="sf-phase" data-phase={s.phase} aria-hidden="true" />
          <span>{serviceLine(s)}</span>
        </p>
        <div className="sf-controls">
          {c.start && (
            <button
              type="button"
              className="button button-primary sf-control"
              data-sf="start"
              {...offProps}
              onClick={() => act(startService(s), '[data-sf="fire"]')}
            >
              Start service
            </button>
          )}
          {c.noMenu && (
            <p className="sf-no-menu">
              <Glyph paths={INFO_GLYPH} size={16} />
              <span>{NO_MENU_LINE}</span>
            </p>
          )}
          {c.fire && (
            <button
              type="button"
              className="button button-primary sf-control"
              data-sf="fire"
              {...offProps}
              onClick={() => act(off ? offlineTry(s) : openFire(s))}
            >
              <Glyph paths={FLAME_GLYPH} size={18} />
              <span>Fire {courseWord(s.current)}</span>
            </button>
          )}
          {c.next && (
            <button
              type="button"
              className="button sf-control"
              data-sf="next"
              {...offProps}
              onClick={() => act(askNext(s))}
            >
              Next course
            </button>
          )}
          {c.end && (
            <button
              type="button"
              className="button sf-control"
              data-sf="end"
              {...offProps}
              onClick={() => act(askNext(s))}
            >
              End service…
            </button>
          )}
        </div>
      </div>
      {s.phase === 'ended' && s.manage && <p className="hig-meta">{ENDED_LINE}</p>}
      {off && (c.start || c.fire) && (
        <p className="sf-offline" data-tried={s.offlineTried || undefined}>
          <Glyph paths={OFFLINE_GLYPH} size={16} />
          <span>{offlineLine(s)}</span>
        </p>
      )}
      {c.fire && steps.length > 0 && (
        <div className="sf-thresholds">
          <button
            type="button"
            className="link-button sf-disclose"
            aria-expanded={s.thresholdsOpen}
            aria-controls="sf-steps"
            onClick={() => act({ ...s, thresholdsOpen: !s.thresholdsOpen })}
          >
            When to suggest the next course {s.thresholdsOpen ? '▴' : '▾'}
          </button>
          <span className="sf-pill">AC, not yet built</span>
          {s.thresholdsOpen && (
            <ul id="sf-steps" className="sf-steps">
              {steps.map((i) => {
                const v = threshold(s, i);
                const label = `Suggest ${courseWord(i)} from`;
                return (
                  <li key={i} className="sf-step-row">
                    <span className="sf-step-name">{courseName(i)}</span>
                    <span className="hig-meta sf-step-hint">
                      Suggested once this share of tables is served
                    </span>
                    <div className="sf-stepper" role="group" aria-label={label}>
                      <button
                        type="button"
                        className="button sf-step"
                        aria-label={`Lower ${courseWord(i)}’s threshold`}
                        aria-disabled={v <= THRESHOLD_MIN || off || undefined}
                        data-off={off || undefined}
                        onClick={() => act(step(s, i, -1))}
                      >
                        −
                      </button>
                      <output className="sf-step-value" aria-label={`${label} ${v}%`}>
                        {v}%
                      </output>
                      <button
                        type="button"
                        className="button sf-step"
                        aria-label={`Raise ${courseWord(i)}’s threshold`}
                        aria-disabled={v >= THRESHOLD_MAX || off || undefined}
                        data-off={off || undefined}
                        onClick={() => act(step(s, i, 1))}
                      >
                        +
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function FireDialog({ s, act }: { s: FireState; act: (n: FireState, f?: string) => void }) {
  const f = s.fire;
  const box = useRef<HTMLDivElement>(null);
  const close = () => act(closeFire(s), '[data-sf="fire"]');

  useDialogKeys(box, close, false);
  useEffect(() => box.current?.focus(), []);

  if (f == null) return null;
  const off = !s.online;
  const scopes: Scope[] = ['all', ...SECTIONS, 'choose'];
  const groups: { name: string; tables: FireState['tables'] }[] = [
    ...SECTIONS.map((id) => ({
      name: `Section ${id}`,
      tables: s.tables.filter((t) => t.section === id),
    })),
    { name: 'In no section', tables: s.tables.filter((t) => t.section == null) },
  ];

  function fire(): void {
    if (f == null) return;
    const next = pressFire(s);
    act(next, next.fire?.error === true ? `#${idOf(firstTickable(s))}` : '[data-sf="fire"]');
  }

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={box}
        className="dialog hig-dialog sf-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sf-fire-title"
        tabIndex={-1}
      >
        <h2 id="sf-fire-title" className="hig-dialog-title">
          Fire {courseWord(f.course)}
        </h2>
        <fieldset className="sf-fieldset">
          <legend className="sf-legend">Course</legend>
          <div className="sf-options sf-courses">
            {COURSES.map((name, i) => (
              <label
                key={name}
                htmlFor={`sf-course-${i}`}
                className="sf-option"
                data-on={f.course === i || undefined}
              >
                <input
                  id={`sf-course-${i}`}
                  type="radio"
                  name="sf-course"
                  checked={f.course === i}
                  onChange={() => act(pickCourse(s, i))}
                />
                <span className="sf-option-name">{name}</span>
                <span className="hig-meta sf-option-line">{courseOffer(s, i)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="hig-meta sf-choice-line">{choiceLine(s, f)}</p>
        <fieldset className="sf-fieldset">
          <legend className="sf-legend">Tables</legend>
          <div className="sf-options">
            {scopes.map((scope) => (
              <label
                key={scope}
                htmlFor={`sf-scope-${scope}`}
                className="sf-option"
                data-on={f.scope === scope || undefined}
              >
                <input
                  id={`sf-scope-${scope}`}
                  type="radio"
                  name="sf-scope"
                  checked={f.scope === scope}
                  onChange={() => act(pickScope(s, scope))}
                />
                <span className="sf-option-name">{scopeName(scope)}</span>
                <span className="hig-meta sf-option-line">{scopeLine(s, f.course, scope)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {f.scope !== 'all' && f.scope !== 'choose' && (
          <p className="hig-meta">
            A table in no section fires through All tables or Choose tables.
          </p>
        )}
        {f.scope === 'choose' && (
          <fieldset
            className="sf-fieldset sf-tables"
            data-error={f.error || undefined}
            aria-describedby={f.error ? 'sf-nothing' : undefined}
          >
            <legend className="visually-hidden">Choose tables</legend>
            {f.error && (
              <p id="sf-nothing" className="sf-error">
                {NOTHING_TICKED}
              </p>
            )}
            {groups.map((g) => (
              <div key={g.name} className="sf-group">
                <h3 className="sf-group-name">{g.name}</h3>
                <ul className="sf-table-list">
                  {g.tables.map((t) => {
                    const done = isFired(t, f.course);
                    const nobody = t.seated === 0 && !done;
                    const locked = done || nobody;
                    return (
                      <li key={t.name}>
                        <label
                          htmlFor={idOf(t.name)}
                          className="sf-table"
                          data-locked={done || undefined}
                          data-nobody={nobody || undefined}
                        >
                          <input
                            id={idOf(t.name)}
                            type="checkbox"
                            checked={done || f.ticked.includes(t.name)}
                            aria-disabled={locked || undefined}
                            aria-invalid={(f.error && canFire(t, f.course)) || undefined}
                            onChange={() => act(toggle(s, t.name))}
                          />
                          <span className="sf-table-name">{t.name}</span>
                          <span className="sf-table-line">
                            {done && <Glyph paths={LOCK_GLYPH} size={14} />}
                            {nobody && <span className="sf-nobody-ring" aria-hidden="true" />}
                            <span>{tableLine(t, f.course)}</span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </fieldset>
        )}
        {off && (
          <p className="sf-offline" data-tried={s.offlineTried || undefined}>
            <Glyph paths={OFFLINE_GLYPH} size={16} />
            <span>{offlineLine(s)}</span>
          </p>
        )}
        <ActionPair
          className="dialog-actions"
          dismiss={
            <button type="button" className="link-button" onClick={close}>
              Don’t fire
            </button>
          }
          confirm={
            <button
              type="button"
              className="button button-primary sf-fire"
              aria-disabled={off || undefined}
              data-off={off || undefined}
              onClick={fire}
            >
              {fireLabel(s, f)}
            </button>
          }
        />
      </div>
    </>
  );
}

function ConfirmDialog({ s, act }: { s: FireState; act: (n: FireState, f?: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const opener = s.confirm === 'end' ? '[data-sf="end"]' : '[data-sf="next"]';
  const close = () => act(closeConfirm(s), opener);

  useDialogKeys(box, close, false);
  useEffect(() => box.current?.focus(), []);

  const words = confirmWords(s);
  const ending = s.confirm === 'end';

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={box}
        className="dialog hig-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sf-confirm-title"
        aria-describedby="sf-confirm-line"
        tabIndex={-1}
      >
        <div className="dialog-heading">
          <h2 id="sf-confirm-title">{confirmTitle(s)}</h2>
          <p id="sf-confirm-line">{confirmLine(s)}</p>
        </div>
        <span className="sf-pill">Words proposed for [en]</span>
        <ActionPair
          className="dialog-actions"
          dismiss={
            <button type="button" className="link-button" onClick={close}>
              {words.keep}
            </button>
          }
          confirm={
            <button
              type="button"
              className={ending ? 'button' : 'button button-primary'}
              onClick={() => act(confirm(s), ending ? '#content h1' : '[data-sf="fire"]')}
            >
              {words.go}
            </button>
          }
        />
      </div>
    </>
  );
}
