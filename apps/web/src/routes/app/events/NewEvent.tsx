import { ApiError, type Membership } from '@soirely/api-client';
import {
  COVER_MIDDLE,
  CURRENCY_CODES,
  EVENT_NAME_MAXIMUM,
  type EventDraft,
  type HostErrors,
  type HostRow,
  type VenueDraft,
  arrivalNoteSent,
  arrivalNoteTooLong,
  coverTypeOf,
  eventFormErrors,
  eventNameLength,
  eventNameOf,
  firstRefusedOf,
  hostErrorsOf,
  hostRefusalsOf,
  hostsSent,
  isEventType,
  localDateTime,
  newEventHosts,
  skippedLine,
  venueDraftOf,
  venueSent,
} from '@soirely/domain';
import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { api } from '../../../api.ts';
import { checkCoverPick } from '../../../coverPick.ts';
import {
  CoverPreview,
  CoverUpload,
  FormBlock,
  Select,
} from '../../../components/EventFormParts.tsx';
import { Broken, DateTime, EditText } from '../../../components/EventPageParts.tsx';
import { Glyph } from '../../../components/Glyph.tsx';
import { Ask, RedAction, TitleRow } from '../../../components/SettingsParts.tsx';
import { currentLocale, dateLocale } from '../../../i18n/index.ts';
import { LayersContext, useDeskLayers } from '../../../layers.ts';
import { meshFor } from '../../../mesh.ts';
import { focusWhereSent, offField } from '../../../offField.ts';
import { can, useSession } from '../../../session.ts';
import { currencyChoices, timeZoneChoices } from '../../../zoneAndCurrencyChoices.ts';
import { Forbidden } from '../Forbidden.tsx';
import { discardCoverUpload, refusalOf } from './coverPhoto.ts';
import { HostFields, VenueFields } from './EventFormFields.tsx';
import { EventCrumb } from './EventOverview.tsx';
import { type Errors, FIELDS, type Field, hostInputId, inputFor } from './eventFieldOrder.ts';
import { typeChoices } from './eventTypes.ts';
import { useLeaveGuard } from './useLeaveGuard.tsx';
import { useStartCarriesEnd } from './useStartCarriesEnd.ts';

export function NewEvent() {
  const session = useSession();
  const organisation = session.organisation;

  if (organisation == null) return null;
  if (!can(session, 'events.create')) return <Forbidden />;

  return <NewEventPage key={organisation.id} organisation={organisation} />;
}

function NewEventPage({ organisation }: { organisation: Membership }) {
  const { t } = useTranslation();
  const { layers, covered, setHost } = useDeskLayers();

  return (
    <LayersContext value={layers}>
      <div className="desk ev">
        <div className="event-form-page" inert={covered}>
          <EventCrumb name={null} />
          <TitleRow title={t('eventForm.title')} compact />
          <EventForm organisation={organisation} />
        </div>
        <div ref={setHost} className="desk-layers" />
      </div>
    </LayersContext>
  );
}

/** A photo chosen for the cover; it waits here until the draft exists. `url` is null when this browser cannot show the file. */
type Chosen = { file: File; url: string | null };

type Status = 'editing' | 'creating' | 'failed' | 'created';

