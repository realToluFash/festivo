import { useTranslation } from 'react-i18next';

import { describedBy } from './eventFieldOrder.ts';

export function Moment({
  id,
  legend,
  skipped,
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
  skipped?: string | null;
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
    skipped == null ? null : `${id}-gap`,
    hint == null ? null : `${id}-hint`,
  );
  const className = error == null ? 'input' : 'input input-wrong';

  return (
    <fieldset className="event-moment" aria-describedby={described}>
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
      <div id={`${id}-gap`} aria-live="polite">
        {skipped != null && (
          <div className="notice notice-quiet event-moment-gap">
            <span className="mark mark-info" aria-hidden="true">
              i
            </span>
            <p>{skipped}</p>
          </div>
        )}
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

export function Choice({
  id,
  label,
  hint,
  value,
  error,
  busy,
  options,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
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
        className={[
          'input',
          error == null ? null : 'input-wrong',
          value === '' ? 'input-unchosen' : null,
        ]
          .filter((one) => one != null)
          .join(' ')}
        value={value}
        disabled={busy}
        aria-invalid={error != null}
        aria-describedby={describedBy(
          error == null ? null : `${id}-error`,
          hint == null ? null : `${id}-hint`,
        )}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldError id={`${id}-error`} message={error} />
      {hint != null && (
        <p className="field-help" id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function FieldError({ id, message }: { id: string; message: string | undefined }) {
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
