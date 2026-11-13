import {
  ApiError,
  GUEST_NAME_MAXIMUM,
  type Guest,
  type GuestDetails,
  type GuestList,
  type OrganisationEvent,
  asGuestList,
  realtimeTopic,
} from '@soirely/api-client';
import {
  deviceCountry,
  formatPhone,
  eventAllows,
  phoneScreenCountry,
  shownPhase,
} from '@soirely/domain';
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useEffectEvent,
  useReducer,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useBlocker, useSearchParams } from 'react-router';

import { api } from '../../../api.ts';
import { config } from '../../../config.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { Skeleton } from '../../../components/Skeleton.tsx';
import {
  Ask,
  CardStep,
  Chevron,
  RowWords,
  TextAction,
} from '../../../components/SettingsParts.tsx';
import { Toast } from '../../../components/Toast.tsx';
import { LayersContext, focusWhenFree, useDeskLayers } from '../../../layers.ts';
import { type Mesh, meshFor } from '../../../mesh.ts';
import { pageTitle, usePageTitle } from '../../../pageTitle.ts';
import { phoneProblemMessage } from '../../../phoneProblem.ts';
import { useLoadedAt, useServerNow } from '../../../serverNow.ts';
import { canOn, useSession } from '../../../session.ts';
import { DraftRow } from './MakeLive.tsx';
import {
  type ListRow,
  MOST_COMPANIONS,
  type Problem,
  type Problems,
  type Typed,
  firstProblem,
  isListed,
  newGuestOf,
  problemsOf,
  rowsOf,
  shownReply,
  violationProblems,
  withGuest,
} from './guestRows.ts';
import {
  GuestColumn,
  REPLY_KEY,
  ReplyMark,
  companionShown,
  guestAddress,
} from './GuestColumn.tsx';
import { replyDate } from './guestDates.ts';
import { CompanionField, GuestField, PhoneField } from './GuestFields.tsx';
import '../../../components/desk.css';
import '../../../components/SettingsParts.css';
import '../../../components/eventsDesk.css';
import '../../../components/EventsList.css';
import '../../../components/eventPage.css';
import './guests.css';

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; list: GuestList };

const RETRY_MS = 5_000;
const RENEW_BEFORE_MS = 60_000;
const FOCUSABLE = 'button, a[href], input, select, [tabindex]';

/** The guest list as the API holds it, published to every page open on it. */
function useLiveGuests(eventId: string, onList: (list: GuestList) => void, onGap: () => void) {
  const latest = useRef({ onList, onGap });

  useEffect(() => {
    latest.current = { onList, onGap };
  });

  useEffect(() => {
    const hub = config().mercureUrl;
    if (hub === '') return;

    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const connect = async (): Promise<void> => {
      let subscription;
      try {
        subscription = await api.guestsSubscription(eventId);
      } catch {
        if (!stopped) timer = setTimeout(() => void connect(), RETRY_MS);
        return;
      }
      if (stopped) return;

      const url = new URL(hub);
      url.searchParams.append('topic', realtimeTopic('EventGuests', eventId));
      url.searchParams.append('authorization', subscription.token);

      source?.close();
      source = new EventSource(url);
      source.onopen = () => latest.current.onGap();
      source.onmessage = (message: MessageEvent<string>) => {
        let list: GuestList | null = null;
        try {
          list = asGuestList(JSON.parse(message.data));
        } catch {
          list = null;
        }
        if (list == null) latest.current.onGap();
        else latest.current.onList(list);
      };
      source.onerror = () => {
        if (source?.readyState !== EventSource.CLOSED || stopped) return;
        clearTimeout(timer);
        timer = setTimeout(() => void connect(), RETRY_MS);
      };

      const lapses = Date.parse(subscription.expiresAt) - Date.now() - RENEW_BEFORE_MS;
      clearTimeout(timer);
      timer = setTimeout(() => void connect(), Math.max(lapses, RETRY_MS));
    };

    void connect();

    return () => {
      stopped = true;
      clearTimeout(timer);
      source?.close();
    };
  }, [eventId]);
}

