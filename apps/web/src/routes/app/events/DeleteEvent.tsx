import { ApiError, type EventDeletion, type OrganisationEvent } from '@soirely/api-client';
import { typedNameMatches } from '@soirely/domain';
import { type FormEvent, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { api } from '../../../api.ts';
import { FieldError } from '../../../components/FieldError.tsx';
import { useDialogKeys } from '../../../dialogFocus.ts';
import { offButton } from '../../../offButton.ts';
import { focusWhereSent, offField } from '../../../offField.ts';
import { focusStep } from '../../../stepFocus.ts';

/** `Event View` (sc-3592): at the foot of the page, apart from the actions that change the event. */
export function DeleteEvent({ event }: { event: OrganisationEvent }) {
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
    <div className="event-delete">
      <p className="event-delete-note">{t('eventDelete.note')}</p>
      <button
        ref={opener}
        type="button"
        className="button button-danger"
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
  const [mismatch, setMismatch] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const name = event.name;

  useLayoutEffect(() => focusStep(heading.current), []);
  useDialogKeys(dialog, onKeep, busy);

  async function submit(form: FormEvent<HTMLFormElement>): Promise<void> {
    form.preventDefault();
    if (busy) return;

    if (needsName && !typedNameMatches(typed, name)) {
      document.getElementById('event-delete-name')?.focus();
      setMismatch(t('eventDelete.mismatch', { event: name }));

      return;
    }

    setBusy(true);
    setFailed(null);
    const land = focusWhereSent();

    try {
      await api.deleteEvent(event.id, needsName ? typed : undefined);
      void navigate('/app/events', { replace: true, state: { deletedEvent: name } });
    } catch (error) {
      setBusy(false);
      const refusedName =
        error instanceof ApiError &&
        (error.problem.violations ?? []).some((one) => one.propertyPath === 'name');

      if (refusedName) {
        // A Draft made live elsewhere since the dialog opened now asks for its name.
        flushSync(() => setNeedsName(true));
        setMismatch(t('eventDelete.mismatch', { event: name }));
        land('event-delete-name');
      } else {
        setFailed(
          error instanceof ApiError ? error.problem.title : t('membersScreen.actionFailed'),
        );
      }
    }
  }

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={dialog}
        className="dialog event-delete-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-delete-title"
        aria-describedby="event-delete-body"
      >
        <form className="dialog-form" noValidate onSubmit={(sent) => void submit(sent)}>
          <div className="dialog-heading">
            <h2 id="event-delete-title" ref={heading} tabIndex={-1}>
              {t('eventDelete.title', { event: name })}
            </h2>
            {needsName ? (
              <div id="event-delete-body" className="event-delete-body">
                <p>{t('eventDelete.removes')}</p>
                <ul className="event-delete-list">
                  <li>{t('eventDelete.removesEvent')}</li>
                </ul>
                <p>{t('eventDelete.guests')}</p>
                <p>{t('eventDelete.window', { deadline: preview.restoreCloses })}</p>
              </div>
            ) : (
              <div id="event-delete-body" className="event-delete-body">
                <p>{t('eventDelete.draftBody')}</p>
              </div>
            )}
          </div>

          {failed != null && (
            <div className="notice notice-broken" role="alert">
              <span className="mark mark-broken" aria-hidden="true">
                ✕
              </span>
              <p>{failed}</p>
            </div>
          )}

          {needsName && (
            <div className="field">
              <label htmlFor="event-delete-name">{t('eventDelete.type', { event: name })}</label>
              <input
                className={mismatch != null ? 'input input-wrong' : 'input'}
                id="event-delete-name"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                value={typed}
                {...offField(busy)}
                aria-invalid={mismatch != null}
                aria-describedby={
                  mismatch != null ? 'event-delete-name-error' : 'event-delete-name-hint'
                }
                onChange={(change) => {
                  setTyped(change.target.value);
                  if (typedNameMatches(change.target.value, name)) setMismatch(null);
                }}
              />
              {mismatch != null && <FieldError id="event-delete-name-error" message={mismatch} />}
              <p className="muted" id="event-delete-name-hint">
                {t('eventDelete.typeHint')}
              </p>
            </div>
          )}

          <div className="dialog-actions actions-confirm">
            <button
              type="button"
              className="link-button"
              {...offButton(busy, { dim: false })}
              onClick={onKeep}
            >
              {t('eventDelete.keep')}
            </button>
            <button className="button button-danger" type="submit" aria-busy={busy}>
              {busy ? t('eventDelete.deleting') : t('eventDelete.delete')}
            </button>
            {busy && (
              <p className="visually-hidden" role="status">
                {t('eventDelete.deleting')}
              </p>
            )}
          </div>
        </form>
      </div>
    </>
  );
}
