import {
  ApiError,
  JOB_NAME_MAXIMUM,
  type OrganisationEvent,
  SHIFT_NEEDED_MAXIMUM,
  STAFF_ACCESS,
  type StaffAccess,
  type StaffJob,
  type StaffPlan,
  type StaffShift,
  asStaffPlan,
  realtimeTopic,
} from '@soirely/api-client';
import {
  COVERAGE_STEP_MS,
  type CoverageShift,
  type JobCoverage,
  coverageWindow,
  holdingName,
  jobCoverage,
  resolvedInstant,
} from '@soirely/domain';
import type { TFunction } from 'i18next';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { Skeleton } from '../../../components/Skeleton.tsx';
import { useDeskTop } from '../../../deskTop.ts';
import { dateLocale } from '../../../i18n/index.ts';
import { pageTitle, usePageTitle } from '../../../pageTitle.ts';
import { canOn } from '../../../session.ts';
import { FieldWrong } from './GuestFields.tsx';
import { StaffTabs } from './StaffTabs.tsx';
import {
  type StaffTimes,
  clockWords,
  dayWords,
  rangeWords,
  staffTimes,
  wallOf,
  weekdayWords,
} from './staffTimes.ts';
import { useHubTopics } from './useHubTopics.ts';
import '../../../components/SettingsParts.css';
import '../../../components/eventsDesk.css';
import '../../../components/eventPage.css';
import './guests.css';
import './roster.css';
import './jobsShifts.css';

const DAY_MS = 24 * 60 * 60_000;

const SHIFT_IDS = {
  job: 'js-f-job',
  start: 'js-f-start-date',
  end: 'js-f-end-date',
  needed: 'js-f-needed',
} as const;

const SHIFT_FIELDS = ['job', 'start', 'end', 'needed'] as const;

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; plan: StaffPlan };

type Panel =
  | { kind: 'addJob' }
  | { kind: 'editJob'; job: string }
  | { kind: 'removeJob'; job: string }
  | { kind: 'addShift' }
  | { kind: 'editShift'; shift: string }
  | { kind: 'assign'; shift: string }
  | null;

interface JobDraft {
  name: string;
  access: StaffAccess;
}

interface ShiftDraft {
  job: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  needed: string;
}

type ShiftProblems = Partial<Record<(typeof SHIFT_FIELDS)[number], string>>;

const byStart = (a: StaffShift, b: StaffShift) =>
  Date.parse(a.startsAt) - Date.parse(b.startsAt) || Date.parse(a.endsAt) - Date.parse(b.endsAt);

const overlaps = (a: { startsAt: string; endsAt: string }, start: number, end: number) =>
  Date.parse(a.startsAt) < end && start < Date.parse(a.endsAt);

