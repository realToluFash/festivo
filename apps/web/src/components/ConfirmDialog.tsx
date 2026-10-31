import { type ReactNode, type RefObject, useEffect, useRef } from 'react';

import { useDialogKeys } from '../dialogFocus.ts';
import { offButton } from '../offButton.ts';

/** Focus starts on Keep and returns unless going on opened a page; with `titleRef` the opener moves it to the title instead (sc-11369). */
export function ConfirmDialog({
  id,
  title,
  titleRef,
  keep,
  go,
  pending,
  opensPage = false,
  children,
  onKeep,
  onGo,
}: {
  id: string;
  title: string;
  titleRef?: RefObject<HTMLHeadingElement | null>;
  keep: string;
  go: string;
  pending: boolean;
  opensPage?: boolean;
  children: ReactNode;
  onKeep: () => void;
  onGo: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const keepButton = useRef<HTMLButtonElement>(null);
  const left = useRef(false);
  const focusesKeep = titleRef == null;

  useEffect(() => {
    if (!focusesKeep) return;

    const opener = document.activeElement;

    keepButton.current?.focus();

    return () => {
      if (left.current) return;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [focusesKeep]);

  useDialogKeys(dialog, onKeep, pending);

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={dialog}
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-body`}
      >
        <div className="dialog-heading">
          <h2 id={`${id}-title`} ref={titleRef} tabIndex={titleRef == null ? undefined : -1}>
            {title}
          </h2>
          <div id={`${id}-body`} className="dialog-body">
            {children}
          </div>
        </div>
        <div className="dialog-actions dialog-actions-stack">
          <button
            ref={keepButton}
            type="button"
            className="link-button"
            {...offButton(pending, { dim: false })}
            onClick={onKeep}
          >
            <span className="button-label">{keep}</span>
          </button>
          <button
            type="button"
            className="button button-danger"
            {...offButton(pending, { dim: false })}
            aria-busy={pending}
            onClick={() => {
              left.current = opensPage;
              onGo();
            }}
          >
            <span className="button-label">{go}</span>
          </button>
        </div>
      </div>
    </>
  );
}
