import { useEffect, useRef } from 'react';

import { useDialogKeys } from '../dialogFocus.ts';
import { type ChangeAsks, MCW } from './menuChange.ts';

/** Focus starts on Cancel and goes back to the opener as it closes; once the change is made the page moves it on to the course heading. A 409 leaves only Close. */
export function MenuChangeDialog({
  asks,
  refused,
  back,
  onCancel,
  onGo,
}: {
  asks: ChangeAsks;
  refused: string | null;
  back: string | null;
  onCancel: () => void;
  onGo: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement;

    cancel.current?.focus();

    return () => {
      const to = back == null ? opener : document.getElementById(back);
      if (to instanceof HTMLElement && to.isConnected) to.focus();
    };
  }, [back]);

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
            <p>{MCW.nobodyMessaged}</p>
          </div>
        </div>
        {refused != null && (
          <div className="notice notice-broken" role="alert">
            <span className="mark mark-broken" aria-hidden="true">
              ✕
            </span>
            <div className="notice-body">
              <p>
                <strong>{MCW.refusedWord}</strong> {refused}
              </p>
            </div>
          </div>
        )}
        <div className="dialog-actions dialog-actions-stack">
          {refused == null ? (
            <>
              <button ref={cancel} type="button" className="link-button" onClick={onCancel}>
                <span className="button-label">{MCW.cancel}</span>
              </button>
              <button type="button" className="button button-primary" onClick={onGo}>
                <span className="button-label">{MCW.go}</span>
              </button>
            </>
          ) : (
            <button
              ref={closeButton}
              type="button"
              className="button button-primary"
              onClick={onCancel}
            >
              <span className="button-label">{MCW.close}</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
