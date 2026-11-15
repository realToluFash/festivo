import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import type { Tell } from '../components/SettingsParts.tsx';
import { Toast } from '../components/Toast.tsx';
import { DemoBell } from './DemoBell.tsx';
import { EventsShell } from './EventParts.tsx';
import { EventSidebar } from './EventSidebar.tsx';
import { type SampleEvent, sampleEvent } from './events.ts';
import { Pill } from './GuestsParts.tsx';
import { clockOfKitchen } from './kitchen.ts';
import { Wrong } from './MenuServed.tsx';
import { keptInbox, waitingLine } from './messages.ts';
import {
  type Errors,
  type Field,
  type Failure,
  type Form,
  type Item,
  type Panel,
  type Reader,
  type ScheduleStart,
  DAYS,
  EARLIEST,
  LATEST,
  MAIN,
  MOST_ITEMS,
  RW,
  SCHEDULE_EVENT,
  TITLE_MAX,
  blankForm,
  check,
  dayName,
  dayOf,
  differences,
  firstWrong,
  formOf,
  formPlaces,
  headingLine,
  itemOf,
  itemsOn,
  lastsCell,
  lastsHelp,
  placeHelp,
  placeOf,
  placesOn,
  readerOf,
  scheduleStart,
  startsCell,
  tablesOn,
  underLine,
  windowLine,
  zoneNamed,
} from './schedule.ts';
import { useSwitcherStart } from './switcher.ts';
import './guests.css';
import './menu.css';
import './stations.css';
import './dataControl.css';
import './schedule.css';

/** /demo/events/evt-wed-4/schedule (sc-3893): the event's Schedule at 1280 × 800 and at 40rem and under, by ?state=, ?locale= and ?zone=. */
export function SchedulePage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const raw = params.get('state');
  const locale = params.get('locale');
  const zone = params.get('zone');
  useSwitcherStart();

  return (
    <ScheduleAt
      key={`${id ?? ''}|${raw ?? ''}|${locale ?? ''}|${zone ?? ''}`}
      id={id}
      raw={raw}
      reader={readerOf(locale, zone)}
    />
  );
}

function ScheduleAt({
  id,
  raw,
  reader,
}: {
  id: string | undefined;
  raw: string | null;
  reader: Reader;
}) {
  const [event] = useState(() => sampleEvent(id));
  const [first] = useState(() => scheduleStart(raw));

  if (event == null) return <Navigate to="/demo/events" replace />;
  if (event.id !== SCHEDULE_EVENT)
    return <Navigate to={`/demo/events/${event.id}?area=schedule`} replace />;

  return (
    <EventsShell
      renderSide={(tell, covered) => (
        <EventSidebar
          event={event}
          area="schedule"
          now={clockOfKitchen()}
          tell={tell}
          inert={covered}
          waiting={waitingLine(keptInbox())}
        />
      )}
    >
      {(tell) => <ScheduleView first={first} event={event} reader={reader} tell={tell} />}
    </EventsShell>
  );
}

const FIELD_IDS: Record<Field, string> = {
  title: 'ro-title',
  date: 'ro-date',
  time: 'ro-time',
  lasts: 'ro-lasts',
  owner: 'ro-owner',
  role: 'ro-role',
  note: 'ro-note',
};

let added = 0;

