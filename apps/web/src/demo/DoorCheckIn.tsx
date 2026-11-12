import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';

import { Brand } from '../components/Brand.tsx';
import { Glyph } from '../components/Glyph.tsx';
import { StaleBand } from '../components/OfflineBand.tsx';
import { Toast } from '../components/Toast.tsx';
import { useDialogKeys } from '../dialogFocus.ts';
import { DOOR_EVENT } from './doorCode.ts';
import {
  type CheckInStart,
  type DoorPerson,
  type Gone,
  type Holder,
  CW,
  JOB,
  NOW,
  OFFLINE_SINCE,
  OPENS_AT,
  OTHER,
  SHIFT_NAME,
  addWalkIn,
  arrive,
  backOf,
  checkInStart,
  checkInStateOf,
  countOf,
  holderOf,
  jobOf,
  meOf,
  nameProblem,
  sameName,
  shownName,
  shownPeople,
  undo,
} from './doorCheckIn.ts';
import { ReplyMark } from './GuestsParts.tsx';
import './doorCheckIn.css';

const LIVE_AFTER = 2500;

/** Check-in in the browser for door staff from a staff link or a door code (sc-28230): signed out of the app, 390 first, one centred 480 column wider. */
export function DoorCheckIn() {
  const [params] = useSearchParams();
  const state = checkInStateOf(params.get('state'));
  const holder = holderOf(params.get('holder'));

  return (
    <CheckInAt key={`${state}|${holder}`} start={checkInStart(state, holder)} holder={holder} />
  );
}

function CheckInAt({ start, holder }: { start: CheckInStart; holder: Holder }) {
  if (start.signedOut) return <NotSignedIn />;
  if (start.gone === 'level_view')
    return (
      <Navigate
        to={
          holder === 'code'
            ? '/demo/redeem?state=browser-in-view'
            : '/demo/check-in/shift?level=view'
        }
        replace
      />
    );
  if (start.gone != null) return <LinkPage gone={start.gone} />;

  return <CheckInPage start={start} holder={holder} />;
}

function Bar({ back }: { back: { to: string; words: string } | null }) {
  return (
    <header className="ci-bar">
      {back != null && (
        <Link className="ci-back" to={back.to}>
          <Glyph name="back" size={20} weight={2.4} />
          <span>{back.words}</span>
        </Link>
      )}
      <span className="ci-brand">
        <Brand />
      </span>
    </header>
  );
}

function Page({
  back,
  band,
  children,
}: {
  back: { to: string; words: string } | null;
  band?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main id="content" className="ci">
      <Bar back={back} />
      {band}
      <div className="ci-column">{children}</div>
    </main>
  );
}

