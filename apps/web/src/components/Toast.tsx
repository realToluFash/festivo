import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { duration } from '../leaving.ts';

/** The countdown waits while the pointer or focus is on it, so nobody loses Undo while reaching for it. */
export function Toast({
  words,
  onUndo,
  onClose,
}: {
  words: string;
  onUndo?: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const held = useRef(false);
  const close = useRef(onClose);

  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const lifetime = duration('toastLifetime');
    let left = lifetime > 0 ? lifetime : 10000;
    const tick = 250;
    const timer = window.setInterval(() => {
      if (held.current) return;
      left -= tick;
      if (left <= 0) close.current();
    }, tick);

    return () => window.clearInterval(timer);
  }, []);

  const hold = (): void => {
    held.current = true;
  };
  const release = (): void => {
    held.current = false;
  };

  return (
    <div
      className="toast"
      role="status"
      onPointerEnter={hold}
      onPointerLeave={release}
      onFocus={hold}
      onBlur={release}
    >
      <p className="toast-words">{words}</p>
      {onUndo != null && (
        <button
          type="button"
          className="toast-undo"
          onClick={() => {
            onUndo();
            onClose();
          }}
        >
          {t('toast.undo')}
        </button>
      )}
      <button type="button" className="toast-close" aria-label={t('toast.close')} onClick={onClose}>
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
