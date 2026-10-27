import { ApiError, type OrganisationEvent } from '@soirely/api-client';
import {
  copiedEnd,
  formatEventMoment,
  formatHours,
  lengthInHours,
  localDateTime,
  skippedLine,
} from '@soirely/domain';
import { type FormEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { api } from '../../../api.ts';
import { useDialogKeys } from '../../../dialogFocus.ts';
import { dateLocale } from '../../../i18n/index.ts';
import { offButton } from '../../../offButton.ts';
import { focusWhereSent } from '../../../offField.ts';
import { focusStep } from '../../../stepFocus.ts';
import { Moment } from './EventFields.tsx';
import { StatusPill } from './MakeLive.tsx';

const OPENING_AFTER = 700;

/** `Duplicate` (sc-3593): how the event is set up, as a new Draft from a start the organiser chooses. */
export function DuplicateEvent({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    window.setTimeout(() => opener.current?.focus(), 0);
  };

  return (
    <>
      <button ref={opener} type="button" className="button" onClick={() => setOpen(true)}>
        {t('eventDuplicate.open')}
      </button>
      {open && <DuplicateDialog event={event} onClose={close} />}
    </>
  );
}

function DuplicateDialog({ event, onClose }: { event: OrganisationEvent; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<'editing' | 'creating' | 'failed' | 'created'>('editing');
  const [created, setCreated] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const busy = status === 'creating' || status === 'created';
  const locale = dateLocale();

  useLayoutEffect(() => focusStep(heading.current), []);
  useDialogKeys(dialog, onClose, busy);

  useEffect(() => {
    if (created == null) return;

    const id = window.setTimeout(
      () => void navigate(`/app/events/${encodeURIComponent(created)}`),
      OPENING_AFTER,
    );

    return () => window.clearTimeout(id);
  }, [created, navigate]);

  async function submit(form: FormEvent<HTMLFormElement>): Promise<void> {
    form.preventDefault();
    if (busy) return;

    if (date === '' || time === '') {
      setError(
        t(
          date === '' && time === ''
            ? 'eventDuplicate.startMissing'
            : date === ''
              ? 'eventDuplicate.dateMissing'
              : 'eventDuplicate.timeMissing',
        ),
      );
      document
        .getElementById(date === '' ? 'event-copy-start-date' : 'event-copy-start-time')
        ?.focus();

      return;
    }

    setStatus('creating');
    const land = focusWhereSent();

    try {
      const copy = await api.duplicateEvent(event.id, localDateTime(date, time) ?? '');
      setStatus('created');
      setCreated(copy.id);
    } catch (failure) {
      const refused =
        failure instanceof ApiError && failure.status === 422
          ? failure.fieldErrors().startsAt
          : undefined;

      if (refused != null) {
        setStatus('editing');
        setError(refused);
        land('event-copy-start-date');
        return;
      }

      setStatus('failed');
    }
  }

  const end = copiedEnd(date, time, event.timeZone, event);
  const duration = formatHours(lengthInHours(event), locale);

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={dialog}
        className="dialog event-copy-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-copy-title"
        aria-describedby="event-copy-body"
      >
        <form className="dialog-form" noValidate onSubmit={(sent) => void submit(sent)}>
          <div className="dialog-heading">
            <h2 id="event-copy-title" ref={heading} tabIndex={-1}>
              {t('eventDuplicate.title', { event: event.name })}
            </h2>
            <p id="event-copy-body">{t('eventDuplicate.body')}</p>
          </div>

          <div className="event-copy-lists">
            <div>
              <h3>{t('eventDuplicate.copied')}</h3>
              <ul>
                <li>{t('eventDuplicate.copiedName')}</li>
                <li>{t('eventDuplicate.copiedType')}</li>
                <li>{t('eventDuplicate.copiedVenue')}</li>
                <li>{t('eventDuplicate.copiedCover')}</li>
                <li>{t('eventDuplicate.copiedTimeZone')}</li>
                <li>{t('eventDuplicate.copiedCurrency')}</li>
                <li>{t('eventDuplicate.copiedLength')}</li>
              </ul>
            </div>
            <div>
              <h3>{t('eventDuplicate.notCopied')}</h3>
              <ul>
                <li>{t('eventDuplicate.notCopiedGuests')}</li>
                <li>{t('eventDuplicate.notCopiedReplies')}</li>
                <li>{t('eventDuplicate.notCopiedHappened')}</li>
              </ul>
            </div>
          </div>

          {status === 'failed' && (
            <div className="notice notice-broken" role="alert">
              <span className="mark mark-broken" aria-hidden="true">
                ✕
              </span>
              <p>{t('eventDuplicate.notCreated')}</p>
            </div>
          )}

          <Moment
            id="event-copy-start"
            legend={t('eventDuplicate.starts')}
            skipped={skippedLine(date, time, event.timeZone, locale, t)}
            hint={
              end == null
                ? t('eventDuplicate.endsUnchosen', { duration, timeZone: event.timeZone })
                : t('eventDuplicate.ends', {
                    end: formatEventMoment(end, event.timeZone, locale),
                    duration,
                    timeZone: event.timeZone,
                  })
            }
            date={date}
            time={time}
            error={error}
            busy={busy}
            onDate={(chosen) => {
              setDate(chosen);
              if (chosen !== '' && time !== '') setError(undefined);
            }}
            onTime={(chosen) => {
              setTime(chosen);
              if (chosen !== '' && date !== '') setError(undefined);
            }}
          />

          <div className="event-copy-created" role="status">
            {status === 'created' && (
              <>
                <StatusPill phase="draft" />
                <p>{t('eventDuplicate.created')}</p>
              </>
            )}
          </div>

          <div className="dialog-actions">
            <button
              type="button"
              className="button"
              {...offButton(busy, { dim: false })}
              onClick={onClose}
            >
              {t('eventDuplicate.cancel')}
            </button>
            <button className="button button-primary" type="submit" aria-busy={busy}>
              {t('eventDuplicate.create')}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
