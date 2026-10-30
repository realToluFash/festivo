import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialogKeys } from '../../../dialogFocus.ts';
import { offButton } from '../../../offButton.ts';

/** Keep editing is the safe answer, so focus starts there; Escape keeps editing too, and focus goes back where it was unless going on opened another page. */
export function Confirm({
  id,
  title,
  body,
  go,
  pending,
  opensPage = false,
  onGo,
  onKeep,
}: {
  id: string;
  title: string;
  body: string;
  go: string;
  pending: boolean;
  opensPage?: boolean;
  onGo: () => void;
  onKeep: () => void;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDivElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const left = useRef(false);

  useEffect(() => {
    const opener = document.activeElement;

    keep.current?.focus();

    return () => {
      if (left.current) return;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

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
          <h2 id={`${id}-title`}>{title}</h2>
          <p id={`${id}-body`}>{body}</p>
        </div>
        <div className="dialog-actions">
          <button
            ref={keep}
            type="button"
            className="button button-primary"
            {...offButton(pending, { dim: false })}
            onClick={onKeep}
          >
            {t('eventEdit.keepEditing')}
          </button>
          <button
            type="button"
            className="button"
            {...offButton(pending, { dim: false })}
            aria-busy={pending}
            onClick={() => {
              left.current = opensPage;
              onGo();
            }}
          >
            {go}
          </button>
        </div>
      </div>
    </>
  );
}
