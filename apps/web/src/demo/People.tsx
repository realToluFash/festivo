import { DemoBell } from './DemoBell.tsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Brand } from '../components/Brand.tsx';
import { Toast } from '../components/Toast.tsx';
import { Glyph, type GlyphName } from '../components/Glyph.tsx';
import { LayersContext, useDeskLayers } from '../layers.ts';
import { DoorArea, PrintPreview } from './DoorCode.tsx';
import {
  BAR,
  BUSY_MS,
  type DoorStart,
  doorPeopleStart,
  doorStartOf,
  HOLD_MS,
  W as DOOR_WORDS,
} from './doorCode.ts';
import {
  ADD_PROMPT,
  addedToast,
  EMPTY_LINE,
  EMPTY_TITLE,
  type EventPlace,
  FAILED_LINE,
  FAILED_TITLE,
  LIT_MS,
  listed,
  LOADING_WORDS,
  manages,
  ON_EVENT,
  type OnEvent,
  opens,
  outsideTag,
  type PeopleStart,
  type PeopleViewer,
  peopleStart,
  peopleStateOf,
  READ_ONLY,
  removedToast,
  rowLine,
  seesEveryEvent,
  withAdded,
  without,
  withRole,
} from './people.ts';
import { AddDialog, RoleDialog } from './PeopleDialogs.tsx';
import { Avatar, Head, RowWords, Tag, TextAction } from '../components/SettingsParts.tsx';
import type { Tell } from '../components/SettingsParts.tsx';
import './today.css';
import '../components/SettingsParts.css';
import './settings.css';
import '../routes/app/events/people.css';
import './people.css';

const RETRY_MS = 1200;

const AREAS: readonly (readonly [string, GlyphName])[] = [
  ['Overview', 'overview'],
  ['Guests', 'users'],
  ['Menu', 'menu'],
  ['Seating', 'seating'],
  ['Messages', 'messages'],
  ['Schedule', 'clock'],
  ['Staff', 'staff'],
  ['People', 'people'],
  ['Budget', 'budget'],
  ['Reports', 'reports'],
];

/** People on an event at a desk (Web-People.dc.html, page 28): one list, the role in a dialog, on sample data; the door code's states add its card (Access-A-Web, page e28). */
export function People() {
  const [params] = useSearchParams();
  const door = doorStartOf({
    state: params.get('state'),
    code: params.get('code'),
    hold: params.get('show') ?? params.get('hold'),
    print: params.get('print'),
  });

  if (door?.print === true) return <PrintPreview code={BAR} />;
  if (door != null) {
    return <PeopleScreen key={params.toString()} start={doorPeopleStart(door)} door={door} />;
  }
  const name = peopleStateOf(params.get('state'));

  return <PeopleScreen key={name} start={peopleStart(name)} door={null} />;
}

type Opened = { id: string; visit: number } | null;

