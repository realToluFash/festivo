import { type ReactNode, type RefObject, useRef } from 'react';

import { useDialogKeys } from '../../../dialogFocus.ts';
import { offButton } from '../../../offButton.ts';

/** A Members confirm as sc-22092's dialog, a sheet at phone width; whoever opens it moves focus to its title and back on Keep. */
export function MemberConfirm({
  id,
  titleRef,
  title,
  keep,
  go,
  busy,
  children,
  onKeep,
  onGo,
}: {
  id: string;
  titleRef: RefObject<HTMLHeadingElement | null>;
  title: string;
  keep: string;
  go: string;
  busy: boolean;
  children: ReactNode;
  onKeep: () => void;
  onGo: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);

  useDialogKeys(dialog, onKeep, busy);

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={dialog}
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
      >
        <div className="dialog-heading">
          <h2 id={`${id}-title`} ref={titleRef} tabIndex={-1}>
            {title}
          </h2>
          {children}
        </div>
        <div className="dialog-actions dialog-actions-stack">
          <button type="button" className="link-button" onClick={onKeep}>
            <span className="button-label">{keep}</span>
          </button>
          <button
            type="button"
            className="button button-danger"
            aria-busy={busy}
            {...offButton(busy)}
            onClick={onGo}
          >
            <span className="button-label">{go}</span>
          </button>
        </div>
      </div>
    </>
  );
}
