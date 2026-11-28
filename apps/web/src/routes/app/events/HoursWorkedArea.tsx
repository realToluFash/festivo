import {
  ApiError,
  type HoursRow,
  type OrganisationEvent,
  type StaffHours,
} from '@soirely/api-client';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { Skeleton } from '../../../components/Skeleton.tsx';
import { useDeskTop } from '../../../deskTop.ts';
import { dateLocale } from '../../../i18n/index.ts';
import { pageTitle, usePageTitle } from '../../../pageTitle.ts';
import { useAnsweredAgain } from '../../../tabKept.ts';
import {
  type HoursClock,
  type TimesDraft,
  type TimesProblem,
  besideWords,
  clockIn,
  clockedWords,
  draftOf,
  hoursWords,
  markWords,
  summaryRest,
  timesProblems,
  trailWords,
  typedOf,
} from './hoursWorked.ts';
import { PanelFoot, PanelTop, When } from './JobsShiftsArea.tsx';
import { StaffTabs } from './StaffTabs.tsx';
import { rangeWords, staffTimes } from './staffTimes.ts';
import '../../../components/SettingsParts.css';
import '../../../components/eventsDesk.css';
import '../../../components/eventPage.css';
import './guests.css';
import '../menu/menuLibrary.css';
import './roster.css';
import './jobsShifts.css';
import './stations.css';
import './hoursWorked.css';

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; hours: StaffHours };

interface Open {
  key: string;
  draft: TimesDraft;
  pressed: boolean;
  server: { in?: string; out?: string };
}

const IN_TIME = 'hw-f-in-time';
const OUT_TIME = 'hw-f-out-time';

const rowKey = (row: HoursRow) => `${row.shiftId}:${row.staffId}`;
const correctId = (key: string) => `hw-correct-${key}`;

