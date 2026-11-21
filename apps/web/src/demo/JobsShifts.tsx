import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import type { Tell } from '../components/SettingsParts.tsx';
import { DemoBell } from './DemoBell.tsx';
import { KeptArea, KeptHere } from './KeptOffline.tsx';
import { clockWords } from './tabKept.ts';
import { EventsShell } from './EventParts.tsx';
import { EventSidebar } from './EventSidebar.tsx';
import { type SampleEvent, sampleEvent } from './events.ts';
import { Pill } from './GuestsParts.tsx';
import { clockOfKitchen } from './kitchen.ts';
import { Wrong } from './MenuServed.tsx';
import { keptInbox, waitingLine } from './messages.ts';
import { RW } from './roster.ts';
import {
  type Coverage,
  type JobDraft,
  type JobsPanel,
  type JobsStart,
  type Plan,
  type Shift,
  type ShiftDraft,
  type ShiftProblems,
  JOB_NAME_MAX,
  JW,
  LEVELS,
  STEP,
  assign,
  assignRefusal,
  byStart,
  coverageOf,
  dateOf,
  firstProblem,
  jobName,
  jobProblem,
  jobsStart,
  levelWords,
  midnightLine,
  minutesOf,
  newOverlap,
  peopleOnJob,
  personName,
  rangeOf,
  removeCase,
  removeJob,
  shiftDraftOf,
  shiftProblems,
  shiftsOf,
  summaryOf,
  ticksOf,
  unassign,
  windowOf,
} from './shifts.ts';
import { STATIONS_EVENT } from './stations.ts';
import { PanelFoot, PanelTop, Select, StaffTabs } from './Stations.tsx';
import { useSwitcherStart } from './switcher.ts';
import './guests.css';
import './menu.css';
import './stations.css';
import './roster.css';
import './jobsShifts.css';

const SHIFT_IDS = {
  job: 'js-f-job',
  start: 'js-f-start-date',
  end: 'js-f-end-date',
  needed: 'js-f-needed',
} as const;

/** /demo/events/evt-wed-4/staff/jobs (sc-3908): Jobs and shifts on the event's Staff page at 1280 × 800, by ?state=. */
export function JobsShiftsPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const raw = params.get('state');
  useSwitcherStart();

  return <JobsAt key={`${id ?? ''}|${raw ?? ''}`} id={id} raw={raw} />;
}

function JobsAt({ id, raw }: { id: string | undefined; raw: string | null }) {
  const [event] = useState(() => sampleEvent(id));
  const [first] = useState(() => jobsStart(raw));

  if (event == null) return <Navigate to="/demo/events" replace />;
  if (event.id !== STATIONS_EVENT)
    return <Navigate to={`/demo/events/${event.id}?area=staff`} replace />;

  return (
    <KeptArea eventId={event.id} area="staff" at={clockWords(clockOfKitchen(), event.timeZone)}>
      <EventsShell
        renderSide={(tell, covered) => (
          <EventSidebar
            event={event}
            area="staff"
            now={clockOfKitchen()}
            tell={tell}
            inert={covered}
            waiting={waitingLine(keptInbox())}
          />
        )}
      >
        {(tell) => <JobsView first={first} event={event} tell={tell} />}
      </EventsShell>
    </KeptArea>
  );
}