function CheckInPage({ start, holder }: { start: CheckInStart; holder: Holder }) {
  const me = meOf(holder);
  const [people, setPeople] = useState(start.people);
  const [typed, setTyped] = useState(start.typed);
  const [failed, setFailed] = useState(start.failed);
  const [offline, setOffline] = useState(start.offline);
  const [unanswered, setUnanswered] = useState(0);
  const [fresh, setFresh] = useState<readonly string[]>(start.fresh);
  const [said, setSaid] = useState(start.said);
  const [toast, setToast] = useState(start.toast);
  const [walkIn, setWalkIn] = useState(start.walkIn);
  const opener = useRef<HTMLButtonElement>(null);
  const open = start.phase === 'open';
  const shown = shownPeople(people, typed);
  const looking = typed.trim() !== '';
  const count = countOf(people);

  useEffect(() => {
    if (!start.live) return;

    const wait = window.setTimeout(() => {
      setPeople((was) => arrive(was, 'ngozi', '19:44', OTHER));
      setFresh(['ngozi']);
    }, LIVE_AFTER);

    return () => window.clearTimeout(wait);
  }, [start.live]);

  function arrived(one: DoorPerson): void {
    const name = shownName(one, people);

    if (offline) {
      setFailed(one.id);
      setSaid(CW.notRecorded);
      return;
    }
    setFailed(null);
    setPeople(arrive(people, one.id, NOW, me));
    setSaid(CW.announced(name, NOW));
  }

  function undone(one: DoorPerson): void {
    if (offline) {
      setFailed(one.id);
      setSaid(CW.notRecorded);
      return;
    }
    setPeople(undo(people, one.id));
    setSaid(null);
    setToast(CW.undone);
  }

  function added(name: string): boolean {
    if (offline) return false;
    setPeople(addWalkIn(people, name, NOW, me));
    setTyped(name);
    setWalkIn(null);
    setSaid(CW.added(name, NOW));
    return true;
  }

  if (start.loading)
    return (
      <Page back={backOf(holder)}>
        <h1 className="ci-title">{CW.title}</h1>
        <p className="ci-status" role="status">
          {CW.loading}
        </p>
        <ul className="ci-rows" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((at) => (
            <li key={at} className="ci-row is-bone">
              <span className="ci-bone" />
            </li>
          ))}
        </ul>
      </Page>
    );

  return (
    <Page
      back={backOf(holder)}
      band={
        <StaleBand
          stale={
            offline
              ? { at: OFFLINE_SINCE, retry: () => setUnanswered((was) => was + 1), unanswered }
              : null
          }
          className="offline-band ci-band"
        />
      }
    >
      <div className="ci-head">
        <h1 className="ci-title">{CW.title}</h1>
        <p className="ci-event">{`${DOOR_EVENT} · ${jobOf(holder)}`}</p>
        {people.length > 0 && <p className="ci-count">{CW.count(count.arrived, count.expected)}</p>}
      </div>
      {start.phase !== 'open' && (
        <div className="ci-notice">
          <p className="ci-notice-title">
            {start.phase === 'before' ? CW.opensAt(OPENS_AT) : CW.ended}
          </p>
          {people.length > 0 && (
            <p>{start.phase === 'before' ? CW.opensBody(OPENS_AT) : CW.endedBody}</p>
          )}
        </div>
      )}
      {people.length === 0 ? (
        <div className="ci-empty">
          <h2>{CW.emptyTitle}</h2>
          {open && (
            <>
              <p>{CW.emptyLine}</p>
              <button
                ref={opener}
                type="button"
                className="ci-primary"
                onClick={() => setWalkIn({ name: '', checked: false, same: null })}
              >
                {CW.addWalkIn}
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <Search typed={typed} onType={setTyped} />
          {looking && shown.length > 0 && <p className="ci-matches">{CW.matches(shown.length)}</p>}
          {looking && shown.length === 0 ? (
            <div className="ci-none">
              <p>{CW.noMatch(typed.trim())}</p>
              {open && (
                <button
                  ref={opener}
                  type="button"
                  className="ci-primary"
                  onClick={() => setWalkIn({ name: typed.trim(), checked: false, same: null })}
                >
                  {CW.addWalkIn}
                </button>
              )}
            </div>
          ) : (
            <ul className="ci-rows">
              {shown.map((one) => (
                <Row
                  key={one.id}
                  one={one}
                  name={shownName(one, people)}
                  open={open}
                  failed={failed === one.id}
                  fresh={fresh.includes(one.id)}
                  onArrive={() => arrived(one)}
                  onUndo={() => undone(one)}
                />
              ))}
            </ul>
          )}
        </>
      )}
      {start.offline && (
        <label className="demo-switch ci-demo">
          <input
            type="checkbox"
            role="switch"
            checked={!offline}
            onChange={(event) => {
              setOffline(!event.target.checked);
              if (!event.target.checked) return;
              setFailed(null);
              setSaid(null);
              setPeople((was) =>
                arrive(arrive(was, 'ngozi', '19:46', OTHER), 'emeka', '19:47', OTHER),
              );
              setFresh(['ngozi', 'emeka']);
            }}
          />
          {CW.connectionBack}
        </label>
      )}
      <p className="desk-unseen" role="status">
        {said}
      </p>
      {walkIn != null && (
        <WalkIn
          start={walkIn}
          people={people}
          onClose={() => {
            setWalkIn(null);
            opener.current?.focus();
          }}
          onMark={(one) => {
            setWalkIn(null);
            setTyped(shownName(one, people));
            if (one.arrivedAt == null) arrived(one);
          }}
          onAdd={added}
        />
      )}
      {toast != null && <Toast key={toast} words={toast} onClose={() => setToast(null)} />}
    </Page>
  );
}

function Search({ typed, onType }: { typed: string; onType: (typed: string) => void }) {
  const id = useId();

  return (
    <div className="ci-search">
      <label htmlFor={id} className="ci-label">
        {CW.search}
      </label>
      <div className="ci-field">
        <Glyph name="search" size={20} weight={2.2} />
        <input
          id={id}
          type="search"
          value={typed}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onType(event.target.value)}
        />
        {typed !== '' && (
          <button
            type="button"
            className="ci-clear"
            aria-label={CW.clear}
            onClick={() => onType('')}
          >
            <Glyph name="clear" size={18} weight={2.4} />
          </button>
        )}
      </div>
    </div>
  );
}

