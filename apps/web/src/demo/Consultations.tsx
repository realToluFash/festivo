import { timezoneLabel } from '@soirely/domain';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';

import { ActionPair } from '../components/ActionPair.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { FieldError } from '../components/FieldError.tsx';
import { Glyph, type GlyphName } from '../components/Glyph.tsx';
import { Chevron, RowWords, type Tell } from '../components/SettingsParts.tsx';
import { DemoBell } from './DemoBell.tsx';
import { EventsShell } from './EventParts.tsx';
import {
  CW,
  type Consultation,
  type ConsultationStart,
  type Draft,
  FIELD_ORDER,
  type Field,
  HOWS,
  type How,
  LENGTHS,
  type Panel,
  READER_ZONE,
  type Save,
  WHERE_MOST,
  cancelledByLost,
  changeable,
  consultationOf,
  consultationStart,
  consultationStateOf,
  dayWords,
  draftOf,
  fixedLeaderWords,
  earliestFirst,
  leaderOf,
  mayEdit,
  problemsOf,
  skipWords,
  standingOf,
  timesWords,
} from './consultations.ts';
import { NOW, PEOPLE } from './enquiries.ts';
import { TodaySidebar } from './TodaySidebar.tsx';
import './consultations.css';

const LOCALE = 'en';
const SAVE_MS = 700;
const ZONES = [
  READER_ZONE,
  'Europe/Madrid',
  'Europe/Paris',
  'Europe/Lisbon',
  'Africa/Lagos',
  'America/New_York',
];
const HOW_GLYPH: Record<How, GlyphName> = { inPerson: 'pin', video: 'device', phone: 'phone' };

/** /demo/consultations (sc-31228): Consultations on an enquiry's page, with ?state= for each of its states. */
export function Consultations() {
  const [params] = useSearchParams();
  const state = consultationStateOf(params.get('state'));
  const start = consultationStart(state);

  return (
    <EventsShell
      fit
      renderSide={(tell, covered) => (
        <TodaySidebar
          phone
          events={[]}
          tell={tell}
          enquiries={start.view === 'page'}
          free={start.calendar.free}
          calendar={start.view === 'calendar' || start.view === 'feed'}
          settings={start.view === 'notifications'}
          inert={covered}
        />
      )}
    >
      {(tell) => <ConsultationsAt key={state} start={start} tell={tell} />}
    </EventsShell>
  );
}

function ConsultationsAt({ start, tell }: { start: ConsultationStart; tell: Tell }) {
  if (start.view === 'calendar') return <CalendarStrip start={start} />;
  if (start.view === 'notifications') return <EnquiriesCategory />;
  if (start.view === 'feed') return <WhatsInTheFeed />;

  return <EnquiryWithConsultations start={start} tell={tell} />;
}

