import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';

type Mute =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'loaded'; muted: boolean; unsaved: boolean };

/** Mute this event (sc-3980), per person: the event page's card and the bell's More share it. */
export function MuteSwitch({
  eventId,
  onMuted,
}: {
  eventId: string;
  onMuted?: (muted: boolean) => void;
}) {
  const { t } = useTranslation();
  const [mute, setMute] = useState<Mute>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    api.eventMuted(eventId).then(
      (muted) => {
        if (current) setMute({ status: 'loaded', muted, unsaved: false });
      },
      () => {
        if (current) setMute({ status: 'failed' });
      },
    );

    return () => {
      current = false;
    };
  }, [eventId, attempt]);

  async function change(next: boolean): Promise<void> {
    setMute({ status: 'loaded', muted: next, unsaved: false });
    try {
      const muted = await api.muteEvent(eventId, next);
      setMute({ status: 'loaded', muted, unsaved: false });
      onMuted?.(muted);
    } catch {
      setMute({ status: 'loaded', muted: !next, unsaved: true });
    }
  }

  return (
    <>
      <label className="notification-switch">
        <input
          type="checkbox"
          role="switch"
          checked={mute.status === 'loaded' && mute.muted}
          disabled={mute.status !== 'loaded'}
          onChange={(event) => void change(event.currentTarget.checked)}
        />
        <span>{t('notifications.muteEvent')}</span>
      </label>
      {mute.status === 'failed' && (
        <div className="field-error" role="alert">
          <p>{t('notifications.muteNotLoaded')}</p>
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setMute({ status: 'loading' });
              setAttempt((tries) => tries + 1);
            }}
          >
            {t('notifications.tryAgain')}
          </button>
        </div>
      )}
      {mute.status === 'loaded' && mute.unsaved && (
        <p className="field-error">{t('notifications.muteNotSaved')}</p>
      )}
    </>
  );
}
