import { ApiError, type CheckIn, realtimeTopic } from '@soirely/api-client';
import {
  type DoorRow,
  REPLY_KEY,
  countLine,
  doorRows,
  formatEventClock,
  listedAs,
  walkInProblem,
} from '@soirely/domain';
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router';

import { api } from '../../api.ts';
import { Brand } from '../../components/Brand.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { StaleBand } from '../../components/OfflineBand.tsx';
import { Toast } from '../../components/Toast.tsx';
import { useDialogKeys } from '../../dialogFocus.ts';
import { dateLocale } from '../../i18n/index.ts';
import { useStaleWatch } from '../../offline.ts';
import { restoreSession, useSessionState } from '../../session.ts';
import { ReplyMark } from '../app/events/GuestColumn.tsx';
import { useHubTopics } from '../app/events/useHubTopics.ts';
import { type DoorWay, doorWayOf, freshRows } from './doorCheckIn.ts';
import { SignOutLine } from './RedeemPhone.tsx';
import '../app/events/guests.css';
import './doorCheckIn.css';
import './redeem.css';

/** Read again this often whatever the hub says, so an ended grant empties the screen within 10 seconds (sc-28230). */
const EVERY_MS = 5_000;

const NAME_MOST = 200;

type Load =
  { kind: 'asking' } | { kind: 'gone' } | { kind: 'failed' } | { kind: 'shown'; checkIn: CheckIn };

/** /door/:eventId (sc-28230): sc-1454's check-in in the browser, for whoever holds Can check guests in through a staff link or a door code. */
export function DoorCheckInPage() {
  const { eventId = '' } = useParams();

  return <DoorCheckIn key={eventId} eventId={eventId} />;
}

