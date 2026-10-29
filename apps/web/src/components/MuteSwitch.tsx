import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { announceMute, useMutes } from '../eventMutes.ts';
import { FieldError } from './FieldError.tsx';

type Mute =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'loaded'; muted: boolean; unsaved: boolean };

/** Mute this event (sc-3980), per person: the event page's card and the bell's More share it. */
export function MuteSwitch({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const [mute, setMute] = useState<Mute>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const errorId = useId();
  const unsaved = mute.status === 'loaded' && mute.unsaved;

  useMutes((changed, saved) => {
    if (changed === eventId) setMute({ status: 'loaded', muted: saved.muted, unsaved: false });
  });

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
      const saved = await api.muteEvent(eventId, next);
      setMute({ status: 'loaded', muted: saved.muted, unsaved: false });
      announceMute(eventId, saved);
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
          aria-describedby={unsaved ? errorId : undefined}
          onChange={(event) => void change(event.currentTarget.checked)}
        />
        <span>{t('notifications.muteEvent')}</span>
      </label>
      {mute.status === 'failed' && (
        <FieldError id={`${errorId}-load`} message={t('notifications.muteNotLoaded')}>
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
        </FieldError>
      )}
      {unsaved && <FieldError id={errorId} message={t('notifications.muteNotSaved')} />}
    </>
  );
}
