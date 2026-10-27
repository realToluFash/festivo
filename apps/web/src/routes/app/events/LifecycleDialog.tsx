import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialogKeys } from '../../../dialogFocus.ts';
import { offButton } from '../../../offButton.ts';
import { type Asking } from './useLifecycleAction.ts';

/** The confirmation every lifecycle move asks with, and the refusal it turns into; on narrow screens the phone's bottom sheet. */
export function LifecycleDialog<C>({
  id,
  asking,
  title,
  lines,
  failed,
  keep,
  confirm,
  tone,
  onGo,
  onClose,
}: {
  id: string;
  asking: Asking<C>;
  title: string;
  lines: string[];
  failed: string;
  keep: string;
  confirm: string;
  tone: 'primary' | 'danger';
  onGo: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const pending = asking.kind === 'confirm' && asking.pending;

  useEffect(() => first.current?.focus(), [asking.kind]);
  useDialogKeys(dialog, onClose, pending);

  const [shownTitle, shownLines] =
    asking.kind === 'confirm'
      ? [title, asking.failed ? [...lines, failed] : lines]
      : [asking.title, asking.lines];

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={dialog}
        className="dialog event-live-dialog"
        role={asking.kind === 'confirm' ? 'dialog' : 'alertdialog'}
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-body`}
      >
        <div className="dialog-heading">
          <h2 id={`${id}-title`}>{shownTitle}</h2>
          <div id={`${id}-body`}>
            {shownLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
        <div className="dialog-actions">
          {asking.kind === 'confirm' ? (
            <>
              <button
                ref={first}
                type="button"
                className="button"
                {...offButton(pending, { dim: false })}
                onClick={onClose}
              >
                {keep}
              </button>
              <button
                type="button"
                className={`button button-${tone}`}
                {...offButton(pending, { dim: false })}
                aria-busy={pending}
                onClick={onGo}
              >
                {confirm}
              </button>
            </>
          ) : (
            <button ref={first} type="button" className="button button-primary" onClick={onClose}>
              {t('eventLive.close')}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