/** /app/events/:id/staff/jobs (sc-3908): Jobs and shifts on the event's Staff page, as its demo draws it at a desk. */
export function JobsShiftsArea({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();
  const desk = useDeskTop();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  usePageTitle(pageTitle(t, [t('jobs.tab'), event.name]));

  useEffect(() => {
    let current = true;

    api.staffPlan(event.id).then(
      (plan) => current && setLoad({ kind: 'loaded', plan }),
      () => current && setLoad((was) => (was.kind === 'loaded' ? was : { kind: 'failed' })),
    );

    return () => {
      current = false;
    };
  }, [event.id, attempt]);

  const topics = useMemo(() => [realtimeTopic('EventStaff', event.id)], [event.id]);
  useHubTopics(
    topics,
    () => api.staffSubscription(event.id),
    (data) => {
      const plan = asStaffPlan(data);
      if (plan == null) setAttempt((n) => n + 1);
      else setLoad({ kind: 'loaded', plan });
    },
    () => setAttempt((n) => n + 1),
  );

  return (
    <div className="desk ev desk-page ev-page gs mn sn rs js">
      <div className="ev-wide mn-page">
        <div className="ev-crumb-row">
          <nav className="ev-crumb" aria-label={t('roster.crumb')}>
            <ol>
              <li className="ev-crumb-part">
                <Link to="/app/events">{t('roster.events')}</Link>
              </li>
              <li className="ev-crumb-part">
                <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                <Link className="ev-crumb-name" to={`/app/events/${encodeURIComponent(event.id)}`}>
                  {event.name}
                </Link>
              </li>
              <li className="ev-crumb-part" aria-current="page">
                <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                <span className="ev-crumb-name">{t('roster.title')}</span>
              </li>
            </ol>
          </nav>
          {desk.bell}
        </div>
        <header className="gs-top">
          <div className="mn-head">
            <h1 className="gs-title">{t('roster.title')}</h1>
            <p className="mn-sub">{t('roster.sub')}</p>
          </div>
        </header>
        <StaffTabs on="jobs" eventId={event.id} />
        {load.kind === 'loading' && (
          <Skeleton words={t('jobs.loading')} shape="rows" rowHeight={56} />
        )}
        {load.kind === 'failed' && (
          <div className="sn-card" role="alert">
            <p className="mn-failed">
              <Glyph name="alert" size={17} weight={2.2} />
              {t('jobs.failed')}
            </p>
            <div>
              <button
                type="button"
                className="gs-pill is-secondary"
                onClick={() => {
                  setLoad({ kind: 'loading' });
                  setAttempt((n) => n + 1);
                }}
              >
                {t('jobs.tryAgain')}
              </button>
            </div>
          </div>
        )}
        {load.kind === 'loaded' && (
          <JobsShifts
            event={event}
            plan={load.plan}
            onPlan={(plan) => setLoad({ kind: 'loaded', plan })}
          />
        )}
      </div>
    </div>
  );
}

function shiftDraftOf(shift: StaffShift | null, timeZone: string, day: string): ShiftDraft {
  if (shift == null)
    return { job: '', startDate: day, startTime: '', endDate: day, endTime: '', needed: '1' };
  const start = wallOf(shift.startsAt, timeZone);
  const end = wallOf(shift.endsAt, timeZone);

  return {
    job: shift.job,
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    needed: String(shift.needed),
  };
}

/** sc-234's corrections, then 1 to 50, then no fewer than the people already on it. */
function shiftProblems(
  draft: ShiftDraft,
  onIt: number,
  adding: boolean,
  timeZone: string,
  t: TFunction,
): ShiftProblems {
  const problems: ShiftProblems = {};
  if (adding && draft.job === '') problems.job = t('jobs.jobBlank');
  const start = resolvedInstant(draft.startDate, draft.startTime, timeZone);
  const end = resolvedInstant(draft.endDate, draft.endTime, timeZone);
  if (start == null) problems.start = t('jobs.startBlank');
  if (end == null) problems.end = t('jobs.endBlank');
  else if (start != null && end <= start) problems.end = t('jobs.endBefore');
  else if (start != null && end - start > DAY_MS) problems.end = t('jobs.tooLong');
  const needed = /^\d+$/.test(draft.needed.trim()) ? Number(draft.needed) : Number.NaN;
  if (!(needed >= 1 && needed <= SHIFT_NEEDED_MAXIMUM))
    problems.needed = t('jobs.neededRange', { max: SHIFT_NEEDED_MAXIMUM });
  else if (needed < onIt) problems.needed = t('jobs.neededBelow', { count: onIt });

  return problems;
}

function firstProblem(problems: ShiftProblems): (typeof SHIFT_FIELDS)[number] | null {
  return SHIFT_FIELDS.find((one) => problems[one] != null) ?? null;
}

function JobsShifts({
  event,
  plan,
  onPlan,
}: {
  event: OrganisationEvent;
  plan: StaffPlan;
  onPlan: (plan: StaffPlan) => void;
}) {
  const { t } = useTranslation();
  const manage = canOn(event, 'staff.manage');
  const times = staffTimes(event, plan.shifts, dateLocale());
  const [view, setView] = useState<'strip' | 'table'>('strip');
  const [panel, setPanel] = useState<Panel>(null);
  const [jobDraft, setJobDraft] = useState<JobDraft>({ name: '', access: 'view' });
  const [shiftDraft, setShiftDraft] = useState<ShiftDraft>(() =>
    shiftDraftOf(null, event.timeZone, wallOf(event.startsAt, event.timeZone).date),
  );
  const [pressed, setPressed] = useState(false);
  const [serverName, setServerName] = useState<string | null>(null);
  const [refused, setRefused] = useState<{ person: string; words: string } | null>(null);
  const [overlap, setOverlap] = useState<string | null>(null);
  const [server, setServer] = useState<number | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');
  const focusAfter = useRef<string | null>(null);

  useEffect(() => {
    if (focusAfter.current == null) return;
    document.getElementById(focusAfter.current)?.focus();
    focusAfter.current = null;
  });

  const jobOf = (id: string | null) => plan.jobs.find((one) => one.id === id) ?? null;
  const jobName = (id: string | null) => jobOf(id)?.name ?? t('jobs.noJobYet');
  const shiftOf = (id: string) => plan.shifts.find((one) => one.id === id) ?? null;
  const personOf = (id: string) => plan.staff.find((one) => one.id === id) ?? null;
  const range = (shift: { startsAt: string | number; endsAt: string | number }) =>
    rangeWords(shift.startsAt, shift.endsAt, times, t);
  const theirShifts = (personId: string) =>
    plan.shifts.filter((one) => one.people.includes(personId)).sort(byStart);

  const panelShift =
    panel?.kind === 'editShift' || panel?.kind === 'assign' ? shiftOf(panel.shift) : null;
  const editingJob = panel?.kind === 'editJob' ? panel.job : null;

  function jobProblem(): string | null {
    if (serverName != null) return serverName;
    const name = jobDraft.name.trim();
    if (name === '') return t('jobs.nameBlank');
    if ([...name].length > JOB_NAME_MAXIMUM) return t('jobs.nameLong', { max: JOB_NAME_MAXIMUM });
    const same = holdingName(plan.jobs, name, editingJob);

    return same == null ? null : t('jobs.nameTaken', { name: same.name });
  }

  function reset() {
    setPressed(false);
    setServerName(null);
    setRefused(null);
    setOverlap(null);
    setServer(null);
    setFailed(null);
  }

  function open(next: Panel) {
    reset();
    if (next?.kind === 'addJob') setJobDraft({ name: '', access: 'view' });
    if (next?.kind === 'editJob') {
      const job = jobOf(next.job);
      setJobDraft({ name: job?.name ?? '', access: job?.access ?? 'view' });
    }
    if (next?.kind === 'addShift')
      setShiftDraft(
        shiftDraftOf(null, event.timeZone, wallOf(event.startsAt, event.timeZone).date),
      );
    if (next?.kind === 'editShift')
      setShiftDraft(shiftDraftOf(shiftOf(next.shift), event.timeZone, ''));
    setPanel(next);
    focusAfter.current = 'sn-panel-title';
  }

  function close(back: string) {
    setPanel(null);
    reset();
    focusAfter.current = back;
  }

  function backOf(current: Panel): string {
    if (current == null || current.kind === 'addJob') return 'js-add-job';
    if (current.kind === 'addShift') return 'js-add-shift';
    if (current.kind === 'editJob') return `js-edit-${current.job}`;
    if (current.kind === 'removeJob') return `js-remove-${current.job}`;
    if (current.kind === 'editShift') return `js-times-${current.shift}`;

    return `js-shift-${current.shift}`;
  }

  async function sent(change: () => Promise<StaffPlan>): Promise<StaffPlan | null> {
    setBusy(true);
    setFailed(null);
    try {
      const next = await change();
      onPlan(next);

      return next;
    } finally {
      setBusy(false);
    }
  }

  function notSaved() {
    setFailed(t('jobs.notSaved'));
    focusAfter.current = 'js-failed';
  }

  async function saveJob() {
    if (jobProblem() != null) {
      setPressed(true);
      focusAfter.current = 'js-f-name';
      return;
    }
    const name = jobDraft.name.trim();
    const body = { name, access: jobDraft.access };
    try {
      await sent(() =>
        editingJob == null
          ? api.addStaffJob(event.id, body)
          : api.editStaffJob(event.id, editingJob, body),
      );
      setSaid(editingJob == null ? t('jobs.jobAdded', { job: name }) : t('jobs.saved'));
      close(editingJob == null ? 'js-add-job' : `js-edit-${editingJob}`);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'validation_failed') {
        setServerName(error.fieldErrors().name ?? t('jobs.notSaved'));
        setPressed(true);
        focusAfter.current = 'js-f-name';
      } else notSaved();
    }
  }

  async function removeJob(jobId: string) {
    const name = jobName(jobId);
    try {
      await sent(() => api.removeStaffJob(event.id, jobId));
      setPanel(null);
      reset();
      setSaid(t('jobs.removed', { job: name }));
      focusAfter.current = 'js-jobs';
    } catch (error) {
      if (error instanceof ApiError && error.code === 'staff_job_staffed')
        setPanel({ kind: 'removeJob', job: jobId });
      else notSaved();
    }
  }

  function startRemove(jobId: string) {
    const shifts = plan.shifts.filter((one) => one.job === jobId);
    if (shifts.length === 0) {
      void removeJob(jobId);
      return;
    }
    open({ kind: 'removeJob', job: jobId });
  }

  async function saveShift() {
    const editing = panel?.kind === 'editShift' ? shiftOf(panel.shift) : null;
    const problems = shiftProblems(
      shiftDraft,
      editing?.people.length ?? 0,
      editing == null,
      event.timeZone,
      t,
    );
    const wrong = firstProblem(problems);
    setServer(null);
    if (wrong != null) {
      setPressed(true);
      setOverlap(null);
      focusAfter.current = SHIFT_IDS[wrong];
      return;
    }
    const start = resolvedInstant(
      shiftDraft.startDate,
      shiftDraft.startTime,
      event.timeZone,
    ) as number;
    const end = resolvedInstant(shiftDraft.endDate, shiftDraft.endTime, event.timeZone) as number;
    if (editing != null) {
      const clash = newOverlap(editing, start, end);
      if (clash != null) {
        setOverlap(clash);
        setPressed(false);
        focusAfter.current = 'js-overlap';
        return;
      }
    }
    const body = {
      startsAt: `${shiftDraft.startDate}T${shiftDraft.startTime}`,
      endsAt: `${shiftDraft.endDate}T${shiftDraft.endTime}`,
      needed: Number(shiftDraft.needed),
    };
    try {
      if (editing == null) {
        await sent(() => api.addStaffShift(event.id, { ...body, job: shiftDraft.job }));
        setSaid(
          t('jobs.shiftAdded', {
            job: jobName(shiftDraft.job),
            when: range({ startsAt: start, endsAt: end }),
          }),
        );
        close('js-add-shift');
      } else {
        await sent(() => api.editStaffShift(event.id, editing.id, body));
        setSaid(t('jobs.saved'));
        close(`js-times-${editing.id}`);
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === 'validation_failed') {
        const onShift = error.problem.onShift;
        const fields = error.fieldErrors();
        if (fields.needed != null && onShift != null && onShift >= 2) {
          setServer(onShift);
          setPressed(false);
          focusAfter.current = SHIFT_IDS.needed;
          void api.staffPlan(event.id).then(onPlan, () => undefined);
        } else notSaved();
      } else if (error instanceof ApiError && error.code === 'staff_shift_overlap') {
        setOverlap(error.problem.detail ?? t('jobs.notSaved'));
        focusAfter.current = 'js-overlap';
      } else notSaved();
    }
  }

  function newOverlap(shift: StaffShift, start: number, end: number): string | null {
    for (const id of shift.people) {
      const other = theirShifts(id).find((one) => one.id !== shift.id && overlaps(one, start, end));
      if (other != null)
        return t('jobs.overlap', {
          name: personOf(id)?.fullName ?? '',
          job: jobName(other.job),
          when: range(other),
        });
    }

    return null;
  }

  function assignRefusal(shift: StaffShift, personId: string): string | null {
    const person = personOf(personId);
    if (person == null) return null;
    if (person.job != null && person.job.id !== shift.job)
      return t('jobs.worksAs', { name: person.fullName, job: person.job.name });
    const other = theirShifts(personId).find(
      (one) =>
        one.id !== shift.id && overlaps(one, Date.parse(shift.startsAt), Date.parse(shift.endsAt)),
    );

    return other == null
      ? null
      : t('jobs.overlap', { name: person.fullName, job: jobName(other.job), when: range(other) });
  }

  async function pick(shift: StaffShift, personId: string) {
    const refusal = assignRefusal(shift, personId);
    if (refusal != null) {
      setRefused({ person: personId, words: refusal });
      return;
    }
    const person = personOf(personId);
    const job = jobName(shift.job);
    try {
      const next = await sent(() => api.assignStaff(event.id, shift.id, personId));
      setRefused(null);
      const took =
        person?.job == null ? ` ${t('jobs.jobTaken', { name: person?.fullName ?? '', job })}` : '';
      setSaid(
        `${t('jobs.assigned', { name: person?.fullName ?? '', job, when: range(shift) })}${took}`,
      );
      const after = next?.shifts.find((one) => one.id === shift.id);
      if (after != null && after.people.length >= after.needed) close(`js-times-${shift.id}`);
      else focusAfter.current = 'sn-panel-title';
    } catch (error) {
      if (error instanceof ApiError && error.status === 409)
        setRefused({ person: personId, words: error.problem.detail ?? t('jobs.notSaved') });
      else notSaved();
    }
  }

  async function drop(shift: StaffShift, personId: string) {
    const name = personOf(personId)?.fullName ?? '';
    try {
      await sent(() => api.unassignStaff(event.id, shift.id, personId));
      setSaid(t('jobs.unassigned', { name }));
      if (server != null) setServer(null);
      focusAfter.current = panel == null ? `js-times-${shift.id}` : 'sn-panel-title';
    } catch {
      notSaved();
    }
  }

  const coverageShifts: CoverageShift[] = plan.shifts.map((one) => ({
    job: one.job,
    startsAt: Date.parse(one.startsAt),
    endsAt: Date.parse(one.endsAt),
    needed: one.needed,
    on: one.people.length,
  }));
  const window = coverageWindow(
    { startsAt: Date.parse(event.startsAt), endsAt: Date.parse(event.endsAt) },
    coverageShifts,
    event.timeZone,
  );
  const coverage = jobCoverage(
    plan.jobs.map((one) => one.id),
    coverageShifts,
    window,
  );

  return (
    <>
      {!manage && (
        <p className="mn-lock">
          <Glyph name="lock" size={16} weight={2.2} />
          {t('jobs.lock')}
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
          <CoverageCard
            event={event}
            plan={plan}
            times={times}
            steps={window.steps}
            coverage={coverage}
            view={view}
            onView={setView}
          />
          <section className="sn-card" aria-labelledby="js-jobs">
            <div className="sn-card-top">
              <div className="sn-card-names">
                <h2 id="js-jobs" tabIndex={-1}>
                  {t('jobs.jobs')}
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
                    {t('jobs.addShift')}
                  </button>
                  <button
                    id="js-add-job"
                    type="button"
                    className="desk-text"
                    onClick={() => open({ kind: 'addJob' })}
                  >
                    <Glyph name="plus" size={17} weight={2.3} />
                    {t('jobs.addJob')}
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
                          {t(`jobs.access.${job.access}`)} ·{' '}
                          {shifts.length === 0
                            ? t('jobs.noShifts')
                            : t('jobs.shiftCount', { count: shifts.length })}
                        </p>
                      </div>
                      {manage && (
                        <div className="js-job-acts">
                          <button
                            id={`js-edit-${job.id}`}
                            type="button"
                            className="desk-text"
                            aria-label={t('jobs.labelled', {
                              action: t('jobs.edit'),
                              what: job.name,
                            })}
                            onClick={() => open({ kind: 'editJob', job: job.id })}
                          >
                            {t('jobs.edit')}
                          </button>
                          <button
                            id={`js-remove-${job.id}`}
                            type="button"
                            className="desk-text rs-danger"
                            aria-label={t('jobs.labelled', {
                              action: t('jobs.remove'),
                              what: job.name,
                            })}
                            onClick={() => startRemove(job.id)}
                          >
                            {t('jobs.remove')}
                          </button>
                        </div>
                      )}
                    </div>
                    {shifts.length > 0 && (
                      <ul className="js-shifts">
                        {shifts.map((shift) => (
                          <ShiftRow
                            key={shift.id}
                            shift={shift}
                            job={job}
                            when={range(shift)}
                            names={(id) => personOf(id)?.fullName ?? ''}
                            manage={manage}
                            lit={panelShift?.id === shift.id}
                            onAssign={() => open({ kind: 'assign', shift: shift.id })}
                            onTimes={() => open({ kind: 'editShift', shift: shift.id })}
                            onDrop={(person) => void drop(shift, person)}
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
                  panel.kind === 'editJob'
                    ? t('jobs.editJob', { job: jobName(panel.job) })
                    : t('jobs.addJob')
                }
                draft={jobDraft}
                problem={pressed ? jobProblem() : null}
                failed={failed}
                busy={busy}
                cta={panel.kind === 'editJob' ? t('jobs.save') : t('jobs.add')}
                onChange={(next) => {
                  setServerName(null);
                  setJobDraft({ ...jobDraft, ...next });
                }}
                onSave={() => void saveJob()}
                onCancel={() => close(backOf(panel))}
              />
            )}
            {panel.kind === 'removeJob' && (
              <RemoveJob
                job={jobOf(panel.job)}
                shifts={plan.shifts.filter((one) => one.job === panel.job).sort(byStart)}
                range={range}
                failed={failed}
                busy={busy}
                onKeep={() => close(backOf(panel))}
                onRemove={() => void removeJob(panel.job)}
              />
            )}
            {(panel.kind === 'addShift' || (panel.kind === 'editShift' && panelShift != null)) && (
              <ShiftForm
                plan={plan}
                times={times}
                shift={panel.kind === 'editShift' ? panelShift : null}
                draft={shiftDraft}
                pressed={pressed}
                overlap={overlap}
                server={server}
                failed={failed}
                busy={busy}
                when={range}
                names={(id) => personOf(id)?.fullName ?? ''}
                onChange={(next) => {
                  setOverlap(null);
                  setServer(null);
                  setShiftDraft({ ...shiftDraft, ...next });
                }}
                onDrop={(person) => panelShift != null && void drop(panelShift, person)}
                onSave={() => void saveShift()}
                onCancel={() => close(backOf(panel))}
              />
            )}
            {panel.kind === 'assign' && panelShift != null && (
              <AssignPanel
                plan={plan}
                shift={panelShift}
                refused={refused}
                failed={failed}
                busy={busy}
                range={range}
                jobName={jobName}
                theirShifts={theirShifts}
                onPick={(person) => void pick(panelShift, person)}
                onDrop={(person) => void drop(panelShift, person)}
                onClose={() => close(backOf(panel))}
              />
            )}
          </aside>
        )}
      </div>
    </>
  );
}

interface Tick {
  at: number;
  words: string;
  day: boolean;
}

/** A tick per step: each hour's clock time, and past 24 hours each midnight's day in place of 00:00, across that step and the next. */
function ticksOf(steps: readonly number[], times: StaffTimes): Tick[] {
  const ticks: Tick[] = [];
  for (const at of steps) {
    const clock = clockWords(at, times);
    const wall = wallOf(at, times.timeZone).time;
    const day = times.long && wall === '00:00';
    const last = ticks.at(-1);
    if (last?.day === true && last.at === at - COVERAGE_STEP_MS) continue;
    ticks.push({
      at,
      words: day ? dayWords(at, times) : wall.endsWith(':00') ? clock : '',
      day,
    });
  }

  return ticks;
}

function CoverageCard({
  event,
  plan,
  times,
  steps,
  coverage,
  view,
  onView,
}: {
  event: OrganisationEvent;
  plan: StaffPlan;
  times: StaffTimes;
  steps: readonly number[];
  coverage: readonly JobCoverage[];
  view: 'strip' | 'table';
  onView: (view: 'strip' | 'table') => void;
}) {
  const { t } = useTranslation();
  const ticks = ticksOf(steps, times);
  const nameOf = (id: string) => plan.jobs.find((one) => one.id === id)?.name ?? '';
  const range = (start: number, end: number) => rangeWords(start, end, times, t);
  const short = coverage.filter((one) => one.gaps.length > 0).length;

  return (
    <section className="sn-card" aria-labelledby="js-coverage">
      <div className="sn-card-top">
        <div className="sn-card-names">
          <h2 id="js-coverage">{t('jobs.coverage')}</h2>
          {coverage.length > 0 && (
            <p className="mn-sub">
              {t('jobs.summaryShort', { count: short, covered: coverage.length - short })}
            </p>
          )}
          <p className="mn-quiet">
            {t('jobs.eventHours', { when: rangeWords(event.startsAt, event.endsAt, times, t) })}
          </p>
        </div>
        {coverage.length > 0 && (
          <div className="js-seg" role="group" aria-label={t('jobs.view')}>
            {(['strip', 'table'] as const).map((one) => (
              <button
                key={one}
                type="button"
                aria-pressed={view === one}
                onClick={() => onView(one)}
              >
                {view === one && <Glyph name="tick" size={14} weight={2.6} />}
                {one === 'strip' ? t('jobs.strip') : t('jobs.table')}
              </button>
            ))}
          </div>
        )}
      </div>
      {coverage.length === 0 ? (
        <p className="mn-quiet">{t('jobs.noShiftsYet')}</p>
      ) : view === 'strip' ? (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- it scrolls sideways, so a keyboard has to reach it (WCAG 2.2 §2.1.1).
        <div className="js-frame" tabIndex={0} role="region" aria-label={t('jobs.stripLabel')}>
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
              <div key={row.job} className="js-row">
                <h3 className="js-row-name">
                  {row.gaps.length === 0 && <Glyph name="tick" size={14} weight={2.6} />}
                  {nameOf(row.job)}
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
                    ? t('jobs.covered')
                    : row.gaps
                        .map((gap) =>
                          t('jobs.gap', {
                            short: t('jobs.short', { count: gap.short }),
                            when: range(gap.start, gap.end),
                          }),
                        )
                        .join('; ')}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- it scrolls sideways, so a keyboard has to reach it (WCAG 2.2 §2.1.1).
        <div className="js-frame" tabIndex={0} role="region" aria-label={t('jobs.tableLabel')}>
          <table className="rs-table js-table">
            <caption className="visually-hidden">{t('jobs.tableLabel')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('jobs.thJob')}</th>
                <th scope="col">{t('jobs.thTime')}</th>
                <th scope="col">{t('jobs.thOn')}</th>
                <th scope="col">{t('jobs.thNeeded')}</th>
                <th scope="col">{t('jobs.thStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {coverage.flatMap((row) =>
                row.spans.map((span) => (
                  <tr key={`${row.job}-${span.start}`}>
                    <th scope="row">{nameOf(row.job)}</th>
                    <td className="rs-shift">{range(span.start, span.end)}</td>
                    <td>{span.on}</td>
                    <td>{span.needed}</td>
                    <td>
                      {span.on < span.needed
                        ? t('jobs.short', { count: span.needed - span.on })
                        : t('jobs.covered')}
                    </td>
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

function Failed({ words }: { words: string }) {
  return (
    <p id="js-failed" className="mn-failed" role="alert" tabIndex={-1}>
      <Glyph name="alert" size={17} weight={2.2} />
      {words}
    </p>
  );
}

function PanelTop({
  title,
  eyebrow,
  onClose,
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="mn-panel-top">
      <div className="mn-panel-names">
        {eyebrow != null && <p className="mn-eyebrow">{eyebrow}</p>}
        <h2 id="sn-panel-title" tabIndex={-1}>
          {title}
        </h2>
      </div>
      <button
        type="button"
        className="ev-round mn-close"
        aria-label={t('jobs.close')}
        onClick={onClose}
      >
        <Glyph name="clear" size={16} weight={2.4} />
      </button>
    </div>
  );
}

function PanelFoot({
  cta,
  busy,
  onSave,
  onCancel,
}: {
  cta: string;
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="mn-panel-foot">
      <div className="mn-panel-acts">
        <button type="button" className="desk-text" onClick={onCancel}>
          {t('jobs.cancel')}
        </button>
        <button
          type="button"
          className="gs-pill is-primary"
          aria-busy={busy || undefined}
          onClick={() => !busy && onSave()}
        >
          {cta}
        </button>
      </div>
    </div>
  );
}

function Chip({ name, manage, onDrop }: { name: string; manage: boolean; onDrop: () => void }) {
  const { t } = useTranslation();

  return (
    <li className="js-chip">
      {name}
      {manage && (
        <button
          type="button"
          className="js-chip-x"
          aria-label={t('jobs.unassign', { name })}
          onClick={onDrop}
        >
          <Glyph name="clear" size={14} weight={2.4} />
        </button>
      )}
    </li>
  );
}

function Places({
  shift,
  names,
  manage,
  onDrop,
}: {
  shift: StaffShift;
  names: (id: string) => string;
  manage: boolean;
  onDrop: (person: string) => void;
}) {
  const { t } = useTranslation();
  const open = Math.max(0, shift.needed - shift.people.length);

  return (
    <ul className="js-chips">
      {shift.people.map((id) => (
        <Chip key={id} name={names(id)} manage={manage} onDrop={() => onDrop(id)} />
      ))}
      {Array.from({ length: open }, (_, index) => (
        <li key={`open-${index}`} className="js-chip is-open">
          {t('jobs.openPlace')}
        </li>
      ))}
    </ul>
  );
}

function ShiftRow({
  shift,
  job,
  when,
  names,
  manage,
  lit,
  onAssign,
  onTimes,
  onDrop,
}: {
  shift: StaffShift;
  job: StaffJob;
  when: string;
  names: (id: string) => string;
  manage: boolean;
  lit: boolean;
  onAssign: () => void;
  onTimes: () => void;
  onDrop: (person: string) => void;
}) {
  const { t } = useTranslation();
  const full = shift.people.length >= shift.needed;
  const what = t('jobs.shiftOf', { job: job.name, when });

  return (
    <li className={lit ? 'js-shift is-lit' : 'js-shift'}>
      <div className="js-shift-top">
        <p className="js-shift-times" id={`js-shift-${shift.id}`} tabIndex={-1}>
          {when}
        </p>
        <p className="mn-sub">
          {t('jobs.filled', { on: shift.people.length, count: shift.needed })}
        </p>
        {manage && (
          <div className="js-job-acts">
            <button
              id={`js-times-${shift.id}`}
              type="button"
              className="desk-text"
              aria-label={t('jobs.labelled', { action: t('jobs.editTimes'), what })}
              onClick={onTimes}
            >
              {t('jobs.editTimes')}
            </button>
            {!full && (
              <button
                type="button"
                className="desk-text"
                aria-label={t('jobs.labelled', { action: t('jobs.assign'), what })}
                onClick={onAssign}
              >
                <Glyph name="plus" size={16} weight={2.3} />
                {t('jobs.assign')}
              </button>
            )}
          </div>
        )}
      </div>
      <Places shift={shift} names={names} manage={manage} onDrop={onDrop} />
      {full && manage && <p className="mn-quiet js-full">{t('jobs.full')}</p>}
    </li>
  );
}

function JobForm({
  title,
  draft,
  problem,
  failed,
  busy,
  cta,
  onChange,
  onSave,
  onCancel,
}: {
  title: string;
  draft: JobDraft;
  problem: string | null;
  failed: string | null;
  busy: boolean;
  cta: string;
  onChange: (next: Partial<JobDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <PanelTop title={title} onClose={onCancel} />
      <div className="mn-panel-body">
        {failed != null && <Failed words={failed} />}
        <div className="desk-field">
          <label htmlFor="js-f-name" className="desk-label">
            {t('jobs.name')}
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
          {problem != null && <FieldWrong id="js-f-name-error">{problem}</FieldWrong>}
          <p id="js-f-name-help" className="desk-help">
            {t('jobs.nameHelp', { max: JOB_NAME_MAXIMUM })}{' '}
            {`${[...draft.name.trim()].length}/${JOB_NAME_MAXIMUM}`}
          </p>
        </div>
        <fieldset className="js-levels">
          <legend className="desk-label">{t('jobs.level')}</legend>
          {STAFF_ACCESS.map((access) => (
            <div key={access} className="js-level">
              <input
                id={`js-level-${access}-input`}
                type="radio"
                name="js-level"
                value={access}
                checked={draft.access === access}
                aria-describedby={`js-level-${access}`}
                onChange={() => onChange({ access })}
              />
              <div className="js-level-words">
                <label htmlFor={`js-level-${access}-input`} className="js-level-name">
                  {t(`jobs.access.${access}`)}
                </label>
                <span id={`js-level-${access}`} className="desk-help">
                  {t(`jobs.accessHint.${access}`)}
                </span>
              </div>
            </div>
          ))}
        </fieldset>
      </div>
      <PanelFoot cta={cta} busy={busy} onSave={onSave} onCancel={onCancel} />
    </>
  );
}

function RemoveJob({
  job,
  shifts,
  range,
  failed,
  busy,
  onKeep,
  onRemove,
}: {
  job: StaffJob | null;
  shifts: StaffShift[];
  range: (shift: StaffShift) => string;
  failed: string | null;
  busy: boolean;
  onKeep: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const name = job?.name ?? '';
  const people = new Set(shifts.flatMap((one) => one.people)).size;
  const refused = people > 0;

  return (
    <>
      <div className="mn-panel-top">
        <div className="mn-panel-names">
          <h2 id="sn-panel-title" tabIndex={-1}>
            {refused
              ? t('jobs.removeRefused')
              : t('jobs.removeAsk', { job: name, count: shifts.length })}
          </h2>
        </div>
      </div>
      <div className="mn-panel-body">
        {failed != null && <Failed words={failed} />}
        {refused ? (
          <p className="mn-failed" role="alert">
            <Glyph name="alert" size={17} weight={2.2} />
            {t('jobs.removeRefusedSub', { job: name, count: people })}
          </p>
        ) : (
          <>
            <ul className="js-ask-shifts">
              {shifts.map((one) => (
                <li key={one.id}>{t('jobs.shiftOf', { job: name, when: range(one) })}</li>
              ))}
            </ul>
            <p className="mn-quiet">{t('jobs.removeAskSub')}</p>
          </>
        )}
      </div>
      <div className="mn-panel-foot">
        <div className="mn-panel-acts">
          {refused ? (
            <button type="button" className="gs-pill is-primary" onClick={onKeep}>
              {t('jobs.close')}
            </button>
          ) : (
            <>
              <button type="button" className="desk-text" onClick={onKeep}>
                {t('jobs.keep')}
              </button>
              <button
                type="button"
                className="gs-pill is-primary rs-remove-go"
                aria-busy={busy || undefined}
                onClick={() => !busy && onRemove()}
              >
                {t('jobs.remove')}
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
  times,
  shift,
  draft,
  pressed,
  overlap,
  server,
  failed,
  busy,
  when,
  names,
  onChange,
  onDrop,
  onSave,
  onCancel,
}: {
  plan: StaffPlan;
  times: StaffTimes;
  shift: StaffShift | null;
  draft: ShiftDraft;
  pressed: boolean;
  overlap: string | null;
  server: number | null;
  failed: string | null;
  busy: boolean;
  when: (shift: StaffShift) => string;
  names: (id: string) => string;
  onChange: (next: Partial<ShiftDraft>) => void;
  onDrop: (person: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const onIt = shift?.people.length ?? 0;
  const checked = shiftProblems(draft, onIt, shift == null, times.timeZone, t);
  const below = t('jobs.neededBelow', { count: onIt });
  const problems: ShiftProblems = pressed
    ? checked
    : checked.needed === below
      ? { needed: below }
      : {};
  if (server != null) problems.needed = t('jobs.neededBelow', { count: server });
  const start = resolvedInstant(draft.startDate, draft.startTime, times.timeZone);
  const end = resolvedInstant(draft.endDate, draft.endTime, times.timeZone);
  const midnight =
    start != null &&
    end != null &&
    end > start &&
    end - start <= DAY_MS &&
    draft.endDate !== draft.startDate
      ? t('jobs.midnight', { weekday: weekdayWords(end, times), time: clockWords(end, times) })
      : null;
  const jobName = (id: string) => plan.jobs.find((one) => one.id === id)?.name ?? '';
  const told = (id: string, wrong: string | undefined, help?: string) =>
    [wrong == null ? null : `${id}-error`, help ?? null].filter(Boolean).join(' ') || undefined;

  return (
    <>
      {shift == null ? (
        <PanelTop title={t('jobs.addShift')} onClose={onCancel} />
      ) : (
        <PanelTop
          title={t('jobs.shiftOf', { job: jobName(shift.job), when: when(shift) })}
          eyebrow={t('jobs.editTimes')}
          onClose={onCancel}
        />
      )}
      <div className="mn-panel-body">
        {failed != null && <Failed words={failed} />}
        {shift != null && (
          <div className="js-on-shift">
            <p className="desk-label">{t('jobs.onShift', { count: onIt })}</p>
            <Places shift={shift} names={names} manage onDrop={onDrop} />
          </div>
        )}
        {shift == null && (
          <div className="desk-field">
            <label htmlFor={SHIFT_IDS.job} className="desk-label">
              {t('jobs.job')}
            </label>
            <div
              className={
                problems.job == null
                  ? 'desk-box gs-select sn-select'
                  : 'desk-box gs-select sn-select is-wrong'
              }
            >
              <span aria-hidden="true">
                {draft.job === '' ? t('jobs.chooseJob') : jobName(draft.job)}
              </span>
              <Glyph name="chevdown" size={15} weight={2.4} />
              <select
                id={SHIFT_IDS.job}
                value={draft.job}
                aria-invalid={problems.job != null || undefined}
                aria-describedby={problems.job == null ? undefined : `${SHIFT_IDS.job}-error`}
                onChange={(change) => onChange({ job: change.target.value })}
              >
                <option value="">{t('jobs.chooseJob')}</option>
                {plan.jobs.map((one) => (
                  <option key={one.id} value={one.id}>
                    {one.name}
                  </option>
                ))}
              </select>
            </div>
            {problems.job != null && (
              <FieldWrong id={`${SHIFT_IDS.job}-error`}>{problems.job}</FieldWrong>
            )}
          </div>
        )}
        <When
          legend={t('jobs.starts')}
          id="js-f-start"
          date={draft.startDate}
          time={draft.startTime}
          wrong={problems.start}
          onDate={(value) => onChange({ startDate: value })}
          onTime={(value) => onChange({ startTime: value })}
        />
        <When
          legend={t('jobs.ends')}
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
            {t('jobs.needed')}
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
            <FieldWrong id={`${SHIFT_IDS.needed}-error`}>{problems.needed}</FieldWrong>
          )}
          <p id={`${SHIFT_IDS.needed}-help`} className="desk-help">
            {shift == null
              ? t('jobs.neededHelp', { max: SHIFT_NEEDED_MAXIMUM })
              : t('jobs.neededHelpEdit', { max: SHIFT_NEEDED_MAXIMUM })}
          </p>
        </div>
      </div>
      <PanelFoot
        cta={shift == null ? t('jobs.add') : t('jobs.save')}
        busy={busy}
        onSave={onSave}
        onCancel={onCancel}
      />
    </>
  );
}

function When({
  legend,
  id,
  date,
  time,
  wrong,
  line = null,
  onDate,
  onTime,
}: {
  legend: string;
  id: string;
  date: string;
  time: string;
  wrong: string | undefined;
  line?: string | null;
  onDate: (value: string) => void;
  onTime: (value: string) => void;
}) {
  const { t } = useTranslation();
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
            aria-label={t('jobs.labelled', { action: legend, what: t('jobs.date') })}
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
            step={COVERAGE_STEP_MS / 1000}
            aria-label={t('jobs.labelled', { action: legend, what: t('jobs.time') })}
            value={time}
            aria-invalid={wrong != null}
            aria-describedby={described}
            onChange={(change) => onTime(change.target.value)}
          />
        </div>
      </div>
      {wrong != null && <FieldWrong id={`${id}-error`}>{wrong}</FieldWrong>}
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
  failed,
  busy,
  range,
  jobName,
  theirShifts,
  onPick,
  onDrop,
  onClose,
}: {
  plan: StaffPlan;
  shift: StaffShift;
  refused: { person: string; words: string } | null;
  failed: string | null;
  busy: boolean;
  range: (shift: StaffShift) => string;
  jobName: (id: string | null) => string;
  theirShifts: (person: string) => StaffShift[];
  onPick: (person: string) => void;
  onDrop: (person: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const job = jobName(shift.job);
  const full = shift.people.length >= shift.needed;
  const others = plan.staff.filter((one) => !shift.people.includes(one.id));
  const names = (id: string) => plan.staff.find((one) => one.id === id)?.fullName ?? '';

  return (
    <>
      <PanelTop
        title={t('jobs.shiftOf', { job, when: range(shift) })}
        eyebrow={t('jobs.assign')}
        onClose={onClose}
      />
      <div className="mn-panel-body">
        {failed != null && <Failed words={failed} />}
        <div className="js-on-shift">
          <p className="desk-label">
            {t('jobs.filled', { on: shift.people.length, count: shift.needed })}
          </p>
          <Places shift={shift} names={names} manage onDrop={onDrop} />
          {full && <p className="mn-quiet js-full">{t('jobs.full')}</p>}
        </div>
        {!full && (
          <ul className="js-people" aria-label={t('jobs.assignTo', { job, when: range(shift) })}>
            {others.length === 0 && <li className="mn-quiet">{t('jobs.notOnHere')}</li>}
            {others.map((person) => {
              const theirs = theirShifts(person.id);
              const no = refused?.person === person.id ? refused.words : null;

              return (
                <li key={person.id} className={no == null ? 'js-person' : 'js-person is-refused'}>
                  <button
                    type="button"
                    className="js-person-pick"
                    aria-busy={busy || undefined}
                    aria-describedby={
                      no == null ? `js-p-${person.id}` : `js-p-${person.id} js-p-${person.id}-no`
                    }
                    onClick={() => !busy && onPick(person.id)}
                  >
                    <span className="js-person-name">{person.fullName}</span>
                    <span id={`js-p-${person.id}`} className="mn-sub">
                      {person.job == null
                        ? t('jobs.takesJob', { job })
                        : theirs.length === 0
                          ? t('jobs.jobAndShift', {
                              job: person.job.name,
                              when: t('jobs.otherShifts'),
                            })
                          : theirs
                              .map((one) =>
                                t('jobs.shiftOf', { job: jobName(one.job), when: range(one) }),
                              )
                              .join('; ')}
                    </span>
                  </button>
                  <div role="alert">
                    {no != null && <FieldWrong id={`js-p-${person.id}-no`}>{no}</FieldWrong>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="mn-panel-foot">
        <div className="mn-panel-acts">
          <button type="button" className="gs-pill is-secondary" onClick={onClose}>
            {t('jobs.close')}
          </button>
        </div>
      </div>
    </>
  );
}
