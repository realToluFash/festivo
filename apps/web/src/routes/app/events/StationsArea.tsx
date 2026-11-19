import {
  ApiError,
  type OrganisationEvent,
  STATION_NAME_MAXIMUM,
  type StaffEntry,
  type StaffPlan,
  type StationCourse,
  type StationKind,
  asStaffPlan,
  realtimeTopic,
} from '@soirely/api-client';
import { holdingName, listFormat } from '@soirely/domain';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';
import { keptKeys, keptLoad, useAnsweredAgain, useKeptAsShown } from '../../../tabKept.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { HintButton } from '../../../components/HintButton.tsx';
import { Skeleton } from '../../../components/Skeleton.tsx';
import { dateLocale } from '../../../i18n/index.ts';
import { pageTitle, usePageTitle } from '../../../pageTitle.ts';
import { canOn } from '../../../session.ts';
import { useDeskTop } from '../../../deskTop.ts';
import { FieldWrong } from './GuestFields.tsx';
import { StaffTabs } from './StaffTabs.tsx';
import { stationLabel } from './stationWords.ts';
import { rangeWords, staffTimes } from './staffTimes.ts';
import { useHubTopics } from './useHubTopics.ts';
import '../../../components/SettingsParts.css';
import '../../../components/eventsDesk.css';
import '../../../components/eventPage.css';
import './guests.css';
import '../menu/menuLibrary.css';
import './roster.css';
import './jobsShifts.css';
import './stations.css';

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; plan: StaffPlan };

type Panel =
  { kind: 'people'; id: string } | { kind: 'floor' } | { kind: 'name'; id: string | null } | null;

interface Station {
  id: string;
  name: string;
  kind: StationKind;
  tables: number;
  pass: boolean;
  people: string[];
  lead: string | null;
  dishes: number;
}

function stationsOf(plan: StaffPlan): Station[] {
  return [
    ...plan.stations.places.map((one) => ({ ...one, kind: 'place' as const, tables: 0 })),
    ...plan.stations.sections.map((one) => ({
      ...one,
      kind: 'section' as const,
      pass: false,
      dishes: 0,
    })),
  ];
}

/** /app/events/:id/staff/stations (sc-3910): Stations on the event's Staff page, as its demo draws it at a desk. */
export function StationsArea({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();
  const desk = useDeskTop();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const answeredAgain = useAnsweredAgain();

  usePageTitle(pageTitle(t, [t('stations.tab'), event.name]));

  useEffect(() => {
    let current = true;

    keptLoad(keptKeys.staff(event.id), api.staffPlan(event.id)).then(
      (plan) => current && setLoad({ kind: 'loaded', plan }),
      () => current && setLoad((was) => (was.kind === 'loaded' ? was : { kind: 'failed' })),
    );

    return () => {
      current = false;
    };
  }, [event.id, attempt, answeredAgain]);
  useKeptAsShown(keptKeys.staff(event.id), load.kind === 'loaded' ? load.plan : null);

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
    <div className="desk ev desk-page ev-page gs mn sn rs">
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
        <StaffTabs on="stations" eventId={event.id} />
        {load.kind === 'loading' && (
          <Skeleton words={t('stations.loading')} shape="rows" rowHeight={56} />
        )}
        {load.kind === 'failed' && (
          <div className="sn-card" role="alert">
            <p className="mn-failed">
              <Glyph name="alert" size={17} weight={2.2} />
              {t('stations.failed')}
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
                {t('stations.tryAgain')}
              </button>
            </div>
          </div>
        )}
        {load.kind === 'loaded' && (
          <Stations
            event={event}
            plan={load.plan}
            onPlan={(plan) => setLoad({ kind: 'loaded', plan })}
          />
        )}
      </div>
    </div>
  );
}