function PeopleScreen({ start, door }: { start: PeopleStart; door: DoorStart | null }) {
  const { layers, covered, setHost } = useDeskLayers();
  const [told, setTold] = useState<string | null>(door?.toast ?? null);
  const tell = useCallback<Tell>((words) => setTold(words), []);
  const [load, setLoad] = useState<PeopleStart['load'] | 'retrying'>(start.load);
  const [members] = useState(start.members);
  const [onEvent, setOnEvent] = useState(start.onEvent);
  const [opened, setOpened] = useState<Opened>(
    door?.person == null ? null : { id: door.person, visit: 0 },
  );
  const [adding, setAdding] = useState(false);
  const [lit, setLit] = useState<{ id: string; held: boolean } | null>(
    door?.person == null ? null : { id: door.person, held: true },
  );
  const joined = useCallback((one: OnEvent) => setOnEvent((was) => [...was, one]), []);
  const place = start.place;
  const [refocus, setRefocus] = useState(0);
  const addBox = useRef<HTMLButtonElement>(null);
  const viewer = start.viewer;
  const canChange = manages(viewer, onEvent);
  const person = opened == null ? null : onEvent.find((one) => one.id === opened.id);

  useEffect(() => {
    if (load !== 'retrying') return;
    const timer = setTimeout(() => setLoad('loaded'), RETRY_MS);

    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (lit == null || lit.held) return;
    const timer = setTimeout(() => setLit(null), LIT_MS);

    return () => clearTimeout(timer);
  }, [lit]);

  // The row it came from has gone, so focus lands on Add, after the dialogs hand it back.
  useEffect(() => {
    if (refocus === 0) return;
    const timer = setTimeout(
      () => (addBox.current ?? document.querySelector<HTMLElement>('.desk-main h1'))?.focus(),
      0,
    );

    return () => clearTimeout(timer);
  }, [refocus]);

  function openRole(one: OnEvent): void {
    setTold(null);
    setLit({ id: one.id, held: true });
    setOpened((was) => ({ id: one.id, visit: (was?.visit ?? 0) + 1 }));
  }

  function closeRole(): void {
    setOpened(null);
    setLit((was) => (was == null ? null : { ...was, held: false }));
  }

  const shown = listed(onEvent);
  const page =
    load !== 'loaded' ? (
      load === 'failed' ? (
        <div className="desk-failed" role="alert">
          <h2>{FAILED_TITLE}</h2>
          <p className="desk-line">{FAILED_LINE}</p>
          <TextAction label="Try again" onClick={() => setLoad('retrying')} />
        </div>
      ) : (
        <Loading />
      )
    ) : (
      <>
        {canChange && (
          <button
            ref={addBox}
            type="button"
            className="people-add"
            onClick={() => {
              setTold(null);
              setAdding(true);
            }}
          >
            <Glyph name="plus" size={19} weight={2.4} />
            {ADD_PROMPT}
          </button>
        )}
        {canChange && door != null && <DoorArea start={door} onJoin={joined} tell={tell} />}
        {shown.length === 0 ? (
          <div className="people-nobody">
            <p className="desk-empty-title">{EMPTY_TITLE}</p>
            <p className="desk-line">{EMPTY_LINE}</p>
          </div>
        ) : (
          <section className="desk-block" aria-labelledby="people-on-event">
            <Head title={<span id="people-on-event">{ON_EVENT}</span>}>
              <span className="people-count">{shown.length}</span>
            </Head>
            <ul className="desk-rows has-lead people-rows">
              {shown.map((one) => (
                <li key={one.id}>
                  <PersonRow
                    person={one}
                    viewer={viewer}
                    organisation={place.organisation}
                    lit={lit?.id === one.id}
                    onOpen={opens(one, viewer, onEvent) ? () => openRole(one) : null}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="people-foot">
          {!canChange && <p className="desk-foot">{READ_ONLY}</p>}
          <p className="desk-foot">{seesEveryEvent(members, place.organisation)}</p>
        </div>
      </>
    );

  return (
    <LayersContext value={layers}>
      <div className="today desk">
        <EventSidebar viewer={viewer} place={place} tell={tell} inert={covered} />
        <main id="content" className="desk-main" inert={covered}>
          <div className="desk-page">
            <div className="desk-column">
              <header className="desk-top">
                <div className="people-title">
                  <h1 className="desk-title" tabIndex={-1}>
                    People
                  </h1>
                  <p className="desk-line">{place.event}</p>
                </div>
                <DemoBell tell={tell} />
              </header>
              {page}
            </div>
          </div>
        </main>
        <div ref={setHost} className="desk-layers" />
        {person != null && opened != null && (
          <RoleDialog
            key={opened.visit}
            person={person}
            roleFails={start.roleFails}
            organisation={place.organisation}
            removing={
              door == null
                ? undefined
                : {
                    words: DOOR_WORDS.removing,
                    ms: BUSY_MS,
                    start: opened.visit === 0 ? door.remove : null,
                    heldMs: HOLD_MS,
                  }
            }
            onSaved={(role) => setOnEvent((was) => withRole(was, person.id, role))}
            onLost={setTold}
            onClose={closeRole}
            onRemove={() => {
              setOnEvent((was) => without(was, person.id));
              setOpened(null);
              setLit(null);
              setTold(removedToast(person));
              setRefocus((n) => n + 1);
            }}
          />
        )}
        {adding && (
          <AddDialog
            members={members}
            onEvent={onEvent}
            viewer={viewer}
            organisation={place.organisation}
            onClose={() => setAdding(false)}
            onAdd={(role, added) => {
              setOnEvent((was) => withAdded(was, role, added));
              setAdding(false);
              setTold(
                addedToast(
                  added.map((one) => one.name),
                  role,
                ),
              );
            }}
          />
        )}
        {told != null && <Toast key={told} words={told} onClose={() => setTold(null)} />}
      </div>
    </LayersContext>
  );
}

/** A person on the event: their face, name and role, and the Outside tag; a chevron when it opens. */
function PersonRow({
  person,
  viewer,
  organisation,
  lit,
  onOpen,
}: {
  person: OnEvent;
  viewer: PeopleViewer;
  organisation: string;
  lit: boolean;
  onOpen: (() => void) | null;
}) {
  const line = rowLine(person, viewer);
  const words = (
    <>
      <Avatar initials={person.initials} tone={person.tone} />
      <RowWords
        title={person.name}
        tag={person.outside && <Tag kind="now" word={outsideTag(organisation)} />}
        lines={[line]}
      />
    </>
  );

  if (onOpen == null) return <div className="desk-row">{words}</div>;

  return (
    <button
      type="button"
      className={lit ? 'desk-row is-on' : 'desk-row'}
      aria-haspopup="dialog"
      onClick={onOpen}
    >
      {words}
      <Glyph name="chevdown" size={18} weight={2.3} className="desk-chevron" />
    </button>
  );
}

function Loading() {
  return (
    <div className="desk-loading" role="status" aria-label={LOADING_WORDS}>
      <span className="desk-unseen">{LOADING_WORDS}</span>
      <span className="desk-sunk people-add-bone" aria-hidden="true" />
      <ul className="desk-rows has-lead" aria-hidden="true">
        {[1, 2, 3, 4].map((bar) => (
          <li key={bar} className="desk-row is-bones">
            <span className="desk-sunk is-face" />
            <span className="desk-row-words">
              <span className={`desk-sunk is-title b${bar}`} />
              <span className={`desk-sunk is-line b${bar}`} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The event's sidebar at a desk (EventView-B): ‹ Events, the event, its areas with People selected, and who is looking. */
function EventSidebar({
  viewer,
  place,
  tell,
  inert,
}: {
  viewer: PeopleViewer;
  place: EventPlace;
  tell: Tell;
  inert: boolean;
}) {
  return (
    <nav className="today-side people-side" aria-label={place.event} inert={inert}>
      <div className="today-logo">
        <Brand lockup />
      </div>
      <button
        type="button"
        className="today-org"
        aria-label={`${place.organisation}. Switch organisation`}
        onClick={() => tell('Switching organisation has its own design.')}
      >
        <span className="today-org-tile" aria-hidden="true">
          {place.initials}
        </span>
        <span className="today-grow">{place.organisation}</span>
        <Glyph name="updown" size={15} />
      </button>
      <button
        type="button"
        className="today-search"
        aria-keyshortcuts="Meta+K Control+K"
        onClick={() => tell('Search has its own design.')}
      >
        <Glyph name="search" size={16} />
        <span className="today-grow">Search</span>
        <kbd className="today-key">⌘K</kbd>
      </button>
      <div className="people-event">
        <Link className="today-place people-back" to="/demo/today">
          <Glyph name="back" size={17} weight={2.4} />
          Events
        </Link>
        <div className="people-event-card">
          <span className="today-cover is-wed people-event-cover" aria-hidden="true" />
          <span className="today-grow">
            <span className="people-event-name">{place.event}</span>
            <span className="people-event-when">{place.when}</span>
          </span>
        </div>
      </div>
      <ul className="today-places">
        {AREAS.map(([label, glyph]) => (
          <li key={label}>
            <button
              type="button"
              className={label === 'People' ? 'today-place is-on' : 'today-place'}
              aria-current={label === 'People' ? 'page' : undefined}
              onClick={() => label !== 'People' && tell(`${label} has its own design.`)}
            >
              <Glyph name={glyph} />
              {label}
            </button>
          </li>
        ))}
      </ul>
      <div className="today-grow" />
      <div className="today-places">
        <Link className="today-place" to="/demo/settings">
          <Glyph name="settings" />
          Settings
        </Link>
        <button
          type="button"
          className="today-person"
          aria-label={`${viewer.name}, ${viewer.role}`}
          onClick={() => tell('Your account has its own design.')}
        >
          <span className="today-avatar today-cover is-draft" aria-hidden="true">
            {viewer.initials}
          </span>
          <span className="today-grow today-person-words" aria-hidden="true">
            <span className="today-person-name">{viewer.name}</span>
            <span className="today-person-role">{viewer.role}</span>
          </span>
          <Glyph name="updown" size={15} />
        </button>
      </div>
    </nav>
  );
}
