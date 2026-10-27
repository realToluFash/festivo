import { ApiError, type TaggedEvent } from '@soirely/api-client';
import {
  EVENT_NAME_MAXIMUM,
  HOST_NAME_MAXIMUM,
  type EventDraft,
  hostProblems,
  hostsChanged,
  hostsSent,
  draftOf,
  eventChanges,
  scheduleKept,
  shownPhase,
  eventNameLength,
  eventFormErrors,
  skippedLine,
  isEventType,
  type VenueDraft,
  venueDraftOf,
} from '@soirely/domain';
import {
  type FormEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useBlocker, useLocation, useNavigate, useParams } from 'react-router';

import { api } from '../../../api.ts';
import { useDialogKeys } from '../../../dialogFocus.ts';
import { currentLocale, dateLocale } from '../../../i18n/index.ts';
import { offButton } from '../../../offButton.ts';
import { focusWhereSent, offField } from '../../../offField.ts';
import { can, useSession } from '../../../session.ts';
import { useFocusOnceShown, useStepFocus } from '../../../stepFocus.ts';
import { currencyChoices, timeZoneChoices } from '../../../zoneAndCurrencyChoices.ts';
import { Forbidden } from '../Forbidden.tsx';
import { ArrivalNotice } from '../../../components/PageArrival.tsx';
import { pageTitle, usePageTitle } from '../../../pageTitle.ts';
import { useLoadedAt, useServerNow } from '../../../serverNow.ts';
import { CoverSection } from './CoverSection.tsx';
import { Choice, FieldError, Moment } from './EventFields.tsx';
import {
  ADD_HOST_ID,
  type Errors,
  FIELDS,
  type Field,
  describedBy,
  hostInputId,
  inputFor,
} from './eventFieldOrder.ts';
import { typeChoices } from './eventTypes.ts';
import { type HostErrors, type HostRow, HostsSection } from './HostsSection.tsx';
import { VenueSection } from './VenueSection.tsx';

/** What the event page announces once the form has closed (sc-3587). */
export type EditOutcome = 'saved' | 'unchanged';

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'notFound' } | TaggedEvent;

type Status = 'editing' | 'saving' | 'failed' | 'latestFailed' | 'changedElsewhere';

type Typed = {
  draft: EventDraft;
  timeZone: string;
  currency: string;
  venue: VenueDraft;
  hosts: HostRow[];
};

const HOST_PATH = /^hosts\[(\d+)\]$/;

export function EditEvent() {
  const session = useSession();
  const { eventId = '' } = useParams();
  const organisationId = session.organisation?.id;

  if (organisationId == null) return null;
  if (!can(session, 'events.manage')) return <Forbidden />;

  return (
    <EditOf
      key={`${organisationId}:${eventId}`}
      organisationId={organisationId}
      eventId={eventId}
    />
  );
}