/** /app/events/:id/staff/hours (sc-234): Hours worked on the event's Staff page, as its demo draws it at a desk. */
export function HoursWorkedArea({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();
  const desk = useDeskTop();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const answeredAgain = useAnsweredAgain();

  usePageTitle(pageTitle(t, [t('hours.title'), event.name]));

  useEffect(() => {
    let current = true;

    api.staffHours(event.id).then(
      (hours) => current && setLoad({ kind: 'loaded', hours }),
      () => current && setLoad((was) => (was.kind === 'loaded' ? was : { kind: 'failed' })),
    );

    return () => {
      current = false;
    };
  }, [event.id, attempt, answeredAgain]);

  return (
    <div className="desk ev desk-page ev-page gs mn sn rs js hw">
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
            <p className="mn-sub">{t('hours.sub')}</p>
          </div>
        </header>
        <StaffTabs on="hours" eventId={event.id} />
        {load.kind === 'loaded' && !load.hours.canCorrect && (
          <p className="mn-lock">
            <Glyph name="lock" size={16} weight={2.2} />
            {t('hours.readOnly')}
          </p>
        )}
        {load.kind === 'loading' && (
          <Skeleton words={t('hours.loading')} shape="rows" rowHeight={56} rows={6} />
        )}
        {load.kind === 'failed' && (
          <div className="hw-failed">
            <p className="mn-failed" role="alert">
              <Glyph name="alert" size={17} weight={2.2} />
              {t('hours.failed')}
            </p>
            <button
              type="button"
              className="gs-pill is-secondary"
              onClick={() => {
                setLoad({ kind: 'loading' });
                setAttempt((n) => n + 1);
              }}
            >
              {t('hours.tryAgain')}
            </button>
          </div>
        )}
        {load.kind === 'loaded' && (
          <Hours
            event={event}
            hours={load.hours}
            onHours={(hours) => setLoad({ kind: 'loaded', hours })}
          />
        )}
      </div>
    </div>
  );
}

function Hours({
  event,
  hours,
  onHours,
}: {
  event: OrganisationEvent;
  hours: StaffHours;
  onHours: (hours: StaffHours) => void;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const on: HoursClock = { timeZone: hours.timeZone, locale };
  const [open, setOpen] = useState<Open | null>(null);
  const [said, setSaid] = useState('');
  const [busy, setBusy] = useState(false);
  const focusAfter = useRef<string | null>(null);
  const { rows, canCorrect } = hours;
  const editing = open == null ? null : (rows.find((one) => rowKey(one) === open.key) ?? null);

  useEffect(() => {
    if (focusAfter.current == null) return;
    document.getElementById(focusAfter.current)?.focus();
    focusAfter.current = null;
  });

  function correct(row: HoursRow) {
    setOpen({ key: rowKey(row), draft: draftOf(row, hours.timeZone), pressed: false, server: {} });
    setSaid('');
  }

  function close(key: string) {
    setOpen(null);
    focusAfter.current = correctId(key);
  }

  async function save() {
    if (open == null || editing == null || busy) return;
    const problems = timesProblems(open.draft, editing.stillOn);
    if (problems.in != null || problems.out != null) {
      setOpen({ ...open, pressed: true, server: {} });
      focusAfter.current = problems.in != null ? IN_TIME : OUT_TIME;
      return;
    }
    setBusy(true);
    try {
      onHours(
        await api.correctStaffHours(
          event.id,
          editing.shiftId,
          editing.staffId,
          typedOf(open.draft),
        ),
      );
      setSaid(t('hours.saved', { name: editing.name }));
      close(open.key);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'validation_failed') {
        const fields = error.fieldErrors();
        const server = {
          ...(fields.clockedInAt == null ? {} : { in: fields.clockedInAt }),
          ...(fields.clockedOutAt == null ? {} : { out: fields.clockedOutAt }),
        };
        setOpen({ ...open, pressed: true, server });
        focusAfter.current = server.in != null ? IN_TIME : OUT_TIME;
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="mn-said" role="status">
        {said !== '' && (
          <>
            <Glyph name="tick" size={17} weight={2.6} />
            {said}
          </>
        )}
      </p>
      {rows.length === 0 ? (
        <section className="hw-empty" aria-labelledby="hw-empty">
          <h2 id="hw-empty">{t('hours.empty')}</h2>
          <p>{t('hours.emptyLine')}</p>
          <Link className="desk-text" to={`/app/events/${encodeURIComponent(event.id)}/staff/jobs`}>
            {t('hours.openJobs')}
            <Glyph name="chevron" size={16} weight={2.4} />
          </Link>
        </section>
      ) : (
        <div className="mn-split">
          <div className="mn-list">
            <Summary hours={hours} on={on} />
            <HoursTable
              event={event}
              hours={hours}
              on={on}
              lit={open?.key ?? null}
              onCorrect={correct}
            />
          </div>
          {open != null && editing != null && canCorrect && (
            <aside className="mn-panel" aria-labelledby="sn-panel-title">
              <CorrectPanel
                row={editing}
                range={rangeWords(editing.startsAt, editing.endsAt, timesOf(event, hours), t)}
                on={on}
                open={open}
                busy={busy}
                onDraft={(draft) => setOpen({ ...open, draft, server: {} })}
                onSave={() => void save()}
                onCancel={() => close(open.key)}
              />
            </aside>
          )}
        </div>
      )}
    </>
  );
}

function timesOf(event: OrganisationEvent, hours: StaffHours) {
  return staffTimes({ ...event, timeZone: hours.timeZone }, hours.rows, dateLocale());
}

function Summary({ hours, on }: { hours: StaffHours; on: HoursClock }) {
  const { t } = useTranslation();
  const sum = hours.summary;

  if (hours.live)
    return (
      <section className="hw-summary" aria-label={t('hours.worked')}>
        <p className="hw-eyebrow">{t('hours.liveAt', { time: clockIn(hours.now, on) })}</p>
        <p className="hw-figure">{t('hours.liveHead', { on: sum.clockedIn, count: sum.total })}</p>
      </section>
    );
  const rest = summaryRest(t, sum);

  return (
    <section className="hw-summary" aria-label={t('hours.worked')}>
      <p className="hw-eyebrow">{t('hours.worked')}</p>
      <p className="hw-figure">
        {t('hours.of', {
          worked: hoursWords(t, sum.workedMinutes),
          scheduled: hoursWords(t, sum.scheduledMinutes),
        })}
      </p>
      {rest != null && <p className="hw-rest">{rest}</p>}
    </section>
  );
}

function LiveMark({ row, on }: { row: HoursRow; on: HoursClock }) {
  const { t } = useTranslation();

  if (row.live === 'in')
    return (
      <span className="hw-mark">
        <span className="hw-shape is-in" aria-hidden="true">
          <Glyph name="tick" size={11} weight={3.2} />
        </span>
        {t('hours.clockedIn')}
      </span>
    );
  if (row.live === 'out')
    return (
      <span className="hw-mark">
        <span className="hw-shape is-none" aria-hidden="true" />
        {t('hours.clockedOut')}
      </span>
    );

  return (
    <span className="hw-mark">
      <span className="hw-shape is-not-yet" aria-hidden="true" />
      {row.live === 'later'
        ? t('hours.opensAt', { time: clockIn(row.opensAt, on) })
        : t('hours.notYet')}
    </span>
  );
}

function Trail({ row, on }: { row: HoursRow; on: HoursClock }) {
  const { t } = useTranslation();

  return trailWords(t, row, on).map((line) => (
    <span key={line} className="hw-sub">
      {line}
    </span>
  ));
}

function AfterMark({ row, on }: { row: HoursRow; on: HoursClock }) {
  const { t } = useTranslation();
  const words = markWords(t, row, on);
  if (words == null) return null;
  const notOut = row.mark === 'not_clocked_out';

  return (
    <span className={notOut ? 'hw-mark is-attention' : 'hw-mark'}>
      <span className={notOut ? 'hw-shape is-out' : 'hw-shape is-none'} aria-hidden="true" />
      {words}
    </span>
  );
}

function HoursTable({
  event,
  hours,
  on,
  lit,
  onCorrect,
}: {
  event: OrganisationEvent;
  hours: StaffHours;
  on: HoursClock;
  lit: string | null;
  onCorrect: (row: HoursRow) => void;
}) {
  const { t } = useTranslation();
  const { rows, live, canCorrect } = hours;
  const times = timesOf(event, hours);

  return (
    <section className="sn-card hw-card" aria-label={t('hours.tableLabel')}>
      <table className="hw-table">
        <thead>
          <tr>
            <th scope="col">{t('hours.person')}</th>
            <th scope="col">{t('hours.scheduled')}</th>
            <th scope="col">{t('hours.clocked')}</th>
            <th scope="col" className="hw-num">
              {t('hours.hours')}
            </th>
            {canCorrect && (
              <th scope="col">
                <span className="visually-hidden">{t('hours.correct')}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);

            return (
              <tr key={key} className={lit === key ? 'is-lit' : undefined}>
                <th scope="row">
                  <span className="hw-name">{row.name}</span>
                  {row.removed && (
                    <span className="hw-mark hw-removed">
                      <Glyph name="user" size={14} weight={2.4} />
                      {t('hours.removed')}
                    </span>
                  )}
                  <span className="hw-sub">{row.job}</span>
                </th>
                <td>
                  <span className="hw-time">{rangeWords(row.startsAt, row.endsAt, times, t)}</span>
                  <span className="hw-sub">{hoursWords(t, row.scheduledMinutes)}</span>
                </td>
                <td>
                  {live ? (
                    <>
                      <LiveMark row={row} on={on} />
                      {row.clockedInAt != null && (
                        <span className="hw-sub">{clockedWords(t, row, on)}</span>
                      )}
                      <Trail row={row} on={on} />
                    </>
                  ) : (
                    <>
                      <span className="hw-time">{clockedWords(t, row, on)}</span>
                      <Trail row={row} on={on} />
                      <AfterMark row={row} on={on} />
                    </>
                  )}
                </td>
                <td className="hw-num">{live ? '' : hoursWords(t, row.workedMinutes)}</td>
                {canCorrect && (
                  <td className="hw-act">
                    <button
                      id={correctId(key)}
                      type="button"
                      className="desk-text"
                      aria-label={t('hours.correctOf', { name: row.name })}
                      onClick={() => onCorrect(row)}
                    >
                      {t('hours.correct')}
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

const PROBLEM_KEYS: Record<TimesProblem, string> = {
  inBlank: 'hours.inBlank',
  outBlank: 'hours.outBlank',
  order: 'hours.order',
  long: 'hours.long',
};

function CorrectPanel({
  row,
  range,
  on,
  open,
  busy,
  onDraft,
  onSave,
  onCancel,
}: {
  row: HoursRow;
  range: string;
  on: HoursClock;
  open: Open;
  busy: boolean;
  onDraft: (draft: TimesDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { draft } = open;
  const problems = open.pressed ? timesProblems(draft, row.stillOn) : {};
  const wrong = (problem: TimesProblem | undefined, server: string | undefined) =>
    problem == null ? server : t(PROBLEM_KEYS[problem]);
  const beside = besideWords(t, row, on);

  return (
    <>
      <PanelTop
        title={t('hours.correctTitle', { name: row.name })}
        eyebrow={t('hours.correctSub', { job: row.job, range })}
        onClose={onCancel}
      />
      <div className="mn-panel-body">
        <div className="hw-when">
          <p className="hw-beside">{beside.in}</p>
          <When
            legend={t('hours.clockIn')}
            id="hw-f-in"
            date={draft.inDate}
            time={draft.inTime}
            wrong={wrong(problems.in, open.server.in)}
            step={60}
            onDate={(value) => onDraft({ ...draft, inDate: value })}
            onTime={(value) => onDraft({ ...draft, inTime: value })}
          />
        </div>
        <div className="hw-when">
          <p className="hw-beside">{beside.out}</p>
          <When
            legend={t('hours.clockOut')}
            id="hw-f-out"
            date={draft.outDate}
            time={draft.outTime}
            wrong={wrong(problems.out, open.server.out)}
            step={60}
            onDate={(value) => onDraft({ ...draft, outDate: value })}
            onTime={(value) => onDraft({ ...draft, outTime: value })}
          />
        </div>
        <p className="desk-help">{t('hours.keepsOriginal')}</p>
      </div>
      <PanelFoot cta={t('hours.save')} busy={busy} onSave={onSave} onCancel={onCancel} />
    </>
  );
}
