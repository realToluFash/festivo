import {
  ApiError,
  type MenuCourse,
  type OrganisationEvent,
  SCHEDULE_TITLE_MAXIMUM,
  SCHEDULE_NOTE_MAXIMUM,
  type Schedule,
  type ScheduleItem,
  asSchedule,
  asScheduleItem,
  realtimeTopic,
} from '@soirely/api-client';
import { eventDayOf, wallOfZoned, visibleLength } from '@soirely/domain';
import type { TFunction } from 'i18next';
import { Fragment, type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';
import { keptKeys, keptLoad, useAnsweredAgain, useKeptAsShown } from '../../../tabKept.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { TextAction } from '../../../components/SettingsParts.tsx';
import { Skeleton } from '../../../components/Skeleton.tsx';
import { Toast } from '../../../components/Toast.tsx';
import { dateLocale } from '../../../i18n/index.ts';
import { pageTitle, usePageTitle } from '../../../pageTitle.ts';
import { canOn } from '../../../session.ts';
import { FieldWrong } from './GuestFields.tsx';
import {
  API_FIELDS,
  type Errors,
  type Field,
  type Form,
  type Reader,
  blankForm,
  check,
  courseLine,
  dayName,
  daysOf,
  detailsOf,
  detailsOfItem,
  differences,
  firstWrong,
  formOf,
  formPlaces,
  headingLine,
  holderOf,
  itemsOn,
  lastsCell,
  lastsHelp,
  placeHelp,
  placesOn,
  startsCell,
  tablesOn,
  underLine,
  windowLine,
  zoneNamed,
} from './scheduleArea.ts';
import { NightSwitch } from './NightSwitch.tsx';
import { ShowOnScreen } from './ShowOnScreen.tsx';
import { useHubTopics } from './useHubTopics.ts';
import { useDeskTop } from '../../../deskTop.ts';
import '../../../components/SettingsParts.css';
import '../../../components/eventsDesk.css';
import '../../../components/eventPage.css';
import './guests.css';
import './schedule.css';

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; schedule: Schedule };

type Panel = { kind: 'add' } | { kind: 'edit'; id: string; version: number } | null;

const FIELD_IDS: Record<Field, string> = {
  title: 'ro-title',
  date: 'ro-date',
  time: 'ro-time',
  lasts: 'ro-lasts',
  owner: 'ro-owner',
  role: 'ro-role',
  note: 'ro-note',
};

function readerZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** /app/events/:id/schedule (sc-3893): the event's running order, a table per place for each event day, as its demo draws it. */
export function ScheduleArea({
  event,
  night = false,
}: {
  event: OrganisationEvent;
  night?: boolean;
}) {
  const { t } = useTranslation();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const answeredAgain = useAnsweredAgain();

  usePageTitle(pageTitle(t, [t('schedule.title'), event.name]));

  useEffect(() => {
    let current = true;

    keptLoad(keptKeys.schedule(event.id), api.schedule(event.id)).then(
      (schedule) => current && setLoad({ kind: 'loaded', schedule }),
      () => current && setLoad((was) => (was.kind === 'loaded' ? was : { kind: 'failed' })),
    );

    return () => {
      current = false;
    };
  }, [event.id, attempt, answeredAgain]);
  useKeptAsShown(keptKeys.schedule(event.id), load.kind === 'loaded' ? load.schedule : null);

  const topics = useMemo(() => [realtimeTopic('EventSchedule', event.id)], [event.id]);
  useHubTopics(
    topics,
    () => api.scheduleSubscription(event.id),
    (data) => {
      const schedule = asSchedule(data);
      if (schedule == null) setAttempt((n) => n + 1);
      else setLoad({ kind: 'loaded', schedule });
    },
    () => setAttempt((n) => n + 1),
  );

  if (load.kind === 'loaded')
    return (
      <ScheduleView
        event={event}
        night={night}
        schedule={load.schedule}
        onSchedule={(schedule) => setLoad({ kind: 'loaded', schedule })}
      />
    );

  return (
    <div className="desk ev desk-page ev-page gs mn sn ro">
      <div className="ev-wide mn-page">
        <Crumbs event={event} night={night} />
        <header className="gs-top">
          <div className="mn-head">
            <h1 className="gs-title">{t('schedule.title')}</h1>
          </div>
        </header>
        {load.kind === 'loading' && (
          <Skeleton words={t('schedule.loading')} shape="rows" rowHeight={56} />
        )}
        {load.kind === 'failed' && (
          <div className="sn-card" role="alert">
            <p className="mn-failed">
              <Glyph name="alert" size={17} weight={2.2} />
              {t('schedule.failed')}
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
                {t('schedule.tryAgain')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Crumbs({
  event,
  chrome = false,
  night,
}: {
  event: OrganisationEvent;
  chrome?: boolean;
  night: boolean;
}) {
  const { t } = useTranslation();
  const desk = useDeskTop();

  return (
    <div className={chrome ? 'ev-crumb-row ro-chrome' : 'ev-crumb-row'}>
      <nav className="ev-crumb" aria-label={t('schedule.crumb')}>
        <ol>
          <li className="ev-crumb-part">
            <Link to="/app/events">{t('schedule.events')}</Link>
          </li>
          <li className="ev-crumb-part">
            <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
            <Link className="ev-crumb-name" to={`/app/events/${encodeURIComponent(event.id)}`}>
              {event.name}
            </Link>
          </li>
          <li className="ev-crumb-part" aria-current="page">
            <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
            <span className="ev-crumb-name">{t('schedule.title')}</span>
          </li>
        </ol>
      </nav>
      {night && <NightSwitch eventId={event.id} on="schedule" />}
      {desk.bell}
    </div>
  );
}

function ScheduleView({
  event,
  night,
  schedule,
  onSchedule,
}: {
  event: OrganisationEvent;
  night: boolean;
  schedule: Schedule;
  onSchedule: (schedule: Schedule) => void;
}) {
  const { t } = useTranslation();
  const manage = canOn(event, 'run_of_show.manage');
  const reader: Reader = { locale: dateLocale(), zone: readerZone() };
  const main = t('schedule.main');
  const items = schedule.items;
  const days = daysOf(event.startsAt, schedule);
  const [chosenDay, setDay] = useState<string>(() => days[0] ?? '');
  const [panel, setPanel] = useState<Panel>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [pressed, setPressed] = useState(false);
  const [refused, setRefused] = useState<Errors>({});
  const [limit, setLimit] = useState(false);
  const [conflict, setConflict] = useState<ScheduleItem | null>(null);
  const [asking, setAsking] = useState(false);
  const [deleted, setDeleted] = useState<ScheduleItem | null>(null);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [said, setSaid] = useState('');
  const [failed, setFailed] = useState<'save' | 'delete' | null>(null);
  const [gone, setGone] = useState(false);
  const [unrestored, setUnrestored] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [screens, setScreens] = useState(false);
  const [courses, setCourses] = useState<readonly MenuCourse[] | null>(null);
  const [courseOpen, setCourseOpen] = useState(false);
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const seesMenu = manage && canOn(event, 'menu.read');
  const focusAfter = useRef<string | null>(null);

  const formOpen = panel != null;
  useEffect(() => {
    if (!seesMenu || !formOpen) return undefined;
    let current = true;
    api.menu(event.id).then(
      (menu) => current && setCourses(menu.courses),
      () => current && setCourses((was) => was ?? []),
    );
    return () => {
      current = false;
    };
  }, [seesMenu, formOpen, event.id]);

  useEffect(() => {
    if (focusAfter.current == null) return;
    document.getElementById(focusAfter.current)?.focus();
    focusAfter.current = null;
  });

  const day = days.includes(chosenDay) ? chosenDay : (days[0] ?? '');
  const editing =
    panel?.kind === 'edit' ? (items.find((one) => one.id === panel.id) ?? null) : null;
  const errors: Errors =
    form != null && pressed ? { ...check(form, schedule, reader, t), ...refused } : refused;
  const tables = tablesOn(items, day, main);
  const places = tables.map((table) => table.place);
  const shownPlace = picked != null && places.includes(picked) ? picked : (places[0] ?? main);
  const line = headingLine(schedule, day, reader, main, t);

  async function dismiss(one: ScheduleItem) {
    try {
      onSchedule((await api.dismissCourseNotice(event.id, one.id)).schedule);
    } catch {
      setFailed('save');
    }
  }

  function pickCourse(id: string | null) {
    setCourseOpen(false);
    const holder =
      id == null || form == null || id === form.course
        ? null
        : holderOf(id, items, editing?.id ?? null);
    if (holder != null) {
      setMoveTo(id);
      focusAfter.current = 'ro-move-cancel';
      return;
    }
    setMoveTo(null);
    if (form != null) setForm({ ...form, course: id });
    focusAfter.current = 'ro-course';
  }

  function reset() {
    setCourseOpen(false);
    setMoveTo(null);
    setPressed(false);
    setRefused({});
    setLimit(false);
    setConflict(null);
    setAsking(false);
    setFailed(null);
    setGone(false);
  }

  function openAdd() {
    setPanel({ kind: 'add' });
    setForm(blankForm(day));
    reset();
    focusAfter.current = 'ro-panel-title';
  }

  function openEdit(one: ScheduleItem) {
    setPanel({ kind: 'edit', id: one.id, version: one.version });
    setForm(formOf(one));
    reset();
    focusAfter.current = 'ro-panel-title';
  }

  function close(back?: string) {
    const was = panel;
    setPanel(null);
    setForm(null);
    reset();
    const there = was?.kind === 'edit' && items.some((one) => one.id === was.id);
    focusAfter.current = back ?? (there ? `ro-open-${was.id}` : 'ro-add');
  }

  function kept(next: Schedule, itemId: string, words: string) {
    onSchedule(next);
    const saved = next.items.find((one) => one.id === itemId);
    if (saved != null) {
      setDay(saved.day);
      setPicked(saved.place ?? main);
    }
    setSaid(words);
    setUnrestored(null);
    close(`ro-open-${itemId}`);
  }

  function wrongAt(found: Errors) {
    const wrong = firstWrong(found);
    if (wrong != null) focusAfter.current = FIELD_IDS[wrong];
  }

  async function send(sent: Panel) {
    if (form == null || sent == null) return;
    const title = form.title.trim();
    const changing = sent.kind === 'edit' && !gone;
    const details = detailsOf(form, formPlaces(items, form, main), main, seesMenu);
    setBusy(true);
    setFailed(null);
    try {
      const answer = changing
        ? await api.changeScheduleItem(event.id, sent.id, details, sent.version)
        : await api.addScheduleItem(event.id, details);
      kept(
        answer.schedule,
        answer.itemId,
        t(changing ? 'schedule.saved' : 'schedule.added', { title }),
      );
    } catch (error) {
      if (error instanceof ApiError && error.code === 'validation_failed') {
        const found: Errors = {};
        for (const [path, message] of Object.entries(error.fieldErrors())) {
          const field = API_FIELDS[path];
          if (field != null) found[field] ??= message;
        }
        setRefused(found);
        wrongAt(found);
      } else if (error instanceof ApiError && error.code === 'schedule_item_limit') {
        setLimit(true);
        focusAfter.current = 'ro-limit';
      } else if (error instanceof ApiError && error.status === 412) {
        const current = asScheduleItem(error.problem.current);
        if (current == null) {
          setFailed('save');
          focusAfter.current = 'ro-failed';
        } else {
          setConflict(current);
          focusAfter.current = 'ro-conflict';
        }
      } else if (changing && error instanceof ApiError && error.status === 404) {
        setGone(true);
        setAsking(false);
        focusAfter.current = 'ro-gone';
      } else {
        setFailed('save');
        focusAfter.current = 'ro-failed';
      }
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (form == null || busy) return;
    setRefused({});
    if ((panel?.kind === 'add' || gone) && items.length >= schedule.itemsMaximum) {
      setLimit(true);
      focusAfter.current = 'ro-limit';
      return;
    }
    const found = check(form, schedule, reader, t);
    if (firstWrong(found) != null) {
      setPressed(true);
      wrongAt(found);
      return;
    }
    void send(panel);
  }

  function useTheirs() {
    if (conflict == null || panel?.kind !== 'edit') return;
    setPanel({ ...panel, version: conflict.version });
    setForm(formOf(conflict));
    onSchedule({
      ...schedule,
      items: items.map((one) => (one.id === conflict.id ? conflict : one)),
    });
    setConflict(null);
    focusAfter.current = 'ro-title';
  }

  function keepMine() {
    if (form == null || conflict == null || panel?.kind !== 'edit' || busy) return;
    const found = check(form, schedule, reader, t);
    if (firstWrong(found) != null) {
      setPressed(true);
      wrongAt(found);
      return;
    }
    const moved = { ...panel, version: conflict.version };
    setPanel(moved);
    setConflict(null);
    void send(moved);
  }

  async function remove() {
    if (editing == null || busy) return;
    const leaving = editing;
    setBusy(true);
    setFailed(null);
    try {
      onSchedule(await api.deleteScheduleItem(event.id, leaving.id));
      setDeleted(leaving);
      setSaid('');
      setUnrestored(null);
      close('ro-add');
    } catch {
      setAsking(false);
      setFailed('delete');
      focusAfter.current = 'ro-failed';
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (deleted == null) return;
    const back = deleted;
    setDeleted(null);
    setUnrestored(null);
    try {
      const answer = await api.addScheduleItem(event.id, detailsOfItem(back));
      onSchedule(answer.schedule);
      setDay(back.day);
      setSaid(t('schedule.restored', { title: back.title }));
      focusAfter.current = `ro-open-${answer.itemId}`;
    } catch {
      setSaid('');
      setUnrestored(back.title);
      focusAfter.current = 'ro-unsaid';
    }
  }

  function onDayKey(change: KeyboardEvent<HTMLButtonElement>, at: number) {
    const by = change.key === 'ArrowRight' ? 1 : change.key === 'ArrowLeft' ? -1 : 0;
    if (by === 0) return;
    change.preventDefault();
    const next = days[(at + by + days.length) % days.length] as string;
    setDay(next);
    setPicked(null);
    focusAfter.current = `ro-day-${next}`;
  }

  return (
    <div
      className={['desk ev desk-page ev-page gs mn sn ro', panel != null && 'is-form']
        .filter(Boolean)
        .join(' ')}
    >
      <div className="ev-wide mn-page">
        <Crumbs event={event} chrome night={night} />
        <header className="gs-top ro-chrome ro-top">
          <div className="mn-head">
            <h1 className="gs-title">{t('schedule.heading', { day: dayName(day, reader) })}</h1>
            {line != null && <p className="mn-sub">{line}</p>}
          </div>
          {items.length > 0 && (
            <Link
              className="gs-pill is-secondary ro-run"
              to={`/app/events/${encodeURIComponent(event.id)}/run`}
            >
              <Glyph name="clock" size={17} weight={2.2} />
              {t('runView.open')}
            </Link>
          )}
          {manage && items.length > 0 && (
            <button
              id="ro-screens"
              type="button"
              className="gs-pill is-secondary ro-run"
              onClick={() => setScreens(true)}
            >
              <Glyph name="device" size={17} weight={2.2} />
              {t('showOnScreen.open')}
            </button>
          )}
          {manage && (
            <button
              id="ro-add"
              type="button"
              className="gs-pill is-primary ro-add"
              onClick={openAdd}
            >
              <Glyph name="plus" size={17} weight={2.4} />
              {t('schedule.addItem')}
            </button>
          )}
        </header>
        <div className="sn-tabs ro-days ro-chrome" role="tablist" aria-label={t('schedule.days')}>
          {days.map((one, at) => {
            const on = one === day;
            return (
              <button
                key={one}
                id={`ro-day-${one}`}
                type="button"
                role="tab"
                className="sn-tab ro-day"
                aria-selected={on}
                aria-controls="ro-tables"
                tabIndex={on ? 0 : -1}
                onKeyDown={(change) => onDayKey(change, at)}
                onClick={() => {
                  setDay(one);
                  setPicked(null);
                  setPicking(false);
                }}
              >
                <span>{dayName(one, reader)}</span>
                <span className="ro-day-sep">{' · '}</span>
                <span className="ro-day-count">
                  {t('schedule.items', { count: itemsOn(items, one).length })}
                </span>
              </button>
            );
          })}
        </div>
        {!manage && (
          <p className="mn-lock ro-chrome">
            <Glyph name="lock" size={16} weight={2.2} />
            {t('schedule.lock')}
          </p>
        )}
        <p className="mn-said ro-chrome" role="status">
          {said !== '' && (
            <>
              <Glyph name="tick" size={17} weight={2.6} />
              {said}
            </>
          )}
        </p>
        {unrestored != null && (
          <p id="ro-unsaid" className="ro-limit ro-unsaid ro-chrome" role="alert" tabIndex={-1}>
            <Broken />
            {t('schedule.notRestored', { title: unrestored })}
          </p>
        )}
        {manage &&
          items
            .filter((one) => one.courseNotice)
            .map((one) => (
              <div key={one.id} className="sn-alert ro-unlinked ro-chrome" role="status">
                <Glyph name="warn" size={18} weight={2.2} />
                <div className="ro-unlinked-words">
                  <p className="ro-unlinked-title">
                    {t('schedule.unlinked', { title: one.title })}
                  </p>
                  <p className="desk-help">{t('schedule.unlinkedWhy')}</p>
                </div>
                <TextAction label={t('schedule.dismiss')} onClick={() => void dismiss(one)} />
              </div>
            ))}
        <div className="mn-split">
          <div
            id="ro-tables"
            className="mn-list ro-tables"
            role="tabpanel"
            aria-labelledby={`ro-day-${day}`}
          >
            {tables.length === 0 ? (
              <section className="sn-card ro-empty" aria-labelledby="ro-empty">
                <Glyph name="clock" size={28} weight={2} />
                <h2 id="ro-empty">{t('schedule.empty')}</h2>
                <p className="mn-sub">{t('schedule.emptyLine')}</p>
                {manage && (
                  <button type="button" className="gs-pill is-primary" onClick={openAdd}>
                    {t('schedule.addItem')}
                  </button>
                )}
              </section>
            ) : (
              <>
                {tables.length > 1 && (
                  <PlacePicker
                    places={places}
                    counts={tables.map((table) => table.items.length)}
                    shown={shownPlace}
                    open={picking}
                    onOpen={() => setPicking(!picking)}
                    onPick={(place) => {
                      setPicked(place);
                      setPicking(false);
                      focusAfter.current = 'ro-picker';
                    }}
                  />
                )}
                {tables.map((table, at) => (
                  <PlaceTable
                    key={table.place}
                    at={at}
                    place={table.place}
                    items={table.items}
                    reader={reader}
                    manage={manage}
                    lit={editing?.id ?? null}
                    shown={table.place === shownPlace}
                    single={tables.length === 1}
                    onOpen={openEdit}
                  />
                ))}
              </>
            )}
          </div>
          {manage && panel != null && form != null && (
            <ItemPanel
              schedule={schedule}
              form={form}
              editing={editing}
              adding={panel.kind === 'add'}
              errors={errors}
              reader={reader}
              main={main}
              limit={limit}
              conflict={conflict}
              asking={asking}
              failed={failed}
              gone={gone}
              busy={busy}
              course={
                seesMenu
                  ? {
                      courses: courses ?? [],
                      loading: courses === null,
                      eventId: event.id,
                      open: courseOpen,
                      moveTo,
                      onOpen: () => {
                        setCourseOpen(!courseOpen);
                        focusAfter.current = courseOpen ? 'ro-course' : 'ro-course-first';
                      },
                      onShut: () => {
                        setCourseOpen(false);
                        focusAfter.current = 'ro-course';
                      },
                      onPick: pickCourse,
                      onMove: () => {
                        if (moveTo != null) setForm({ ...form, course: moveTo });
                        setMoveTo(null);
                        focusAfter.current = 'ro-course';
                      },
                      onCancelMove: () => {
                        setMoveTo(null);
                        focusAfter.current = 'ro-course';
                      },
                    }
                  : null
              }
              onChange={(next) => {
                setForm({ ...form, ...next });
                const cleared = { ...refused };
                for (const key of Object.keys(next)) delete cleared[key as Field];
                if (Object.keys(next).includes('time')) delete cleared.date;
                setRefused(cleared);
              }}
              onSave={save}
              onClose={() => close()}
              onTheirs={useTheirs}
              onMine={keepMine}
              onAsk={() => {
                setFailed(null);
                setAsking(true);
                focusAfter.current = 'ro-keep';
              }}
              onKeep={() => {
                setAsking(false);
                focusAfter.current = 'ro-delete';
              }}
              onDelete={() => void remove()}
            />
          )}
        </div>
      </div>
      {screens && (
        <ShowOnScreen
          eventId={event.id}
          onClose={() => {
            setScreens(false);
            focusAfter.current = 'ro-screens';
          }}
        />
      )}
      {deleted != null && (
        <Toast
          key={deleted.id}
          words={t('schedule.deleted', { title: deleted.title })}
          counted={{ said: t('schedule.undoOpen') }}
          onUndo={() => void undo()}
          onClose={() => setDeleted(null)}
        />
      )}
    </div>
  );
}

function PlacePicker({
  places,
  counts,
  shown,
  open,
  onOpen,
  onPick,
}: {
  places: readonly string[];
  counts: readonly number[];
  shown: string;
  open: boolean;
  onOpen: () => void;
  onPick: (place: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="ro-picker">
      <button
        id="ro-picker"
        type="button"
        className="ro-picker-pill"
        aria-label={t('schedule.placePicker', { place: shown })}
        aria-expanded={open}
        aria-controls="ro-picker-list"
        onClick={onOpen}
      >
        <span>{shown}</span>
        <Glyph name="chevdown" size={16} weight={2.4} />
      </button>
      {open && (
        <ul id="ro-picker-list" className="ro-picker-list">
          {places.map((place, at) => (
            <li key={place}>
              <button
                type="button"
                className="ro-picker-row"
                aria-current={place === shown || undefined}
                onClick={() => onPick(place)}
              >
                <span className="ro-picker-name">{place}</span>
                <span className="ro-picker-count">
                  {t('schedule.items', { count: counts[at] ?? 0 })}
                </span>
                {place === shown && <Glyph name="tick" size={17} weight={2.6} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlaceTable({
  at,
  place,
  items,
  reader,
  manage,
  lit,
  shown,
  single,
  onOpen,
}: {
  at: number;
  place: string;
  items: readonly ScheduleItem[];
  reader: Reader;
  manage: boolean;
  lit: string | null;
  shown: boolean;
  single: boolean;
  onOpen: (one: ScheduleItem) => void;
}) {
  const { t } = useTranslation();
  const id = `ro-place-${at}`;

  return (
    <section
      className={['sn-card ro-table-card', shown && 'is-shown', single && 'is-single']
        .filter(Boolean)
        .join(' ')}
      aria-labelledby={id}
    >
      <div className="sn-card-top">
        <h2 id={id} className="ro-place">
          {place}
        </h2>
        <p className="mn-sub ro-place-count">{t('schedule.items', { count: items.length })}</p>
      </div>
      <div className="ro-fit">
        <table className="ro-table" aria-labelledby={id}>
          <thead>
            <tr>
              <th scope="col" className="ro-starts">
                {t('schedule.starts')}
              </th>
              <th scope="col" className="ro-wide ro-lasts">
                {t('schedule.lasts')}
              </th>
              <th scope="col">{t('schedule.item')}</th>
              <th scope="col" className="ro-wide ro-owner">
                {t('schedule.owner')}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((one) => (
              <tr key={one.id} className={lit === one.id ? 'is-lit' : undefined}>
                <td className="ro-starts">{startsCell(one, reader, t)}</td>
                <td className="ro-wide ro-lasts">{lastsCell(one.lengthMinutes, t)}</td>
                <td>
                  <div className="ro-item">
                    <span className="ro-title-line">
                      {manage ? (
                        <button
                          id={`ro-open-${one.id}`}
                          type="button"
                          className="ro-open"
                          onClick={() => onOpen(one)}
                        >
                          {one.title}
                        </button>
                      ) : (
                        <span className="ro-plain">{one.title}</span>
                      )}
                      {one.course != null && (
                        <span className="ro-course" title={one.course.name}>
                          {t('schedule.courseTag', { name: one.course.name })}
                        </span>
                      )}
                    </span>
                    <span className="ro-under">
                      <Words text={underLine(one, t)} />
                    </span>
                    {(one.fixedTime || one.showToGuests) && (
                      <span className="ro-pills">
                        {one.fixedTime && (
                          <span className="ro-pill">
                            <Glyph name="lock" size={13} weight={2.4} />
                            {t('schedule.fixed')}
                          </span>
                        )}
                        {one.showToGuests && (
                          <span className="ro-pill">
                            <Glyph name="eye" size={13} weight={2.4} />
                            {t('schedule.shown')}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </td>
                <td className="ro-wide ro-owner">
                  {one.ownerName == null ? (
                    <span className="ro-quiet">{t('schedule.noOwner')}</span>
                  ) : (
                    <>
                      <span className="ro-owner-name">
                        <Words text={one.ownerName} />
                      </span>
                      {one.ownerRole != null && <span className="ro-quiet">{one.ownerRole}</span>}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Each word of an owner's name on one line, wrapping at its spaces only: "Okonkwo-Williams" is one word (sc-63743). */
function Words({ text }: { text: string }) {
  return (
    <>
      {text.split(' ').map((word, at) => (
        <Fragment key={at}>
          {at > 0 && ' '}
          <span className="ro-word">{word}</span>
        </Fragment>
      ))}
    </>
  );
}

function ItemPanel({
  schedule,
  form,
  editing,
  adding,
  errors,
  reader,
  main,
  limit,
  conflict,
  asking,
  failed,
  gone,
  busy,
  course,
  onChange,
  onSave,
  onClose,
  onTheirs,
  onMine,
  onAsk,
  onKeep,
  onDelete,
}: {
  schedule: Schedule;
  form: Form;
  editing: ScheduleItem | null;
  adding: boolean;
  errors: Errors;
  reader: Reader;
  main: string;
  limit: boolean;
  conflict: ScheduleItem | null;
  asking: boolean;
  failed: 'save' | 'delete' | null;
  gone: boolean;
  busy: boolean;
  course: CourseControls | null;
  onChange: (next: Partial<Form>) => void;
  onSave: () => void;
  onClose: () => void;
  onTheirs: () => void;
  onMine: () => void;
  onAsk: () => void;
  onKeep: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const items = schedule.items;
  const zone = zoneNamed(schedule.timeZone, reader, schedule.earliest);
  const placeLine = placeHelp(items, form, editing, main, t);
  const formDay =
    form.date === '' ? null : eventDayOf(`${form.date}T${form.time === '' ? '12:00' : form.time}`);
  const dayPlaces = formDay == null ? [] : placesOn(items, formDay, main);
  const startsWrong = errors.date ?? errors.time ?? null;
  const ends = lastsHelp(form, reader, t);
  const windowWords = windowLine(schedule, reader, t);

  return (
    <aside className="mn-panel ro-panel" aria-labelledby="ro-panel-title">
      <div className="mn-panel-top">
        <button type="button" className="desk-text ro-back" onClick={onClose}>
          <Glyph name="back" size={17} weight={2.4} />
          {t('schedule.back')}
        </button>
        <div className="mn-panel-names">
          <h2 id="ro-panel-title" tabIndex={-1}>
            {adding ? t('schedule.addItem') : t('schedule.editItem')}
          </h2>
        </div>
        <button
          type="button"
          className="ev-round mn-close ro-x"
          aria-label={t('schedule.close')}
          onClick={onClose}
        >
          <Glyph name="clear" size={16} weight={2.4} />
        </button>
      </div>
      <div className="mn-panel-body">
        {limit && (
          <div id="ro-limit" className="ro-limit" role="alert" tabIndex={-1}>
            <Broken />
            <p>{t('schedule.limit', { max: schedule.itemsMaximum })}</p>
          </div>
        )}
        {failed != null && (
          <div id="ro-failed" className="ro-limit" role="alert" tabIndex={-1}>
            <Broken />
            <p>{t(failed === 'save' ? 'schedule.notSaved' : 'schedule.notDeleted')}</p>
          </div>
        )}
        {gone && (
          <div id="ro-gone" className="sn-alert ro-gone" role="alert" tabIndex={-1}>
            <Glyph name="warn" size={18} weight={2.2} />
            <p>{t('schedule.gone')}</p>
          </div>
        )}
        {conflict != null && (
          <Conflict
            conflict={conflict}
            form={form}
            reader={reader}
            main={main}
            t={t}
            onTheirs={onTheirs}
            onMine={onMine}
          />
        )}
        <TextField
          id="ro-title"
          label={t('schedule.titleLabel')}
          value={form.title}
          error={errors.title}
          help={t('schedule.count', {
            n: visibleLength(form.title.trim()),
            max: SCHEDULE_TITLE_MAXIMUM,
          })}
          onChange={(title) => onChange({ title })}
        />
        <fieldset className="ro-starts-set">
          <legend className="desk-label gs-label">{t('schedule.starts')}</legend>
          <div className="ro-pair">
            <div className="desk-field">
              <label htmlFor="ro-date" className="desk-label ro-sublabel">
                {t('schedule.date')}
              </label>
              <div className={errors.date == null ? 'desk-box' : 'desk-box is-wrong'}>
                <input
                  id="ro-date"
                  type="date"
                  value={form.date}
                  min={wallOfZoned(schedule.earliest).slice(0, 10)}
                  max={wallOfZoned(schedule.latest).slice(0, 10)}
                  aria-invalid={errors.date != null}
                  aria-describedby={startsWrong == null ? 'ro-starts-help' : 'ro-starts-error'}
                  onChange={(change) => onChange({ date: change.target.value })}
                />
              </div>
            </div>
            <div className="desk-field">
              <label htmlFor="ro-time" className="desk-label ro-sublabel">
                {t('schedule.time')}
              </label>
              <div className={errors.time == null ? 'desk-box' : 'desk-box is-wrong'}>
                <input
                  id="ro-time"
                  type="time"
                  value={form.time}
                  aria-invalid={errors.time != null}
                  aria-describedby={startsWrong == null ? 'ro-starts-help' : 'ro-starts-error'}
                  onChange={(change) => onChange({ time: change.target.value })}
                />
              </div>
            </div>
          </div>
          {startsWrong !== windowWords && (
            <p id="ro-starts-help" className="desk-help">
              {windowWords}
            </p>
          )}
          {startsWrong != null && <FieldWrong id="ro-starts-error">{startsWrong}</FieldWrong>}
          {zone != null && <p className="desk-help">{t('schedule.zoneLine', { zone })}</p>}
        </fieldset>
        <TextField
          id="ro-lasts"
          label={t('schedule.lastsLabel')}
          value={form.lasts}
          error={errors.lasts}
          help={ends ?? undefined}
          optional
          numeric
          onChange={(lasts) => onChange({ lasts })}
        />
        <div className="desk-field">
          <label htmlFor="ro-place" className="desk-label gs-label">
            {t('schedule.place')}
            <Optional />
          </label>
          <div className="desk-box">
            <input
              id="ro-place"
              type="text"
              value={form.place}
              placeholder={main}
              autoComplete="off"
              aria-describedby={placeLine == null ? undefined : 'ro-place-help'}
              onChange={(change) => onChange({ place: change.target.value })}
            />
          </div>
          {dayPlaces.length > 0 && (
            <div className="ro-chips" role="group" aria-label={t('schedule.placesOnDay')}>
              {dayPlaces.map((place) => {
                const on = (form.place.trim() === '' ? main : form.place.trim()) === place;
                return (
                  <button
                    key={place}
                    type="button"
                    className={on ? 'gs-chip is-on' : 'gs-chip'}
                    aria-pressed={on}
                    onClick={() => onChange({ place: place === main ? '' : place })}
                  >
                    {on && <Glyph name="tick" size={15} weight={2.6} />}
                    {place}
                  </button>
                );
              })}
            </div>
          )}
          {placeLine != null && (
            <p id="ro-place-help" className="desk-help">
              {placeLine}
            </p>
          )}
        </div>
        <TextField
          id="ro-owner"
          label={t('schedule.ownerLabel')}
          value={form.owner}
          error={errors.owner}
          optional
          onChange={(owner) => onChange({ owner })}
        />
        <TextField
          id="ro-role"
          label={t('schedule.role')}
          value={form.role}
          error={errors.role}
          optional
          onChange={(role) => onChange({ role })}
        />
        <div className="desk-field">
          <label htmlFor="ro-note" className="desk-label gs-label">
            {t('schedule.note')}
            <Optional />
          </label>
          <div className={errors.note == null ? 'desk-box ro-area' : 'desk-box ro-area is-wrong'}>
            <textarea
              id="ro-note"
              rows={3}
              value={form.note}
              aria-invalid={errors.note != null}
              aria-describedby={errors.note == null ? 'ro-note-help' : 'ro-note-help ro-note-error'}
              onChange={(change) => onChange({ note: change.target.value })}
            />
          </div>
          <p id="ro-note-help" className="desk-help">
            {t('schedule.noteHelp', { n: visibleLength(form.note), max: SCHEDULE_NOTE_MAXIMUM })}
          </p>
          {errors.note != null && <FieldWrong id="ro-note-error">{errors.note}</FieldWrong>}
        </div>
        {course != null && (
          <CourseField
            controls={course}
            chosen={form.course}
            items={items}
            editingId={editing?.id ?? null}
            formTime={form.time}
          />
        )}
        <Switch
          id="ro-fixed"
          label={t('schedule.fixed')}
          line={t('schedule.fixedLine')}
          on={form.fixed}
          onChange={(fixed) => onChange({ fixed })}
        />
        <Switch
          id="ro-guests"
          label={t('schedule.showToGuests')}
          line={t('schedule.guestsLine')}
          on={form.guests}
          onChange={(guests) => onChange({ guests })}
        />
      </div>
      <div className="mn-panel-foot">
        {asking && editing != null && !gone ? (
          <div className="ro-ask">
            <p className="ro-ask-words">{t('schedule.deleteAsk', { title: editing.title })}</p>
            <div className="ro-ask-acts">
              <button id="ro-keep" type="button" className="desk-text" onClick={onKeep}>
                {t('schedule.keepIt')}
              </button>
              <button
                type="button"
                className="gs-pill is-secondary"
                aria-disabled={busy || undefined}
                onClick={onDelete}
              >
                {t('schedule.deleteItem')}
              </button>
            </div>
          </div>
        ) : (
          <div className="mn-panel-acts ro-acts">
            {editing != null && !gone && (
              <button
                id="ro-delete"
                type="button"
                className="gs-pill is-secondary ro-delete"
                onClick={onAsk}
              >
                {t('schedule.deleteItemAsk')}
              </button>
            )}
            <div className="ro-acts-end">
              <button type="button" className="desk-text ro-cancel" onClick={onClose}>
                {t('schedule.cancel')}
              </button>
              <button
                type="button"
                className="gs-pill is-primary ro-save"
                aria-disabled={busy || undefined}
                onClick={onSave}
              >
                {t(gone ? 'schedule.addAgain' : 'schedule.save')}
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

interface CourseControls {
  courses: readonly MenuCourse[];
  loading: boolean;
  eventId: string;
  open: boolean;
  moveTo: string | null;
  onOpen: () => void;
  onShut: () => void;
  onPick: (id: string | null) => void;
  onMove: () => void;
  onCancelMove: () => void;
}

/** sc-3898: Course, a list of the event's menu courses in menu order, docked under the field and a sheet at 40rem and under. */
function CourseField({
  controls,
  chosen,
  items,
  editingId,
  formTime,
}: {
  controls: CourseControls;
  chosen: string | null;
  items: readonly ScheduleItem[];
  editingId: string | null;
  formTime: string;
}) {
  const { t } = useTranslation();
  const { courses, loading, eventId, open, moveTo, onOpen, onShut, onPick, onMove, onCancelMove } =
    controls;
  const current = courses.find((one) => one.id === chosen) ?? null;
  const holder = current == null ? null : holderOf(current.id, items, editingId);
  const asked = courses.find((one) => one.id === moveTo) ?? null;
  const askedHolder = asked == null ? null : holderOf(asked.id, items, editingId);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (press: globalThis.KeyboardEvent) => {
      if (press.key === 'Escape') onShut();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onShut]);

  return (
    <div className="desk-field ro-course-field">
      <span id="ro-course-label" className="desk-label gs-label">
        {t('schedule.course')}
        <Optional />
      </span>
      <button
        id="ro-course"
        type="button"
        className="desk-box ro-course-box"
        aria-labelledby="ro-course-label ro-course"
        aria-describedby="ro-course-help"
        aria-expanded={open}
        aria-controls="ro-course-list"
        onClick={onOpen}
      >
        <span className={current == null ? 'ro-course-none' : 'ro-course-name'}>
          {current?.name ?? t('schedule.noCourse')}
        </span>
        <Glyph name={open ? 'chevup' : 'chevdown'} size={16} weight={2.4} />
      </button>
      <p id="ro-course-help" className="desk-help">
        {holder != null ? t('schedule.moving', { other: holder.title }) : t('schedule.courseHelp')}
      </p>
      {open && (
        <>
          <div className="ro-sheet-scrim" aria-hidden="true" />
          <div
            id="ro-course-list"
            className="ro-course-list"
            role="group"
            aria-labelledby="ro-course-list-title"
          >
            <div className="ro-course-list-top">
              <h3 id="ro-course-list-title">{t('schedule.courseList')}</h3>
              <button
                type="button"
                className="ev-round ro-course-x"
                aria-label={t('schedule.close')}
                onClick={onShut}
              >
                <Glyph name="clear" size={16} weight={2.4} />
              </button>
            </div>
            {loading ? (
              <div className="ro-course-empty" aria-busy="true" />
            ) : courses.length === 0 ? (
              <div className="ro-course-empty">
                <p className="ro-course-empty-title">{t('schedule.noCourses')}</p>
                <p className="desk-help">{t('schedule.noCoursesLine')}</p>
                <Link
                  id="ro-course-first"
                  className="desk-text"
                  to={`/app/events/${encodeURIComponent(eventId)}/menu`}
                >
                  {t('schedule.openMenu')}
                  <Glyph name="chevron" size={16} weight={2.4} />
                </Link>
              </div>
            ) : (
              <ul className="ro-course-rows">
                {[null, ...courses].map((one, at) => {
                  const on = (one?.id ?? null) === chosen;
                  const line = one == null ? null : courseLine(one, items, editingId, formTime, t);
                  return (
                    <li key={one?.id ?? 'none'}>
                      <button
                        id={at === 0 ? 'ro-course-first' : undefined}
                        type="button"
                        className="ro-course-row"
                        aria-current={on || undefined}
                        onClick={() => onPick(one?.id ?? null)}
                      >
                        <span className="ro-course-words">
                          <span className="ro-course-row-name">
                            {one?.name ?? t('schedule.noCourse')}
                          </span>
                          {line != null && (
                            <>
                              {' '}
                              <span className="ro-course-row-line">{line}</span>
                            </>
                          )}
                        </span>
                        {on && <Glyph name="tick" size={17} weight={2.6} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
      {asked != null && askedHolder != null && (
        <div className="ro-move" role="group" aria-labelledby="ro-move-ask">
          <p id="ro-move-ask" className="ro-ask-words">
            {t('schedule.moveAsk', { course: asked.name, other: askedHolder.title })}
          </p>
          <p className="desk-help">{t('schedule.moveLine', { other: askedHolder.title })}</p>
          <div className="ro-ask-acts">
            <button id="ro-move-cancel" type="button" className="desk-text" onClick={onCancelMove}>
              {t('schedule.keepOn', { other: askedHolder.title })}
            </button>
            <button type="button" className="gs-pill is-secondary" onClick={onMove}>
              {t('schedule.moveIt')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Conflict({
  conflict,
  form,
  reader,
  main,
  t,
  onTheirs,
  onMine,
}: {
  conflict: ScheduleItem;
  form: Form;
  reader: Reader;
  main: string;
  t: TFunction;
  onTheirs: () => void;
  onMine: () => void;
}) {
  return (
    <div id="ro-conflict" className="sn-alert ro-conflict" role="alert" tabIndex={-1}>
      <Glyph name="warn" size={18} weight={2.2} />
      <div>
        <p>{t('schedule.conflict')}</p>
        <table className="ro-diff">
          <thead>
            <tr>
              <th scope="col">{t('schedule.field')}</th>
              <th scope="col">{t('schedule.theirs')}</th>
              <th scope="col">{t('schedule.yours')}</th>
            </tr>
          </thead>
          <tbody>
            {differences(conflict, form, reader, main, t).map((row) => (
              <tr key={row.field}>
                <th scope="row">{row.field}</th>
                <td>{row.theirs}</td>
                <td>{row.yours}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ro-conflict-acts">
          <button type="button" className="gs-pill is-secondary" onClick={onTheirs}>
            {t('schedule.useTheirs')}
          </button>
          <button type="button" className="gs-pill is-secondary" onClick={onMine}>
            {t('schedule.keepMine')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Broken() {
  return (
    <span className="ro-ring" aria-hidden="true">
      <Glyph name="clear" size={14} weight={2.6} />
    </span>
  );
}

function Optional() {
  const { t } = useTranslation();

  return <span className="gs-optional">{t('schedule.optional')}</span>;
}

function TextField({
  id,
  label,
  value,
  error,
  help,
  optional = false,
  numeric = false,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string | undefined;
  help?: string | undefined;
  optional?: boolean;
  numeric?: boolean;
  onChange: (value: string) => void;
}) {
  const told = [help == null ? null : `${id}-help`, error == null ? null : `${id}-error`]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="desk-field">
      <label htmlFor={id} className="desk-label gs-label">
        {label}
        {optional && <Optional />}
      </label>
      <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
        <input
          id={id}
          type="text"
          inputMode={numeric ? 'numeric' : undefined}
          value={value}
          autoComplete="off"
          aria-invalid={error != null}
          aria-describedby={told === '' ? undefined : told}
          onChange={(change) => onChange(change.target.value)}
        />
      </div>
      {help != null && (
        <p id={`${id}-help`} className="desk-help">
          {help}
        </p>
      )}
      {error != null && <FieldWrong id={`${id}-error`}>{error}</FieldWrong>}
    </div>
  );
}

function Switch({
  id,
  label,
  line,
  on,
  onChange,
}: {
  id: string;
  label: string;
  line: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className="ro-switch-row">
      <div className="ro-switch-words">
        <span id={`${id}-label`} className="desk-label">
          {label}
        </span>
        <span id={`${id}-line`} className="desk-help">
          {line}
        </span>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        className="dc-switch ro-switch"
        aria-checked={on}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-line`}
        onClick={() => onChange(!on)}
      >
        <span className="dc-switch-track" aria-hidden="true">
          <span className="dc-switch-knob" />
        </span>
      </button>
    </div>
  );
}
