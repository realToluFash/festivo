import { ApiError, type Membership } from '@soirely/api-client';
import {
  CURRENCY_CODES,
  EVENT_NAME_MAXIMUM,
  type EventDraft,
  eventNameLength,
  eventNameOf,
  eventProblems,
  filledEndDate,
  localDateTime,
} from '@soirely/domain';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { api } from '../../../api.ts';
import { currentLocale } from '../../../i18n/index.ts';
import { can, useSession } from '../../../session.ts';
import { currencyChoices, timeZoneChoices } from '../../../zoneAndCurrencyChoices.ts';
import { Forbidden } from '../Forbidden.tsx';
import { Choice, FieldError, Moment } from './EventFields.tsx';
import { type Errors, FIELDS, type Field, describedBy, inputFor } from './eventFieldOrder.ts';

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
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
  });
  const [endChosen, setEndChosen] = useState(false);
  const [timeZone, setTimeZone] = useState(organisation.timezone);
  const [currency, setCurrency] = useState(
    CURRENCY_CODES.includes(organisation.currency) ? organisation.currency : '',
  );
  const [errors, setErrors] = useState<Errors>({});
  const [unsent, setUnsent] = useState(0);
  const [status, setStatus] = useState<'editing' | 'creating' | 'failed'>('editing');
  const focusNext = useRef<string | null>(null);
  const currencies = useMemo(() => currencyChoices('', currency, locale, t), [currency, locale, t]);
  const zones = useMemo(() => timeZoneChoices(organisation.timezone), [organisation.timezone]);
  const busy = status === 'creating';

  useEffect(() => {
    if (focusNext.current == null) return;

    document.getElementById(focusNext.current)?.focus();
    focusNext.current = null;
  }, [errors]);

  function edit(field: Field, changes: Partial<EventDraft>): void {
    setDraft((previous) => ({ ...previous, ...changes }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  }

  function refuse(found: Errors): void {
    const first = FIELDS.find((field) => found[field] != null);

    focusNext.current = first == null ? null : inputFor(first, draft);
    setErrors(found);
  }

  async function create(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;

    const found: Errors = {};
    for (const { field, problem } of eventProblems(draft))
      found[field] ??= t(`eventForm.${problem}`, { most: EVENT_NAME_MAXIMUM });
    if (currency === '') found.currency = t('orgGeneral.currencyBlank');

    const unsentFields = Object.keys(found).length;

    if (unsentFields > 0) {
      setUnsent(unsentFields);
      setStatus('editing');
      refuse(found);
      return;
    }

    setUnsent(0);
    setStatus('creating');

    try {
      const created = await api.createEvent(organisation.id, {
        name: eventNameOf(draft.name),
        startsAt: localDateTime(draft.startDate, draft.startTime) ?? '',
        endsAt: localDateTime(draft.endDate, draft.endTime) ?? '',
        timeZone,
        currency,
      });

      void navigate(`/app/events/${encodeURIComponent(created.id)}`);
    } catch (error) {
      const refused = error instanceof ApiError && error.status === 422 ? error.fieldErrors() : {};
      const found: Errors = {};
      for (const field of FIELDS) if (refused[field] != null) found[field] = refused[field];

      if (Object.keys(found).length > 0) {
        setStatus('editing');
        refuse(found);
        return;
      }

      setStatus('failed');
    }
  }

  const nameLength = eventNameLength(draft.name);

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
              disabled={busy}
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
        </section>

        <section className="card" aria-labelledby="event-when">
          <h2 id="event-when">{t('eventForm.whenHeading')}</h2>
          <Moment
            id="event-start"
            legend={t('eventForm.starts')}
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
