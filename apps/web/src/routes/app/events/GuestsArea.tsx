import {
  ApiError,
  GUEST_NAME_MAXIMUM,
  type Guest,
  type GuestList,
  type OrganisationEvent,
  asGuestList,
  realtimeTopic,
} from '@soirely/api-client';
import {
  callingCode,
  countryChoices,
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
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';

import { api } from '../../../api.ts';
import { config } from '../../../config.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { Skeleton } from '../../../components/Skeleton.tsx';
import { CardStep, Chevron, RowWords, TextAction } from '../../../components/SettingsParts.tsx';
import { currentLocale } from '../../../i18n/index.ts';
import { LayersContext, focusWhenFree, useDeskLayers } from '../../../layers.ts';
import { type Mesh, meshFor } from '../../../mesh.ts';
import { pageTitle, usePageTitle } from '../../../pageTitle.ts';
import { codeChoice, phoneProblemMessage } from '../../../phoneProblem.ts';
import { useLoadedAt, useServerNow } from '../../../serverNow.ts';
import { canOn, useSession } from '../../../session.ts';
import { GuestColumn } from './GuestColumn.tsx';
import { DraftRow } from './MakeLive.tsx';
import {
  type ListRow,
  MOST_COMPANIONS,
  type Problem,
  type Problems,
  type ReplyWord,
  type Typed,
  blank,
  firstProblem,
  isListed,
  newGuestOf,
  problemsOf,
  rowsOf,
  violationProblems,
  withGuest,
} from './guestRows.ts';
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

const REPLY_KEY: Record<ReplyWord, string> = {
  coming: 'guestList.reply.coming',
  maybe: 'guestList.reply.maybe',
  notComing: 'guestList.reply.notComing',
  noReply: 'guestList.reply.noReply',
  held: 'guestList.reply.held',
};

const MARK: Record<ReplyWord, string> = {
  coming: 'is-coming',
  maybe: 'is-maybe',
  notComing: 'is-not-coming',
  noReply: 'is-no-reply',
  held: 'is-held',
};

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
  const [address, setAddress] = useSearchParams();
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
  const manages = canOn(event, 'guests.manage');
  const country = useStartingCountry(manages);

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
      setLoad({ kind: 'loaded', list });
      setHeard((n) => n + 1);
    },
    () => setAttempt((n) => n + 1),
  );

  function startAdd(): void {
    setAdding(true);
    focus('fullName');
  }

  const guests = load.kind === 'loaded' ? load.list.guests : [];
  const counts = load.kind === 'loaded' ? load.list.counts : null;
  const openId = address.get('guest');
  const open = adding ? null : (guests.find((guest) => guest.id === openId) ?? null);

  function openGuest(id: string): void {
    setAdding(false);
    setAddress({ guest: id });
    focus('guest-heading');
  }

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
                      <Rows rows={rowsOf(guests)} open={open?.id ?? null} onOpen={openGuest} />
                    )}
                  </section>
                  {open != null && (
                    <section className="gs-column" aria-label={open.fullName}>
                      <GuestColumn
                        key={open.id}
                        guest={open}
                        mesh={meshFor(event.id)}
                        reply={t(REPLY_KEY[open.reply])}
                        mark={MARK[open.reply]}
                        manages={manages}
                        invites={invites}
                        flagged={flagged.has(open.id)}
                        onCopy={() =>
                          api.guestLink(event.id, open.id).catch((error: unknown) => {
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
                          })
                        }
                        onReplace={() =>
                          api
                            .replaceGuestLink(event.id, open.id)
                            .then(() =>
                              setFlagged((was) => new Set([...was].filter((id) => id !== open.id))),
                            )
                        }
                      />
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

function ReplyMark({ reply }: { reply: ReplyWord }) {
  return (
    <span className="gs-lead">
      <span className={`gs-mark ${MARK[reply]}`} aria-hidden="true">
        {reply === 'coming' && <Glyph name="tick" size={15} weight={3.2} />}
        {reply === 'notComing' && <span className="gs-bar" />}
        {reply === 'maybe' && <Glyph name="question" size={18} weight={2.8} />}
      </span>
    </span>
  );
}

function Rows({
  rows,
  open,
  onOpen,
}: {
  rows: readonly ListRow[];
  open: string | null;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <ul className="desk-rows gs-rows">
      {rows.map((row) => {
        if (row.kind === 'guest') {
          const { guest } = row;
          const reply = t(REPLY_KEY[guest.reply]);
          const mobile = guest.mobile == null ? null : formatPhone(guest.mobile);
          const contact =
            guest.email != null && mobile != null
              ? t('guestList.contacts', { email: guest.email, mobile })
              : (guest.email ?? mobile);

          return (
            <li key={guest.id}>
              <button
                type="button"
                className={guest.id === open ? 'desk-row gs-row is-on' : 'desk-row gs-row'}
                aria-current={guest.id === open ? 'true' : undefined}
                data-focus={`row:${guest.id}`}
                onClick={() => onOpen(guest.id)}
              >
                <ReplyMark reply={guest.reply} />
                <RowWords
                  title={guest.fullName}
                  lines={[contact == null ? reply : t('guestList.line', { reply, contact })]}
                />
                <Chevron />
              </button>
            </li>
          );
        }

        const { host, companion, nth } = row;
        const name = blank(companion.fullName)
          ? nth == null
            ? t('guestList.guestOf', { host: host.fullName })
            : t('guestList.guestOfNth', { host: host.fullName, nth })
          : (companion.fullName ?? '');

        return (
          <li key={companion.id} className="is-companion">
            <div className="desk-row gs-row">
              <ReplyMark reply={companion.state} />
              <RowWords title={name} lines={[t(REPLY_KEY[companion.state])]} />
            </div>
          </li>
        );
      })}
    </ul>
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
            label={label}
            remove={
              name.trim() !== ''
                ? t('guestList.removeNamed', { name: name.trim() })
                : host === ''
                  ? t('guestList.removeNamed', { name: label })
                  : at === 0
                    ? t('guestList.removeCompanionOf', { host })
                    : t('guestList.removeCompanionOfNth', { host, nth: at + 1 })
            }
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

function CompanionField({
  at,
  name,
  label,
  remove,
  placeholder,
  error,
  onChange,
  onRemove,
}: {
  at: number;
  name: string;
  label: string;
  remove: string;
  placeholder: string;
  error: string | undefined;
  onChange: (name: string) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <div className="gs-companion-field">
      <div className="gs-companion">
        <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
          <input
            type="text"
            value={name}
            placeholder={placeholder}
            spellCheck={false}
            autoComplete="off"
            data-focus={`companion-${at}`}
            aria-label={label}
            aria-invalid={error != null}
            aria-describedby={error == null ? undefined : `${id}-error`}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
        <button
          type="button"
          className="desk-text gs-remove"
          aria-label={remove}
          onClick={onRemove}
        >
          {t('guestList.remove')}
        </button>
      </div>
      {error != null && <FieldWrong id={`${id}-error`}>{error}</FieldWrong>}
    </div>
  );
}

function FieldWrong({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="desk-error">
      <Glyph name="alert" size={15} weight={2.2} />
      {children}
    </p>
  );
}

function GuestField({
  label,
  value,
  optional = false,
  error,
  focusKey,
  type = 'text',
  onChange,
}: {
  label: string;
  value: string;
  optional?: boolean;
  error: string | undefined;
  focusKey: string;
  type?: 'text' | 'email';
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <div className="desk-field">
      <label htmlFor={id} className="desk-label gs-label">
        {label}
        {optional && <span className="gs-optional">{t('eventForm.optional')}</span>}
      </label>
      <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
        <input
          id={id}
          type={type}
          value={value}
          autoComplete="off"
          spellCheck={false}
          data-focus={focusKey}
          aria-invalid={error != null}
          aria-describedby={error == null ? undefined : `${id}-error`}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {error != null && <FieldWrong id={`${id}-error`}>{error}</FieldWrong>}
    </div>
  );
}

/** The account's Mobile number: the code and the number side by side, only countries that can be dialled. */
function PhoneField({
  country,
  number,
  error,
  onCountry,
  onNumber,
}: {
  country: string;
  number: string;
  error: string | undefined;
  onCountry: (code: string) => void;
  onNumber: (number: string) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const locale = currentLocale();
  const countries = useMemo(
    () => countryChoices(locale).filter(({ code }) => callingCode(code) != null),
    [locale],
  );

  return (
    <div className="desk-field">
      <label htmlFor={id} className="desk-label gs-label">
        {t('verifyPhone.numberLabel')}
        <span className="gs-optional">{t('eventForm.optional')}</span>
      </label>
      <div className="gs-phone">
        <div className="desk-box gs-country">
          <span aria-hidden="true">{`${country} ${callingCode(country) ?? ''}`.trim()}</span>
          <Glyph name="chevdown" size={15} weight={2.4} />
          <select
            aria-label={t('guestList.country')}
            value={country}
            data-focus="country"
            onChange={(event) => onCountry(event.target.value)}
          >
            <option value="" disabled hidden />
            {countries.map(({ code, name }) => (
              <option key={code} value={code}>
                {codeChoice(code, name)}
              </option>
            ))}
          </select>
        </div>
        <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
          <input
            id={id}
            type="tel"
            value={number}
            autoComplete="off"
            data-focus="mobile"
            aria-invalid={error != null}
            aria-describedby={error == null ? undefined : `${id}-error`}
            onChange={(event) => onNumber(event.target.value)}
          />
        </div>
      </div>
      {error != null && <FieldWrong id={`${id}-error`}>{error}</FieldWrong>}
    </div>
  );
}
