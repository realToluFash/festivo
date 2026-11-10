import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import type { Tell } from '../components/SettingsParts.tsx';
import { DemoBell } from './DemoBell.tsx';
import { EventsShell } from './EventParts.tsx';
import { EventSidebar } from './EventSidebar.tsx';
import { type SampleEvent, sampleEvent } from './events.ts';
import { Pill } from './GuestsParts.tsx';
import { clockOfKitchen } from './kitchen.ts';
import { IconButton, Wrong } from './MenuServed.tsx';
import { keptInbox, waitingLine } from './messages.ts';
import {
  type Changed,
  type Panel,
  type Station,
  type Stations,
  type StationsStart,
  PASS,
  ROSTER,
  STATIONS_EVENT,
  SW,
  addPlace,
  checkName,
  dishedAt,
  itemsAt,
  labelOf,
  moveStop,
  noLeadLine,
  noStationLine,
  personById,
  placeMeta,
  placesOf,
  removeLine,
  removePlace,
  renamePlace,
  sectionsOf,
  setDishedAt,
  setLead,
  shiftOf,
  stationById,
  stationOf,
  stationsStart,
  toggle,
  dishesLine,
} from './stations.ts';
import { useSwitcherStart } from './switcher.ts';
import './guests.css';
import './menu.css';
import './stations.css';

/** /demo/events/evt-wed-4/staff (sc-3910): Stations on the event's Staff page at 1280 × 800, by ?state=. */
export function StationsPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const raw = params.get('state');
  useSwitcherStart();

  return <StationsAt key={`${id ?? ''}|${raw ?? ''}`} id={id} raw={raw} />;
}

function StationsAt({ id, raw }: { id: string | undefined; raw: string | null }) {
  const [event] = useState(() => sampleEvent(id));
  const [first] = useState(() => stationsStart(raw));

  if (event == null) return <Navigate to="/demo/events" replace />;
  if (event.id !== STATIONS_EVENT)
    return <Navigate to={`/demo/events/${event.id}?area=staff`} replace />;

  return (
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
      {(tell) => <StationsView first={first} event={event} tell={tell} />}
    </EventsShell>
  );
}