/** The code the Mobile number starts on, as the account's own Mobile number field picks it. */
function useStartingCountry(asks: boolean): string {
  const session = useSession();
  const [numbers, setNumbers] = useState<
    readonly { primary: boolean; countryCode: string | null }[]
  >([]);

  useEffect(() => {
    if (!asks) return;
    let current = true;

    api.me().then(
      (me) => current && setNumbers(me.phoneNumbers),
      () => undefined,
    );

    return () => {
      current = false;
    };
  }, [asks]);

  return phoneScreenCountry(
    { organisationCountry: session.organisationCountry ?? null, phoneNumbers: numbers },
    deviceCountry(navigator.languages),
  );
}

/** Focus asked for by `data-focus` key, given once the next render has drawn it. */
function useFocusKeys(root: RefObject<HTMLElement | null>) {
  const pending = useRef<string[]>([]);
  const [, rerender] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    const keys = pending.current;

    if (keys.length === 0) return;
    pending.current = [];
    focusWhenFree(() => {
      for (const key of keys) {
        const at = root.current?.querySelector<HTMLElement>(`[data-focus="${key}"]`);

        if (at == null) continue;

        return at.matches(FOCUSABLE) ? at : at.querySelector<HTMLElement>(FOCUSABLE);
      }

      return null;
    });
  });

  return useCallback((...keys: string[]) => {
    pending.current = keys;
    rerender();
  }, []);
}

/** A deleted event's Guests answers as an event that never existed does, its heading focused (sc-1468). */
export function GuestsGone({ heading }: { heading: RefObject<HTMLHeadingElement | null> }) {
  const { t } = useTranslation();

  usePageTitle(pageTitle(t, [t('eventPage.notFound')]));
  useEffect(() => heading.current?.focus(), [heading]);

  return (
    <div className="desk ev gs">
      <div className="ev-wide gs-page">
        <header className="gs-top">
          <h1 ref={heading} className="gs-title" tabIndex={-1}>
            {t('eventPage.notFound')}
          </h1>
        </header>
      </div>
    </div>
  );
}

