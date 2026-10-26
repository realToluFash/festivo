import { ApiError, type Membership } from '@soirely/api-client';
import {
  CURRENCY_CODES,
  EVENT_NAME_MAXIMUM,
  type EventDraft,
  eventNameLength,
  eventNameOf,
  eventProblems,
  isEventType,
  filledEndDate,
  localDateTime,
  VENUE_ADDRESS_MAXIMUM,
  VENUE_NAME_MAXIMUM,
  type VenueDraft,
  venueDraftOf,
  venueProblems,
  venueSent,
} from '@soirely/domain';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { api } from '../../../api.ts';
import { currentLocale } from '../../../i18n/index.ts';
import { focusWhereSent, offField } from '../../../offField.ts';
import { can, useSession } from '../../../session.ts';
import { currencyChoices, timeZoneChoices } from '../../../zoneAndCurrencyChoices.ts';
import { Forbidden } from '../Forbidden.tsx';
import { CoverSection } from './CoverSection.tsx';
import type { CoverPhoto } from './EventCoverImage.tsx';
import { Choice, FieldError, Moment } from './EventFields.tsx';
import { type Errors, FIELDS, type Field, describedBy, inputFor } from './eventFieldOrder.ts';
import { typeChoices } from './eventTypes.ts';
import { skippedLine } from './skippedLine.ts';
import { VenueSection } from './VenueSection.tsx';

