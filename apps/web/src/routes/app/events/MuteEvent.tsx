import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';

/** `MuteEvent-*` (sc-3980): per person, the same switch as the bell's More, below the page's buttons. */
export function MuteEvent({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const heading = useId();
  const [muted, setMuted] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    api.eventMuted(eventId).then(
      (answer) => {
        if (current) setMuted(answer);
      },
      () => {
        if (current) setFailed(true);
      },
    );

    return () => {
      current = false;
    };
  }, [eventId]);

  async function change(next: boolean): Promise<void> {
    setFailed(false);
    setMuted(next);
    try {
      setMuted(await api.muteEvent(eventId, next));
    } catch {
      setMuted(!next);
      setFailed(true);
    }
  }

  return (
    <section className="card event-mute" aria-labelledby={heading}>
      <h2 id={heading}>{t('eventMute.heading')}</h2>
      <p className="muted">{t('eventMute.note')}</p>
      <label className="notification-switch">
        <input
          type="checkbox"
          role="switch"
          checked={muted === true}
          disabled={muted == null}
          onChange={(event) => void change(event.currentTarget.checked)}
        />
        <span>{t('notifications.muteEvent')}</span>
      </label>
      {failed && <p className="field-error">{t('notifications.muteNotSaved')}</p>}
      <Link className="link-button" to="/app/account/notifications">
        {t('notifications.settings')}
      </Link>
    </section>
  );
}