export function GuestsArea({
  event,
  tag,
  heading,
  onChange,
}: {
  event: OrganisationEvent;
  tag: string;
  heading: RefObject<HTMLHeadingElement | null>;
  onChange: (event: OrganisationEvent, tag: string) => void;
}) {
  const { t } = useTranslation();
  const { layers, covered, setHost } = useDeskLayers();
  const now = useServerNow();
  const phase = shownPhase(event, useLoadedAt(event), now);
  const invites = eventAllows(phase, 'invite');
  const root = useRef<HTMLDivElement>(null);
  const focus = useFocusKeys(root);
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [heard, setHeard] = useState(0);
  const [flagged, setFlagged] = useState<ReadonlySet<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [params, setParams] = useSearchParams();
  const open = adding ? null : params.get('guest');
  const [stamp, setStamp] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [asking, setAsking] = useState<(() => void) | null>(null);
  const [saved, setSaved] = useState(false);
  const lastRow = useRef<string | null>(open);
  const addAfter = useRef(false);
  const headingOwed = useRef(false);
  const column = useRef<HTMLElement>(null);
  const manages = canOn(event, 'guests.manage');
  const country = useStartingCountry(manages);
  const away = useBlocker(dirty);

  useEffect(() => {
    if (!dirty) return;

    const ask = (leaving: BeforeUnloadEvent): void => leaving.preventDefault();
    window.addEventListener('beforeunload', ask);

    return () => window.removeEventListener('beforeunload', ask);
  }, [dirty]);

  useEffect(() => {
    if (open != null) lastRow.current = open;
  }, [open]);

  usePageTitle(pageTitle(t, [t('eventPage.guests'), event.name]));

  useEffect(() => {
    let current = true;

    api.guests(event.id).then(
      (list) => current && setLoad({ kind: 'loaded', list }),
      () => current && setLoad((was) => (was.kind === 'loaded' ? was : { kind: 'failed' })),
    );

    return () => {
      current = false;
    };
  }, [event.id, attempt]);

  useEffect(() => {
    let current = true;

    if (manages) {
      api.flaggedGuests(event.id).then(
        (ids) => current && setFlagged(new Set(ids)),
        () => undefined,
      );
    }

    return () => {
      current = false;
    };
  }, [event.id, manages, attempt, heard]);

  useLiveGuests(
    event.id,
    (list) => {
      setStamp((n) => n + 1);
      setHeard((n) => n + 1);
      if (manages) setAttempt((n) => n + 1);
      else setLoad({ kind: 'loaded', list });
    },
    () => setAttempt((n) => n + 1),
  );

  function startAdd(): void {
    if (dirty) {
      addAfter.current = true;
      setParams({}, { replace: true });
      return;
    }
    if (open != null) setParams({}, { replace: true });
    showAdd();
  }

  function showAdd(): void {
    setAdding(true);
    focus('fullName');
  }

  function openGuest(id: string): void {
    setAdding(false);
    setParams({ guest: id });
    headingOwed.current = id !== open;
    focus('guest-heading');
  }

  function close(): void {
    setParams({});
    focus(`row:${lastRow.current ?? ''}`, 'title');
  }

  const onEscape = useEffectEvent((key: globalThis.KeyboardEvent) => {
    if (key.key !== 'Escape' || key.defaultPrevented || adding || open == null || dirty) return;
    key.preventDefault();
    close();
  });

  useEffect(() => {
    const at = column.current;
    const listen = (key: globalThis.KeyboardEvent) => onEscape(key);

    at?.addEventListener('keydown', listen);

    return () => at?.removeEventListener('keydown', listen);
  });

  function changed(guest: GuestDetails): void {
    setLoad((was) =>
      was.kind === 'loaded'
        ? {
            kind: 'loaded',
            list: {
              ...was.list,
              guests: was.list.guests.map((one) => (one.id === guest.id ? guest : one)),
            },
          }
        : was,
    );
  }

  /** A phase that no longer invites: the event is read again, so the page says why, and the refusal still reaches the caller. */
  function phaseRefused(error: unknown): never {
    if (error instanceof ApiError && error.is('event_state_invalid')) {
      void api.taggedEvent(event.id).then(
        (latest) => {
          onChange(latest.event, latest.tag);
          window.setTimeout(() => heading.current?.focus(), 0);
        },
        () => undefined,
      );
    }

    throw error;
  }

  const guests = load.kind === 'loaded' ? load.list.guests : [];
  const counts = load.kind === 'loaded' ? load.list.counts : null;

  return (
    <LayersContext value={layers}>
      <div ref={root} className="desk ev gs">
        <div className="ev-wide gs-page" inert={covered}>
          <div className="ev-crumb-row">
            <nav className="ev-crumb" aria-label={t('eventPage.crumb')}>
              <ol>
                <li className="ev-crumb-part">
                  <Link to="/app/events">{t('events.title')}</Link>
                </li>
                <li className="ev-crumb-part">
                  <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                  <Link
                    className="ev-crumb-name"
                    to={`/app/events/${encodeURIComponent(event.id)}`}
                  >
                    {event.name}
                  </Link>
                </li>
                <li className="ev-crumb-part" aria-current="page">
                  <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                  <span className="ev-crumb-name">{t('eventPage.guests')}</span>
                </li>
              </ol>
            </nav>
          </div>
          <header className="gs-top">
            <h1 ref={heading} className="gs-title" tabIndex={-1} data-focus="title">
              {t('eventPage.guests')}
            </h1>
            {manages && guests.length > 0 && (
              <button type="button" className="ev-new" data-focus="add" onClick={startAdd}>
                <Glyph name="plus" size={18} weight={2.4} />
                {t('guestList.addGuest')}
              </button>
            )}
          </header>
          <DraftRow
            event={event}
            tag={tag}
            now={now}
            manages={canOn(event, 'events.manage')}
            heading={heading}
            onChange={onChange}
            onMadeLive={() => undefined}
          />
          {(phase === 'paused' || phase === 'finished') && (
            <p className="desk-line gs-blocked">
              {t(phase === 'paused' ? 'guestList.pausedLine' : 'guestList.finishedLine')}
            </p>
          )}
          {load.kind === 'loading' && (
            <Skeleton words={t('pending.loading')} shape="rows" rowHeight={64} />
          )}
          {load.kind === 'failed' && (
            <div className="desk-failed gs-failed" role="alert">
              <h2>{t('guestList.loadFailed')}</h2>
              <p className="desk-line">{t('guestList.loadFailedLine')}</p>
              <TextAction
                label={t('events.retry')}
                onClick={() => {
                  setLoad({ kind: 'loading' });
                  setAttempt((n) => n + 1);
                }}
              />
            </div>
          )}
          {load.kind === 'loaded' && (
            <>
              {guests.length === 0 && (
                <GuestsCover
                  mesh={meshFor(event.id)}
                  says={t('guestList.noGuests')}
                  step={manages ? { label: t('guestList.addGuest'), onClick: startAdd } : null}
                />
              )}
              {counts != null && guests.length > 0 && (
                <GuestsCover
                  mesh={meshFor(event.id)}
                  says={t('guestList.onTheList', { count: counts.people })}
                />
              )}
              {(guests.length > 0 || adding) && (
                <div className="gs-cols">
                  <section className="gs-list" aria-label={t('eventPage.guests')}>
                    {guests.length > 0 && (
                      <Rows
                        rows={rowsOf(guests)}
                        eventId={event.id}
                        timeZone={event.timeZone}
                        open={open}
                        onOpen={openGuest}
                      />
                    )}
                  </section>
                  {!adding && (
                    <section
                      ref={column}
                      className="gs-column"
                      aria-label={guests.find((one) => one.id === open)?.fullName}
                    >
                      {open == null ? (
                        <p className="gs-pick">{t('guestList.pick')}</p>
                      ) : (
                        <GuestColumn
                          key={open}
                          eventId={event.id}
                          guestId={open}
                          timeZone={event.timeZone}
                          mesh={meshFor(event.id)}
                          manages={manages}
                          guests={guests}
                          country={country}
                          stamp={stamp}
                          invites={invites}
                          draft={phase === 'draft'}
                          flagged={flagged.has(open)}
                          onCopy={() => api.guestLink(event.id, open).catch(phaseRefused)}
                          onMark={(how) => api.markInvited(event.id, open, how).catch(phaseRefused)}
                          onUnmark={() => api.markNotInvited(event.id, open)}
                          onChanged={changed}
                          onReplace={() =>
                            api
                              .replaceGuestLink(event.id, open)
                              .then(() =>
                                setFlagged((was) => new Set([...was].filter((id) => id !== open))),
                              )
                          }
                          focus={focus}
                          onDirty={setDirty}
                          onAsk={(then) => setAsking(() => then)}
                          onClose={close}
                          onShown={() => {
                            if (!headingOwed.current) return;
                            headingOwed.current = false;
                            focus('guest-heading');
                          }}
                          onSaved={(guest) => {
                            changed(guest);
                            setSaved(true);
                          }}
                        />
                      )}
                    </section>
                  )}
                  {adding && (
                    <section className="gs-column" aria-label={t('guestList.addGuest')}>
                      <AddForm
                        eventId={event.id}
                        guests={guests}
                        country={country}
                        focus={focus}
                        onAdded={(guest) =>
                          setLoad((was) =>
                            was.kind === 'loaded'
                              ? { kind: 'loaded', list: withGuest(was.list, guest) }
                              : was,
                          )
                        }
                        onDone={() => {
                          setAdding(false);
                          focus('add', 'title');
                        }}
                      />
                    </section>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        {(asking != null || away.state === 'blocked') && (
          <Ask
            title={t('guestList.discardTitle')}
            line={t('guestList.discardLine', {
              name: guests.find((one) => one.id === open)?.fullName ?? '',
            })}
            keep={t('guestList.keepEditing')}
            go={t('guestList.discard')}
            onKeep={() => {
              addAfter.current = false;
              setAsking(null);
              away.reset?.();
            }}
            onGo={() => {
              const then = asking;

              setAsking(null);
              setDirty(false);
              if (then != null) then();
              else away.proceed?.();
              if (addAfter.current) {
                addAfter.current = false;
                showAdd();
              }
            }}
          />
        )}
        {saved && <Toast words={t('guestList.saved')} onClose={() => setSaved(false)} />}
        <div ref={setHost} className="desk-layers" />
      </div>
    </LayersContext>
  );
}

const PIECES = [1, 2, 3, 4, 5, 6];

/** The summary card in the two states this story reaches, no guests yet and nobody invited yet; sc-3772 brings its other lines and steps. */
function GuestsCover({
  mesh,
  says,
  step = null,
}: {
  mesh: Mesh;
  says: string;
  step?: { label: string; onClick: () => void } | null;
}) {
  return (
    <section className={`ev-card today-cover is-${mesh} gs-card is-page`}>
      <span className="ev-scrim" aria-hidden="true" />
      {PIECES.map((piece) => (
        <span key={piece} className={`desk-piece p${piece}`} aria-hidden="true" />
      ))}
      <div className="ev-card-inner gs-card-inner">
        <p className="gs-says">{says}</p>
        {step != null && (
          <div className="ev-card-foot">
            <CardStep label={step.label} onClick={step.onClick} />
          </div>
        )}
      </div>
    </section>
  );
}

/** Each row is a link to its guest's address; a companion's opens their guest. */
function Rows({
  rows,
  eventId,
  timeZone,
  open,
  onOpen,
}: {
  rows: readonly ListRow[];
  eventId: string;
  /** The event's: a reply's date is the day it was in the event's zone. */
  timeZone: string;
  open: string | null;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <ul className="desk-rows gs-rows">
      {rows.map((row) => {
        if (row.kind === 'guest') {
          const { guest } = row;
          const shown = shownReply(guest);
          const word = t(REPLY_KEY[shown]);
          const reply =
            guest.repliedAt == null
              ? word
              : t('guestList.replied', {
                  reply: word,
                  date: replyDate(guest.repliedAt, timeZone),
                });
          const mobile = guest.mobile == null ? null : formatPhone(guest.mobile);
          const contact =
            guest.email != null && mobile != null
              ? t('guestList.contacts', { email: guest.email, mobile })
              : (guest.email ?? mobile);

          return (
            <li key={guest.id}>
              <RowLink
                eventId={eventId}
                guestId={guest.id}
                rowId={guest.id}
                open={open}
                onOpen={onOpen}
              >
                <span className="gs-lead">
                  <ReplyMark reply={shown} />
                </span>
                <RowWords
                  title={guest.fullName}
                  lines={[contact == null ? reply : t('guestList.line', { reply, contact })]}
                />
              </RowLink>
            </li>
          );
        }

        const { host, companion, at } = row;
        const name = companionShown(
          t,
          host.fullName,
          host.companions.map((one) => one.fullName),
          at,
        );

        return (
          <li key={companion.id} className="is-companion">
            <RowLink
              eventId={eventId}
              guestId={host.id}
              rowId={companion.id}
              open={null}
              onOpen={onOpen}
            >
              <span className="gs-lead">
                <ReplyMark reply={companion.state} />
              </span>
              <RowWords title={name} lines={[t(REPLY_KEY[companion.state])]} />
            </RowLink>
          </li>
        );
      })}
    </ul>
  );
}

function RowLink({
  eventId,
  guestId,
  rowId,
  open,
  onOpen,
  children,
}: {
  eventId: string;
  guestId: string;
  rowId: string;
  open: string | null;
  onOpen: (id: string) => void;
  children: ReactNode;
}) {
  const on = open === guestId;

  return (
    <Link
      to={guestAddress(eventId, guestId)}
      className={on ? 'desk-row gs-row is-on' : 'desk-row gs-row'}
      aria-current={on ? 'true' : undefined}
      data-focus={`row:${rowId}`}
      onClick={(press) => {
        if (press.metaKey || press.ctrlKey || press.shiftKey || press.button !== 0) return;
        press.preventDefault();
        onOpen(guestId);
      }}
    >
      {children}
      <Chevron />
    </Link>
  );
}

function fieldOf(key: string, problems: Problems): string {
  return key === 'mobile' && problems.mobile === 'noCountry' ? 'country' : key;
}

const EMPTY: Omit<Typed, 'country'> = { fullName: '', email: '', number: '', companions: [] };

/** Add guest in place beside the list: it stays open after each guest, cleared, focus back on Full name. */
function AddForm({
  eventId,
  guests,
  country,
  focus,
  onAdded,
  onDone,
}: {
  eventId: string;
  guests: readonly Guest[];
  country: string;
  focus: (...keys: string[]) => void;
  onAdded: (guest: Guest) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState<Omit<Typed, 'country'>>(EMPTY);
  const [picked, setPicked] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [refused, setRefused] = useState<Problems>({});
  const [duplicate, setDuplicate] = useState(false);
  const [failed, setFailed] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const values: Typed = { ...typed, country: picked ?? country };
  const problems: Problems = { ...(tried ? problemsOf(values) : {}), ...refused };

  function change(next: Partial<Omit<Typed, 'country'>>): void {
    setTyped((was) => ({ ...was, ...next }));
    setRefused({});
    if (next.fullName != null) setDuplicate(false);
  }

  function words(key: string): string | undefined {
    const problem: Problem | undefined = problems[key];

    if (problem == null) return undefined;
    if (typeof problem === 'object') return problem.refused;
    if (problem === 'blank') return t('guestList.blankName');
    if (problem === 'tooLong') return t('guestList.nameTooLong', { most: GUEST_NAME_MAXIMUM });
    if (problem === 'emailShape') return t('forms.emailShape');

    return (
      phoneProblemMessage(
        problem === 'phoneTooShort'
          ? 'tooShort'
          : problem === 'phoneTooLong'
            ? 'tooLong'
            : 'noCountry',
        values.country,
        t,
      ) ?? undefined
    );
  }

  async function add(allowDuplicate = false): Promise<void> {
    if (busy) return;
    const first = firstProblem(problemsOf(values), values.companions.length);

    if (first != null) {
      setTried(true);
      setRefused({});
      focus(fieldOf(first, problemsOf(values)));
      return;
    }
    if (!allowDuplicate && isListed(guests, values.fullName)) {
      setDuplicate(true);
      focus('duplicate');
      return;
    }
    setBusy(true);
    setFailed(false);
    setSaid(null);
    try {
      const guest = await api.addGuest(eventId, newGuestOf(values, allowDuplicate));

      onAdded(guest);
      setSaid(t('guestList.justAdded', { name: guest.fullName }));
      setTyped(EMPTY);
      setTried(false);
      setDuplicate(false);
      focus('fullName');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'guest_already_listed') {
        setDuplicate(true);
        focus('duplicate');
      } else if (error instanceof ApiError && error.status === 422) {
        const found = violationProblems(error.problem.violations ?? [], values);
        const at = firstProblem(found, values.companions.length);

        if (at == null) setFailed(true);
        else {
          setRefused(found);
          focus(fieldOf(at, found));
        }
      } else setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const onEscape = useEffectEvent((event: globalThis.KeyboardEvent) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    onDone();
  });

  useEffect(() => {
    const at = box.current;
    const listen = (event: globalThis.KeyboardEvent) => onEscape(event);

    at?.addEventListener('keydown', listen);

    return () => at?.removeEventListener('keydown', listen);
  }, []);

  return (
    <div ref={box} className="gs-form">
      <div className="gs-col-head">
        <h2 className="gs-col-title" tabIndex={-1} data-focus="form-heading">
          {t('guestList.addGuest')}
        </h2>
        <div className="gs-col-actions">
          <button type="button" className="desk-text" onClick={onDone}>
            {t('guestList.done')}
          </button>
        </div>
      </div>
      {said != null && (
        <p className="gs-ok" role="status">
          <Glyph name="tick" size={17} weight={2.6} />
          {said}
        </p>
      )}
      {failed && (
        <p className="desk-error gs-refused" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {t('guestList.notAdded')}
        </p>
      )}
      <div className="desk-fields gs-fields">
        <GuestField
          label={t('account.fullName')}
          value={typed.fullName}
          error={words('fullName')}
          focusKey="fullName"
          onChange={(fullName) => change({ fullName })}
        />
        <GuestField
          label={t('guestList.emailAddress')}
          value={typed.email}
          optional
          type="email"
          error={words('email')}
          focusKey="email"
          onChange={(email) => change({ email })}
        />
        <PhoneField
          country={values.country}
          number={typed.number}
          error={words('mobile')}
          onCountry={(code) => {
            setPicked(code);
            setRefused({});
          }}
          onNumber={(number) => change({ number })}
        />
        {duplicate && (
          <div className="gs-amber" role="alert">
            <h3 className="gs-amber-head" tabIndex={-1} data-focus="duplicate">
              <Glyph name="alert" size={17} weight={2.2} />
              {t('guestList.duplicate', { name: values.fullName.trim() })}
            </h3>
            <div className="gs-pair">
              <button
                type="button"
                className="gs-pill is-primary"
                aria-busy={busy || undefined}
                onClick={() => void add(true)}
              >
                {t('guestList.addAnyway')}
              </button>
              <button
                type="button"
                className="gs-pill is-secondary"
                onClick={() => {
                  setDuplicate(false);
                  focus('fullName');
                }}
              >
                {t('guestList.cancel')}
              </button>
            </div>
          </div>
        )}
        <CompanionFields
          host={values.fullName.trim()}
          companions={typed.companions}
          words={words}
          focus={focus}
          onChange={(companions) => change({ companions })}
        />
      </div>
      <button
        type="button"
        className="gs-pill is-primary is-tall"
        aria-busy={busy || undefined}
        onClick={() => void add()}
      >
        {t('guestList.addGuest')}
      </button>
    </div>
  );
}

function CompanionFields({
  host,
  companions,
  words,
  focus,
  onChange,
}: {
  host: string;
  companions: readonly string[];
  words: (key: string) => string | undefined;
  focus: (...keys: string[]) => void;
  onChange: (companions: string[]) => void;
}) {
  const { t } = useTranslation();
  const count = companions.length;

  return (
    <fieldset className="gs-fieldset gs-companions">
      <legend className="gs-legend">{t('guestList.companionsTitle')}</legend>
      <p className="gs-count">
        {count === 0
          ? t('guestList.noneYet', { most: MOST_COMPANIONS })
          : t('guestList.ofMost', { n: count, most: MOST_COMPANIONS })}
      </p>
      {companions.map((name, at) => {
        const placeholder =
          host === ''
            ? ''
            : at === 0
              ? t('guestList.guestOf', { host })
              : t('guestList.guestOfNth', { host, nth: at + 1 });
        const label = t('guestList.companionName', { nth: at + 1, total: count });
        const error = words(`companion-${at}`);

        return (
          <CompanionField
            key={at}
            at={at}
            name={name}
            host={host}
            label={label}
            placeholder={placeholder}
            error={error}
            onChange={(typed) =>
              onChange(companions.map((each, index) => (index === at ? typed : each)))
            }
            onRemove={() => {
              onChange(companions.filter((_, index) => index !== at));
              focus(`companion-${at + 1 < count ? at : at - 1}`, 'add-companion');
            }}
          />
        );
      })}
      {count < MOST_COMPANIONS ? (
        <button
          type="button"
          className="desk-text"
          data-focus="add-companion"
          onClick={() => {
            onChange([...companions, '']);
            focus(`companion-${count}`);
          }}
        >
          <Glyph name="plus" size={17} weight={2.3} />
          {t('guestList.addCompanion')}
        </button>
      ) : (
        <p className="gs-most">{t('guestList.mostCompanions', { most: MOST_COMPANIONS })}</p>
      )}
    </fieldset>
  );
}