function EditOf({ organisationId, eventId }: { organisationId: string; eventId: string }) {
  const { t } = useTranslation();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [reads, setReads] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const failedLine = useRef<HTMLParagraphElement>(null);
  const land = useFocusOnceShown();
  const eventPath = `/app/events/${encodeURIComponent(eventId)}`;

  useEffect(() => {
    let current = true;

    api.taggedEvent(eventId).then(
      (tagged) =>
        current &&
        setLoad(tagged.event.organisationId === organisationId ? tagged : { kind: 'notFound' }),
      (error: unknown) =>
        current &&
        setLoad(
          error instanceof ApiError && error.status === 404
            ? { kind: 'notFound' }
            : { kind: 'failed' },
        ),
    );

    return () => {
      current = false;
    };
  }, [organisationId, eventId, attempt]);

  return (
    <div className="event-form-page">
      <Link className="link-button event-back" to={eventPath}>
        <span aria-hidden="true">‹ </span>
        {t('eventPage.backToEvent')}
      </Link>

      {'kind' in load && load.kind === 'loading' && (
        <p className="muted" role="status">
          {t('eventPage.loading')}
        </p>
      )}

      {'kind' in load && load.kind === 'failed' && (
        <ArrivalNotice
          role={attempt > 0 ? undefined : 'alert'}
          line={t('eventPage.failed')}
          lineRef={failedLine}
          focusable
          retry={t('events.retry')}
          onRetry={() => {
            setLoad({ kind: 'loading' });
            setAttempt((n) => n + 1);
            land(() => heading.current ?? failedLine.current);
          }}
        />
      )}

      {'kind' in load && load.kind === 'notFound' && (
        <section className="card">
          <h1 ref={heading} tabIndex={-1}>
            {t('eventPage.notFound')}
          </h1>
        </section>
      )}

      {'event' in load && (
        <DetailsForm
          key={reads}
          opened={load}
          reread={reads > 0}
          eventPath={eventPath}
          heading={heading}
          onLatest={(latest) => {
            setLoad(latest);
            setReads((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

function typedOf({ event }: TaggedEvent): Typed {
  return {
    draft: draftOf(event),
    timeZone: event.timeZone,
    currency: event.currency,
    venue: venueDraftOf(event.venue),
    hosts: event.hosts.map((name, key) => ({ key, name })),
  };
}

function DetailsForm({
  opened,
  reread,
  eventPath,
  heading,
  onLatest,
}: {
  opened: TaggedEvent;
  reread: boolean;
  eventPath: string;
  heading: RefObject<HTMLHeadingElement | null>;
  onLatest: (latest: TaggedEvent) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const locale = currentLocale();
  const saved = opened.event;
  const [entered, setTyped] = useState<Typed>(() => typedOf(opened));
  const [cover, setCover] = useState(saved.cover);
  const [errors, setErrors] = useState<Errors>({});
  const [hostErrors, setHostErrors] = useState<HostErrors>({});
  const [hostsChecked, setHostsChecked] = useState(false);
  const [said, setSaid] = useState('');
  const [unsent, setUnsent] = useState(0);
  const [status, setStatus] = useState<Status>('editing');
  const [confirming, setConfirming] = useState<'latest' | null>(null);
  const [fetchingLatest, setFetchingLatest] = useState(false);
  const focusNext = useRef<(() => void) | null>(null);
  const closing = useRef(false);
  const saving = useRef(false);
  const [notSaved, arriveAtNotSaved] = useStepFocus<HTMLParagraphElement>();
  const [saveButton, arriveAtSave] = useStepFocus<HTMLButtonElement>();
  const now = useServerNow();
  const loadedAt = useLoadedAt(saved);
  const over = shownPhase(saved, loadedAt, now) === 'finished';
  const typed = useMemo(
    () => (over ? scheduleKept(entered, typedOf(opened)) : entered),
    [over, entered, opened],
  );
  const { draft, timeZone, currency, venue, hosts } = typed;
  const changes = useMemo(
    () => ({
      ...eventChanges(saved, typed),
      ...(hostsChanged(
        saved.hosts,
        typed.hosts.map((row) => row.name),
      )
        ? { hosts: hostsSent(typed.hosts.map((row) => row.name)) }
        : {}),
    }),
    [saved, typed],
  );
  const lockedBy = over ? 'event-schedule-over' : undefined;

  usePageTitle(pageTitle(t, [t('eventEdit.title'), saved.name]));
  const dirty = Object.keys(changes).length > 0;
  const busy = status === 'saving';
  const currencies = useMemo(
    () => currencyChoices(saved.currency, currency, locale, t),
    [saved.currency, currency, locale, t],
  );
  const zones = useMemo(
    () => timeZoneChoices(saved.timeZone, timeZone),
    [saved.timeZone, timeZone],
  );
  const types = useMemo(() => typeChoices(draft.type, t), [draft.type, t]);
  const blocker = useBlocker(
    useCallback(() => saving.current || (dirty && !closing.current), [dirty]),
  );

  const [toVenue] = useState(() => location.hash === '#venue');
  const [toCover] = useState(() => location.hash === '#cover');
  const [toHosts] = useState(() => location.hash === '#hosts');
  const [firstHost] = useState(() => typed.hosts[0]);

  useEffect(() => {
    if (reread) document.getElementById('event-name')?.focus();
    else if (toVenue) document.getElementById('event-venue-name')?.focus();
    else if (toCover) document.getElementById('cover-upload')?.focus();
    else if (toHosts)
      document.getElementById(firstHost == null ? ADD_HOST_ID : hostInputId(firstHost))?.focus();
  }, [reread, toVenue, toCover, toHosts, firstHost]);

  useEffect(() => {
    if (!dirty) return;

    const ask = (event: BeforeUnloadEvent): void => event.preventDefault();
    window.addEventListener('beforeunload', ask);

    return () => window.removeEventListener('beforeunload', ask);
  }, [dirty]);

  useEffect(() => {
    focusNext.current?.();
    focusNext.current = null;
  }, [errors]);

  function edit(field: Field, change: Partial<EventDraft>): void {
    setTyped((previous) => ({ ...previous, draft: { ...previous.draft, ...change } }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  }

  function choose(field: 'timeZone' | 'currency', value: string): void {
    setTyped((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  }

  function hostErrorsOf(rows: readonly HostRow[]): HostErrors {
    const found: HostErrors = {};

    hostProblems(rows.map((row) => row.name)).forEach((problem, index) => {
      const row = rows[index];

      if (problem == null || row == null) return;

      found[row.key] =
        problem.problem === 'hostBlank'
          ? t('eventHosts.blank')
          : problem.problem === 'hostTooLong'
            ? t('eventHosts.tooLong', { most: HOST_NAME_MAXIMUM, length: problem.length })
            : t('eventHosts.duplicate', { name: problem.name });
    });

    return found;
  }

  /** Focus goes to the first refused in page order: the name and type, then the hosts top to bottom, then the rest. */
  function refuse(
    found: Errors,
    focus = (id: string) => document.getElementById(id)?.focus(),
    hostFound: HostErrors = {},
  ): void {
    const first = FIELDS.find((field) => found[field] != null);
    const host = hosts.find((row) => hostFound[row.key] != null);
    const id =
      first != null && (first === 'name' || first === 'type' || host == null)
        ? inputFor(first, draft)
        : host == null
          ? null
          : hostInputId(host);

    focusNext.current = id == null ? null : () => focus(id);
    setErrors(found);
    setHostErrors(hostFound);
  }

  function editHosts(rows: HostRow[], touched: number | null): void {
    setTyped((previous) => ({ ...previous, hosts: rows }));
    if (touched != null) setHostErrors((previous) => ({ ...previous, [touched]: undefined }));
    else if (hostsChecked) setHostErrors(hostErrorsOf(rows));
  }

  function leaveHost(row: HostRow): void {
    if (!hostsChecked) return;

    setHostErrors((previous) => ({ ...previous, [row.key]: hostErrorsOf(hosts)[row.key] }));
  }

  function close(outcome: EditOutcome): void {
    closing.current = true;
    void navigate(eventPath, { state: { edit: outcome } });
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;

    const found: Errors = eventFormErrors(typed, t);
    const hostFound = hostErrorsOf(hosts);

    const unsentFields = Object.keys(found).length + Object.keys(hostFound).length;

    setSaid('');
    setHostsChecked(true);

    if (unsentFields > 0) {
      setUnsent(unsentFields);
      setStatus('editing');
      refuse(found, undefined, hostFound);
      return;
    }

    setUnsent(0);

    if (!dirty) {
      close('unchanged');
      return;
    }

    setStatus('saving');
    saving.current = true;
    const land = focusWhereSent();

    try {
      await api.updateEvent(saved.id, changes, opened.tag);
      saving.current = false;
      close('saved');
    } catch (error) {
      saving.current = false;

      if (error instanceof ApiError && error.status === 412) {
        setStatus('changedElsewhere');
        return;
      }

      if (error instanceof ApiError && error.is('event_concluded')) {
        setStatus('editing');
        refuse({ startsAt: t('eventEdit.scheduleConcluded') }, land);
        return;
      }

      if (error instanceof ApiError && error.is('event_host_required') && hosts[0] != null) {
        setStatus('editing');
        refuse({}, land, { [hosts[0].key]: t('eventHosts.lastHostRefused') });
        return;
      }

      if (error instanceof ApiError && error.is('event_currency_in_use')) {
        setStatus('editing');
        refuse({ currency: t('eventEdit.currencyInUse') }, land);
        return;
      }

      const refused = error instanceof ApiError && error.status === 422 ? error.fieldErrors() : {};
      const fromServer: Errors = {};
      for (const field of FIELDS) if (refused[field] != null) fromServer[field] = refused[field];

      const hostsFromServer: HostErrors = {};
      for (const [path, message] of Object.entries(refused)) {
        const index = path === 'hosts' ? hosts.length - 1 : Number(HOST_PATH.exec(path)?.[1]);
        const row = hosts[index];
        if (row != null) hostsFromServer[row.key] ??= message;
      }

      if (Object.keys(fromServer).length + Object.keys(hostsFromServer).length > 0) {
        setStatus('editing');
        refuse(fromServer, land, hostsFromServer);
        return;
      }

      setStatus('failed');
    }
  }

  async function showLatest(): Promise<void> {
    setFetchingLatest(true);

    try {
      const latest = await api.taggedEvent(saved.id);
      closing.current = true;
      onLatest(latest);
    } catch {
      setFetchingLatest(false);
      setConfirming(null);
      setStatus('latestFailed');
      arriveAtNotSaved();
    }
  }

  const nameLength = eventNameLength(draft.name);
  const typedStart = new Date(`${draft.startDate}T${draft.startTime}Z`);
  const startSkipped = skippedLine(draft.startDate, draft.startTime, timeZone, dateLocale(), t);
  const zoneHint =
    Number.isNaN(typedStart.getTime()) || startSkipped != null
      ? t('eventEdit.zoneHintPlain')
      : t('eventEdit.zoneHint', {
          day: new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(
            typedStart,
          ),
          time: new Intl.DateTimeFormat(locale, {
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
            timeZone: 'UTC',
          }).format(typedStart),
        });

  return (
    <>
      <h1 ref={heading} tabIndex={-1}>
        {t('eventEdit.title')}
      </h1>

      <form className="event-form" noValidate onSubmit={(event) => void save(event)}>
        <p className="visually-hidden" role="status">
          {unsent > 0 ? t('eventForm.problems', { count: unsent }) : said}
        </p>

        <section className="card" aria-labelledby="event-about">
          <h2 id="event-about">{t('eventForm.aboutHeading')}</h2>
          <div className="field">
            <label htmlFor="event-name">{t('eventForm.name')}</label>
            <input
              id="event-name"
              className={errors.name == null ? 'input' : 'input input-wrong'}
              type="text"
              value={draft.name}
              autoComplete="off"
              spellCheck={false}
              {...offField(busy)}
              aria-invalid={errors.name != null}
              aria-describedby={describedBy(
                errors.name == null ? null : 'event-name-error',
                'event-name-count',
              )}
              onChange={(event) => edit('name', { name: event.target.value })}
            />
            <FieldError id="event-name-error" message={errors.name} />
            <p className="field-help" id="event-name-count">
              {t('eventForm.nameCount', { count: nameLength, most: EVENT_NAME_MAXIMUM })}
            </p>
          </div>
          <Choice
            id="event-type"
            label={t('eventForm.type')}
            value={draft.type}
            error={errors.type}
            busy={busy}
            options={types}
            onChange={(value) => edit('type', { type: isEventType(value) ? value : '' })}
          />
        </section>

        <HostsSection
          rows={hosts}
          errors={hostErrors}
          status={saved.status}
          busy={busy}
          onRows={editHosts}
          onLeave={leaveHost}
          onSay={(line) => {
            setUnsent(0);
            setSaid(line);
          }}
        />

        <CoverSection
          type={draft.type}
          photo={cover}
          organisationId={saved.organisationId}
          onUse={async ({ upload, position, description }) => {
            const updated = await api.setEventCover(saved.id, {
              ...(upload == null ? {} : { uploadKey: upload.key }),
              position,
              description,
            });
            setCover(updated.cover);
          }}
          onRemove={async () => setCover((await api.removeEventCover(saved.id)).cover)}
        />

        <section className="card" aria-labelledby="event-when">
          <h2 id="event-when">{t('eventForm.whenHeading')}</h2>
          {over && (
            <p className="field-help" id="event-schedule-over">
              {t('eventEdit.scheduleLocked')}
            </p>
          )}
          <Moment
            id="event-start"
            legend={t('eventForm.starts')}
            lockedBy={lockedBy}
            skipped={startSkipped}
            date={draft.startDate}
            time={draft.startTime}
            error={errors.startsAt}
            busy={busy}
            onDate={(startDate) => edit('startsAt', { startDate })}
            onTime={(startTime) => edit('startsAt', { startTime })}
          />
          <Moment
            id="event-end"
            legend={t('eventForm.ends')}
            lockedBy={lockedBy}
            skipped={skippedLine(draft.endDate, draft.endTime, timeZone, dateLocale(), t)}
            hint={t('eventForm.endsHint')}
            date={draft.endDate}
            time={draft.endTime}
            error={errors.endsAt}
            busy={busy}
            onDate={(endDate) => edit('endsAt', { endDate })}
            onTime={(endTime) => edit('endsAt', { endTime })}
          />
        </section>

        <VenueSection
          venue={venue}
          errors={errors}
          busy={busy}
          timeZone={timeZone}
          onVenue={(change) => {
            setTyped((previous) => ({ ...previous, venue: { ...previous.venue, ...change } }));
            setErrors((previous) => ({
              ...previous,
              ...('name' in change ? { venueName: undefined } : {}),
              ...('address' in change ? { venueAddress: undefined } : {}),
            }));
          }}
          {...(over ? {} : { onUseZone: (zone: string) => choose('timeZone', zone) })}
        />

        <section className="card" aria-labelledby="event-defaults">
          <h2 id="event-defaults">{t('eventForm.zoneHeading')}</h2>
          <div className="settings-fields">
            <Choice
              id="event-time-zone"
              label={t('eventForm.timeZone')}
              hint={over ? undefined : zoneHint}
              lockedBy={lockedBy}
              value={timeZone}
              error={errors.timeZone}
              busy={busy}
              options={zones}
              onChange={(value) => choose('timeZone', value)}
            />
            <Choice
              id="event-currency"
              label={t('eventForm.currency')}
              value={currency}
              error={errors.currency}
              busy={busy}
              options={currencies}
              onChange={(value) => choose('currency', value)}
            />
          </div>
        </section>

        {(status === 'failed' || status === 'latestFailed') && (
          <div
            className="notice notice-broken"
            role={status === 'latestFailed' ? undefined : 'alert'}
          >
            <span className="mark mark-broken" aria-hidden="true">
              ✕
            </span>
            <p
              className="notice-title"
              ref={status === 'latestFailed' ? notSaved : undefined}
              tabIndex={status === 'latestFailed' ? -1 : undefined}
            >
              {t('eventEdit.notSaved')}
            </p>
          </div>
        )}

        {status === 'changedElsewhere' && (
          <div className="notice notice-broken" role="alert">
            <span className="mark mark-broken" aria-hidden="true">
              ✕
            </span>
            <div className="notice-body">
              <p className="notice-title">{t('eventEdit.changedElsewhere')}</p>
              <div className="event-form-actions">
                <button type="button" className="button" onClick={() => setConfirming('latest')}>
                  {t('eventEdit.showLatest')}
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    setStatus('editing');
                    arriveAtSave();
                  }}
                >
                  {t('eventEdit.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="event-form-actions">
          <button ref={saveButton} className="button button-primary" type="submit" aria-busy={busy}>
            {busy ? t('eventEdit.saving') : t('eventEdit.save')}
          </button>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => void navigate(eventPath)}
          >
            {t('eventEdit.cancel')}
          </button>
        </div>
      </form>

      {confirming === 'latest' && (
        <Confirm
          id="event-latest"
          title={t('eventEdit.showLatestTitle')}
          body={t('eventEdit.showLatestBody')}
          go={t('eventEdit.showLatest')}
          pending={fetchingLatest}
          onGo={() => void showLatest()}
          onKeep={() => setConfirming(null)}
        />
      )}

      {blocker.state === 'blocked' && !busy && (
        <Confirm
          id="event-leave"
          title={t('eventEdit.leaveTitle')}
          body={t('eventEdit.leaveBody')}
          go={t('eventEdit.leave')}
          pending={false}
          opensPage
          onGo={() => blocker.proceed()}
          onKeep={() => blocker.reset()}
        />
      )}
    </>
  );
}

/** Keep editing is the safe answer, so focus starts there; Escape keeps editing too, and focus goes back where it was unless going on opened another page. */
function Confirm({
  id,
  title,
  body,
  go,
  pending,
  opensPage = false,
  onGo,
  onKeep,
}: {
  id: string;
  title: string;
  body: string;
  go: string;
  pending: boolean;
  opensPage?: boolean;
  onGo: () => void;
  onKeep: () => void;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDivElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const left = useRef(false);

  useEffect(() => {
    const opener = document.activeElement;

    keep.current?.focus();

    return () => {
      if (left.current) return;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  useDialogKeys(dialog, onKeep, pending);

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={dialog}
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-body`}
      >
        <div className="dialog-heading">
          <h2 id={`${id}-title`}>{title}</h2>
          <p id={`${id}-body`}>{body}</p>
        </div>
        <div className="dialog-actions">
          <button
            ref={keep}
            type="button"
            className="button button-primary"
            {...offButton(pending, { dim: false })}
            onClick={onKeep}
          >
            {t('eventEdit.keepEditing')}
          </button>
          <button
            type="button"
            className="button"
            {...offButton(pending, { dim: false })}
            aria-busy={pending}
            onClick={() => {
              left.current = opensPage;
              onGo();
            }}
          >
            {go}
          </button>
        </div>
      </div>
    </>
  );
}