export function NewEvent() {
  const session = useSession();
  const organisation = session.organisation;

  if (organisation == null) return null;
  if (!can(session, 'events.create')) return <Forbidden />;

  return <EventForm key={organisation.id} organisation={organisation} />;
}

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
  const [errors, setErrors] = useState<Errors>({});
  const [cover, setCover] = useState<{ uploadKey: string; photo: CoverPhoto } | null>(null);
  const [unsent, setUnsent] = useState(0);
  const [status, setStatus] = useState<'editing' | 'creating' | 'failed'>('editing');
  const focusNext = useRef<(() => void) | null>(null);
  const currencies = useMemo(() => currencyChoices('', currency, locale, t), [currency, locale, t]);
  const zones = useMemo(
    () => timeZoneChoices(organisation.timezone, timeZone),
    [organisation.timezone, timeZone],
  );
  const types = useMemo(() => typeChoices(draft.type, t), [draft.type, t]);
  const busy = status === 'creating';

  useEffect(() => {
    focusNext.current?.();
    focusNext.current = null;
  }, [errors]);

  function edit(field: Field, changes: Partial<EventDraft>): void {
    setDraft((previous) => ({ ...previous, ...changes }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  }

  function refuse(
    found: Errors,
    focus = (id: string) => document.getElementById(id)?.focus(),
  ): void {
    const first = FIELDS.find((field) => found[field] != null);

    focusNext.current = first == null ? null : () => focus(inputFor(first, draft));
    setErrors(found);
  }

  async function create(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;

    const found: Errors = {};
    for (const { field, problem } of eventProblems(draft, timeZone))
      found[field] ??= t(`eventForm.${problem}`, { most: EVENT_NAME_MAXIMUM });
    for (const { field, problem } of venueProblems(venue))
      found[field] ??= t(`eventForm.${problem}`, {
        most: field === 'venueName' ? VENUE_NAME_MAXIMUM : VENUE_ADDRESS_MAXIMUM,
      });
    if (currency === '') found.currency = t('orgGeneral.currencyBlank');

    const unsentFields = Object.keys(found).length;
    const { type } = draft;

    if (unsentFields > 0 || type === '') {
      setUnsent(unsentFields);
      setStatus('editing');
      refuse(found);
      return;
    }

    setUnsent(0);
    setStatus('creating');
    const land = focusWhereSent();

    const sentVenue = venueSent(venue);

    try {
      const created = await api.createEvent(organisation.id, {
        name: eventNameOf(draft.name),
        type,
        startsAt: localDateTime(draft.startDate, draft.startTime) ?? '',
        endsAt: localDateTime(draft.endDate, draft.endTime) ?? '',
        timeZone,
        currency,
        ...(sentVenue == null ? {} : { venue: sentVenue }),
      });

      if (cover != null) {
        const { uploadKey, photo } = cover;

        // The event exists either way; a cover that fails here is set again from Edit details.
        await api
          .setEventCover(created.id, {
            uploadKey,
            position: photo.position,
            description: photo.description,
          })
          .catch(() => null);
      }

      void navigate(`/app/events/${encodeURIComponent(created.id)}`);
    } catch (error) {
      const refused = error instanceof ApiError && error.status === 422 ? error.fieldErrors() : {};
      const found: Errors = {};
      for (const field of FIELDS) if (refused[field] != null) found[field] = refused[field];

      if (Object.keys(found).length > 0) {
        setStatus('editing');
        refuse(found, land);
        return;
      }

      setStatus('failed');
    }
  }

  const nameLength = eventNameLength(draft.name);
  const startSkipped = skippedLine(draft.startDate, draft.startTime, timeZone, t);

  return (
    <div className="event-form-page">
      <Link className="link-button event-back" to="/app/events">
        <span aria-hidden="true">‹ </span>
        {t('events.title')}
      </Link>
      <h1>{t('eventForm.title')}</h1>

      <form className="event-form" noValidate onSubmit={(event) => void create(event)}>
        {status === 'failed' && (
          <div className="notice notice-broken" role="alert">
            <span className="mark mark-broken" aria-hidden="true">
              ✕
            </span>
            <p className="notice-title">{t('eventForm.notCreated')}</p>
          </div>
        )}
        <p className="visually-hidden" role="status">
          {unsent > 0 ? t('eventForm.problems', { count: unsent }) : ''}
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

        <CoverSection
          type={draft.type}
          photo={cover?.photo ?? null}
          organisationId={organisation.id}
          onUse={async ({ upload, position, description }) => {
            setCover((previous) => {
              const uploadKey = upload?.key ?? previous?.uploadKey;
              const sizes = upload?.preview.sizes ?? previous?.photo.sizes;

              return uploadKey == null || sizes == null
                ? previous
                : { uploadKey, photo: { sizes, position, description } };
            });
          }}
          onRemove={async () => setCover(null)}
        />

        <section className="card" aria-labelledby="event-when">
          <h2 id="event-when">{t('eventForm.whenHeading')}</h2>
          <Moment
            id="event-start"
            legend={t('eventForm.starts')}
            skipped={startSkipped}
            date={draft.startDate}
            time={draft.startTime}
            error={errors.startsAt}
            busy={busy}
            onDate={(startDate) =>
              edit('startsAt', {
                startDate,
                endDate: filledEndDate(startDate, draft.endDate, endChosen),
              })
            }
            onTime={(startTime) => edit('startsAt', { startTime })}
          />
          <Moment
            id="event-end"
            legend={t('eventForm.ends')}
            skipped={skippedLine(draft.endDate, draft.endTime, timeZone, t)}
            hint={t('eventForm.endsHint')}
            date={draft.endDate}
            time={draft.endTime}
            error={errors.endsAt}
            busy={busy}
            onDate={(endDate) => {
              setEndChosen(endDate !== '');
              edit('endsAt', { endDate });
            }}
            onTime={(endTime) => edit('endsAt', { endTime })}
          />
        </section>

        <VenueSection
          venue={venue}
          errors={errors}
          busy={busy}
          timeZone={timeZone}
          onVenue={(change) => {
            setVenue((previous) => ({ ...previous, ...change }));
            setErrors((previous) => ({
              ...previous,
              ...('name' in change ? { venueName: undefined } : {}),
              ...('address' in change ? { venueAddress: undefined } : {}),
            }));
          }}
          onUseZone={(zone) => {
            setTimeZone(zone);
            setErrors((previous) => ({ ...previous, timeZone: undefined }));
          }}
        />

        <section className="card" aria-labelledby="event-defaults">
          <h2 id="event-defaults">{t('eventForm.zoneHeading')}</h2>
          <div className="settings-fields">
            <Choice
              id="event-time-zone"
              label={t('eventForm.timeZone')}
              value={timeZone}
              error={errors.timeZone}
              busy={busy}
              options={zones}
              onChange={(value) => {
                setTimeZone(value);
                setErrors((previous) => ({ ...previous, timeZone: undefined }));
              }}
            />
            <Choice
              id="event-currency"
              label={t('eventForm.currency')}
              value={currency}
              error={errors.currency}
              busy={busy}
              options={currencies}
              onChange={(value) => {
                setCurrency(value);
                setErrors((previous) => ({ ...previous, currency: undefined }));
              }}
            />
          </div>
          <p className="field-help">{t('eventForm.defaultsHint', { name: organisation.name })}</p>
        </section>

        <div>
          <button className="button button-primary" type="submit" aria-busy={busy}>
            {busy ? t('eventForm.creating') : t('eventForm.create')}
          </button>
        </div>
      </form>
    </div>
  );
}