/** New event (sc-48607): the event's own parts in today's order, in headed blocks, and Create event's answer right above it. */
function EventForm({ organisation }: { organisation: Membership }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const locale = currentLocale();
  const [draft, setDraft] = useState<EventDraft>({
    name: '',
    type: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
  });
  const [endChosen, setEndChosen] = useState(false);
  const [venue, setVenue] = useState<VenueDraft>(() => venueDraftOf(null));
  const [timeZone, setTimeZone] = useState(organisation.timezone);
  const [currency, setCurrency] = useState(
    CURRENCY_CODES.includes(organisation.currency) ? organisation.currency : '',
  );
  const [hosts, setHosts] = useState<HostRow[]>([{ key: 0, name: '' }]);
  const [errors, setErrors] = useState<Errors>({});
  const [hostErrors, setHostErrors] = useState<HostErrors>({});
  const [hostsChecked, setHostsChecked] = useState(false);
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [coverRefusal, setCoverRefusal] = useState<string | null>(null);
  const [unsent, setUnsent] = useState(0);
  const [moved, setMoved] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('editing');
  const focusNext = useRef<(() => void) | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadButton = useRef<HTMLButtonElement>(null);
  const currencies = useMemo(() => currencyChoices('', currency, locale, t), [currency, locale, t]);
  const zones = useMemo(
    () => timeZoneChoices(organisation.timezone, timeZone),
    [organisation.timezone, timeZone],
  );
  const types = useMemo(() => typeChoices(draft.type, t), [draft.type, t]);
  const busy = status === 'creating' || status === 'created';
  const typed = JSON.stringify({
    draft,
    venue,
    timeZone,
    currency,
    hosts: hosts.map((row) => row.name),
  });
  const [blank] = useState(typed);
  const dirty = typed !== blank || chosen != null;
  const leave = useLeaveGuard({ dirty, busy, body: t('eventForm.leaveBody') });

  useEffect(() => {
    focusNext.current?.();
    focusNext.current = null;
  }, [errors, hostErrors]);

  useEffect(() => {
    const url = chosen?.url;

    return () => {
      if (url != null) URL.revokeObjectURL(url);
    };
  }, [chosen]);

  const { moveStart, moveEnd } = useStartCarriesEnd({
    draft,
    endChosen,
    timeZone,
    edit,
    say: setMoved,
  });

  function edit(field: Field, changes: Partial<EventDraft>): void {
    setDraft((previous) => ({ ...previous, ...changes }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    touched();
  }

  function touched(): void {
    setUnsent(0);
    setStatus((was) => (was === 'failed' ? 'editing' : was));
  }

  /** Focus goes to the first refused in the form's order: the name and type, then the hosts top to bottom, then the rest (sc-22143). */
  function refuse(
    found: Errors,
    focus = (id: string) => document.getElementById(id)?.focus(),
    hostFound: HostErrors = {},
  ): void {
    const first = firstRefusedOf(found, hostFound, hosts);
    const id =
      first == null
        ? null
        : 'field' in first
          ? inputFor(first.field, draft)
          : hostInputId({ key: first.host });

    focusNext.current = id == null ? null : () => focus(id);
    setErrors(found);
    setHostErrors(hostFound);
  }

  function editHosts(rows: HostRow[]): void {
    setHosts(rows);
    touched();
    if (hostsChecked) setHostErrors(hostErrorsOf(newEventHosts(rows), t));
  }

  function leaveHost(row: HostRow): void {
    if (!hostsChecked) return;

    setHostErrors((previous) => ({
      ...previous,
      [row.key]: hostErrorsOf(newEventHosts(hosts), t)[row.key],
    }));
  }

  async function pick(file: File | undefined): Promise<void> {
    if (fileInput.current != null) fileInput.current.value = '';
    if (file == null) return;

    const checked = await checkCoverPick(file);

    if (checked.refusal != null) {
      setCoverRefusal(t(`eventCover.refused_${checked.refusal}`));
      return;
    }

    setCoverRefusal(null);
    setChosen({ file, url: checked.shows ? URL.createObjectURL(file) : null });
    touched();
  }

  /** The draft exists either way, so a refused photo is said on its page rather than here. */
  async function sendCover(eventId: string, file: File): Promise<string | null> {
    let key: string | null = null;

    try {
      const signed = await api.signEventCoverUpload(organisation.id, {
        contentType: coverTypeOf(file) ?? file.type,
        size: file.size,
        filename: file.name,
      });
      await api.uploadTo(signed, file);
      key = signed.key;
      await api.previewEventCoverUpload(organisation.id, signed.key);
      await api.setEventCover(eventId, {
        uploadKey: signed.key,
        position: COVER_MIDDLE,
        description: null,
      });

      return null;
    } catch (error) {
      if (key != null) discardCoverUpload(organisation.id, key);

      return refusalOf(error, t);
    }
  }

  async function create(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;
    setMoved(null);

    const found: Errors = eventFormErrors({ draft, venue, timeZone, currency }, t);
    const sentHosts = newEventHosts(hosts);
    const hostFound = hostErrorsOf(sentHosts, t);
    const unsentFields = Object.keys(found).length + Object.keys(hostFound).length;
    const { type } = draft;

    setHostsChecked(true);

    if (unsentFields > 0 || type === '') {
      setUnsent(unsentFields);
      setStatus('editing');
      refuse(found, undefined, hostFound);
      return;
    }

    setUnsent(0);
    setStatus('creating');
    const land = focusWhereSent();
    const sentVenue = venueSent(venue);
    const sentNote = arrivalNoteSent(venue.note);

    try {
      const created = await api.createEvent(organisation.id, {
        name: eventNameOf(draft.name),
        type,
        startsAt: localDateTime(draft.startDate, draft.startTime) ?? '',
        endsAt: localDateTime(draft.endDate, draft.endTime) ?? '',
        timeZone,
        currency,
        ...(sentVenue == null ? {} : { venue: sentVenue }),
        ...(sentNote == null ? {} : { arrivalNote: sentNote }),
        hosts: hostsSent(sentHosts.map((row) => row.name)),
      });

      setStatus('created');
      const coverRefused = chosen == null ? null : await sendCover(created.id, chosen.file);

      leave.release();
      void navigate(
        `/app/events/${encodeURIComponent(created.id)}`,
        coverRefused == null ? undefined : { state: { coverRefused } },
      );
    } catch (error) {
      const refused = error instanceof ApiError && error.status === 422 ? error.fieldErrors() : {};
      const fromServer: Errors = {};
      for (const field of FIELDS) if (refused[field] != null) fromServer[field] = refused[field];

      const hostsFromServer = hostRefusalsOf(refused, sentHosts);

      if (Object.keys(fromServer).length + Object.keys(hostsFromServer).length > 0) {
        setStatus('editing');
        refuse(fromServer, land, hostsFromServer);
        return;
      }

      setStatus('failed');
    }
  }

  const nameLength = eventNameLength(draft.name);
  const startSkipped = skippedLine(draft.startDate, draft.startTime, timeZone, dateLocale(), t);
  const endSkipped = skippedLine(draft.endDate, draft.endTime, timeZone, dateLocale(), t);
  const error = (id: string, words: string | undefined): ReactNode =>
    words != null && (
      <p id={id} className="desk-error">
        <Glyph name="alert" size={15} weight={2.2} />
        {words}
      </p>
    );

  return (
    <form
      className="ev-new-form"
      noValidate
      aria-busy={busy}
      onSubmit={(submit) => void create(submit)}
    >
      <FormBlock title={t('eventForm.aboutHeading')}>
        <EditText
          id="event-name"
          label={t('eventForm.name')}
          value={draft.name}
          error={errors.name ?? null}
          help={t('eventForm.nameCount', { count: nameLength, most: EVENT_NAME_MAXIMUM })}
          input={{ autoComplete: 'off', ...offField(busy) }}
          onChange={(name) => edit('name', { name })}
        />
        <Select
          id="event-type"
          label={t('eventForm.type')}
          value={draft.type}
          choices={types.map((one) => [one.value, one.label] as const)}
          error={errors.type}
          off={busy}
          onChange={(value) => edit('type', { type: isEventType(value) ? value : '' })}
        />
      </FormBlock>

      <FormBlock title={t('eventHosts.heading')}>
        <HostFields
          rows={hosts}
          errors={hostErrors}
          keep={false}
          off={busy}
          inputId={hostInputId}
          onRows={editHosts}
          onEdited={(key) => setHostErrors((previous) => ({ ...previous, [key]: undefined }))}
          onLeave={leaveHost}
        />
      </FormBlock>

      <FormBlock title={t('eventForm.coverHeading')}>
        <CoverPreview
          photo={
            chosen == null ? null : chosen.url == null ? (
              <Glyph name="photo" size={56} weight={1.6} />
            ) : (
              <img src={chosen.url} alt="" />
            )
          }
          mesh={meshFor(draft.type === '' ? 'new-event' : draft.type)}
          className="ev-new-cover"
        />
        <input
          ref={fileInput}
          type="file"
          className="desk-unseen"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(change) => void pick(change.target.files?.[0])}
        />
        {chosen != null ? (
          !busy && (
            <RedAction
              label={t('eventCover.remove')}
              line={t('eventCover.removeLine')}
              onClick={() => {
                setChosen(null);
                touched();
                requestAnimationFrame(() => uploadButton.current?.focus());
              }}
            />
          )
        ) : (
          <CoverUpload
            words={{
              line: t('eventCover.coverLine'),
              upload: t('eventCover.upload'),
              accepted: t('eventCover.accepted'),
            }}
            refusal={coverRefusal}
            off={busy}
            buttonRef={uploadButton}
            onUpload={() => fileInput.current?.click()}
          />
        )}
      </FormBlock>

      <FormBlock title={t('eventForm.whenHeading')}>
        <div className="ev-new-when">
          <DateTime
            id="event-start"
            legend={t('eventForm.starts')}
            wall={{ date: draft.startDate, time: draft.startTime }}
            wrong={errors.startsAt != null}
            told={
              errors.startsAt != null
                ? 'event-start-error'
                : startSkipped != null
                  ? 'event-start-skip'
                  : undefined
            }
            off={busy}
            onChange={(wall) => {
              setMoved(null);
              moveStart({ startDate: wall.date, startTime: wall.time });
            }}
          />
          {error('event-start-error', errors.startsAt)}
          {startSkipped != null && (
            <p id="event-start-skip" className="ev-said" role="status">
              {startSkipped}
            </p>
          )}
        </div>
        <div className="ev-new-when">
          <DateTime
            id="event-end"
            legend={t('eventForm.ends')}
            wall={{ date: draft.endDate, time: draft.endTime }}
            wrong={errors.endsAt != null}
            told={errors.endsAt != null ? 'event-end-error' : 'event-end-help'}
            off={busy}
            onChange={(wall) => {
              setMoved(null);
              if (wall.date !== draft.endDate) setEndChosen(wall.date !== '');
              moveEnd({ endDate: wall.date, endTime: wall.time });
            }}
          />
          {errors.endsAt != null ? (
            error('event-end-error', errors.endsAt)
          ) : moved != null ? (
            <p id="event-end-help" className="ev-said" role="status">
              {moved}
            </p>
          ) : (
            <p id="event-end-help" className="desk-help">
              {endSkipped ?? t('eventForm.endsHint')}
            </p>
          )}
        </div>
      </FormBlock>

      <FormBlock title={t('eventForm.venueHeading')}>
        <VenueFields
          venue={venue}
          errors={errors}
          zone={timeZone}
          off={busy}
          ids={{
            name: 'event-venue-name',
            address: 'event-venue-address',
            note: 'event-arrival-note',
          }}
          onVenue={(change) => {
            setVenue((previous) => ({ ...previous, ...change }));
            setErrors((previous) => ({
              ...previous,
              ...('name' in change ? { venueName: undefined } : {}),
              ...('address' in change ? { venueAddress: undefined } : {}),
              ...(change.note != null && !arrivalNoteTooLong(change.note)
                ? { arrivalNote: undefined }
                : {}),
            }));
            setUnsent(0);
            setStatus((was) => (was === 'failed' ? 'editing' : was));
          }}
          onUseZone={(zone) => {
            setTimeZone(zone);
            setErrors((previous) => ({ ...previous, timeZone: undefined }));
          }}
        />
      </FormBlock>

      <FormBlock title={t('eventForm.zoneHeading')}>
        <div className="ev-new-pair">
          <Select
            id="event-time-zone"
            label={t('eventForm.timeZone')}
            value={timeZone}
            choices={zones.map((one) => [one.value, one.label] as const)}
            error={errors.timeZone}
            help={t('eventPage.timesIn', { timeZone })}
            off={busy}
            onChange={(value) => {
              setTimeZone(value);
              setErrors((previous) => ({ ...previous, timeZone: undefined }));
              touched();
            }}
          />
          <Select
            id="event-currency"
            label={t('eventForm.currency')}
            value={currency}
            choices={currencies.map((one) => [one.value, one.label] as const)}
            error={errors.currency}
            help={t('eventForm.defaultsHint', { name: organisation.name })}
            off={busy}
            onChange={(value) => {
              setCurrency(value);
              setErrors((previous) => ({ ...previous, currency: undefined }));
              touched();
            }}
          />
        </div>
      </FormBlock>

      <div className="ev-new-foot">
        {status === 'failed' && <Broken>{t('eventForm.notCreated')}</Broken>}
        {unsent > 0 && (
          <p className="desk-error" role="alert">
            <Glyph name="alert" size={15} weight={2.2} />
            {t('eventForm.problems', { count: unsent })}
          </p>
        )}
        {status === 'created' && (
          <div className="notice notice-done" role="status">
            <span className="mark mark-done" aria-hidden="true">
              ✓
            </span>
            <p>{t('eventForm.created')}</p>
          </div>
        )}
        <button type="submit" className="button button-primary" aria-disabled={busy}>
          {status === 'creating' ? t('eventForm.creating') : t('eventForm.create')}
        </button>
      </div>

      {leave.asking != null && (
        <Ask
          title={t('eventEdit.leaveTitle')}
          line={t('eventForm.leaveBody')}
          keep={t('eventEdit.keepEditing')}
          go={t('eventEdit.leave')}
          onKeep={leave.asking.keep}
          onGo={leave.asking.go}
        />
      )}
    </form>
  );
}