function Row({
  one,
  name,
  open,
  failed,
  fresh,
  onArrive,
  onUndo,
}: {
  one: DoorPerson;
  name: string;
  open: boolean;
  failed: boolean;
  fresh: boolean;
  onArrive: () => void;
  onUndo: () => void;
}) {
  const here = one.arrivedAt != null;
  const classes = ['ci-row', one.host != null && 'is-companion', fresh && 'is-fresh']
    .filter(Boolean)
    .join(' ');

  return (
    <li className={classes}>
      <div className="ci-who">
        <p className="ci-name">{name}</p>
        <p className="ci-reply">
          <ReplyMark reply={one.reply} size={16} />
          {CW.reply[one.reply]}
        </p>
        {here && (
          <p className="ci-here">
            <Glyph name="tick" size={16} weight={3} />
            {CW.arrivedAt(one.arrivedAt ?? '', one.by ?? '')}
          </p>
        )}
        {failed && (
          <p className="ci-failed">
            <Glyph name="alert" size={16} weight={2.2} />
            {CW.notRecorded}
          </p>
        )}
      </div>
      {open &&
        (here ? (
          <button
            type="button"
            className="ci-secondary"
            aria-label={CW.undoName(name)}
            onClick={onUndo}
          >
            {CW.undo}
          </button>
        ) : (
          <button
            type="button"
            className="ci-primary is-row"
            aria-label={CW.arriveName(name)}
            onClick={onArrive}
          >
            {CW.arrived}
          </button>
        ))}
    </li>
  );
}

/** Add walk-in: a sheet rising at the phone, a centred 480 dialog at a desk. The name is checked before anything is sent. */
function WalkIn({
  start,
  people,
  onClose,
  onMark,
  onAdd,
}: {
  start: { name: string; checked: boolean; same: string | null };
  people: readonly DoorPerson[];
  onClose: () => void;
  onMark: (one: DoorPerson) => void;
  onAdd: (name: string) => boolean;
}) {
  const id = useId();
  const sheet = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(start.name);
  const [checked, setChecked] = useState(start.checked);
  const [same, setSame] = useState(start.same);
  const [refused, setRefused] = useState(false);
  const problem = checked ? nameProblem(name) : null;
  const listed = (typed: string) =>
    people.find((one) => one.name != null && sameName(one.name, typed));

  useDialogKeys(sheet, onClose, false);
  useEffect(() => field.current?.focus(), []);

  function add(typed: string): void {
    setRefused(!onAdd(typed));
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setChecked(true);
    if (nameProblem(name) != null) {
      field.current?.focus();
      return;
    }
    const found = listed(name);

    if (found != null && same == null) setSame(found.name);
    else add(name.trim());
  }

  const found = same == null ? null : listed(same);
  const told = [problem != null && `${id}-error`, `${id}-hint`].filter(Boolean).join(' ');

  return (
    <>
      <div className="ci-scrim" aria-hidden="true" onClick={onClose} />
      <div
        ref={sheet}
        className="ci-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
      >
        <span className="ci-grabber" aria-hidden="true" />
        <h2 id={`${id}-title`}>{CW.addWalkIn}</h2>
        <form className="ci-form" noValidate onSubmit={submit}>
          {found != null && (
            <div className="ci-amber" role="alert">
              <p>{CW.same(found.name ?? '')}</p>
              <button type="button" className="ci-primary" onClick={() => onMark(found)}>
                {CW.markThem}
              </button>
              <button type="button" className="ci-secondary" onClick={() => add(name.trim())}>
                {CW.addNew}
              </button>
            </div>
          )}
          <label htmlFor={`${id}-name`} className="ci-label">
            {CW.fullName}
          </label>
          <div className={problem == null ? 'ci-field' : 'ci-field is-wrong'}>
            <input
              ref={field}
              id={`${id}-name`}
              type="text"
              value={name}
              autoComplete="off"
              aria-invalid={problem != null}
              aria-describedby={told}
              onChange={(event) => {
                setName(event.target.value);
                setSame(null);
                setRefused(false);
              }}
            />
          </div>
          {problem != null && (
            <p id={`${id}-error`} className="ci-error" role="alert">
              <Glyph name="clear" size={16} weight={2.6} />
              {problem}
            </p>
          )}
          <p id={`${id}-hint`} className="ci-hint">
            {CW.walkHint}
          </p>
          {refused && (
            <p className="ci-failed" role="alert">
              <Glyph name="alert" size={16} weight={2.2} />
              {CW.notRecorded}
            </p>
          )}
          {found == null && (
            <button type="submit" className="ci-primary">
              {CW.addMark}
            </button>
          )}
          <button type="button" className="ci-secondary" onClick={onClose}>
            {CW.cancel}
          </button>
        </form>
      </div>
    </>
  );
}