function DoorCheckIn({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const session = useSessionState();
  const [load, setLoad] = useState<Load>({ kind: 'asking' });
  const [way, setWay] = useState<DoorWay | null | undefined>(undefined);
  const [fresh, setFresh] = useState<readonly string[]>([]);
  const [refused, setRefused] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const shown = load.kind === 'shown' ? load.checkIn : null;
  const latest = useRef(shown);
  const { watch, stale } = useStaleWatch({
    loaded: shown != null,
    reload: () => void read(),
    title,
  });

  useEffect(() => {
    latest.current = shown;
  });

  const reading = useRef(0);

  // Every read goes through the API, which refuses an ended grant at once; the hub only says that the list changed.
  function read(): Promise<void> {
    const asked = ++reading.current;

    return watch(api.checkIn(eventId)).then(
      (checkIn) => {
        if (asked !== reading.current) return;
        const was = latest.current;
        if (was != null) setFresh(freshRows(was, checkIn));
        setLoad({ kind: 'shown', checkIn });
      },
      (error: unknown) => {
        if (asked !== reading.current) return;
        if (error instanceof ApiError && error.status === 403) setRefused(true);
        else if (error instanceof ApiError && (error.status === 404 || error.status === 401))
          setLoad({ kind: 'gone' });
        else if (latest.current == null) setLoad({ kind: 'failed' });
      },
    );
  }

  const signedIn = session.status === 'signedIn';
  const outside = session.status === 'signedIn' ? session.session.outsideEvents : undefined;

  useEffect(() => {
    void restoreSession();
  }, []);

  const reads = useRef(read);

  useEffect(() => {
    reads.current = read;
  });

  useEffect(() => {
    if (!signedIn) return;
    let current = true;
    let again: number | undefined;
    const find = (): void =>
      void doorWayOf(eventId, outside, t).then(
        (found) => current && setWay(found),
        () => {
          if (current) again = window.setTimeout(find, EVERY_MS);
        },
      );
    find();

    return () => {
      current = false;
      window.clearTimeout(again);
    };
  }, [eventId, signedIn, outside, t]);

  useEffect(() => {
    if (!signedIn) return;
    void reads.current();
    const every = window.setInterval(() => void reads.current(), EVERY_MS);

    return () => window.clearInterval(every);
  }, [eventId, signedIn]);

  useHubTopics(
    signedIn && shown != null ? [realtimeTopic('EventCheckIn', eventId)] : [],
    () => api.checkInSubscription(eventId),
    () => void read(),
    () => void read(),
  );

  if (session.status === 'signedOut') return <NotSignedIn />;
  if (refused) return way === undefined ? <Asking /> : <Navigate to={way?.to ?? '/app'} replace />;
  if (load.kind === 'gone') return <LinkGone />;

  return (
    <Page back={way ?? null}>
      {load.kind === 'asking' && <Loading titleRef={title} />}
      {load.kind === 'failed' && <Failed titleRef={title} onRetry={() => void read()} />}
      {shown != null && (
        <DoorList
          eventId={eventId}
          checkIn={shown}
          way={way ?? null}
          fresh={fresh}
          offline={stale != null}
          band={<StaleBand stale={stale} className="offline-band ci-band" />}
          titleRef={title}
          onRead={(checkIn) => {
            setFresh([]);
            setLoad({ kind: 'shown', checkIn });
          }}
        />
      )}
    </Page>
  );
}

function Bar({ back }: { back: DoorWay | null }) {
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

function Page({ back, children }: { back: DoorWay | null; children: ReactNode }) {
  return (
    <main id="content" className="ci">
      <Bar back={back} />
      {children}
    </main>
  );
}

function Asking() {
  return <Page back={null}>{null}</Page>;
}

function Loading({ titleRef }: { titleRef: React.RefObject<HTMLHeadingElement | null> }) {
  const { t } = useTranslation();

  return (
    <div className="ci-column">
      <h1 ref={titleRef} tabIndex={-1} className="ci-title">
        {t('checkIn.title')}
      </h1>
      <p className="ci-status" role="status">
        {t('checkIn.loading')}
      </p>
      <ul className="ci-rows" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((at) => (
          <li key={at} className="ci-row is-bone">
            <span className="ci-bone" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Failed({
  titleRef,
  onRetry,
}: {
  titleRef: React.RefObject<HTMLHeadingElement | null>;
  onRetry: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="ci-column">
      <h1 ref={titleRef} tabIndex={-1} className="ci-title">
        {t('checkIn.title')}
      </h1>
      <div className="ci-card" role="alert">
        <p>{t('checkIn.failed')}</p>
        <button type="button" className="ci-secondary" onClick={onRetry}>
          {t('checkIn.tryAgain')}
        </button>
      </div>
    </div>
  );
}

interface WalkInStart {
  name: string;
}

function DoorList({
  eventId,
  checkIn,
  way,
  fresh,
  offline,
  band,
  titleRef,
  onRead,
}: {
  eventId: string;
  checkIn: CheckIn;
  way: DoorWay | null;
  fresh: readonly string[];
  offline: boolean;
  band: ReactNode;
  titleRef: React.RefObject<HTMLHeadingElement | null>;
  onRead: (checkIn: CheckIn) => void;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const [typed, setTyped] = useState('');
  const [failed, setFailed] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [walkIn, setWalkIn] = useState<WalkInStart | null>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const open = checkIn.state === 'open';
  const rows = doorRows(t, checkIn, typed, locale);
  const looking = typed.trim() !== '';
  const everyone = checkIn.guests.length;
  const clock = (at: string) => formatEventClock(at, checkIn.timeZone, locale);
  const opensAt = clock(checkIn.opensAt);

  async function arrived(row: DoorRow): Promise<void> {
    setFailed(null);
    try {
      const read = await api.arrive(eventId, row.id);
      onRead(read);
      const now = arrivalOf(read, row.id);
      setSaid(
        t('checkIn.arrivedAnnounced', { name: row.name, time: now == null ? '' : clock(now) }),
      );
    } catch {
      setFailed(row.id);
      setSaid(t('checkIn.notRecorded'));
    }
  }

  async function undone(row: DoorRow): Promise<void> {
    setFailed(null);
    try {
      onRead(await api.undoArrival(eventId, row.id));
      setSaid(null);
      setToast(t('checkIn.undone'));
    } catch {
      setFailed(row.id);
      setSaid(t('checkIn.notRecorded'));
    }
  }

  return (
    <>
      {band}
      <div className="ci-column">
        <div className="ci-head">
          <h1 ref={titleRef} tabIndex={-1} className="ci-title">
            {t('checkIn.title')}
          </h1>
          {way?.line != null && <p className="ci-event">{way.line}</p>}
          {everyone > 0 && <p className="ci-count">{countLine(t, checkIn.count)}</p>}
        </div>
        {checkIn.state !== 'open' && (
          <div className="ci-notice">
            <p className="ci-notice-title">
              {checkIn.state === 'before_open'
                ? t('checkIn.opensAt', { time: opensAt })
                : t('checkIn.ended')}
            </p>
            {everyone > 0 && (
              <p>
                {checkIn.state === 'before_open'
                  ? t('checkIn.searchWorksNow', { time: opensAt })
                  : t('checkIn.endedBody')}
              </p>
            )}
          </div>
        )}
        {everyone === 0 ? (
          <div className="ci-empty">
            <h2>{t('checkIn.nobodyYet')}</h2>
            {open && (
              <>
                <p>{t('checkIn.nobodyYetLine')}</p>
                <button
                  ref={opener}
                  type="button"
                  className="ci-primary"
                  onClick={() => setWalkIn({ name: '' })}
                >
                  {t('checkIn.addWalkIn')}
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <Search typed={typed} onType={setTyped} />
            {looking && rows.length === 0 ? (
              <div className="ci-none">
                <p>{t('checkIn.noOne', { typed: typed.trim() })}</p>
                {open && (
                  <button
                    ref={opener}
                    type="button"
                    className="ci-primary"
                    onClick={() => setWalkIn({ name: typed.trim() })}
                  >
                    {t('checkIn.addWalkIn')}
                  </button>
                )}
              </div>
            ) : (
              <ul className="ci-rows">
                {rows.map((row) => (
                  <Row
                    key={row.id}
                    row={row}
                    clock={clock}
                    open={open}
                    failed={failed === row.id}
                    fresh={fresh.includes(row.id)}
                    onArrive={() => void arrived(row)}
                    onUndo={() => void undone(row)}
                  />
                ))}
              </ul>
            )}
          </>
        )}
        <p className="desk-unseen" role="status">
          {said}
        </p>
        {walkIn != null && (
          <WalkIn
            eventId={eventId}
            start={walkIn}
            checkIn={checkIn}
            offline={offline}
            onClose={() => {
              setWalkIn(null);
              opener.current?.focus();
            }}
            onMark={(row) => {
              setWalkIn(null);
              setTyped(row.name);
              if (row.arrival == null) void arrived(row);
            }}
            onAdded={(name, read, id) => {
              onRead(read);
              setTyped(name);
              setWalkIn(null);
              const at = arrivalOf(read, id);
              setSaid(t('checkIn.walkedIn', { name, time: at == null ? '' : clock(at) }));
            }}
          />
        )}
        {toast != null && <Toast key={toast} words={toast} onClose={() => setToast(null)} />}
      </div>
    </>
  );
}

function arrivalOf(checkIn: CheckIn, id: string): string | null {
  for (const guest of checkIn.guests) {
    if (guest.id === id) return guest.arrival?.at ?? null;
    for (const one of guest.companions) if (one.id === id) return one.arrival?.at ?? null;
  }

  return null;
}

function Search({ typed, onType }: { typed: string; onType: (typed: string) => void }) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <div className="ci-search">
      <label htmlFor={id} className="ci-label">
        {t('checkIn.searchByName')}
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
            aria-label={t('checkIn.clearSearch')}
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
  row,
  clock,
  open,
  failed,
  fresh,
  onArrive,
  onUndo,
}: {
  row: DoorRow;
  clock: (at: string) => string;
  open: boolean;
  failed: boolean;
  fresh: boolean;
  onArrive: () => void;
  onUndo: () => void;
}) {
  const { t } = useTranslation();
  const classes = ['ci-row', row.companion && 'is-companion', fresh && 'is-fresh']
    .filter(Boolean)
    .join(' ');

  return (
    <li className={classes}>
      <div className="ci-who">
        <p className="ci-name">{row.name}</p>
        {row.seat != null && <p className="ci-seat">{row.seat}</p>}
        <p className="ci-reply">
          <ReplyMark reply={row.reply} size={16} />
          {t(REPLY_KEY[row.reply])}
        </p>
        {row.arrival != null && (
          <p className="ci-here">
            <Glyph name="tick" size={16} weight={3} />
            {t('checkIn.arrivedAtBy', {
              time: clock(row.arrival.at),
              name: row.arrival.by ?? '',
            })}
          </p>
        )}
        {failed && (
          <p className="ci-failed">
            <Glyph name="alert" size={16} weight={2.2} />
            {t('checkIn.notRecorded')}
          </p>
        )}
      </div>
      {open &&
        (row.arrival != null ? (
          <button
            type="button"
            className="ci-secondary"
            aria-label={t('checkIn.undoFor', { name: row.name })}
            onClick={onUndo}
          >
            {t('checkIn.undo')}
          </button>
        ) : (
          <button
            type="button"
            className="ci-primary is-row"
            aria-label={t('checkIn.arrivedFor', { name: row.name })}
            onClick={onArrive}
          >
            {t('checkIn.arrived')}
          </button>
        ))}
    </li>
  );
}

/** Add walk-in: a sheet rising at the phone, a centred 480 dialog at a desk. The name is checked before anything is sent. */
function WalkIn({
  eventId,
  start,
  checkIn,
  offline,
  onClose,
  onMark,
  onAdded,
}: {
  eventId: string;
  start: WalkInStart;
  checkIn: CheckIn;
  offline: boolean;
  onClose: () => void;
  onMark: (row: DoorRow) => void;
  onAdded: (name: string, read: CheckIn, id: string) => void;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const id = useId();
  const sheet = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(start.name);
  const [checked, setChecked] = useState(false);
  const [same, setSame] = useState<DoorRow | null>(null);
  const [refused, setRefused] = useState(false);
  const [busy, setBusy] = useState(false);
  const problem = checked ? walkInProblem(name) : null;

  useDialogKeys(sheet, onClose, false);
  useEffect(() => field.current?.focus(), []);

  async function add(allowDuplicate: boolean): Promise<void> {
    const trimmed = name.trim();
    if (offline) {
      setRefused(true);
      return;
    }
    setBusy(true);
    setRefused(false);
    try {
      const { walkIn, checkIn: read } = await api.addWalkIn(eventId, trimmed, allowDuplicate);
      onAdded(trimmed, read, walkIn);
    } catch (error) {
      setBusy(false);
      if (error instanceof ApiError && error.is('guest_already_listed'))
        setSame(listedAs(t, checkIn, trimmed, locale));
      else setRefused(true);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setChecked(true);
    if (walkInProblem(name) != null) {
      field.current?.focus();
      return;
    }
    const found = listedAs(t, checkIn, name, locale);

    if (found != null && same == null) setSame(found);
    else void add(same != null);
  }

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
        <h2 id={`${id}-title`}>{t('checkIn.addWalkIn')}</h2>
        <form className="ci-form" noValidate onSubmit={submit}>
          {same != null && (
            <div className="ci-amber" role="alert">
              <p>{t('checkIn.alreadyListed', { name: same.name })}</p>
              <button type="button" className="ci-primary" onClick={() => onMark(same)}>
                {t('checkIn.markThemArrived')}
              </button>
              <button
                type="button"
                className="ci-secondary"
                disabled={busy}
                onClick={() => void add(true)}
              >
                {t('checkIn.addSomeoneNew')}
              </button>
            </div>
          )}
          <label htmlFor={`${id}-name`} className="ci-label">
            {t('checkIn.fullName')}
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
              {problem === 'blank'
                ? t('checkIn.nameBlank')
                : t('checkIn.nameLong', { count: NAME_MOST })}
            </p>
          )}
          <p id={`${id}-hint`} className="ci-hint">
            {t('checkIn.walkInHint')}
          </p>
          {refused && (
            <p className="ci-failed" role="alert">
              <Glyph name="alert" size={16} weight={2.2} />
              {t('checkIn.notRecorded')}
            </p>
          )}
          {same == null && (
            <button type="submit" className="ci-primary" disabled={busy}>
              {t('checkIn.addAndArrive')}
            </button>
          )}
          <button type="button" className="ci-secondary" onClick={onClose}>
            {t('checkIn.cancel')}
          </button>
        </form>
      </div>
    </>
  );
}

/** sc-3912's page in the list's place once the link or code no longer answers: nothing of the event stays on the screen. */
export function LinkGone() {
  const { t } = useTranslation();

  return (
    <Page back={null}>
      <div className="ci-column">
        <div className="ci-card">
          <h1 className="ci-title">{t('staffLink.goneTitle')}</h1>
          <p>{t('staffLink.goneBody')}</p>
          <p>{t('staffLink.goneNext')}</p>
        </div>
        <p className="ci-foot">{t('staffLink.foot')}</p>
      </div>
    </Page>
  );
}

/** Check-in's address in a browser that is not signed in: it names no guest, event or person. */
export function NotSignedIn({ signedOut = false }: { signedOut?: boolean }) {
  const { t } = useTranslation();
  const title = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (signedOut) title.current?.focus();
  }, [signedOut]);

  return (
    <Page back={null}>
      <div className="ci-column">
        <div className="ci-card">
          {signedOut && (
            <p className="rd-signed-out" role="status">
              <SignOutLine size={26} />
              {t('redeem.signedOut')}
            </p>
          )}
          <h1 ref={title} tabIndex={-1} className="ci-title">
            {t('checkIn.notSignedIn.title')}
          </h1>
          <p>{t('checkIn.notSignedIn.body')}</p>
          <Link className="ci-primary" to="/d">
            {t('checkIn.notSignedIn.cta')}
          </Link>
        </div>
      </div>
    </Page>
  );
}