function Stations({
  event,
  plan,
  onPlan,
}: {
  event: OrganisationEvent;
  plan: StaffPlan;
  onPlan: (plan: StaffPlan) => void;
}) {
  const { t, i18n } = useTranslation();
  const manage = canOn(event, 'staff.manage');
  const times = staffTimes(event, plan.shifts, dateLocale());
  const [panel, setPanel] = useState<Panel>(null);
  const [said, setSaid] = useState('');
  const [asking, setAsking] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [pressed, setPressed] = useState(false);
  const [serverName, setServerName] = useState<string | null>(null);
  const [floorPick, setFloorPick] = useState('');
  const [dismissed, setDismissed] = useState<readonly string[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const focusAfter = useRef<string | null>(null);

  useEffect(() => {
    if (focusAfter.current == null) return;
    document.getElementById(focusAfter.current)?.focus();
    focusAfter.current = null;
  });

  const { places, sections, floorLead, courses, walk } = plan.stations;
  const stations = stationsOf(plan);
  const stationById = (id: string) => stations.find((one) => one.id === id);
  const personById = (id: string) => plan.staff.find((one) => one.id === id);
  const nameOf = (id: string) => personById(id)?.fullName ?? '';
  const labelOf = (station: Station) => stationLabel(station, t);
  const stationOf = (personId: string) => stations.find((one) => one.people.includes(personId));
  const jobOf = (entry: StaffEntry) => entry.job?.name ?? t('roster.noJob');
  const shiftOf = (entry: StaffEntry) => {
    const first = entry.shifts[0];

    return first == null ? t('roster.noShift') : rangeWords(first.startsAt, first.endsAt, times, t);
  };
  const floor = floorLead == null ? null : (personById(floorLead) ?? null);

  async function write(change: () => Promise<StaffPlan>): Promise<StaffPlan | null> {
    if (busy) return null;
    setBusy(true);
    setFailed(null);
    try {
      const next = await change();
      onPlan(next);

      return next;
    } catch (error) {
      if (error instanceof ApiError && error.code === 'validation_failed') throw error;
      setFailed(t('stations.notSaved'));
      focusAfter.current = 'sn-failed';

      return null;
    } finally {
      setBusy(false);
    }
  }

  function open(next: Panel) {
    setAsking(null);
    setPressed(false);
    setServerName(null);
    setFailed(null);
    setPanel(next);
    if (next?.kind === 'name') setDraft(next.id == null ? '' : (stationById(next.id)?.name ?? ''));
    if (next?.kind === 'floor') setFloorPick(floorLead ?? '');
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
    setServerName(null);
    focusAfter.current = back;
  }

  function nameProblem(raw: string, except: string | null): string | null {
    const name = raw.trim();
    if (name === '') return t('stations.blank');
    if ([...name].length > STATION_NAME_MAXIMUM)
      return t('stations.tooLong', { max: STATION_NAME_MAXIMUM });
    const section = holdingName(sections, name, null);
    if (section != null) return t('stations.takenSection', { name: section.name });
    const place = holdingName(places, name, except);

    return place == null ? null : t('stations.takenPlace', { name: place.name });
  }

  const nameError =
    panel?.kind === 'name' && pressed ? (serverName ?? nameProblem(draft, panel.id)) : null;
  const floorError = panel?.kind === 'floor' && pressed && floorPick === '';

  async function saveName() {
    if (panel?.kind !== 'name') return;
    if (nameProblem(draft, panel.id) != null) {
      setPressed(true);
      focusAfter.current = 'sn-name';
      return;
    }
    const name = draft.trim();
    const placeId = panel.id;
    try {
      const next = await write(() =>
        placeId == null
          ? api.addStationPlace(event.id, name)
          : api.renameStationPlace(event.id, placeId, name),
      );
      if (next == null) return;
      setSaid(
        placeId == null ? t('stations.saidAdded', { name }) : t('stations.saidRenamed', { name }),
      );
      close();
    } catch (error) {
      setServerName(
        (error as ApiError).fieldErrors().name ?? (error as ApiError).problem.detail ?? null,
      );
      setPressed(true);
      focusAfter.current = 'sn-name';
    }
  }

  async function saveFloor() {
    if (floorPick === '') {
      setPressed(true);
      focusAfter.current = 'sn-floor';
      return;
    }
    const pick = floorPick;
    const next = await sent(() => api.setFloorLead(event.id, pick));
    if (next == null) return;
    setSaid(t('stations.saidFloor', { name: nameOf(pick) }));
    close();
  }

  async function sent(change: () => Promise<StaffPlan>): Promise<StaffPlan | null> {
    try {
      return await write(change);
    } catch {
      setFailed(t('stations.notSaved'));
      focusAfter.current = 'sn-failed';

      return null;
    }
  }

  async function pick(course: StationCourse, item: string, placeId: string) {
    const before = course.items.find((one) => one.name === item)?.dishedAt ?? null;
    const next = await sent(() => api.setDishedAt(event.id, course.id, item, placeId));
    if (next == null) return;
    const after = next.stations.walk;
    const placeName = (id: string) => next.stations.places.find((one) => one.id === id)?.name ?? '';
    const name = placeName(placeId);
    const lines = [t('stations.saidDished', { item, name })];
    if (!walk.includes(placeId) && after.includes(placeId))
      lines.push(t('stations.saidJoins', { name, stop: after.indexOf(placeId) + 2 }));
    if (before != null && walk.includes(before) && !after.includes(before))
      lines.push(t('stations.saidLeaves', { name: placeName(before) }));
    setSaid(lines.join(' '));
  }

  async function move(placeId: string, by: -1 | 1) {
    const at = walk.indexOf(placeId);
    const to = at + by;
    if (at < 0 || to < 0 || to >= walk.length) return;
    const order = walk.slice();
    order.splice(at, 1);
    order.splice(to, 0, placeId);
    const next = await sent(() => api.setWalkingOrder(event.id, order));
    if (next == null) return;
    const after = next.stations.walk;
    const now = after.indexOf(placeId);
    const name = next.stations.places.find((one) => one.id === placeId)?.name ?? '';
    setSaid(t('stations.saidMoved', { name, stop: now + 2, count: after.length + 1 }));
    const last = after.length - 1;
    const side = by === -1 ? (now > 0 ? 'up' : 'down') : now < last ? 'down' : 'up';
    focusAfter.current = `sn-${side}-${placeId}`;
  }

  async function remove(place: Station) {
    const people = place.people.length;
    const next = await sent(() => api.removeStationPlace(event.id, place.id));
    if (next == null) return;
    const lines = [t('stations.saidRemoved', { name: place.name })];
    if (people > 0) lines.push(t('stations.saidNoStationNow', { count: people }));
    setSaid(lines.join(' '));
    setAsking(null);
    if (panel?.kind === 'people' && panel.id === place.id) setPanel(null);
    focusAfter.current = 'sn-add';
  }

  async function toggle(personId: string, station: Station) {
    const name = nameOf(personId);
    const from = stationOf(personId);
    const off = from?.id === station.id;
    const wasLead = from?.lead === personId;
    const next = await sent(() => api.putOnStation(event.id, personId, off ? null : station.id));
    if (next == null) return;
    const to = labelOf(station);
    if (off)
      setSaid(
        wasLead
          ? t('stations.saidOffLead', { name, station: to })
          : t('stations.saidOff', { name }),
      );
    else if (from == null) setSaid(t('stations.saidOn', { name, station: to }));
    else
      setSaid(
        t(wasLead ? 'stations.saidFromLead' : 'stations.saidFrom', {
          name,
          from: labelOf(from),
          to,
        }),
      );
  }

  async function lead(station: Station, personId: string | null) {
    const next = await sent(() => api.setStationLead(event.id, station.id, personId));
    if (next == null) return;
    const label = labelOf(station);
    setSaid(
      personId == null
        ? t('stations.saidNoLead', { station: label })
        : t('stations.saidLead', { name: nameOf(personId), station: label }),
    );
  }

  const removedSections = new Map<string, string[]>();
  for (const entry of plan.staff) {
    if (entry.stationRemoved == null || dismissed.includes(entry.stationRemoved)) continue;
    removedSections.set(entry.stationRemoved, [
      ...(removedSections.get(entry.stationRemoved) ?? []),
      entry.fullName,
    ]);
  }
  const names = (list: readonly string[]) =>
    listFormat(i18n.language, { type: 'conjunction' }).format(list);
  const unstationed = plan.staff.filter((one) => stationOf(one.id) == null);
  const peopleStation = panel?.kind === 'people' ? stationById(panel.id) : undefined;
  const lit =
    panel?.kind === 'people' ? panel.id : panel?.kind === 'name' ? (panel.id ?? null) : null;

  function metaOf(station: Station): string {
    const people =
      station.people.length > 0 ? t('stations.people', { count: station.people.length }) : null;
    const dishes =
      station.kind === 'place' && station.dishes > 0
        ? t('stations.dishesItems', { count: station.dishes })
        : null;
    if (people != null && dishes != null) return t('stations.meta', { people, dishes });

    return people ?? dishes ?? '';
  }

  function askLine(place: Station): string {
    const people = place.people.length;
    const items = place.dishes;
    const lose = t('stations.loseStation', { count: people });
    const go = t('stations.goToPass', { count: items });
    if (people > 0 && items > 0) return t('stations.removeAskBoth', { name: place.name, lose, go });
    if (people > 0) return t('stations.removeAskPeople', { name: place.name, lose });
    if (items > 0) return t('stations.removeAskItems', { name: place.name, go });

    return t('stations.removeAsk', { name: place.name });
  }

  function row(station: Station) {
    const label = labelOf(station);
    const meta = metaOf(station);
    const editable = station.kind === 'place' && !station.pass;
    const placeAsking = asking === station.id;

    return (
      <li key={station.id} className={lit === station.id ? 'sn-row is-lit' : 'sn-row'}>
        <div className="sn-row-top">
          <div className="sn-row-names">
            <h3>
              {label}
              {station.pass && <span className="sn-tag">{t('stations.fixed')}</span>}
            </h3>
            {meta !== '' && <p className="mn-quiet">{meta}</p>}
          </div>
          {manage && (
            <div className="sn-acts">
              <button
                id={`sn-people-${station.id}`}
                type="button"
                className="sn-act"
                aria-label={t('stations.peopleAndLeadFor', { name: label })}
                onClick={() => open({ kind: 'people', id: station.id })}
              >
                {t('stations.peopleAndLead')}
              </button>
              {editable && (
                <>
                  <button
                    id={`sn-rename-${station.id}`}
                    type="button"
                    className="sn-act"
                    aria-label={t('stations.renameName', { name: station.name })}
                    onClick={() => open({ kind: 'name', id: station.id })}
                  >
                    {t('stations.rename')}
                  </button>
                  <button
                    id={`sn-remove-${station.id}`}
                    type="button"
                    className="sn-act"
                    aria-label={t('stations.removeName', { name: station.name })}
                    onClick={() => {
                      setAsking(station.id);
                      focusAfter.current = `sn-ask-${station.id}`;
                    }}
                  >
                    {t('stations.remove')}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        {station.people.length > 0 ? (
          <ul className="sn-people" aria-label={t('stations.peopleOn', { name: label })}>
            {station.people.map((id) => {
              const one = personById(id);

              return (
                <li key={id} className="sn-person">
                  <span className="sn-person-name">{one?.fullName ?? ''}</span>
                  {one != null && <span className="sn-time">{shiftOf(one)}</span>}
                  {station.lead === id && <span className="sn-lead">{t('stations.lead')}</span>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="sn-nobody">
            <span className="sn-nobody-mark" aria-hidden="true" />
            {t('stations.nobodyOn', { name: station.name })}
          </p>
        )}
        {station.people.length > 0 && station.lead == null && (
          <p className="mn-quiet">
            {floor == null
              ? t('stations.noLeadNoFloor')
              : t('stations.noLeadFloor', { name: floor.fullName })}
          </p>
        )}
        {manage && placeAsking && (
          <div className="mn-ask">
            <p id={`sn-ask-${station.id}`} tabIndex={-1}>
              {askLine(station)}
            </p>
            <div className="mn-ask-acts">
              <button
                type="button"
                className="desk-text"
                onClick={() => {
                  setAsking(null);
                  focusAfter.current = `sn-remove-${station.id}`;
                }}
              >
                {t('stations.keepIt')}
              </button>
              <button
                type="button"
                className="gs-pill is-secondary"
                aria-busy={busy || undefined}
                onClick={() => void remove(station)}
              >
                {t('stations.removeCta', { name: station.name })}
              </button>
            </div>
          </div>
        )}
      </li>
    );
  }

  const passName = places.find((one) => one.pass)?.name ?? '';

  return (
    <>
      {!manage && (
        <p className="mn-lock">
          <Glyph name="lock" size={16} weight={2.2} />
          {t('stations.lock')}
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
      {failed != null && (
        <p id="sn-failed" className="mn-failed" role="alert" tabIndex={-1}>
          <Glyph name="alert" size={17} weight={2.2} />
          {failed}
        </p>
      )}
      <div className="mn-split">
        <div className="mn-list">
          {[...removedSections].map(([section, people]) => (
            <div key={section} className="sn-alert" role="alert">
              <Glyph name="alert" size={18} weight={2.2} />
              <div>
                <strong>{t('stations.removedTitle', { name: section })}</strong>
                <p>{t('stations.removedBody', { names: names(people), count: people.length })}</p>
              </div>
              <button
                type="button"
                className="desk-text"
                onClick={() => setDismissed((was) => [...was, section])}
              >
                {t('stations.gotIt')}
              </button>
            </div>
          ))}
          <section className="sn-card sn-floor" aria-labelledby="sn-floor-title">
            <div className="sn-card-names">
              <h2 id="sn-floor-title" className="sn-eyebrow">
                {t('stations.floorLead')}
              </h2>
              <p className="sn-floor-name">{floor?.fullName ?? t('stations.noFloorLead')}</p>
              <p className="mn-sub">
                {floor == null
                  ? t('stations.noFloorMeta')
                  : t('stations.floorMeta', { job: jobOf(floor), shift: shiftOf(floor) })}
              </p>
            </div>
            {manage && (
              <button
                id="sn-floor-open"
                type="button"
                className={floor == null ? 'gs-pill is-primary' : 'gs-pill is-secondary'}
                onClick={() => open({ kind: 'floor' })}
              >
                {floor == null ? t('stations.chooseFloor') : t('stations.change')}
              </button>
            )}
          </section>
          <section className="sn-card" aria-labelledby="sn-places">
            <div className="sn-card-top">
              <div className="sn-card-names">
                <h2 id="sn-places">{t('stations.places')}</h2>
                <p className="mn-sub">{t('stations.placesSub')}</p>
              </div>
              {manage && (
                <button
                  id="sn-add"
                  type="button"
                  className="desk-text"
                  onClick={() => open({ kind: 'name', id: null })}
                >
                  <Glyph name="plus" size={17} weight={2.3} />
                  {t('stations.addPlace')}
                </button>
              )}
            </div>
            <ul className="sn-rows">
              {stations.filter((one) => one.kind === 'place').map((one) => row(one))}
            </ul>
            <p className="sn-foot">{t('stations.placesFoot')}</p>
          </section>
          <section className="sn-card" aria-labelledby="sn-sections">
            <div className="sn-card-names">
              <h2 id="sn-sections">{t('stations.sections')}</h2>
              <p className="mn-sub">{t('stations.sectionsSub')}</p>
            </div>
            {sections.length === 0 ? (
              <p className="sn-empty">{t('stations.noSections')}</p>
            ) : (
              <ul className="sn-rows">
                {stations.filter((one) => one.kind === 'section').map((one) => row(one))}
              </ul>
            )}
            <p className="sn-foot">{t('stations.sectionsFoot')}</p>
          </section>
          <section id="sn-dishes" className="sn-card" aria-labelledby="sn-dishes-title">
            <div className="sn-card-names">
              <h2 id="sn-dishes-title">{t('stations.dishes')}</h2>
              <p className="mn-sub">{t('stations.dishesSub')}</p>
            </div>
            {courses.length === 0 ? (
              <p className="sn-empty">{t('stations.noCourses')}</p>
            ) : (
              courses.map((course, index) => (
                <div key={course.id} className="sn-course">
                  <h3 id={`sn-course-${course.id}`}>
                    <span className="sn-eyebrow">
                      {t('stations.course', { number: index + 1 })}
                    </span>
                    {course.name}
                  </h3>
                  {course.items.length === 0 ? (
                    <p className="sn-empty">{t('stations.noDishes')}</p>
                  ) : (
                    <ul className="sn-items" aria-labelledby={`sn-course-${course.id}`}>
                      {course.items.map((item, at) => {
                        const atName =
                          places.find((one) => one.id === item.dishedAt)?.name ?? passName;

                        return (
                          <li key={item.name} className="sn-item">
                            <span className="sn-item-name" translate="no">
                              {item.name}
                            </span>
                            {manage ? (
                              <StationSelect
                                id={`sn-at-${course.id}-${at}`}
                                value={item.dishedAt}
                                shown={atName}
                                label={t('stations.dishedAtLabel', {
                                  item: item.name,
                                  course: course.name,
                                })}
                                dense
                                onChange={(placeId) => void pick(course, item.name, placeId)}
                                options={places.map((one) => ({ value: one.id, label: one.name }))}
                              />
                            ) : (
                              <span className="sn-at-text">
                                <span className="sn-at-label">{t('stations.dishedAt')}</span>
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
          <section id="sn-walk" className="sn-card" aria-labelledby="sn-walk-title">
            <div className="sn-card-names">
              <h2 id="sn-walk-title">{t('stations.walk')}</h2>
              <p className="mn-sub">{t('stations.walkSub')}</p>
            </div>
            {walk.length === 0 ? (
              <p className="sn-empty">{t('stations.walkEmpty')}</p>
            ) : (
              <ol className="sn-walk" aria-labelledby="sn-walk-title">
                <li className="sn-stop">
                  <span className="sn-stop-n" aria-hidden="true">
                    1
                  </span>
                  <span className="sn-stop-names">
                    <span className="sn-stop-name">{passName}</span>
                    <span className="mn-quiet">{t('stations.walkPass')}</span>
                  </span>
                </li>
                {walk.map((id, at) => {
                  const place = places.find((one) => one.id === id);
                  const name = place?.name ?? '';
                  const dishes = place?.dishes ?? 0;

                  return (
                    <li key={id} className="sn-stop">
                      <span className="sn-stop-n" aria-hidden="true">
                        {at + 2}
                      </span>
                      <span className="sn-stop-names">
                        <span className="sn-stop-name">{name}</span>
                        <span className="mn-quiet">
                          {dishes > 0 ? t('stations.dishesItems', { count: dishes }) : null}
                        </span>
                      </span>
                      {manage && (
                        <span className="sn-stop-acts">
                          {at > 0 ? (
                            <HintButton
                              id={`sn-up-${id}`}
                              label={t('stations.moveUpName', { name })}
                              hint={t('stations.moveUp')}
                              onClick={() => void move(id, -1)}
                            >
                              <Glyph name="chevup" size={18} weight={2.3} />
                            </HintButton>
                          ) : (
                            <span className="sn-stop-gap" />
                          )}
                          {at < walk.length - 1 ? (
                            <HintButton
                              id={`sn-down-${id}`}
                              label={t('stations.moveDownName', { name })}
                              hint={t('stations.moveDown')}
                              onClick={() => void move(id, 1)}
                            >
                              <Glyph name="chevdown" size={18} weight={2.3} />
                            </HintButton>
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
            <p className="sn-foot">{t('stations.walkFoot')}</p>
          </section>
          <section className="sn-card" aria-labelledby="sn-none">
            <h2 id="sn-none">{t('stations.noStation')}</h2>
            <p className="sn-line">
              {unstationed.length === 0
                ? t('stations.everyone')
                : t('stations.noStationLine', {
                    count: unstationed.length,
                    names: names(unstationed.map((one) => one.fullName)),
                  })}
            </p>
            <p className="sn-foot">{manage ? t('stations.unFoot') : t('stations.lock')}</p>
          </section>
        </div>
        {manage && panel != null && (panel.kind !== 'people' || peopleStation != null) && (
          <aside className="mn-panel" aria-labelledby="sn-panel-title">
            {panel.kind === 'people' && peopleStation != null && (
              <>
                <PanelTop
                  title={labelOf(peopleStation)}
                  eyebrow={
                    peopleStation.kind === 'section' ? t('stations.sections') : t('stations.places')
                  }
                  onClose={close}
                />
                <div className="mn-panel-body">
                  <div className="desk-field">
                    <label htmlFor="sn-lead" className="desk-label">
                      {t('stations.lead')}
                    </label>
                    <StationSelect
                      id="sn-lead"
                      value={peopleStation.lead ?? ''}
                      shown={
                        peopleStation.lead == null
                          ? t('stations.noLead')
                          : nameOf(peopleStation.lead)
                      }
                      describedBy="sn-lead-help"
                      onChange={(value) => void lead(peopleStation, value === '' ? null : value)}
                      options={[
                        { value: '', label: t('stations.noLead') },
                        ...peopleStation.people.map((id) => ({ value: id, label: nameOf(id) })),
                      ]}
                    />
                    <p id="sn-lead-help" className="desk-help">
                      {t('stations.leadHelp')}
                    </p>
                  </div>
                  <ul className="sn-roster" aria-label={t('stations.rosterLabel')}>
                    {plan.staff.map((one) => {
                      const label = labelOf(peopleStation);
                      const at = stationOf(one.id);
                      const here = at?.id === peopleStation.id;
                      const where =
                        at == null
                          ? t('stations.noStation')
                          : t('stations.onStation', { name: labelOf(at) });
                      const cta = here
                        ? t('stations.takeOff')
                        : at == null
                          ? t('stations.putOn')
                          : t('stations.moveHere');
                      const aria = here
                        ? t('stations.takeOffName', { name: one.fullName, station: label })
                        : at == null
                          ? t('stations.putOnName', { name: one.fullName, station: label })
                          : t('stations.moveHereName', {
                              name: one.fullName,
                              from: labelOf(at),
                              to: label,
                            });

                      return (
                        <li key={one.id} className="sn-roster-row">
                          <span className="sn-roster-names">
                            <span className="sn-person-name">{one.fullName}</span>
                            <span className={here ? 'mn-quiet is-here' : 'mn-quiet'}>
                              {t('stations.personMeta', {
                                job: jobOf(one),
                                shift: shiftOf(one),
                                where,
                              })}
                            </span>
                          </span>
                          <button
                            type="button"
                            className="sn-act"
                            aria-label={aria}
                            aria-busy={busy || undefined}
                            onClick={() => void toggle(one.id, peopleStation)}
                          >
                            {cta}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mn-quiet">{t('stations.peopleFoot')}</p>
                </div>
                <div className="mn-panel-foot">
                  <div className="mn-panel-acts">
                    <button type="button" className="gs-pill is-primary" onClick={close}>
                      {t('stations.done')}
                    </button>
                  </div>
                </div>
              </>
            )}
            {panel.kind === 'floor' && (
              <>
                <PanelTop title={t('stations.floorLead')} onClose={close} />
                <div className="mn-panel-body">
                  <div className="desk-field">
                    <label htmlFor="sn-floor" className="desk-label">
                      {t('stations.whoLeads')}
                    </label>
                    <StationSelect
                      id="sn-floor"
                      value={floorPick}
                      shown={floorPick === '' ? t('stations.choosePerson') : nameOf(floorPick)}
                      wrong={floorError}
                      describedBy={floorError ? 'sn-floor-error sn-floor-help' : 'sn-floor-help'}
                      onChange={setFloorPick}
                      options={[
                        { value: '', label: t('stations.choosePerson') },
                        ...plan.staff.map((one) => ({
                          value: one.id,
                          label:
                            one.job == null
                              ? one.fullName
                              : t('stations.floorOption', {
                                  name: one.fullName,
                                  job: one.job.name,
                                }),
                        })),
                      ]}
                    />
                    {floorError && (
                      <FieldWrong id="sn-floor-error">{t('stations.chooseWho')}</FieldWrong>
                    )}
                    <p id="sn-floor-help" className="desk-help">
                      {t('stations.floorHelp')}
                    </p>
                  </div>
                </div>
                <PanelFoot
                  cta={t('stations.saveFloor')}
                  busy={busy}
                  onSave={() => void saveFloor()}
                  onCancel={close}
                />
              </>
            )}
            {panel.kind === 'name' && (
              <>
                <PanelTop
                  title={
                    panel.id == null
                      ? t('stations.addPlace')
                      : t('stations.renameName', { name: stationById(panel.id)?.name ?? '' })
                  }
                  onClose={close}
                />
                <div className="mn-panel-body">
                  <div className="desk-field">
                    <label htmlFor="sn-name" className="desk-label">
                      {t('stations.name')}
                    </label>
                    <div className={nameError == null ? 'desk-box' : 'desk-box is-wrong'}>
                      <input
                        id="sn-name"
                        type="text"
                        value={draft}
                        spellCheck={false}
                        autoComplete="off"
                        aria-invalid={nameError != null}
                        aria-describedby={
                          nameError != null ? 'sn-name-error sn-name-help' : 'sn-name-help'
                        }
                        onChange={(change) => {
                          setServerName(null);
                          setDraft(change.target.value);
                        }}
                      />
                    </div>
                    {nameError != null && <FieldWrong id="sn-name-error">{nameError}</FieldWrong>}
                    <p id="sn-name-help" className="desk-help">
                      {t('stations.nameHelp', { max: STATION_NAME_MAXIMUM })}
                    </p>
                  </div>
                  <p className="mn-quiet">
                    {panel.id == null ? t('stations.addNote') : t('stations.renameNote')}
                  </p>
                </div>
                <PanelFoot
                  cta={panel.id == null ? t('stations.addCta') : t('stations.saveName')}
                  busy={busy}
                  onSave={() => void saveName()}
                  onCancel={close}
                />
              </>
            )}
          </aside>
        )}
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
        aria-label={t('stations.close')}
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
          {t('stations.cancel')}
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

/** A native select under the shown words, as the Stations and Roster demos draw it. */
export function StationSelect({
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