function EnquiryWithConsultations({ start, tell }: { start: ConsultationStart; tell: Tell }) {
  const [list, setList] = useState<Consultation[]>(start.list);
  const [panel, setPanel] = useState<Panel>(start.panel);
  const [save, setSave] = useState<Save>(start.save);
  const [lost, setLost] = useState(false);
  const failOnce = useRef(start.save === 'failed');
  const edits = mayEdit(start.enquiry, start.viewer) && !lost;
  const assignee = Object.values(PEOPLE).find((one) => one.id === start.enquiry.assignedTo);
  const ordered = earliestFirst(list);

  function finish(after: () => void): void {
    setSave('saving');
    window.setTimeout(() => {
      if (failOnce.current) {
        failOnce.current = false;
        setSave('failed');

        return;
      }
      setSave('idle');
      after();
    }, SAVE_MS);
  }

  function book(draft: Draft, change: Consultation | null): void {
    const made = consultationOf(draft, change?.id ?? `con-${Date.now()}`);

    if (made == null) return;
    finish(() => {
      setList((now) =>
        change == null ? [...now, made] : now.map((one) => (one.id === change.id ? made : one)),
      );
      setPanel({ kind: 'none' });
      tell(change == null ? CW.booked : CW.changed);
    });
  }

  function open(change: Consultation | null): void {
    setSave('idle');
    setPanel({
      kind: 'book',
      change,
      draft: draftOf(change, start.enquiry, start.viewer),
      touched: false,
      pressed: false,
    });
  }

  return (
    <div className="desk-page con-page">
      <div className={panel.kind === 'book' ? 'con-split is-docked' : 'con-split'}>
        <div className="desk-column con-column">
          <div className="desk-top con-top">
            <nav aria-label="Breadcrumb" className="con-crumb">
              <Link to="/demo/enquiries">Enquiries</Link>
              <Glyph name="chevron" size={15} weight={2} />
              <span aria-current="page">{start.enquiry.client}</span>
            </nav>
            <DemoBell tell={tell} />
          </div>
          <div className="con-head">
            <div className="con-head-words">
              <h1 className="desk-title con-title">{start.enquiry.client}</h1>
              <p className="con-status">
                {lost ? (
                  <>
                    <span className="con-lost-mark" aria-hidden="true" />
                    Lost
                  </>
                ) : (
                  <>
                    <span className="con-open-ring" aria-hidden="true" />
                    Open
                  </>
                )}
              </p>
            </div>
            {edits && (
              <button
                type="button"
                className="button con-outlined"
                onClick={() => setPanel({ kind: 'closeLost' })}
              >
                Close as lost…
              </button>
            )}
          </div>
          {!mayEdit(start.enquiry, start.viewer) && (
            <p className="con-read-only" role="note">
              <Glyph name="eye" size={17} weight={2.2} />
              <span>{assignee == null ? CW.readOnlyNobody : CW.readOnly(assignee.name)}</span>
            </p>
          )}
          <section className="con-card" aria-labelledby="con-title">
            <div className="con-card-head">
              <h2 id="con-title">{CW.consultations}</h2>
              {ordered.length > 0 && <span className="con-count">{ordered.length}</span>}
            </div>
            {ordered.length === 0 ? (
              <div className="con-none">
                <p className="con-none-title">{CW.none}</p>
                <p className="desk-line">{CW.noneLine}</p>
              </div>
            ) : (
              <ul className="con-rows">
                {ordered.map((one) => (
                  <ConsultationRow
                    key={one.id}
                    consultation={one}
                    list={list}
                    edits={edits}
                    manages={start.viewer.role !== 'member'}
                    onChange={() => open(one)}
                    onCancel={() => setPanel({ kind: 'cancel', consultation: one })}
                  />
                ))}
              </ul>
            )}
            {edits && (
              <div className="con-card-foot">
                <button type="button" className="button con-secondary" onClick={() => open(null)}>
                  <Glyph name="plus" size={17} weight={2.4} />
                  {CW.book}
                </button>
              </div>
            )}
          </section>
          <p className="desk-note con-demo-only">{CW.demoPage}</p>
        </div>
        {panel.kind === 'book' && (
          <BookPanel
            key={panel.change?.id ?? 'new'}
            panel={panel}
            start={start}
            save={save}
            onClose={() => setPanel({ kind: 'none' })}
            onBook={book}
          />
        )}
      </div>
      {panel.kind === 'cancel' && (
        <ConfirmDialog
          id="con-cancel"
          title={CW.cancelTitle}
          keep={CW.keepIt}
          go={save === 'saving' ? CW.saving : CW.cancelIt}
          pending={save === 'saving'}
          refusal={save === 'failed' ? <Refused words={CW.notCancelled} /> : undefined}
          onKeep={() => setPanel({ kind: 'none' })}
          onGo={() =>
            finish(() => {
              setList((now) =>
                now.map((one) =>
                  one.id === panel.consultation.id ? { ...one, cancelled: true } : one,
                ),
              );
              setPanel({ kind: 'none' });
              tell(CW.cancelledSaid);
            })
          }
        >
          <p>
            {CW.cancelLine(
              dayWords(panel.consultation, LOCALE),
              timesWords(panel.consultation, LOCALE),
            )}
          </p>
        </ConfirmDialog>
      )}
      {panel.kind === 'closeLost' && (
        <ConfirmDialog
          id="con-lost"
          title="Close this enquiry as lost?"
          keep="Keep it open"
          go="Close as lost"
          pending={false}
          onKeep={() => setPanel({ kind: 'none' })}
          onGo={() => {
            setList((now) =>
              now.map((one) => (changeable(one) ? { ...one, cancelled: true } : one)),
            );
            setLost(true);
            setPanel({ kind: 'none' });
          }}
        >
          <p>It moves to Lost. You can reopen it.</p>
          {cancelledByLost(list) > 0 && (
            <p className="con-lost-count">
              <span className="con-cancel-mark" aria-hidden="true" />
              {CW.closeLostCancels(cancelledByLost(list))}
            </p>
          )}
          <p className="desk-note">
            The reason and its line are sc-31226’s, drawn on its own board.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

export function ConsultationRow({
  consultation,
  list,
  edits,
  manages,
  onChange,
  onCancel,
  now = NOW,
  tell = null,
  lit = false,
}: {
  consultation: Consultation;
  list: readonly Consultation[];
  edits: boolean;
  manages: boolean;
  onChange: () => void;
  onCancel: () => void;
  now?: string;
  /** sc-37133's Tell {client}, which shows whether or not this viewer edits. */
  tell?: ReactNode;
  /** The row a notification opened the page at (sc-37133). */
  lit?: boolean;
}) {
  const standing = standingOf(consultation, list, now);
  const leader = leaderOf(consultation);
  const goes = edits && changeable(consultation, now);

  return (
    <li className={lit ? `con-row is-${standing} is-lit` : `con-row is-${standing}`}>
      <div className="con-row-top">
        <p className="con-when">
          <span className="con-day">{dayWords(consultation, LOCALE)}</span>
          <span className="con-times">{timesWords(consultation, LOCALE)}</span>
        </p>
        {standing !== 'booked' && <StandingTag standing={standing} />}
      </div>
      <p className="con-how">
        <Glyph name={HOW_GLYPH[consultation.how]} size={17} weight={2.2} />
        <span>{CW.how[consultation.how]}</span>
      </p>
      {consultation.where != null && <p className="con-where">{consultation.where}</p>}
      {consultation.link != null && (
        <a className="con-link" href={consultation.link} target="_blank" rel="noreferrer">
          {consultation.link.replace(/^https:\/\//, '')}
        </a>
      )}
      {leader != null ? (
        <p className="con-led">{CW.ledBy(leader.name)}</p>
      ) : (
        manages && (
          <p className="con-nobody">
            <Glyph name="warn" size={16} weight={2.4} />
            <span>
              <strong>{CW.nobodyLeading}</strong> · {CW.nobodyLine}
            </span>
          </p>
        )
      )}
      {goes && (
        <div className="con-row-acts">
          <button type="button" className="link-button con-change" onClick={onChange}>
            <Glyph name="pen" size={16} weight={2.2} />
            {CW.change}
          </button>
          <button type="button" className="button con-outlined" onClick={onCancel}>
            {CW.cancelConsultation}
          </button>
        </div>
      )}
      {tell}
    </li>
  );
}

function StandingTag({ standing }: { standing: 'next' | 'held' | 'cancelled' }) {
  return (
    <span className={`con-tag is-${standing}`}>
      {standing === 'next' ? (
        <span className="con-next-dot" aria-hidden="true" />
      ) : standing === 'held' ? (
        <Glyph name="tick" size={13} weight={3} />
      ) : (
        <span className="con-cancel-mark" aria-hidden="true" />
      )}
      {CW[standing]}
    </span>
  );
}

export function Refused({ words, onRetry }: { words: string; onRetry?: () => void }) {
  return (
    <div className="notice notice-broken con-refused" role="alert">
      <span className="mark mark-broken" aria-hidden="true">
        ✕
      </span>
      <div className="notice-body">
        <p>{words}</p>
        {onRetry != null && (
          <button type="button" className="button button-primary con-retry" onClick={onRetry}>
            {CW.tryAgain}
          </button>
        )}
      </div>
    </div>
  );
}

export function BookPanel({
  panel,
  start,
  save,
  onClose,
  onBook,
  now = NOW,
}: {
  panel: Extract<Panel, { kind: 'book' }>;
  start: Pick<ConsultationStart, 'enquiry' | 'viewer'>;
  save: Save;
  onClose: () => void;
  onBook: (draft: Draft, change: Consultation | null) => void;
  now?: string;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [draft, setDraft] = useState<Draft>(panel.draft);
  const [touched, setTouched] = useState(panel.touched);
  const [pressed, setPressed] = useState(panel.pressed);
  const title = useRef<HTMLHeadingElement>(null);
  const member = start.viewer.role === 'member';
  const problems = pressed ? problemsOf(draft, touched, now, !member) : {};
  const skip = skipWords(draft, LOCALE);
  const people = Object.values(PEOPLE);
  const change = panel.change;

  useEffect(() => title.current?.focus(), []);

  function set(patch: Partial<Draft>, start = false): void {
    setDraft((now) => ({ ...now, ...patch }));
    if (start) setTouched(true);
  }

  function press(): void {
    setPressed(true);
    const found = problemsOf(draft, touched, now, !member);
    const first = FIELD_ORDER.find((field) => found[field] != null);

    if (first != null) {
      document.getElementById(`${id}-${first}`)?.focus();

      return;
    }
    onBook(draft, change);
  }

  const err = (field: Field) =>
    problems[field] == null
      ? {}
      : { 'aria-invalid': true as const, 'aria-describedby': `${id}-${field}-error` };
  const error = (field: Field) =>
    problems[field] == null ? null : (
      <FieldError id={`${id}-${field}-error`} message={problems[field]} quiet />
    );

  return (
    <aside className="con-panel" aria-labelledby={`${id}-title`}>
      <div className="con-panel-top">
        <h2 id={`${id}-title`} ref={title} tabIndex={-1}>
          {change == null ? CW.bookTitle : CW.changeTitle}
        </h2>
        <button type="button" className="con-close" aria-label="Close" onClick={onClose}>
          <Glyph name="clear" size={18} weight={2.4} />
        </button>
      </div>
      <p className="con-panel-for">
        {start.enquiry.client}
        {start.enquiry.type != null && ` · ${t(`eventTypes.${start.enquiry.type}`)}`}
      </p>
      <div className="con-panel-body">
        {save === 'failed' && (
          <Refused words={change == null ? CW.notBooked : CW.notSaved} onRetry={press} />
        )}
        <div className="con-pair">
          <div className="field">
            <label htmlFor={`${id}-date`}>{CW.date}</label>
            <input
              id={`${id}-date`}
              className={problems.date == null ? 'input' : 'input input-wrong'}
              type="date"
              value={draft.date}
              {...err('date')}
              onChange={(event) => set({ date: event.target.value }, true)}
            />
            {error('date')}
          </div>
          <div className="field">
            <label htmlFor={`${id}-time`}>{CW.startTime}</label>
            <input
              id={`${id}-time`}
              className={problems.time == null ? 'input' : 'input input-wrong'}
              type="time"
              value={draft.time}
              {...err('time')}
              onChange={(event) => set({ time: event.target.value }, true)}
            />
            {error('time')}
          </div>
        </div>
        {skip != null && problems.time == null && (
          <p className="con-skip" role="status">
            <Glyph name="info" size={17} weight={2.2} />
            <span>{skip}</span>
          </p>
        )}
        <div className="con-pair">
          <div className="field">
            <label htmlFor={`${id}-length`}>{CW.length}</label>
            <select
              id={`${id}-length`}
              className="input"
              value={draft.minutes}
              onChange={(event) =>
                set({ minutes: LENGTHS.find((one) => one === Number(event.target.value)) ?? 60 })
              }
            >
              {LENGTHS.map((one) => (
                <option key={one} value={one}>
                  {CW.lengths[one]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${id}-zone`}>{CW.timeZone}</label>
            <select
              id={`${id}-zone`}
              className="input"
              value={draft.timeZone}
              onChange={(event) => set({ timeZone: event.target.value }, true)}
            >
              {ZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {timezoneLabel(zone)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <fieldset className="con-how-pick">
          <legend>{CW.howLabel}</legend>
          <div className="con-how-choices">
            {HOWS.map((how) => (
              <label
                key={how}
                className={draft.how === how ? 'con-how-choice is-on' : 'con-how-choice'}
              >
                <input
                  type="radio"
                  name={`${id}-how`}
                  value={how}
                  checked={draft.how === how}
                  onChange={() => set({ how })}
                />
                <Glyph name={HOW_GLYPH[how]} size={17} weight={2.2} />
                {CW.how[how]}
              </label>
            ))}
          </div>
        </fieldset>
        {draft.how === 'inPerson' && (
          <div className="field">
            <div className="field-heading con-field-heading">
              <label htmlFor={`${id}-where`}>{CW.where}</label>
              <span className="con-optional">{CW.optional}</span>
            </div>
            <textarea
              id={`${id}-where`}
              className={
                problems.where == null
                  ? 'input con-where-field'
                  : 'input input-wrong con-where-field'
              }
              rows={2}
              value={draft.where}
              {...err('where')}
              onChange={(event) => set({ where: event.target.value })}
            />
            <p
              className={
                [...draft.where].length > WHERE_MOST ? 'con-counter is-over' : 'con-counter'
              }
            >
              {CW.count([...draft.where].length)}
            </p>
            {error('where')}
          </div>
        )}
        {draft.how === 'video' && (
          <div className="field">
            <div className="field-heading con-field-heading">
              <label htmlFor={`${id}-link`}>{CW.link}</label>
              <span className="con-optional">{CW.optional}</span>
            </div>
            <input
              id={`${id}-link`}
              className={problems.link == null ? 'input' : 'input input-wrong'}
              type="url"
              inputMode="url"
              placeholder="https://"
              value={draft.link}
              {...err('link')}
              onChange={(event) => set({ link: event.target.value })}
            />
            {error('link')}
          </div>
        )}
        {draft.how === 'phone' && <p className="desk-line con-phone">{CW.phoneNothing}</p>}
        {member ? (
          <div className="field">
            <p className="con-label">{CW.ledByLabel}</p>
            <p className="con-fixed">{fixedLeaderWords(draft, start.viewer)}</p>
            <p className="desk-note">{change == null ? CW.ledByMemberLine : CW.ledByKeptLine}</p>
          </div>
        ) : (
          <div className="field">
            <label htmlFor={`${id}-ledBy`}>{CW.ledByLabel}</label>
            <select
              id={`${id}-ledBy`}
              className={
                problems.ledBy == null
                  ? draft.ledBy == null
                    ? 'input input-unchosen'
                    : 'input'
                  : 'input input-wrong input-unchosen'
              }
              value={draft.ledBy ?? ''}
              {...err('ledBy')}
              onChange={(event) =>
                set({ ledBy: event.target.value === '' ? null : event.target.value })
              }
            >
              <option value="" disabled>
                {CW.chooseLeader}
              </option>
              {people.map((one) => (
                <option key={one.id} value={one.id}>
                  {one.name}
                </option>
              ))}
            </select>
            {error('ledBy')}
          </div>
        )}
      </div>
      <div className="con-panel-foot">
        <ActionPair
          dismiss={
            <button type="button" className="link-button" onClick={onClose}>
              {CW.cancel}
            </button>
          }
          confirm={
            <button
              type="button"
              className="button button-primary"
              aria-busy={save === 'saving'}
              onClick={() => save !== 'saving' && press()}
            >
              {save === 'saving'
                ? change == null
                  ? CW.booking
                  : CW.saving
                : change == null
                  ? CW.bookIt
                  : CW.saveChanges}
            </button>
          }
        />
      </div>
    </aside>
  );
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Line {
  day: number;
  kind: 'event' | 'milestone' | 'consultation';
  time: string;
  title: string;
}

const NOVEMBER: readonly Line[] = [
  { day: 5, kind: 'event', time: '18:00', title: 'Adaeze & Tunde’s wedding' },
  { day: 7, kind: 'milestone', time: '15:00', title: 'Adaeze & Tunde’s wedding ends' },
  { day: 13, kind: 'event', time: '19:00', title: 'Ireti at 40' },
  { day: 14, kind: 'event', time: '19:30 Europe/Madrid', title: 'Gala Fundación Lucía' },
  { day: 19, kind: 'consultation', time: '14:30', title: CW.calendarLine('Lucía Fernández') },
  { day: 24, kind: 'consultation', time: '11:00', title: CW.calendarLine('Lucía Fernández') },
];

const CELLS = Array.from({ length: 42 }, (_, index) => index - 5);

const KIND_WORD = { event: 'Event', milestone: 'Milestone', consultation: CW.calendarWord };

function CalendarStrip({ start }: { start: ConsultationStart }) {
  const [view, setView] = useState(start.calendar.view);
  const [show, setShow] = useState(start.calendar.show);
  const lines = NOVEMBER.filter(
    (line) =>
      (show === 'all' || line.kind === 'event') &&
      !(start.calendar.free && line.kind === 'consultation'),
  );

  return (
    <div className="desk-page cal-page">
      <div className="desk-column con-cal">
        <h1 className="desk-title">Calendar</h1>
        <div className="con-cal-tools">
          <div className="con-seg" role="group" aria-label="View">
            {(['month', 'agenda'] as const).map((one) => (
              <button
                key={one}
                type="button"
                aria-pressed={view === one}
                onClick={() => setView(one)}
              >
                {view === one && <Glyph name="tick" size={14} weight={2.6} />}
                {one === 'month' ? 'Month' : 'Agenda'}
              </button>
            ))}
          </div>
          <label className="con-show">
            <span>Show</span>
            <select
              className="input"
              value={show}
              onChange={(event) => setShow(event.target.value === 'events' ? 'events' : 'all')}
            >
              <option value="all">Events and milestones</option>
              <option value="events">Events only</option>
            </select>
          </label>
        </div>
        {view === 'month' ? (
          <div className="con-week" role="grid" aria-label="November 2026">
            {DAYS.map((name) => (
              <div key={name} className="con-week-name" role="columnheader">
                {name}
              </div>
            ))}
            {CELLS.map((day, index) => (
              <div key={index} className="con-week-day" role="gridcell">
                {day >= 1 && day <= 30 && (
                  <>
                    <p className={day === 18 ? 'con-week-num is-today' : 'con-week-num'}>{day}</p>
                    {lines
                      .filter((line) => line.day === day)
                      .map((line) => (
                        <CalendarLine key={line.title + line.day} line={line} mark />
                      ))}
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <ul className="desk-rows con-agenda">
            {lines.map((line) => (
              <li key={line.title + line.day} className="con-agenda-day">
                <p className="con-agenda-date">{`${DAYS[(line.day + 5) % 7]}, Nov ${line.day}`}</p>
                <CalendarLine line={line} />
              </li>
            ))}
          </ul>
        )}
        <p className="desk-note con-demo-only">
          {start.calendar.free
            ? 'A Free organisation’s Calendar shows no consultations: the events and the milestone stay.'
            : 'Month and Agenda are the product’s Calendar, which a demo may not change: this strip shows the line its third kind adds. A cancelled consultation is not on it.'}
        </p>
      </div>
    </div>
  );
}

function CalendarLine({ line, mark = false }: { line: Line; mark?: boolean }) {
  const label = `${line.time}, ${line.title}`;
  const shape: ReactNode =
    line.kind === 'event' ? (
      <span className="con-shape-event" aria-hidden="true" />
    ) : line.kind === 'milestone' ? (
      <span className="con-shape-milestone" aria-hidden="true" />
    ) : (
      <span className="con-shape-consultation" aria-hidden="true">
        <Glyph name="users" size={13} weight={2.4} />
      </span>
    );
  const to = line.kind === 'consultation' ? '/demo/consultations?state=upcoming' : '/demo/calendar';

  return mark ? (
    <Link className={`con-mark is-${line.kind}`} to={to} aria-label={label}>
      {shape}
      <span className="con-mark-words">
        {line.time} {line.title}
      </span>
    </Link>
  ) : (
    <Link className="desk-row con-cal-row" to={to} aria-label={label}>
      {shape}
      <RowWords
        title={line.title}
        tag={
          <span className={`desk-tag con-kind is-${line.kind}`}>
            {shape}
            {KIND_WORD[line.kind]}
          </span>
        }
        lines={[line.time]}
      />
      <Chevron />
    </Link>
  );
}

function EnquiriesCategory() {
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(true);

  return (
    <div className="desk-page">
      <div className="desk-column">
        <h1 className="desk-title">Notification settings</h1>
        <section className="con-card con-notif">
          <div className="con-card-head">
            <h2>{CW.enquiriesCategory}</h2>
            <span className="con-value">
              {push && email ? 'Push and email' : push ? 'Push only' : email ? 'Email only' : 'Off'}
            </span>
          </div>
          <p className="desk-line">{CW.enquiriesNote}</p>
          {(
            [
              ['Push', push, setPush],
              ['Email', email, setEmail],
            ] as const
          ).map(([name, on, flip]) => (
            <label key={name} className="con-switch-row">
              <span>{name}</span>
              <input
                type="checkbox"
                role="switch"
                aria-label={`${CW.enquiriesCategory} ${name}`}
                checked={on}
                onChange={() => flip(!on)}
              />
            </label>
          ))}
          <div className="con-copy">
            <p className="con-label">What it sends, as [l10n] will word it</p>
            <p>{CW.given('Folake Adeyemi', 'Lucía Fernández', 'Thursday, Nov 19, 14:30')}</p>
            <p>{CW.moved('Folake Adeyemi', 'Lucía Fernández', 'Friday, Nov 20, 10:00')}</p>
            <p>{CW.cancelledBy('Folake Adeyemi', 'Lucía Fernández', 'Thursday, Nov 19, 14:30')}</p>
            <p>{CW.reminder('Lucía Fernández', '14:30')}</p>
          </div>
        </section>
        <p className="desk-note con-demo-only">
          The six categories on main are the product’s (Settings › Notification settings); Enquiries
          joins them after Event changes, on for push and email.
        </p>
      </div>
    </div>
  );
}

function WhatsInTheFeed() {
  const lines = [
    'Each event’s name and status word',
    'Its start and end, in its own time zone',
    'The venue line',
    'Milestone titles, with a link back to Soirely',
  ];

  return (
    <div className="desk-page">
      <div className="desk-column">
        <h1 className="desk-title">Subscribe in your calendar app</h1>
        <section className="con-card">
          <h2 className="con-feed-title">What’s in it</h2>
          <ul className="con-feed">
            {lines.map((line) => (
              <li key={line}>
                <Glyph name="tick" size={15} weight={2.6} />
                {line}
              </li>
            ))}
            <li className="is-new">
              <Glyph name="tick" size={15} weight={2.6} />
              {CW.feedLine}
            </li>
          </ul>
          <h2 className="con-feed-title">Never in it</h2>
          <ul className="con-feed is-never">
            {[
              'Guest names',
              CW.feedNever,
              'Contact details',
              'Dietary notes',
              'Amounts of money',
            ].map((line) => (
              <li key={line}>
                <Glyph name="slash" size={15} weight={2.4} />
                {line}
              </li>
            ))}
          </ul>
        </section>
        <p className="desk-note con-demo-only">
          The panel is the product’s CalendarSubscribe; the demo shows its list with the line this
          story adds.
        </p>
      </div>
    </div>
  );
}
