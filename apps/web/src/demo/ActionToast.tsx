import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { duration } from '../leaving.ts';
import './makeLive.css';

export interface Told {
  words: string;
  action?: { word: string; to: string };
}

/** The kit's toast with a text action that goes somewhere: read out politely, and held while the pointer or focus is on it. */
export function ActionToast({ told, onClose }: { told: Told; onClose: () => void }) {
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
      <p className="toast-words">{told.words}</p>
      {told.action != null && (
        <Link className="toast-undo ml-toast-go" to={told.action.to}>
          {told.action.word}
        </Link>
      )}
      <button type="button" className="toast-close" aria-label={t('toast.close')} onClick={onClose}>
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