function JobsView({ first, event, tell }: { first: JobsStart; event: SampleEvent; tell: Tell }) {
  const [plan, setPlan] = useState<Plan>(first.plan);
  const [view, setView] = useState(first.view);
  const [panel, setPanel] = useState<JobsPanel>(first.panel);
  const [jobDraft, setJobDraft] = useState<JobDraft>(first.jobDraft);
  const [shiftDraft, setShiftDraft] = useState<ShiftDraft>(first.shiftDraft);
  const [pressed, setPressed] = useState(first.pressed);
  const [refused, setRefused] = useState(first.refused);
  const [overlap, setOverlap] = useState<string | null>(first.overlap);
  const [server, setServer] = useState<number | null>(first.server);
  const [meanwhile, setMeanwhile] = useState(first.meanwhile);
  const [said, setSaid] = useState('');
  const focusAfter = useRef<string | null>(null);
  const { manage } = first;

  useEffect(() => {
    if (first.overlap != null) document.getElementById('js-overlap')?.focus();
    else if (first.server != null) document.getElementById(SHIFT_IDS.needed)?.focus();
    else if (first.pressed && (first.panel?.kind === 'addJob' || first.panel?.kind === 'editJob'))
      document.getElementById('js-f-name')?.focus();
    else if (first.pressed) {
      const onIt =
        first.panel?.kind === 'editShift'
          ? (first.plan.shifts.find((one) => one.id === (first.panel as { shift: string }).shift)
              ?.people.length ?? 0)
          : 0;
      const wrong = firstProblem(shiftProblems(first.shiftDraft, onIt));
      if (wrong != null) document.getElementById(SHIFT_IDS[wrong])?.focus();
    }
  }, [first]);

  useEffect(() => {
    if (focusAfter.current == null) return;
    document.getElementById(focusAfter.current)?.focus();
    focusAfter.current = null;
  });

  const coverage = coverageOf(plan);
  const shiftOf = (id: string) => plan.shifts.find((one) => one.id === id) as Shift;
  const panelShift =
    panel?.kind === 'editShift' || panel?.kind === 'assign' ? shiftOf(panel.shift) : null;
  const editingJob = panel?.kind === 'editJob' ? panel.job : null;

  function open(next: JobsPanel) {
    setPressed(false);
    setRefused(null);
    setOverlap(null);
    setServer(null);
    if (next?.kind === 'addJob') setJobDraft({ name: '', level: 'view' });
    if (next?.kind === 'editJob') {
      const job = plan.jobs.find((one) => one.id === next.job);
      setJobDraft({ name: job?.name ?? '', level: job?.level ?? 'view' });
    }
    if (next?.kind === 'addShift') setShiftDraft(shiftDraftOf(null, '', dateOf(plan.event.start)));
    if (next?.kind === 'editShift') setShiftDraft(shiftDraftOf(shiftOf(next.shift)));
    setPanel(next);
    focusAfter.current = 'sn-panel-title';
  }

  function close(back: string) {
    setPanel(null);
    setRefused(null);
    setOverlap(null);
    setServer(null);
    focusAfter.current = back;
  }

  function backOf(current: JobsPanel): string {
    if (current == null || current.kind === 'addJob') return 'js-add-job';
    if (current.kind === 'addShift') return 'js-add-shift';
    if (current.kind === 'editJob') return `js-edit-${current.job}`;
    if (current.kind === 'removeJob') return `js-remove-${current.job}`;
    if (current.kind === 'editShift') return `js-times-${current.shift}`;

    return `js-shift-${current.shift}`;
  }

  function saveJob() {
    if (jobProblem(plan, jobDraft, editingJob) != null) {
      setPressed(true);
      focusAfter.current = 'js-f-name';
      return;
    }
    const name = jobDraft.name.trim();
    if (editingJob == null) {
      const id = `job-${plan.jobs.length + 1}-${name}`;
      setPlan({ ...plan, jobs: [...plan.jobs, { id, name, level: jobDraft.level }] });
      setSaid(JW.jobAdded(name));
      close('js-add-job');
      return;
    }
    setPlan({
      ...plan,
      jobs: plan.jobs.map((one) =>
        one.id === editingJob ? { ...one, name, level: jobDraft.level } : one,
      ),
    });
    setSaid(JW.saved);
    close(`js-edit-${editingJob}`);
  }

  function startRemove(jobId: string) {
    if (removeCase(plan, jobId) === 'straight') {
      const name = jobName(plan, jobId);
      setPlan(removeJob(plan, jobId));
      setPanel(null);
      setSaid(JW.removed(name));
      focusAfter.current = 'js-jobs';
      return;
    }
    open({ kind: 'removeJob', job: jobId });
  }

  function confirmRemove(jobId: string) {
    const name = jobName(plan, jobId);
    setPlan(removeJob(plan, jobId));
    setPanel(null);
    setSaid(JW.removed(name));
    focusAfter.current = 'js-jobs';
  }

  function saveShift() {
    const editing = panel?.kind === 'editShift' ? shiftOf(panel.shift) : null;
    const problems = shiftProblems(shiftDraft, editing?.people.length ?? 0);
    const wrong = firstProblem(problems);
    setServer(null);
    if (wrong != null) {
      setPressed(true);
      setOverlap(null);
      focusAfter.current = SHIFT_IDS[wrong];
      return;
    }
    const start = minutesOf(shiftDraft.startDate, shiftDraft.startTime) as number;
    const end = minutesOf(shiftDraft.endDate, shiftDraft.endTime) as number;
    const needed = Number(shiftDraft.needed);
    if (editing == null) {
      const id = `shift-${plan.shifts.length + 1}`;
      setPlan({
        ...plan,
        shifts: [...plan.shifts, { id, job: shiftDraft.job, start, end, needed, people: [] }],
      });
      setSaid(JW.shiftAdded(jobName(plan, shiftDraft.job), rangeOf(plan, start, end)));
      close('js-add-shift');
      return;
    }
    const clash = newOverlap(plan, editing, start, end);
    if (clash != null) {
      setOverlap(clash);
      setPressed(false);
      focusAfter.current = 'js-overlap';
      return;
    }
    if (meanwhile != null && meanwhile.shift === editing.id) {
      const now = assign(plan, meanwhile.shift, meanwhile.person);
      const onIt = (now.shifts.find((one) => one.id === editing.id) as Shift).people.length;
      setPlan(now);
      setMeanwhile(null);
      if (needed < onIt) {
        setServer(onIt);
        setPressed(false);
        focusAfter.current = SHIFT_IDS.needed;
        return;
      }
    }
    setPlan({
      ...plan,
      shifts: plan.shifts.map((one) =>
        one.id === editing.id ? { ...one, start, end, needed } : one,
      ),
    });
    setSaid(JW.saved);
    close(`js-times-${editing.id}`);
  }

  function pick(shift: Shift, personId: string) {
    const refusal = assignRefusal(plan, shift, personId);
    if (refusal != null) {
      setRefused({ person: personId, words: refusal });
      return;
    }
    const person = plan.people.find((one) => one.id === personId);
    const now = assign(plan, shift.id, personId);
    const job = jobName(plan, shift.job);
    setPlan(now);
    setRefused(null);
    const took = person?.job == null ? ` ${JW.jobTaken(person?.name ?? '', job)}` : '';
    setSaid(
      `${JW.assigned(person?.name ?? '', job, rangeOf(plan, shift.start, shift.end))}${took}`,
    );
    const after = now.shifts.find((one) => one.id === shift.id) as Shift;
    if (after.people.length >= after.needed) close(`js-times-${shift.id}`);
    else focusAfter.current = 'sn-panel-title';
  }

  function drop(shift: Shift, personId: string) {
    const name = personName(plan, personId);
    setPlan(unassign(plan, shift.id, personId));
    setSaid(JW.unassigned(name));
    if (server != null) setServer(null);
    focusAfter.current = panel == null ? `js-times-${shift.id}` : 'sn-panel-title';
  }

  return (
    <div className="desk-page ev-page gs mn sn rs js">
      <div className="ev-wide mn-page">
        <KeptHere />
        <div className="ev-crumb-row">
          <nav className="ev-crumb" aria-label="Breadcrumb">
            <ol>
              <li className="ev-crumb-part">
                <Link to="/demo/events">Events</Link>
              </li>
              <li className="ev-crumb-part">
                <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                <Link className="ev-crumb-name" to={`/demo/events/${event.id}`}>
                  {event.name}
                </Link>
              </li>
              <li className="ev-crumb-part" aria-current="page">
                <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                <span className="ev-crumb-name">{RW.title}</span>
              </li>
            </ol>
          </nav>
          <DemoBell tell={tell} />
        </div>
        <header className="gs-top">
          <div className="mn-head">
            <h1 className="gs-title">{RW.title}</h1>
            <p className="mn-sub">{RW.sub}</p>
          </div>
        </header>
        <StaffTabs on={JW.tab} eventId={event.id} tell={tell} />
        {!manage && (
          <p className="mn-lock">
            <Glyph name="lock" size={16} weight={2.2} />
            {JW.lock}
          </p>
        )}
        <p className="mn-said" role="status">
          {said !== '' && (
            <>
              <Glyph name="tick" size={17} weight={2.6} />
              {said}
            </>
          )}
        </p>
        <div className="mn-split">
          <div className="mn-list">
            <CoverageCard plan={plan} coverage={coverage} view={view} onView={setView} />
            <section className="sn-card" aria-labelledby="js-jobs">
              <div className="sn-card-top">
                <div className="sn-card-names">
                  <h2 id="js-jobs" tabIndex={-1}>
                    {JW.jobs}
                  </h2>
                </div>
                {manage && (
                  <div className="js-top-acts">
                    <button
                      id="js-add-shift"
                      type="button"
                      className="desk-text"
                      onClick={() => open({ kind: 'addShift' })}
                    >
                      <Glyph name="plus" size={17} weight={2.3} />
                      {JW.addShift}
                    </button>
                    <button
                      id="js-add-job"
                      type="button"
                      className="desk-text"
                      onClick={() => open({ kind: 'addJob' })}
                    >
                      <Glyph name="plus" size={17} weight={2.3} />
                      {JW.addJob}
                    </button>
                  </div>
                )}
              </div>
              <ul className="js-jobs">
                {plan.jobs.map((job) => {
                  const shifts = plan.shifts.filter((one) => one.job === job.id).sort(byStart);
                  const lit =
                    (panel?.kind === 'editJob' || panel?.kind === 'removeJob') &&
                    panel.job === job.id;

                  return (
                    <li key={job.id} className={lit ? 'js-job is-lit' : 'js-job'}>
                      <div className="js-job-top">
                        <div className="sn-row-names">
                          <h3 className="js-job-name">{job.name}</h3>
                          <p className="mn-sub">
                            {levelWords(job.level)} ·{' '}
                            {shifts.length === 0 ? JW.noShifts : JW.shiftCount(shifts.length)}
                          </p>
                        </div>
                        {manage && (
                          <div className="js-job-acts">
                            <button
                              id={`js-edit-${job.id}`}
                              type="button"
                              className="desk-text"
                              aria-label={`${JW.edit} ${job.name}`}
                              onClick={() => open({ kind: 'editJob', job: job.id })}
                            >
                              {JW.edit}
                            </button>
                            <button
                              id={`js-remove-${job.id}`}
                              type="button"
                              className="desk-text rs-danger"
                              aria-label={`${JW.remove} ${job.name}`}
                              onClick={() => startRemove(job.id)}
                            >
                              {JW.remove}
                            </button>
                          </div>
                        )}
                      </div>
                      {shifts.length > 0 && (
                        <ul className="js-shifts">
                          {shifts.map((shift) => (
                            <ShiftRow
                              key={shift.id}
                              plan={plan}
                              shift={shift}
                              manage={manage}
                              lit={panelShift?.id === shift.id}
                              onAssign={() => open({ kind: 'assign', shift: shift.id })}
                              onTimes={() => open({ kind: 'editShift', shift: shift.id })}
                              onDrop={(person) => drop(shift, person)}
                            />
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
          {panel != null && manage && (
            <aside className="mn-panel" aria-labelledby="sn-panel-title">
              {(panel.kind === 'addJob' || panel.kind === 'editJob') && (
                <JobForm
                  title={
                    panel.kind === 'editJob' ? JW.editJob(jobName(plan, panel.job)) : JW.addJob
                  }
                  draft={jobDraft}
                  problem={pressed ? jobProblem(plan, jobDraft, editingJob) : null}
                  cta={panel.kind === 'editJob' ? JW.save : JW.add}
                  onChange={(next) => setJobDraft({ ...jobDraft, ...next })}
                  onSave={saveJob}
                  onCancel={() => close(backOf(panel))}
                />
              )}
              {panel.kind === 'removeJob' && (
                <RemoveJob
                  plan={plan}
                  jobId={panel.job}
                  onKeep={() => close(backOf(panel))}
                  onRemove={() => confirmRemove(panel.job)}
                />
              )}
              {(panel.kind === 'addShift' || panel.kind === 'editShift') && (
                <ShiftForm
                  plan={plan}
                  shift={panel.kind === 'editShift' ? shiftOf(panel.shift) : null}
                  draft={shiftDraft}
                  pressed={pressed}
                  overlap={overlap}
                  server={server}
                  onChange={(next) => {
                    setOverlap(null);
                    setServer(null);
                    setShiftDraft({ ...shiftDraft, ...next });
                  }}
                  onDrop={(person) => drop(shiftOf((panel as { shift: string }).shift), person)}
                  onSave={saveShift}
                  onCancel={() => close(backOf(panel))}
                />
              )}
              {panel.kind === 'assign' && (
                <AssignPanel
                  plan={plan}
                  shift={shiftOf(panel.shift)}
                  refused={refused}
                  onPick={(person) => pick(shiftOf(panel.shift), person)}
                  onDrop={(person) => drop(shiftOf(panel.shift), person)}
                  onClose={() => close(backOf(panel))}
                />
              )}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

function CoverageCard({
  plan,
  coverage,
  view,
  onView,
}: {
  plan: Plan;
  coverage: readonly Coverage[];
  view: 'strip' | 'table';
  onView: (view: 'strip' | 'table') => void;
}) {
  const window = windowOf(plan);
  const steps: number[] = [];
  for (let at = window.start; at < window.end; at += STEP) steps.push(at);
  const ticks = ticksOf(plan);

  return (
    <section className="sn-card" aria-labelledby="js-coverage">
      <div className="sn-card-top">
        <div className="sn-card-names">
          <h2 id="js-coverage">{JW.coverage}</h2>
          {coverage.length > 0 && <p className="mn-sub">{summaryOf(coverage)}</p>}
          <p className="mn-quiet">
            {JW.eventHours(rangeOf(plan, plan.event.start, plan.event.end))}
          </p>
        </div>
        {coverage.length > 0 && (
          <div className="js-seg" role="group" aria-label={JW.view}>
            {(['strip', 'table'] as const).map((one) => (
              <button
                key={one}
                type="button"
                aria-pressed={view === one}
                onClick={() => onView(one)}
              >
                {view === one && <Glyph name="tick" size={14} weight={2.6} />}
                {one === 'strip' ? JW.strip : JW.table}
              </button>
            ))}
          </div>
        )}
      </div>
      {coverage.length === 0 ? (
        <p className="mn-quiet">{JW.noShiftsYet}</p>
      ) : view === 'strip' ? (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- it scrolls sideways, so a keyboard has to reach it (WCAG 2.2 §2.1.1).
        <div className="js-frame" tabIndex={0} role="region" aria-label={JW.stripLabel}>
          <div className="js-strip">
            <div className="js-axis" aria-hidden="true">
              <span className="js-axis-name" />
              {ticks.map((tick) => (
                <span key={tick.at} className={tick.day ? 'js-tick is-day' : 'js-tick'}>
                  {tick.words}
                </span>
              ))}
            </div>
            {coverage.map((row) => (
              <div key={row.job.id} className="js-row">
                <h3 className="js-row-name">
                  {row.gaps.length === 0 && <Glyph name="tick" size={14} weight={2.6} />}
                  {row.job.name}
                </h3>
                <div className="js-cells" aria-hidden="true">
                  {row.cells.map((cell, index) => (
                    <span
                      key={steps[index]}
                      className={
                        cell == null
                          ? 'js-cell'
                          : cell.on < cell.needed
                            ? 'js-cell is-short'
                            : 'js-cell is-covered'
                      }
                    >
                      {cell == null ? '' : `${cell.on}/${cell.needed}`}
                    </span>
                  ))}
                </div>
                <p className={row.gaps.length === 0 ? 'js-gaps is-covered' : 'js-gaps'}>
                  {row.gaps.length === 0
                    ? JW.covered
                    : row.gaps
                        .map(
                          (gap) => `${JW.short(gap.short)} · ${rangeOf(plan, gap.start, gap.end)}`,
                        )
                        .join('; ')}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- it scrolls sideways, so a keyboard has to reach it (WCAG 2.2 §2.1.1).
        <div className="js-frame" tabIndex={0} role="region" aria-label={JW.tableLabel}>
          <table className="rs-table js-table">
            <caption className="visually-hidden">{JW.tableLabel}</caption>
            <thead>
              <tr>
                <th scope="col">{JW.thJob}</th>
                <th scope="col">{JW.thTime}</th>
                <th scope="col">{JW.thOn}</th>
                <th scope="col">{JW.thNeeded}</th>
                <th scope="col">{JW.thStatus}</th>
              </tr>
            </thead>
            <tbody>
              {coverage.flatMap((row) =>
                row.spans.map((span) => (
                  <tr key={`${row.job.id}-${span.start}`}>
                    <th scope="row">{row.job.name}</th>
                    <td className="rs-shift">{rangeOf(plan, span.start, span.end)}</td>
                    <td>{span.on}</td>
                    <td>{span.needed}</td>
                    <td>{span.on < span.needed ? JW.short(span.needed - span.on) : JW.covered}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Chip({ name, manage, onDrop }: { name: string; manage: boolean; onDrop: () => void }) {
  return (
    <li className="js-chip">
      {name}
      {manage && (
        <button type="button" className="js-chip-x" aria-label={JW.unassign(name)} onClick={onDrop}>
          <Glyph name="clear" size={14} weight={2.4} />
        </button>
      )}
    </li>
  );
}

function Places({
  plan,
  shift,
  manage,
  onDrop,
}: {
  plan: Plan;
  shift: Shift;
  manage: boolean;
  onDrop: (person: string) => void;
}) {
  const open = Math.max(0, shift.needed - shift.people.length);

  return (
    <ul className="js-chips">
      {shift.people.map((id) => (
        <Chip key={id} name={personName(plan, id)} manage={manage} onDrop={() => onDrop(id)} />
      ))}
      {Array.from({ length: open }, (_, index) => (
        <li key={`open-${index}`} className="js-chip is-open">
          {JW.openPlace}
        </li>
      ))}
    </ul>
  );
}

function ShiftRow({
  plan,
  shift,
  manage,
  lit,
  onAssign,
  onTimes,
  onDrop,
}: {
  plan: Plan;
  shift: Shift;
  manage: boolean;
  lit: boolean;
  onAssign: () => void;
  onTimes: () => void;
  onDrop: (person: string) => void;
}) {
  const full = shift.people.length >= shift.needed;
  const job = jobName(plan, shift.job);

  return (
    <li className={lit ? 'js-shift is-lit' : 'js-shift'}>
      <div className="js-shift-top">
        <p className="js-shift-times" id={`js-shift-${shift.id}`} tabIndex={-1}>
          {rangeOf(plan, shift.start, shift.end)}
        </p>
        <p className="mn-sub">{JW.filled(shift.people.length, shift.needed)}</p>
        {manage && (
          <div className="js-job-acts">
            <button
              id={`js-times-${shift.id}`}
              type="button"
              className="desk-text"
              aria-label={`${JW.editTimes}, ${JW.editShift(job, rangeOf(plan, shift.start, shift.end))}`}
              onClick={onTimes}
            >
              {JW.editTimes}
            </button>
            {!full && (
              <button
                type="button"
                className="desk-text"
                aria-label={`${JW.assign}, ${JW.editShift(job, rangeOf(plan, shift.start, shift.end))}`}
                onClick={onAssign}
              >
                <Glyph name="plus" size={16} weight={2.3} />
                {JW.assign}
              </button>
            )}
          </div>
        )}
      </div>
      <Places plan={plan} shift={shift} manage={manage} onDrop={onDrop} />
      {full && manage && <p className="mn-quiet js-full">{JW.full}</p>}
    </li>
  );
}

function JobForm({
  title,
  draft,
  problem,
  cta,
  onChange,
  onSave,
  onCancel,
}: {
  title: string;
  draft: JobDraft;
  problem: string | null;
  cta: string;
  onChange: (next: Partial<JobDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <PanelTop title={title} onClose={onCancel} />
      <div className="mn-panel-body">
        <div className="desk-field">
          <label htmlFor="js-f-name" className="desk-label">
            {JW.name}
          </label>
          <div className={problem == null ? 'desk-box' : 'desk-box is-wrong'}>
            <input
              id="js-f-name"
              type="text"
              value={draft.name}
              autoComplete="off"
              aria-invalid={problem != null}
              aria-describedby={
                problem == null ? 'js-f-name-help' : 'js-f-name-error js-f-name-help'
              }
              onChange={(change) => onChange({ name: change.target.value })}
            />
          </div>
          {problem != null && <Wrong id="js-f-name-error">{problem}</Wrong>}
          <p id="js-f-name-help" className="desk-help">
            {JW.nameHelp} {`${[...draft.name.trim()].length}/${JOB_NAME_MAX}`}
          </p>
        </div>
        <fieldset className="js-levels">
          <legend className="desk-label">{JW.level}</legend>
          {LEVELS.map((one) => (
            <div key={one.level} className="js-level">
              <input
                id={`js-level-${one.level}-input`}
                type="radio"
                name="js-level"
                value={one.level}
                checked={draft.level === one.level}
                aria-describedby={`js-level-${one.level}`}
                onChange={() => onChange({ level: one.level })}
              />
              <div className="js-level-words">
                <label htmlFor={`js-level-${one.level}-input`} className="js-level-name">
                  {one.words}
                </label>
                <span id={`js-level-${one.level}`} className="desk-help">
                  {one.hint}
                </span>
              </div>
            </div>
          ))}
        </fieldset>
      </div>
      <PanelFoot cta={cta} onSave={onSave} onCancel={onCancel} />
    </>
  );
}

function RemoveJob({
  plan,
  jobId,
  onKeep,
  onRemove,
}: {
  plan: Plan;
  jobId: string;
  onKeep: () => void;
  onRemove: () => void;
}) {
  const name = jobName(plan, jobId);
  const refused = removeCase(plan, jobId) === 'refused';
  const shifts = plan.shifts.filter((one) => one.job === jobId).sort(byStart);

  return (
    <>
      <div className="mn-panel-top">
        <div className="mn-panel-names">
          <h2 id="sn-panel-title" tabIndex={-1}>
            {refused ? JW.removeRefused : JW.removeAsk(name, shifts.length)}
          </h2>
        </div>
      </div>
      <div className="mn-panel-body">
        {refused ? (
          <p className="mn-failed" role="alert">
            <Glyph name="alert" size={17} weight={2.2} />
            {`${name}: ${JW.removeRefusedSub(peopleOnJob(plan, jobId))}`}
          </p>
        ) : (
          <>
            <ul className="js-ask-shifts">
              {shifts.map((one) => (
                <li key={one.id}>{JW.editShift(name, rangeOf(plan, one.start, one.end))}</li>
              ))}
            </ul>
            <p className="mn-quiet">{JW.removeAskSub}</p>
          </>
        )}
      </div>
      <div className="mn-panel-foot">
        <div className="mn-panel-acts">
          {refused ? (
            <Pill label={JW.close} primary onClick={onKeep} />
          ) : (
            <>
              <button type="button" className="desk-text" onClick={onKeep}>
                {JW.keep}
              </button>
              <button type="button" className="gs-pill is-primary rs-remove-go" onClick={onRemove}>
                {JW.remove}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function ShiftForm({
  plan,
  shift,
  draft,
  pressed,
  overlap,
  server,
  onChange,
  onDrop,
  onSave,
  onCancel,
}: {
  plan: Plan;
  shift: Shift | null;
  draft: ShiftDraft;
  pressed: boolean;
  overlap: string | null;
  server: number | null;
  onChange: (next: Partial<ShiftDraft>) => void;
  onDrop: (person: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const onIt = shift?.people.length ?? 0;
  const checked = shiftProblems(draft, onIt);
  const below = checked.needed != null && checked.needed === JW.neededBelow(onIt);
  const problems: ShiftProblems = pressed ? checked : below ? { needed: JW.neededBelow(onIt) } : {};
  if (server != null) problems.needed = JW.neededBelow(server);
  const midnight = midnightLine(draft);
  const job = shift == null ? '' : jobName(plan, shift.job);
  const told = (id: string, wrong: string | undefined, help?: string) =>
    [wrong == null ? null : `${id}-error`, help ?? null].filter(Boolean).join(' ') || undefined;

  return (
    <>
      {shift == null ? (
        <PanelTop title={JW.addShift} onClose={onCancel} />
      ) : (
        <PanelTop
          title={JW.editShift(job, rangeOf(plan, shift.start, shift.end))}
          eyebrow={JW.editTimes}
          onClose={onCancel}
        />
      )}
      <div className="mn-panel-body">
        {shift != null && (
          <div className="js-on-shift">
            <p className="desk-label">{JW.onShift(onIt)}</p>
            <Places plan={plan} shift={shift} manage onDrop={onDrop} />
          </div>
        )}
        {shift == null && (
          <div className="desk-field">
            <label htmlFor={SHIFT_IDS.job} className="desk-label">
              {JW.job}
            </label>
            <Select
              id={SHIFT_IDS.job}
              value={draft.job}
              shown={draft.job === '' ? JW.chooseJob : jobName(plan, draft.job)}
              wrong={problems.job != null}
              {...(problems.job == null ? {} : { describedBy: `${SHIFT_IDS.job}-error` })}
              onChange={(value) => onChange({ job: value })}
              options={[
                { value: '', label: JW.chooseJob },
                ...plan.jobs.map((one) => ({ value: one.id, label: one.name })),
              ]}
            />
            {problems.job != null && <Wrong id={`${SHIFT_IDS.job}-error`}>{problems.job}</Wrong>}
          </div>
        )}
        <When
          legend={JW.starts}
          id="js-f-start"
          date={draft.startDate}
          time={draft.startTime}
          wrong={problems.start}
          onDate={(value) => onChange({ startDate: value })}
          onTime={(value) => onChange({ startTime: value })}
        />
        <When
          legend={JW.ends}
          id="js-f-end"
          date={draft.endDate}
          time={draft.endTime}
          wrong={problems.end}
          line={problems.end == null ? midnight : null}
          onDate={(value) => onChange({ endDate: value })}
          onTime={(value) => onChange({ endTime: value })}
        />
        {overlap != null && (
          <p id="js-overlap" className="mn-failed" role="alert" tabIndex={-1}>
            <Glyph name="alert" size={17} weight={2.2} />
            {overlap}
          </p>
        )}
        <div className="desk-field">
          <label htmlFor={SHIFT_IDS.needed} className="desk-label">
            {JW.needed}
          </label>
          <div
            className={
              problems.needed == null ? 'desk-box js-needed' : 'desk-box js-needed is-wrong'
            }
          >
            <input
              id={SHIFT_IDS.needed}
              type="text"
              inputMode="numeric"
              value={draft.needed}
              autoComplete="off"
              aria-invalid={problems.needed != null}
              aria-describedby={told(SHIFT_IDS.needed, problems.needed, `${SHIFT_IDS.needed}-help`)}
              onChange={(change) => onChange({ needed: change.target.value })}
            />
          </div>
          {problems.needed != null && (
            <Wrong id={`${SHIFT_IDS.needed}-error`}>{problems.needed}</Wrong>
          )}
          <p id={`${SHIFT_IDS.needed}-help`} className="desk-help">
            {shift == null ? JW.neededHelp : JW.neededHelpEdit}
          </p>
        </div>
      </div>
      <PanelFoot cta={shift == null ? JW.add : JW.save} onSave={onSave} onCancel={onCancel} />
    </>
  );
}

export function When({
  legend,
  id,
  date,
  time,
  wrong,
  line = null,
  step = 60 * STEP,
  onDate,
  onTime,
}: {
  legend: string;
  id: string;
  date: string;
  time: string;
  wrong: string | undefined;
  line?: string | null;
  step?: number;
  onDate: (value: string) => void;
  onTime: (value: string) => void;
}) {
  const described =
    [wrong == null ? null : `${id}-error`, line == null ? null : `${id}-line`]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <fieldset className="desk-field js-when">
      <legend className="desk-label">{legend}</legend>
      <div className="js-when-pair">
        <div className={wrong == null ? 'desk-box' : 'desk-box is-wrong'}>
          <input
            id={`${id}-date`}
            type="date"
            aria-label={`${legend}, ${JW.date}`}
            value={date}
            aria-invalid={wrong != null}
            aria-describedby={described}
            onChange={(change) => onDate(change.target.value)}
          />
        </div>
        <div className={wrong == null ? 'desk-box' : 'desk-box is-wrong'}>
          <input
            id={`${id}-time`}
            type="time"
            step={step}
            aria-label={`${legend}, ${JW.time}`}
            value={time}
            aria-invalid={wrong != null}
            aria-describedby={described}
            onChange={(change) => onTime(change.target.value)}
          />
        </div>
      </div>
      {wrong != null && <Wrong id={`${id}-error`}>{wrong}</Wrong>}
      {line != null && (
        <p id={`${id}-line`} className="desk-help js-midnight">
          <Glyph name="clock" size={15} weight={2.2} />
          {line}
        </p>
      )}
    </fieldset>
  );
}

function AssignPanel({
  plan,
  shift,
  refused,
  onPick,
  onDrop,
  onClose,
}: {
  plan: Plan;
  shift: Shift;
  refused: { person: string; words: string } | null;
  onPick: (person: string) => void;
  onDrop: (person: string) => void;
  onClose: () => void;
}) {
  const job = jobName(plan, shift.job);
  const full = shift.people.length >= shift.needed;
  const others = plan.people.filter((one) => !shift.people.includes(one.id));

  return (
    <>
      <PanelTop
        title={JW.editShift(job, rangeOf(plan, shift.start, shift.end))}
        eyebrow={JW.assign}
        onClose={onClose}
      />
      <div className="mn-panel-body">
        <div className="js-on-shift">
          <p className="desk-label">{JW.filled(shift.people.length, shift.needed)}</p>
          <Places plan={plan} shift={shift} manage onDrop={onDrop} />
          {full && <p className="mn-quiet js-full">{JW.full}</p>}
        </div>
        {!full && (
          <ul
            className="js-people"
            aria-label={JW.assignTo(job, rangeOf(plan, shift.start, shift.end))}
          >
            {others.length === 0 && <li className="mn-quiet">{JW.notOnHere}</li>}
            {others.map((person) => {
              const theirs = shiftsOf(plan, person.id);
              const no = refused?.person === person.id ? refused.words : null;

              return (
                <li key={person.id} className={no == null ? 'js-person' : 'js-person is-refused'}>
                  <button
                    type="button"
                    className="js-person-pick"
                    aria-describedby={
                      no == null ? `js-p-${person.id}` : `js-p-${person.id} js-p-${person.id}-no`
                    }
                    onClick={() => onPick(person.id)}
                  >
                    <span className="js-person-name">{person.name}</span>
                    <span id={`js-p-${person.id}`} className="mn-sub">
                      {person.job == null
                        ? JW.takesJob(job)
                        : theirs.length === 0
                          ? `${jobName(plan, person.job)} · ${JW.otherShifts}`
                          : theirs
                              .map((one) =>
                                JW.editShift(
                                  jobName(plan, one.job),
                                  rangeOf(plan, one.start, one.end),
                                ),
                              )
                              .join('; ')}
                    </span>
                  </button>
                  <div role="alert">
                    {no != null && <Wrong id={`js-p-${person.id}-no`}>{no}</Wrong>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="mn-panel-foot">
        <div className="mn-panel-acts">
          <Pill label={JW.close} onClick={onClose} />
        </div>
      </div>
    </>
  );
}
