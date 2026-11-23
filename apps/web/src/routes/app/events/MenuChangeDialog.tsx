import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialogKeys } from '../../../dialogFocus.ts';

/** What a change asks, as sc-3913's MenuChange dialog says it: the change, who it asks again for which course, and what stays. */
export interface ChangeAsks {
  title: string;
  count: string;
  stays: string;
}

/** Focus starts on Cancel and goes back to the opener as it closes; once the change is made the page moves it on to the course heading. A refusal leaves only Close. */
export function MenuChangeDialog({
  asks,
  refused,
  busy,
  onCancel,
  onGo,
}: {
  asks: ChangeAsks;
  refused: string | null;
  busy: boolean;
  onCancel: () => void;
  onGo: () => void;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement;

    cancel.current?.focus();

    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    if (refused != null) closeButton.current?.focus();
  }, [refused]);

  useDialogKeys(dialog, onCancel, false);

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={dialog}
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="mx-title"
        aria-describedby="mx-body"
      >
        <div className="dialog-heading">
          <h2 id="mx-title">{asks.title}</h2>
          <div id="mx-body" className="dialog-body">
            <p>{asks.count}</p>
            <p>{asks.stays}</p>
            <p>{t('menuChange.nobodyMessaged')}</p>
          </div>
        </div>
        {refused != null && (
          <div className="notice notice-broken" role="alert">
            <span className="mark mark-broken" aria-hidden="true">
              ✕
            </span>
            <div className="notice-body">
              <p>
                <strong>{t('menuChange.refusedWord')}</strong> {refused}
              </p>
            </div>
          </div>
        )}
        <div className="dialog-actions dialog-actions-stack">
          {refused == null ? (
            <>
              <button ref={cancel} type="button" className="link-button" onClick={onCancel}>
                <span className="button-label">{t('menuChange.cancel')}</span>
              </button>
              <button
                type="button"
                className="button button-primary"
                aria-disabled={busy}
                onClick={busy ? undefined : onGo}
              >
                <span className="button-label">{t('menuChange.go')}</span>
              </button>
            </>
          ) : (
            <button
              ref={closeButton}
              type="button"
              className="button button-primary"
              onClick={onCancel}
            >
              <span className="button-label">{t('menuChange.close')}</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