const PAGES: Record<
  Exclude<Gone, 'level_view'>,
  { title: string; body: string; next: string; foot: string }
> = {
  link_gone: CW.gone,
  outside_window: CW.notYet,
  outside_window_ended: CW.linkEnded,
};

/** sc-3912's link pages in the list's place once access ends: nothing of the event stays on the screen. */
function LinkPage({ gone }: { gone: Exclude<Gone, 'level_view'> }) {
  const page = PAGES[gone];

  return (
    <Page back={null}>
      <div className="ci-card">
        <h1 className="ci-title">{page.title}</h1>
        <p>{page.body}</p>
        <p>{page.next}</p>
      </div>
      <p className="ci-foot">{page.foot}</p>
    </Page>
  );
}

/** Check-in's address in a browser that is not signed in: it names no guest, event or person. */
function NotSignedIn() {
  return (
    <Page back={null}>
      <div className="ci-card">
        <h1 className="ci-title">{CW.notSignedIn.title}</h1>
        <p>{CW.notSignedIn.body}</p>
        <Link className="ci-primary" to="/demo/redeem?state=enter">
          {CW.notSignedIn.cta}
        </Link>
      </div>
    </Page>
  );
}

/** The shift page as far as sc-28230 draws it (CheckIn.dc.html, Reaching it): Check-in under the clock card at Can check guests in, none at Can view. */
export function ShiftPage() {
  const [params] = useSearchParams();
  const view = params.get('level') === 'view';
  const [told, setTold] = useState<string | null>(null);

  return (
    <Page back={null}>
      <p className="ci-only">{CW.shift.only}</p>
      <h1 className="ci-title">{CW.shift.hello}</h1>
      <p className="ci-event">{`${DOOR_EVENT} · ${JOB}`}</p>
      <div className="ci-card">
        <p className="ci-label">{CW.shift.yourShift}</p>
        <p className="ci-name">{CW.shift.times}</p>
        <p className="ci-here">
          <Glyph name="tick" size={16} weight={3} />
          {CW.shift.clocked}
        </p>
      </div>
      {!view && (
        <Link className="ci-primary" to="/demo/check-in?state=list">
          {CW.title}
        </Link>
      )}
      <div className="ci-you">
        <p>{CW.shift.signedInAs(SHIFT_NAME)}</p>
        <p>{CW.shift.signedOutAt}</p>
        <button
          type="button"
          className="ci-secondary"
          onClick={() => setTold(CW.shift.signOutLater)}
        >
          {CW.shift.signOut}
        </button>
      </div>
      {told != null && <Toast key={told} words={told} onClose={() => setTold(null)} />}
    </Page>
  );
}
