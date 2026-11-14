import { type FocusEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { duration } from '../leaving.ts';

/** How long a counted toast keeps Undo open, in seconds (sc-3774, WCAG 2.2 §2.2.1). */
export const COUNTED_SECONDS = 10;

/** The countdown waits while the pointer or focus is on it; a `counted` one restarts from full and has no ×, since its end is what Undo takes back. */
export function Toast({
  words,
  onUndo,
  onClose,
  counted,
}: {
  words: string;
  onUndo?: () => void;
  onClose: () => void;
  /** Said once with the words to screen readers, which never hear the count. */
  counted?: { said: string };
}) {
  const { t } = useTranslation();
  const held = useRef(false);
  const close = useRef(onClose);
  const [left, setLeft] = useState(COUNTED_SECONDS);
  const counts = counted != null;

  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (counts) {
      const timer = window.setInterval(
        () => setLeft((was) => (held.current ? COUNTED_SECONDS : Math.max(was - 1, 0))),
        1000,
      );

      return () => window.clearInterval(timer);
    }
    const lifetime = duration('toastLifetime');
    let remaining = lifetime > 0 ? lifetime : 10000;
    const tick = 250;
    const timer = window.setInterval(() => {
      if (held.current) return;
      remaining -= tick;
      if (remaining <= 0) close.current();
    }, tick);

    return () => window.clearInterval(timer);
  }, [counts]);

  useEffect(() => {
    if (counts && left === 0) close.current();
  }, [counts, left]);

  const hold = (): void => {
    held.current = true;
    if (counts) setLeft(COUNTED_SECONDS);
  };
  const release = (event?: FocusEvent<HTMLDivElement>): void => {
    if (event != null && event.currentTarget.contains(event.relatedTarget)) return;
    held.current = false;
  };

  return (
    <div
      className={counts ? 'toast is-counted' : 'toast'}
      role="status"
      onPointerEnter={hold}
      onPointerLeave={() => release()}
      onFocus={hold}
      onBlur={release}
    >
      <p className="toast-words">
        {words}
        {counted != null && <span className="visually-hidden"> {counted.said}</span>}
      </p>
      {counts && (
        <span className="toast-count" aria-hidden="true">
          {t('toast.secondsLeft', { count: left })}
        </span>
      )}
      {onUndo != null && (
        <button
          type="button"
          className="toast-undo"
          data-focus="undo"
          onClick={() => {
            onUndo();
            if (!counts) onClose();
          }}
        >
          {t('toast.undo')}
        </button>
      )}
      {!counts && (
        <button
          type="button"
          className="toast-close"
          aria-label={t('toast.close')}
          onClick={onClose}
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
    </div>
  );
}