function StationsView({
  first,
  event,
  tell,
}: {
  first: StationsStart;
  event: SampleEvent;
  tell: Tell;
}) {
  const [state, setState] = useState<Stations>(first.state);
  const [panel, setPanel] = useState<Panel>(first.panel);
  const [said, setSaid] = useState(first.said);
  const [asking, setAsking] = useState<string | null>(first.asking);
  const [draft, setDraft] = useState(first.draft);
  const [pressed, setPressed] = useState(first.pressed);
  const [floorPick, setFloorPick] = useState(first.state.floor ?? '');
  const [removed, setRemoved] = useState(first.removed);
  const focusAfter = useRef<string | null>(null);
  const manage = first.manage;

  useEffect(() => {
    const id = first.scroll === 'dishes' ? 'sn-dishes' : first.scroll === 'walk' ? 'sn-walk' : null;
    if (id != null) document.getElementById(id)?.scrollIntoView?.({ block: 'start' });
    if (first.asking != null) document.getElementById(`sn-ask-${first.asking}`)?.focus();
    if (first.pressed)
      document.getElementById(first.panel?.kind === 'floor' ? 'sn-floor' : 'sn-name')?.focus();
  }, [first]);

  useEffect(() => {
    if (focusAfter.current == null) return;
    document.getElementById(focusAfter.current)?.focus();
    focusAfter.current = null;
  });

  function apply(changed: Changed) {
    setState(changed.state);
    setSaid(changed.said);
  }

  function open(next: Panel) {
    setAsking(null);
    setPressed(false);
    setPanel(next);
    if (next?.kind === 'name')
      setDraft(next.id == null ? '' : (stationById(state, next.id)?.name ?? ''));
    if (next?.kind === 'floor') setFloorPick(state.floor ?? '');
    focusAfter.current = 'sn-panel-title';
  }

  function close() {
    const back =
      panel?.kind === 'people'
        ? `sn-people-${panel.id}`
        : panel?.kind === 'floor'
          ? 'sn-floor-open'
          : panel?.kind === 'name' && panel.id != null
            ? `sn-rename-${panel.id}`
            : 'sn-add';
    setPanel(null);
    setPressed(false);
    focusAfter.current = back;
  }

  const nameError = panel?.kind === 'name' && pressed ? checkName(state, draft, panel.id) : null;
  const floorError = panel?.kind === 'floor' && pressed && floorPick === '' ? SW.chooseWho : null;

  function saveName() {
    if (panel?.kind !== 'name') return;
    if (checkName(state, draft, panel.id) != null) {
      setPressed(true);
      focusAfter.current = 'sn-name';
      return;
    }
    apply(panel.id == null ? addPlace(state, draft) : renamePlace(state, panel.id, draft));
    close();
  }

  function saveFloor() {
    if (floorPick === '') {
      setPressed(true);
      focusAfter.current = 'sn-floor';
      return;
    }
    setState({ ...state, floor: floorPick });
    setSaid(`${personById(floorPick).name} leads the floor.`);
    close();
  }

  function move(placeId: string, by: -1 | 1) {
    const changed = moveStop(state, placeId, by);
    if (changed == null) return;
    apply(changed);
    const at = changed.state.walk.indexOf(placeId);
    const last = changed.state.walk.length - 1;
    const side = by === -1 ? (at > 0 ? 'up' : 'down') : at < last ? 'down' : 'up';
    focusAfter.current = `sn-${side}-${placeId}`;
  }

  function remove(placeId: string) {
    apply(removePlace(state, placeId));
    setAsking(null);
    if (panel?.kind === 'people' && panel.id === placeId) setPanel(null);
    focusAfter.current = 'sn-add';
  }

  const places = placesOf(state);
  const sections = sectionsOf(state);
  const lit = panel?.kind === 'people' ? panel.id : panel?.kind === 'name' ? panel.id : null;

  return (
    <div className="desk-page ev-page gs mn st">
      <div className="ev-wide mn-page">
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
                <span className="ev-crumb-name">{SW.title}</span>
              </li>
            </ol>
          </nav>
          <DemoBell tell={tell} />
        </div>
        <header className="gs-top">
          <div className="mn-head">
            <h1 className="gs-title">{SW.title}</h1>
            <p className="mn-sub">{SW.sub}</p>
          </div>
        </header>
        <nav className="sn-tabs" aria-label={SW.title}>
          {SW.tabs.map((tab) =>
            tab === 'Stations' ? (
              <span key={tab} className="sn-tab" aria-current="page">
                {tab}
              </span>
            ) : (
              <button
                key={tab}
                type="button"
                className="sn-tab"
                onClick={() => tell(`${tab} has its own design (sc-3906, sc-3908, sc-101).`)}
              >
                {tab}
              </button>
            ),
          )}
        </nav>
        {!manage && (
          <p className="mn-lock">
            <Glyph name="lock" size={16} weight={2.2} />
            {SW.lock}
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
            {removed && (
              <div className="sn-alert" role="alert">
                <Glyph name="alert" size={18} weight={2.2} />
                <div>
                  <strong>{SW.removedTitle}</strong>
                  <p>
                    Chidi Okafor and Emeka Obi were on it and have no station now. The roster says
                    so beside their names.
                  </p>
                </div>
                <button type="button" className="desk-text" onClick={() => setRemoved(false)}>
                  Got it
                </button>
              </div>
            )}
            <FloorCard state={state} manage={manage} onOpen={() => open({ kind: 'floor' })} />
            <section className="sn-card" aria-labelledby="sn-places">
              <div className="sn-card-top">
                <div className="sn-card-names">
                  <h2 id="sn-places">{SW.places}</h2>
                  <p className="mn-sub">{SW.placesSub}</p>
                </div>
                {manage && (
                  <button
                    id="sn-add"
                    type="button"
                    className="desk-text"
                    onClick={() => open({ kind: 'name', id: null })}
                  >
                    <Glyph name="plus" size={17} weight={2.3} />
                    {SW.addPlace}
                  </button>
                )}
              </div>
              <ul className="sn-rows">
                {places.map((one) => (
                  <StationRow
                    key={one.id}
                    state={state}
                    station={one}
                    manage={manage}
                    lit={lit === one.id}
                    asking={asking === one.id}
                    onPeople={() => open({ kind: 'people', id: one.id })}
                    onRename={() => open({ kind: 'name', id: one.id })}
                    onAsk={() => {
                      setAsking(one.id);
                      focusAfter.current = `sn-ask-${one.id}`;
                    }}
                    onKeep={() => {
                      setAsking(null);
                      focusAfter.current = `sn-remove-${one.id}`;
                    }}
                    onRemove={() => remove(one.id)}
                  />
                ))}
              </ul>
              <p className="sn-foot">{SW.placesFoot}</p>
            </section>
            <section className="sn-card" aria-labelledby="sn-sections">
              <div className="sn-card-names">
                <h2 id="sn-sections">{SW.sections}</h2>
                <p className="mn-sub">{SW.sectionsSub}</p>
              </div>
              {sections.length === 0 ? (
                <p className="sn-empty">{SW.noSections}</p>
              ) : (
                <ul className="sn-rows">
                  {sections.map((one) => (
                    <StationRow
                      key={one.id}
                      state={state}
                      station={one}
                      manage={manage}
                      lit={lit === one.id}
                      asking={false}
                      onPeople={() => open({ kind: 'people', id: one.id })}
                    />
                  ))}
                </ul>
              )}
              <p className="sn-foot">{SW.sectionsFoot}</p>
            </section>
            <Dishes
              state={state}
              manage={manage}
              onPick={(courseId, item, placeId) =>
                apply(setDishedAt(state, courseId, item, placeId))
              }
            />
            <Walk state={state} manage={manage} onMove={move} />
            <section className="sn-card" aria-labelledby="sn-none">
              <h2 id="sn-none">{SW.noStation}</h2>
              <p className="sn-line">{noStationLine(state)}</p>
              <p className="sn-foot">{manage ? SW.unFoot : SW.lock}</p>
            </section>
          </div>
          {manage && panel != null && (
            <aside className="mn-panel" aria-labelledby="sn-panel-title">
              {panel.kind === 'people' && (
                <PeoplePanel
                  state={state}
                  station={stationById(state, panel.id) as Station}
                  onToggle={(personId) => apply(toggle(state, personId, panel.id))}
                  onLead={(personId) => apply(setLead(state, panel.id, personId))}
                  onClose={close}
                />
              )}
              {panel.kind === 'floor' && (
                <>
                  <PanelTop title={SW.floorLead} onClose={close} />
                  <div className="mn-panel-body">
                    <div className="desk-field">
                      <label htmlFor="sn-floor" className="desk-label">
                        {SW.whoLeads}
                      </label>
                      <Select
                        id="sn-floor"
                        value={floorPick}
                        shown={floorPick === '' ? SW.choosePerson : personById(floorPick).name}
                        wrong={floorError != null}
                        describedBy={
                          floorError != null ? 'sn-floor-error sn-floor-help' : 'sn-floor-help'
                        }
                        onChange={setFloorPick}
                        options={[
                          { value: '', label: SW.choosePerson },
                          ...ROSTER.map((one) => ({
                            value: one.id,
                            label: `${one.name} · ${one.job}`,
                          })),
                        ]}
                      />
                      {floorError != null && <Wrong id="sn-floor-error">{floorError}</Wrong>}
                      <p id="sn-floor-help" className="desk-help">
                        {SW.floorHelp}
                      </p>
                    </div>
                  </div>
                  <PanelFoot cta={SW.saveFloor} onSave={saveFloor} onCancel={close} />
                </>
              )}
              {panel.kind === 'name' && (
                <>
                  <PanelTop
                    title={
                      panel.id == null
                        ? SW.addPlace
                        : `Rename ${stationById(state, panel.id)?.name ?? ''}`
                    }
                    onClose={close}
                  />
                  <div className="mn-panel-body">
                    <div className="desk-field">
                      <label htmlFor="sn-name" className="desk-label">
                        {SW.name}
                      </label>
                      <div className={nameError == null ? 'desk-box' : 'desk-box is-wrong'}>
                        <input
                          id="sn-name"
                          type="text"
                          value={draft}
                          spellCheck={false}
                          aria-invalid={nameError != null}
                          aria-describedby={
                            nameError != null ? 'sn-name-error sn-name-help' : 'sn-name-help'
                          }
                          onChange={(change) => setDraft(change.target.value)}
                        />
                      </div>
                      {nameError != null && <Wrong id="sn-name-error">{nameError}</Wrong>}
                      <p id="sn-name-help" className="desk-help">
                        {SW.nameHelp}
                      </p>
                    </div>
                    <p className="mn-quiet">{panel.id == null ? SW.addNote : SW.renameNote}</p>
                  </div>
                  <PanelFoot
                    cta={panel.id == null ? SW.addCta : SW.saveName}
                    onSave={saveName}
                    onCancel={close}
                  />
                </>
              )}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

function FloorCard({
  state,
  manage,
  onOpen,
}: {
  state: Stations;
  manage: boolean;
  onOpen: () => void;
}) {
  const lead = state.floor == null ? null : personById(state.floor);

  return (
    <section className="sn-card sn-floor" aria-labelledby="sn-floor-title">
      <div className="sn-card-names">
        <h2 id="sn-floor-title" className="sn-eyebrow">
          {SW.floorLead}
        </h2>
        <p className="sn-floor-name">{lead == null ? SW.noFloorLead : lead.name}</p>
        <p className="mn-sub">
          {lead == null
            ? SW.noFloorMeta
            : `${lead.job} · ${shiftOf(lead)}. The lead for anyone whose station has none.`}
        </p>
      </div>
      {manage && (
        <Pill
          label={lead == null ? SW.chooseFloor : SW.change}
          primary={lead == null}
          onClick={onOpen}
        />
      )}
    </section>
  );
}

function StationRow({
  state,
  station,
  manage,
  lit,
  asking,
  onPeople,
  onRename,
  onAsk,
  onKeep,
  onRemove,
}: {
  state: Stations;
  station: Station;
  manage: boolean;
  lit: boolean;
  asking: boolean;
  onPeople: () => void;
  onRename?: () => void;
  onAsk?: () => void;
  onKeep?: () => void;
  onRemove?: () => void;
}) {
  const label = labelOf(station);
  const meta = placeMeta(state, station);
  const editable = station.kind === 'place' && station.id !== PASS;

  return (
    <li className={lit ? 'sn-row is-lit' : 'sn-row'}>
      <div className="sn-row-top">
        <div className="sn-row-names">
          <h3>
            {label}
            {station.id === PASS && <span className="sn-tag">Fixed</span>}
          </h3>
          {meta !== '' && <p className="mn-quiet">{meta}</p>}
        </div>
        {manage && (
          <div className="sn-acts">
            <button
              id={`sn-people-${station.id}`}
              type="button"
              className="sn-act"
              aria-label={`${SW.peopleAndLead} for ${label}`}
              onClick={onPeople}
            >
              {SW.peopleAndLead}
            </button>
            {editable && (
              <>
                <button
                  id={`sn-rename-${station.id}`}
                  type="button"
                  className="sn-act"
                  aria-label={`${SW.rename} ${station.name}`}
                  onClick={onRename}
                >
                  {SW.rename}
                </button>
                <button
                  id={`sn-remove-${station.id}`}
                  type="button"
                  className="sn-act"
                  aria-label={`Remove ${station.name}…`}
                  onClick={onAsk}
                >
                  {SW.remove}
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {station.people.length > 0 ? (
        <ul className="sn-people" aria-label={`People on ${label}`}>
          {station.people.map((id) => {
            const one = personById(id);

            return (
              <li key={id} className="sn-person">
                <span className="sn-person-name">{one.name}</span>
                <span className="sn-time">{shiftOf(one)}</span>
                {station.lead === id && <span className="sn-lead">{SW.lead}</span>}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="sn-nobody">
          <span className="sn-nobody-mark" aria-hidden="true" />
          Nobody on {station.kind === 'section' ? station.name : label}
        </p>
      )}
      {station.people.length > 0 && station.lead == null && (
        <p className="mn-quiet">{noLeadLine(state)}</p>
      )}
      {asking && (
        <div className="mn-ask">
          <p id={`sn-ask-${station.id}`} tabIndex={-1}>
            {removeLine(state, station.id)}
          </p>
          <div className="mn-ask-acts">
            <button type="button" className="desk-text" onClick={onKeep}>
              {SW.keepIt}
            </button>
            <Pill label={`Remove ${station.name}`} onClick={() => onRemove?.()} />
          </div>
        </div>
      )}
    </li>
  );
}

function Dishes({
  state,
  manage,
  onPick,
}: {
  state: Stations;
  manage: boolean;
  onPick: (courseId: string, item: string, placeId: string) => void;
}) {
  const places = placesOf(state);

  return (
    <section id="sn-dishes" className="sn-card" aria-labelledby="sn-dishes-title">
      <div className="sn-card-names">
        <h2 id="sn-dishes-title">{SW.dishes}</h2>
        <p className="mn-sub">{SW.dishesSub}</p>
      </div>
      {state.courses.length === 0 ? (
        <p className="sn-empty">{SW.noCourses}</p>
      ) : (
        state.courses.map((course, index) => (
          <div key={course.id} className="sn-course">
            <h3 id={`sn-course-${course.id}`}>
              <span className="sn-eyebrow">Course {index + 1}</span>
              {course.name}
            </h3>
            {course.items.length === 0 ? (
              <p className="sn-empty">{SW.noDishes}</p>
            ) : (
              <ul className="sn-items" aria-labelledby={`sn-course-${course.id}`}>
                {course.items.map((item, index) => {
                  const at = dishedAt(state, course.id, item);
                  const atName = stationById(state, at)?.name ?? '';

                  return (
                    <li key={item} className="sn-item">
                      <span className="sn-item-name" translate="no">
                        {item}
                      </span>
                      {manage ? (
                        <Select
                          id={`sn-at-${course.id}-${index}`}
                          value={at}
                          shown={atName}
                          label={`${SW.dishedAt}, ${item}, ${course.name}`}
                          dense
                          onChange={(placeId) => onPick(course.id, item, placeId)}
                          options={places.map((one) => ({ value: one.id, label: one.name }))}
                        />
                      ) : (
                        <span className="sn-at-text">
                          <span className="sn-at-label">{SW.dishedAt}</span>
                          {atName}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))
      )}
    </section>
  );
}

function Walk({
  state,
  manage,
  onMove,
}: {
  state: Stations;
  manage: boolean;
  onMove: (placeId: string, by: -1 | 1) => void;
}) {
  const last = state.walk.length - 1;

  return (
    <section id="sn-walk" className="sn-card" aria-labelledby="sn-walk-title">
      <div className="sn-card-names">
        <h2 id="sn-walk-title">{SW.walk}</h2>
        <p className="mn-sub">{SW.walkSub}</p>
      </div>
      {state.walk.length === 0 ? (
        <p className="sn-empty">{SW.walkEmpty}</p>
      ) : (
        <ol className="sn-walk" aria-labelledby="sn-walk-title">
          <li className="sn-stop">
            <span className="sn-stop-n" aria-hidden="true">
              1
            </span>
            <span className="sn-stop-names">
              <span className="sn-stop-name">Pass</span>
              <span className="mn-quiet">{SW.walkPass}</span>
            </span>
          </li>
          {state.walk.map((id, at) => {
            const name = stationById(state, id)?.name ?? '';

            return (
              <li key={id} className="sn-stop">
                <span className="sn-stop-n" aria-hidden="true">
                  {at + 2}
                </span>
                <span className="sn-stop-names">
                  <span className="sn-stop-name">{name}</span>
                  <span className="mn-quiet">{dishesLine(itemsAt(state, id))}</span>
                </span>
                {manage && (
                  <span className="sn-stop-acts">
                    {at > 0 ? (
                      <IconButton
                        id={`sn-up-${id}`}
                        glyph="chevup"
                        label={`${SW.moveUp}, ${name}`}
                        hint={SW.moveUp}
                        onClick={() => onMove(id, -1)}
                      />
                    ) : (
                      <span className="sn-stop-gap" />
                    )}
                    {at < last ? (
                      <IconButton
                        id={`sn-down-${id}`}
                        glyph="chevdown"
                        label={`${SW.moveDown}, ${name}`}
                        hint={SW.moveDown}
                        onClick={() => onMove(id, 1)}
                      />
                    ) : (
                      <span className="sn-stop-gap" />
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
      <p className="sn-foot">{SW.walkFoot}</p>
    </section>
  );
}

function PeoplePanel({
  state,
  station,
  onToggle,
  onLead,
  onClose,
}: {
  state: Stations;
  station: Station;
  onToggle: (personId: string) => void;
  onLead: (personId: string | null) => void;
  onClose: () => void;
}) {
  const label = labelOf(station);
  const lead = station.lead;

  return (
    <>
      <PanelTop
        title={label}
        eyebrow={station.kind === 'section' ? SW.sections : SW.places}
        onClose={onClose}
      />
      <div className="mn-panel-body">
        <div className="desk-field">
          <label htmlFor="sn-lead" className="desk-label">
            {SW.lead}
          </label>
          <Select
            id="sn-lead"
            value={lead ?? ''}
            shown={lead == null ? SW.noLead : personById(lead).name}
            describedBy="sn-lead-help"
            onChange={(value) => onLead(value === '' ? null : value)}
            options={[
              { value: '', label: SW.noLead },
              ...station.people.map((id) => ({ value: id, label: personById(id).name })),
            ]}
          />
          <p id="sn-lead-help" className="desk-help">
            {SW.leadHelp}
          </p>
        </div>
        <ul className="sn-roster" aria-label={SW.rosterLabel}>
          {ROSTER.map((one) => {
            const at = stationOf(state, one.id);
            const here = at?.id === station.id;
            const where = here ? `On ${label}` : at == null ? SW.noStation : `On ${labelOf(at)}`;
            const cta = here ? 'Take off' : at == null ? 'Put on' : 'Move here';
            const aria = here
              ? `Take ${one.name} off ${label}`
              : at == null
                ? `Put ${one.name} on ${label}`
                : `Move ${one.name} from ${labelOf(at)} to ${label}`;

            return (
              <li key={one.id} className="sn-roster-row">
                <span className="sn-roster-names">
                  <span className="sn-person-name">{one.name}</span>
                  <span className={here ? 'mn-quiet is-here' : 'mn-quiet'}>
                    {`${one.job} · ${shiftOf(one)} · ${where}`}
                  </span>
                </span>
                <button
                  type="button"
                  className="sn-act"
                  aria-label={aria}
                  onClick={() => onToggle(one.id)}
                >
                  {cta}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mn-quiet">{SW.peopleFoot}</p>
      </div>
      <div className="mn-panel-foot">
        <div className="mn-panel-acts">
          <Pill label={SW.done} primary onClick={onClose} />
        </div>
      </div>
    </>
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
  return (
    <div className="mn-panel-top">
      <div className="mn-panel-names">
        {eyebrow != null && <p className="mn-eyebrow">{eyebrow}</p>}
        <h2 id="sn-panel-title" tabIndex={-1}>
          {title}
        </h2>
      </div>
      <button type="button" className="ev-round mn-close" aria-label={SW.close} onClick={onClose}>
        <Glyph name="clear" size={16} weight={2.4} />
      </button>
    </div>
  );
}

function PanelFoot({
  cta,
  onSave,
  onCancel,
}: {
  cta: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mn-panel-foot">
      <div className="mn-panel-acts">
        <button type="button" className="desk-text" onClick={onCancel}>
          {SW.cancel}
        </button>
        <Pill label={cta} primary onClick={onSave} />
      </div>
    </div>
  );
}

function Select({
  id,
  value,
  shown,
  options,
  label,
  describedBy,
  wrong = false,
  dense = false,
  onChange,
}: {
  id: string;
  value: string;
  shown: string;
  options: readonly { value: string; label: string }[];
  label?: string;
  describedBy?: string;
  wrong?: boolean;
  dense?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className={['desk-box gs-select sn-select', dense && 'is-dense', wrong && 'is-wrong']
        .filter(Boolean)
        .join(' ')}
    >
      <span aria-hidden="true">{shown}</span>
      <Glyph name="chevdown" size={15} weight={2.4} />
      <select
        id={id}
        value={value}
        aria-label={label}
        aria-invalid={wrong || undefined}
        aria-describedby={describedBy}
        onChange={(change) => onChange(change.target.value)}
      >
        {options.map((one) => (
          <option key={one.value} value={one.value}>
            {one.label}
          </option>
        ))}
      </select>
    </div>
  );
}
