import { ApiError, type EventDeletion, type OrganisationEvent } from '@soirely/api-client';
import { typedNameMatches } from '@soirely/domain';
import { useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { api } from '../../../api.ts';
import { FieldError } from '../../../components/FieldError.tsx';
import { Ask } from '../../../components/SettingsParts.tsx';
import { offButton } from '../../../offButton.ts';

/** `Event View` (sc-3592): at the foot of the page, apart from the actions that change the event. */
export function DeleteEvent({
  event,
  look,
}: {
  event: OrganisationEvent;
  look?: { className: string; describedBy: string } | undefined;
}) {
  const { t } = useTranslation();
  const [opening, setOpening] = useState(false);
  const [unopened, setUnopened] = useState<string | null>(null);
  const [preview, setPreview] = useState<EventDeletion | null>(null);
  const opener = useRef<HTMLButtonElement>(null);

  function open(): void {
    setOpening(true);
    setUnopened(null);
    api.eventDeletion(event.id).then(
      (answer) => {
        setOpening(false);
        setPreview(answer);
      },
      (error: unknown) => {
        setOpening(false);
        setUnopened(
          error instanceof ApiError ? error.problem.title : t('membersScreen.actionFailed'),
        );
      },
    );
  }

  const keep = () => {
    setPreview(null);
    window.setTimeout(() => opener.current?.focus(), 0);
  };

  return (
    <div className={look == null ? 'event-delete' : undefined}>
      {look == null && <p className="event-delete-note">{t('eventDelete.note')}</p>}
      <button
        ref={opener}
        type="button"
        className={look?.className ?? 'button button-danger'}
        aria-describedby={look?.describedBy}
        {...offButton(opening, { dim: false })}
        aria-busy={opening}
        onClick={open}
      >
        {t('eventDelete.open')}
      </button>
      {unopened != null && <FieldError id="event-delete-unopened" message={unopened} />}
      {preview != null && <DeleteDialog event={event} preview={preview} onKeep={keep} />}
    </div>
  );
}

/** As the demo asks (sc-1468): B's confirm for a Draft with nobody on its list, else the name to type, focused, with Delete grey until it matches. */
function DeleteDialog({
  event,
  preview,
  onKeep,
}: {
  event: OrganisationEvent;
  preview: EventDeletion;
  onKeep: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [needsName, setNeedsName] = useState(preview.needsName);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const [failed, setFailed] = useState<string | undefined>(undefined);
  const field = useRef<HTMLInputElement>(null);
  const body = useId();
  const [name, setName] = useState(event.name);
  const matched = typedNameMatches(typed, name);

  async function go(): Promise<void> {
    if (busy) return;

    if (needsName && !matched) {
      setMismatch(true);
      field.current?.focus();

      return;
    }

    setBusy(true);
    setFailed(undefined);

    try {
      await api.deleteEvent(event.id, needsName ? typed : undefined);
      void navigate('/app/events', { replace: true, state: { deletedEvent: name } });
    } catch (error) {
      const refusedName =
        error instanceof ApiError &&
        (error.problem.violations ?? []).some((one) => one.propertyPath === 'name');
      const current = refusedName ? await reread(event.id) : null;
      setBusy(false);

      if (refusedName) {
        // A Draft made live, or given a guest, elsewhere since the dialog opened now asks for its name.
        flushSync(() => {
          if (current != null) setName(current);
          setNeedsName(true);
          setMismatch(true);
        });
        field.current?.focus();
      } else {
        setFailed(
          error instanceof ApiError ? error.problem.title : t('membersScreen.actionFailed'),
        );
      }
    }
  }

  const ask = {
    title: t('eventDelete.title', { event: name }),
    keep: t('eventDelete.keep'),
    go: t('eventDelete.delete'),
    busy: busy ? t('eventDelete.deleting') : undefined,
    failed,
    onKeep,
    onGo: () => void go(),
  };

  if (!needsName) return <Ask {...ask} line={t('eventDelete.draftBody')} />;

  return (
    <Ask
      {...ask}
      line={t('eventDelete.removes')}
      describedBy={`${body}-what ${body}-link ${body}-window`}
      off={!matched}
      first={field}
    >
      <ul id={`${body}-what`} className="ev-removes">
        <li>{t('eventDelete.removesEvent')}</li>
        {preview.people > 0 && <li>{t('eventDelete.removesGuests', { count: preview.people })}</li>}
      </ul>
      <p id={`${body}-link`}>{t('eventDelete.guests')}</p>
      <p id={`${body}-window`}>{t('eventDelete.window', { deadline: preview.restoreCloses })}</p>
      <div className="desk-field ev-delete-name">
        <label htmlFor="event-delete-name" className="desk-label">
          {t('eventDelete.type', { event: name })}
        </label>
        <div className={mismatch ? 'desk-box is-wrong' : 'desk-box'}>
          <input
            ref={field}
            id="event-delete-name"
            type="text"
            value={typed}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            readOnly={busy}
            aria-invalid={mismatch}
            aria-describedby="event-delete-name-help"
            onChange={(change) => {
              setTyped(change.target.value);
              if (typedNameMatches(change.target.value, name)) setMismatch(false);
            }}
            onBlur={() => setMismatch(typed !== '' && !matched)}
            onKeyDown={(key) => {
              if (key.key !== 'Enter') return;
              key.preventDefault();
              void go();
            }}
          />
        </div>
        {mismatch ? (
          <p id="event-delete-name-help" className="desk-error" role="alert">
            {t('eventDelete.mismatch', { event: name })}
          </p>
        ) : (
          <p id="event-delete-name-help" className="desk-help">
            {t('eventDelete.typeHint')}
          </p>
        )}
      </div>
    </Ask>
  );
}

/** A name the API refused may be one renamed since the dialog opened (sc-44741); unread, the dialog keeps the name it has. */
async function reread(eventId: string): Promise<string | null> {
  try {
    return (await api.event(eventId)).name;
  } catch {
    return null;
  }
}
