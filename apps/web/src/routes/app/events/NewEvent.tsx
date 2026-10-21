import { ApiError, type Membership } from '@soirely/api-client';
import {
  EVENT_NAME_MAXIMUM,
  type EventDraft,
  type EventField,
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

type Field = EventField | 'timeZone' | 'currency';
type Errors = Partial<Record<Field, string | undefined>>;

const FIELDS: readonly Field[] = ['name', 'startsAt', 'endsAt', 'timeZone', 'currency'];

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
  const [currency, setCurrency] = useState(organisation.currency);
  const [errors, setErrors] = useState<Errors>({});
  const [unsent, setUnsent] = useState(0);
  const [status, setStatus] = useState<'editing' | 'creating' | 'failed'>('editing');
  const focusNext = useRef<string | null>(null);
  const currencies = useMemo(
    () => currencyChoices(organisation.currency, locale),
    [organisation.currency, locale],
  );
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

    const problems = eventProblems(draft);

    if (problems.length > 0) {
      const found: Errors = {};
      for (const { field, problem } of problems)
        found[field] ??= t(`eventForm.${problem}`, { most: EVENT_NAME_MAXIMUM });

      setUnsent(problems.length);
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
              {t('eventForm.nameCount', { length: nameLength, most: EVENT_NAME_MAXIMUM })}
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

/** The input focus goes to: the empty half of a start or an end, or the end's date when it is too early. */
function inputFor(field: Field, draft: EventDraft): string {
  if (field === 'name') return 'event-name';
  if (field === 'timeZone') return 'event-time-zone';
  if (field === 'currency') return 'event-currency';

  const [prefix, date, time] =
    field === 'startsAt'
      ? ['event-start', draft.startDate, draft.startTime]
      : ['event-end', draft.endDate, draft.endTime];

  return date !== '' && time === '' ? `${prefix}-time` : `${prefix}-date`;
}

function describedBy(...ids: (string | null)[]): string | undefined {
  const joined = ids.filter((id) => id != null).join(' ');

  return joined === '' ? undefined : joined;
}

function Moment({
  id,
  legend,
  hint,
  date,
  time,
  error,
  busy,
  onDate,
  onTime,
}: {
  id: string;
  legend: string;
  hint?: string;
  date: string;
  time: string;
  error: string | undefined;
  busy: boolean;
  onDate: (date: string) => void;
  onTime: (time: string) => void;
}) {
  const { t } = useTranslation();
  const described = describedBy(
    error == null ? null : `${id}-error`,
    hint == null ? null : `${id}-hint`,
  );
  const className = error == null ? 'input' : 'input input-wrong';

  return (
    <fieldset className="event-moment">
      <legend>{legend}</legend>
      <div className="event-moment-inputs">
        <div className="field event-moment-date">
          <label htmlFor={`${id}-date`}>{t('eventForm.date')}</label>
          <input
            id={`${id}-date`}
            className={className}
            type="date"
            value={date}
            disabled={busy}
            aria-invalid={error != null}
            aria-describedby={described}
            onChange={(event) => onDate(event.target.value)}
          />
        </div>
        <div className="field event-moment-time">
          <label htmlFor={`${id}-time`}>{t('eventForm.time')}</label>
          <input
            id={`${id}-time`}
            className={className}
            type="time"
            value={time}
            disabled={busy}
            aria-invalid={error != null}
            aria-describedby={described}
            onChange={(event) => onTime(event.target.value)}
          />
        </div>
      </div>
      <FieldError id={`${id}-error`} message={error} />
      {hint != null && (
        <p className="field-help" id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </fieldset>
  );
}

function Choice({
  id,
  label,
  value,
  error,
  busy,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error: string | undefined;
  busy: boolean;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        className={error == null ? 'input' : 'input input-wrong'}
        value={value}
        disabled={busy}
        aria-invalid={error != null}
        aria-describedby={error == null ? undefined : `${id}-error`}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (message == null) return null;

  return (
    <div className="field-error" id={id}>
      <span className="mark mark-broken" aria-hidden="true">
        ✕
      </span>
      <p>{message}</p>
    </div>
  );
}