function ScheduleView({
  first,
  event,
  reader,
  tell,
}: {
  first: ScheduleStart;
  event: SampleEvent;
  reader: Reader;
  tell: Tell;
}) {
  const [items, setItems] = useState<Item[]>(first.items);
  const [day, setDay] = useState(first.day);
  const [panel, setPanel] = useState<Panel>(first.panel);
  const [form, setForm] = useState<Form | null>(first.form);
  const [pressed, setPressed] = useState(first.pressed);
  const [limit, setLimit] = useState(first.limit);
  const [conflict, setConflict] = useState<Item | null>(first.conflict);
  const [stale, setStale] = useState(first.conflict != null);
  const [asking, setAsking] = useState(first.asking);
  const [deleted, setDeleted] = useState<Item | null>(first.deleted);
  const [picking, setPicking] = useState(first.picking);
  const [failed, setFailed] = useState(first.failed);
  const [picked, setPicked] = useState<string | null>(null);
  const [said, setSaid] = useState('');
  const focusAfter = useRef<string | null>(null);
  const manage = first.manage;

  useEffect(() => {
    const at =
      first.focus === 'limit'
        ? 'ro-limit'
        : first.focus === 'conflict'
          ? 'ro-conflict'
          : first.focus === 'failed'
            ? FAILED_IDS[first.failed ?? 'save']
            : first.focus === 'ask'
              ? 'ro-keep'
              : first.focus == null
                ? null
                : FIELD_IDS[first.focus];
    if (at != null) document.getElementById(at)?.focus();
  }, [first]);

  useEffect(() => {
    if (focusAfter.current == null) return;
    document.getElementById(focusAfter.current)?.focus();
    focusAfter.current = null;
  });

  const editing =
    panel?.kind === 'edit' ? (items.find((one) => one.id === panel.id) ?? null) : null;
  const errors: Errors = form != null && pressed ? check(form, reader) : {};
  const tables = tablesOn(items, day);
  const places = tables.map((table) => table.place);
  const shownPlace = picked != null && places.includes(picked) ? picked : (places[0] ?? MAIN);
  const line = headingLine(items, day, reader);
  const dayWord = dayName(day, reader);

  function openAdd() {
    setPanel({ kind: 'add' });
    setForm(blankForm(day));
    reset();
    focusAfter.current = 'ro-panel-title';
  }

  function openEdit(one: Item) {
    setPanel({ kind: 'edit', id: one.id });
    setForm(formOf(one));
    reset();
    focusAfter.current = 'ro-panel-title';
  }

  function reset() {
    setPressed(false);
    setLimit(false);
    setConflict(null);
    setAsking(false);
    setFailed(null);
  }

  function close(back?: string) {
    const was = panel;
    setPanel(null);
    setForm(null);
    reset();
    focusAfter.current = back ?? (was?.kind === 'edit' ? `ro-open-${was.id}` : 'ro-add');
  }

  function keep(saved: Item, words: string) {
    setItems((was) => [...was.filter((one) => one.id !== saved.id), saved]);
    setDay(dayOf(saved.starts));
    setPicked(placeOf(saved));
    setSaid(words);
    close(`ro-open-${saved.id}`);
  }

  function save() {
    if (form == null) return;
    const adding = panel?.kind === 'add' || failed === 'gone';
    if (adding && items.length >= MOST_ITEMS) {
      setLimit(true);
      focusAfter.current = 'ro-limit';
      return;
    }
    const wrong = firstWrong(check(form, reader));
    if (wrong != null) {
      setPressed(true);
      focusAfter.current = FIELD_IDS[wrong];
      return;
    }
    if (stale && first.conflict != null) {
      setConflict(first.conflict);
      focusAfter.current = 'ro-conflict';
      return;
    }
    if (panel?.kind === 'edit' && !adding) {
      keep(itemOf(panel.id, form, formPlaces(items, form)), RW.saved(form.title.trim()));
      return;
    }
    added += 1;
    keep(itemOf(`added-${added}`, form, formPlaces(items, form)), RW.added(form.title.trim()));
  }

  function useTheirs() {
    if (conflict == null) return;
    setForm(formOf(conflict));
    setItems((was) => was.map((one) => (one.id === conflict.id ? conflict : one)));
    setConflict(null);
    setStale(false);
    focusAfter.current = 'ro-title';
  }

  function keepMine() {
    if (form == null || panel?.kind !== 'edit') return;
    const wrong = firstWrong(check(form, reader));
    if (wrong != null) {
      setPressed(true);
      focusAfter.current = FIELD_IDS[wrong];
      return;
    }
    keep(itemOf(panel.id, form, formPlaces(items, form)), RW.saved(form.title.trim()));
  }

  function remove() {
    if (editing == null) return;
    setItems((was) => was.filter((one) => one.id !== editing.id));
    setDeleted(editing);
    setSaid('');
    close('ro-add');
  }

  function undo() {
    if (deleted == null) return;
    const back = deleted;
    setItems((was) => [...was, back]);
    setDay(dayOf(back.starts));
    setDeleted(null);
    setSaid(RW.restored(back.title));
    focusAfter.current = `ro-open-${back.id}`;
  }

  function onDayKey(change: KeyboardEvent<HTMLButtonElement>, at: number) {
    const by = change.key === 'ArrowRight' ? 1 : change.key === 'ArrowLeft' ? -1 : 0;
    if (by === 0) return;
    change.preventDefault();
    const next = DAYS[(at + by + DAYS.length) % DAYS.length] as string;
    setDay(next);
    setPicked(null);
    focusAfter.current = `ro-day-${next}`;
  }

  return (
    <div
      className={['desk-page ev-page gs mn sn ro', panel != null && 'is-form']
        .filter(Boolean)
        .join(' ')}
    >
      <div className="ev-wide mn-page">
        <div className="ev-crumb-row ro-chrome">
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
        <header className="gs-top ro-chrome ro-top">
          <div className="mn-head">
            <h1 className="gs-title">{`${RW.title} · ${dayWord}`}</h1>
            {line != null && <p className="mn-sub">{line}</p>}
          </div>
          {manage && (
            <button
              id="ro-add"
              type="button"
              className="gs-pill is-primary ro-add"
              onClick={openAdd}
            >
              <Glyph name="plus" size={17} weight={2.4} />
              {RW.addItem}
            </button>
          )}
        </header>
        <div className="sn-tabs ro-days ro-chrome" role="tablist" aria-label={RW.days}>
          {DAYS.map((one, at) => {
            const on = one === day;
            const count = itemsOn(items, one).length;
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
                <span className="ro-day-count">{RW.items(count)}</span>
              </button>
            );
          })}
        </div>
        {!manage && (
          <p className="mn-lock ro-chrome">
            <Glyph name="lock" size={16} weight={2.2} />
            {RW.lock}
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
        {failed === 'undo' && deleted != null && (
          <p id="ro-unsaid" className="ro-limit ro-unsaid ro-chrome" role="alert" tabIndex={-1}>
            <Broken />
            {RW.notRestored(deleted.title)}
          </p>
        )}
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
                <h2 id="ro-empty">{RW.empty}</h2>
                <p className="mn-sub">{RW.emptyLine}</p>
                {manage && <Pill label={RW.addItem} primary onClick={openAdd} />}
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
                {tables.map((table) => (
                  <PlaceTable
                    key={table.place}
                    place={table.place}
                    items={table.items}
                    day={day}
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
              items={items}
              form={form}
              editing={editing}
              errors={errors}
              reader={reader}
              limit={limit}
              conflict={conflict}
              asking={asking}
              failed={failed}
              onChange={(next) => setForm({ ...form, ...next })}
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
              onDelete={remove}
            />
          )}
        </div>
      </div>
      {deleted != null && failed !== 'undo' && (
        <Toast
          key={deleted.id}
          words={RW.deleted(deleted.title)}
          counted={{ said: RW.undoOpen }}
          onUndo={undo}
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
  return (
    <div className="ro-picker">
      <button
        id="ro-picker"
        type="button"
        className="ro-picker-pill"
        aria-label={RW.placePicker(shown)}
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
                <span className="ro-picker-count">{RW.items(counts[at] ?? 0)}</span>
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
  place,
  items,
  day,
  reader,
  manage,
  lit,
  shown,
  single,
  onOpen,
}: {
  place: string;
  items: readonly Item[];
  day: string;
  reader: Reader;
  manage: boolean;
  lit: string | null;
  shown: boolean;
  single: boolean;
  onOpen: (one: Item) => void;
}) {
  const id = `ro-place-${place.replace(/\W+/g, '-').toLowerCase()}`;

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
        <p className="mn-sub ro-place-count">{RW.items(items.length)}</p>
      </div>
      <table className="ro-table" aria-labelledby={id}>
        <thead>
          <tr>
            <th scope="col" className="ro-starts">
              {RW.starts}
            </th>
            <th scope="col" className="ro-wide ro-lasts">
              {RW.lasts}
            </th>
            <th scope="col">{RW.item}</th>
            <th scope="col" className="ro-wide ro-owner">
              {RW.owner}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((one) => (
            <tr key={one.id} className={lit === one.id ? 'is-lit' : undefined}>
              <td className="ro-starts">{startsCell(one, day, reader)}</td>
              <td className="ro-wide ro-lasts">{lastsCell(one)}</td>
              <td>
                <div className="ro-item">
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
                  <span className="ro-under">{underLine(one)}</span>
                  {(one.fixed || one.guests) && (
                    <span className="ro-pills">
                      {one.fixed && (
                        <span className="ro-pill">
                          <Glyph name="lock" size={13} weight={2.4} />
                          {RW.fixed}
                        </span>
                      )}
                      {one.guests && (
                        <span className="ro-pill">
                          <Glyph name="eye" size={13} weight={2.4} />
                          {RW.shown}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </td>
              <td className="ro-wide ro-owner">
                {one.owner == null ? (
                  <span className="ro-quiet">{RW.noOwner}</span>
                ) : (
                  <>
                    <span className="ro-owner-name">{one.owner}</span>
                    {one.role != null && <span className="ro-quiet">{one.role}</span>}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ItemPanel({
  items,
  form,
  editing,
  errors,
  reader,
  limit,
  conflict,
  asking,
  failed,
  onChange,
  onSave,
  onClose,
  onTheirs,
  onMine,
  onAsk,
  onKeep,
  onDelete,
}: {
  items: readonly Item[];
  form: Form;
  editing: Item | null;
  errors: Errors;
  reader: Reader;
  limit: boolean;
  conflict: Item | null;
  asking: boolean;
  failed: Failure | null;
  onChange: (next: Partial<Form>) => void;
  onSave: () => void;
  onClose: () => void;
  onTheirs: () => void;
  onMine: () => void;
  onAsk: () => void;
  onKeep: () => void;
  onDelete: () => void;
}) {
  const zone = zoneNamed(reader);
  const placeLine = placeHelp(items, form, editing);
  const formDay =
    form.date === '' ? null : dayOf(`${form.date}T${form.time === '' ? '12:00' : form.time}`);
  const dayPlaces = formDay == null ? [] : placesOn(items, formDay);
  const startsWrong = errors.date ?? errors.time ?? null;
  const ends = lastsHelp(form, reader);
  const title = editing == null && failed !== 'gone' ? RW.addItem : RW.editItem;

  return (
    <aside className="mn-panel ro-panel" aria-labelledby="ro-panel-title">
      <div className="mn-panel-top">
        <button type="button" className="desk-text ro-back" onClick={onClose}>
          <Glyph name="back" size={17} weight={2.4} />
          {RW.back}
        </button>
        <div className="mn-panel-names">
          <h2 id="ro-panel-title" tabIndex={-1}>
            {title}
          </h2>
        </div>
        <button
          type="button"
          className="ev-round mn-close ro-x"
          aria-label={RW.close}
          onClick={onClose}
        >
          <Glyph name="clear" size={16} weight={2.4} />
        </button>
      </div>
      <div className="mn-panel-body">
        {limit && (
          <div id="ro-limit" className="ro-limit" role="alert" tabIndex={-1}>
            <Broken />
            <p>{RW.limit}</p>
          </div>
        )}
        {(failed === 'save' || failed === 'delete') && (
          <div id="ro-failed" className="ro-limit" role="alert" tabIndex={-1}>
            <Broken />
            <p>{failed === 'save' ? RW.notSaved : RW.notDeleted}</p>
          </div>
        )}
        {failed === 'gone' && (
          <div id="ro-gone" className="sn-alert ro-gone" role="alert" tabIndex={-1}>
            <Glyph name="warn" size={18} weight={2.2} />
            <p>{RW.gone}</p>
          </div>
        )}
        {conflict != null && (
          <div id="ro-conflict" className="sn-alert ro-conflict" role="alert" tabIndex={-1}>
            <Glyph name="warn" size={18} weight={2.2} />
            <div>
              <p>{RW.conflict}</p>
              <table className="ro-diff">
                <thead>
                  <tr>
                    <th scope="col">{RW.field}</th>
                    <th scope="col">{RW.theirs}</th>
                    <th scope="col">{RW.yours}</th>
                  </tr>
                </thead>
                <tbody>
                  {differences(conflict, form, reader).map((row) => (
                    <tr key={row.field}>
                      <th scope="row">{row.field}</th>
                      <td>{row.theirs}</td>
                      <td>{row.yours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="ro-conflict-acts">
                <Pill label={RW.useTheirs} onClick={onTheirs} />
                <Pill label={RW.keepMine} onClick={onMine} />
              </div>
            </div>
          </div>
        )}
        <TextField
          id="ro-title"
          label={RW.titleLabel}
          value={form.title}
          error={errors.title}
          help={RW.count(form.title.trim().length, TITLE_MAX)}
          onChange={(title) => onChange({ title })}
        />
        <fieldset className="ro-starts-set">
          <legend className="desk-label gs-label">{RW.starts}</legend>
          <div className="ro-pair">
            <div className="desk-field">
              <label htmlFor="ro-date" className="desk-label ro-sublabel">
                {RW.date}
              </label>
              <div className={errors.date == null ? 'desk-box' : 'desk-box is-wrong'}>
                <input
                  id="ro-date"
                  type="date"
                  value={form.date}
                  min={EARLIEST.slice(0, 10)}
                  max={LATEST.slice(0, 10)}
                  aria-invalid={errors.date != null}
                  aria-describedby={startsWrong == null ? 'ro-starts-help' : 'ro-starts-error'}
                  onChange={(change) => onChange({ date: change.target.value })}
                />
              </div>
            </div>
            <div className="desk-field">
              <label htmlFor="ro-time" className="desk-label ro-sublabel">
                {RW.time}
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
          {startsWrong !== windowLine(reader) && (
            <p id="ro-starts-help" className="desk-help">
              {windowLine(reader)}
            </p>
          )}
          {startsWrong != null && <Wrong id="ro-starts-error">{startsWrong}</Wrong>}
          {zone != null && <p className="desk-help">{RW.zoneLine(zone)}</p>}
        </fieldset>
        <TextField
          id="ro-lasts"
          label={RW.lastsLabel}
          value={form.lasts}
          error={errors.lasts}
          help={ends ?? undefined}
          optional
          numeric
          onChange={(lasts) => onChange({ lasts })}
        />
        <div className="desk-field">
          <label htmlFor="ro-place" className="desk-label gs-label">
            {RW.place}
            <Optional />
          </label>
          <div className="desk-box">
            <input
              id="ro-place"
              type="text"
              value={form.place}
              placeholder={MAIN}
              autoComplete="off"
              aria-describedby={placeLine == null ? undefined : 'ro-place-help'}
              onChange={(change) => onChange({ place: change.target.value })}
            />
          </div>
          {dayPlaces.length > 0 && (
            <div className="ro-chips" role="group" aria-label="Places on this day">
              {dayPlaces.map((place) => {
                const on = (form.place.trim() === '' ? MAIN : form.place.trim()) === place;
                return (
                  <button
                    key={place}
                    type="button"
                    className={on ? 'gs-chip is-on' : 'gs-chip'}
                    aria-pressed={on}
                    onClick={() => onChange({ place: place === MAIN ? '' : place })}
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
          label={RW.ownerLabel}
          value={form.owner}
          error={errors.owner}
          optional
          onChange={(owner) => onChange({ owner })}
        />
        <TextField
          id="ro-role"
          label={RW.role}
          value={form.role}
          error={errors.role}
          optional
          onChange={(role) => onChange({ role })}
        />
        <div className="desk-field">
          <label htmlFor="ro-note" className="desk-label gs-label">
            {RW.note}
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
            {RW.noteHelp(form.note.length)}
          </p>
          {errors.note != null && <Wrong id="ro-note-error">{errors.note}</Wrong>}
        </div>
        <Switch
          id="ro-fixed"
          label={RW.fixed}
          line={RW.fixedLine}
          on={form.fixed}
          onChange={(fixed) => onChange({ fixed })}
        />
        <Switch
          id="ro-guests"
          label={RW.showToGuests}
          line={RW.guestsLine}
          on={form.guests}
          onChange={(guests) => onChange({ guests })}
        />
      </div>
      <div className="mn-panel-foot">
        {asking && editing != null ? (
          <div className="ro-ask">
            <p className="ro-ask-words">{RW.deleteAsk(editing.title)}</p>
            <div className="ro-ask-acts">
              <button id="ro-keep" type="button" className="desk-text" onClick={onKeep}>
                {RW.keepIt}
              </button>
              <button type="button" className="gs-pill is-secondary" onClick={onDelete}>
                {RW.deleteItem}
              </button>
            </div>
          </div>
        ) : (
          <div className="mn-panel-acts ro-acts">
            {editing != null && (
              <button
                id="ro-delete"
                type="button"
                className="gs-pill is-secondary ro-delete"
                onClick={onAsk}
              >
                {`${RW.deleteItem}…`}
              </button>
            )}
            <button type="button" className="desk-text ro-cancel" onClick={onClose}>
              {RW.cancel}
            </button>
            <button type="button" className="gs-pill is-primary ro-save" onClick={onSave}>
              {failed === 'gone' ? RW.addAgain : RW.save}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

const FAILED_IDS: Record<Failure, string> = {
  save: 'ro-failed',
  delete: 'ro-failed',
  undo: 'ro-unsaid',
  gone: 'ro-gone',
};

function Broken() {
  return (
    <span className="ro-ring" aria-hidden="true">
      <Glyph name="clear" size={14} weight={2.6} />
    </span>
  );
}

function Optional() {
  return <span className="gs-optional">{RW.optional}</span>;
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
      {error != null && <Wrong id={`${id}-error`}>{error}</Wrong>}
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
