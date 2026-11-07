import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { MuteSwitch } from '../../../components/MuteSwitch.tsx';

/** `MuteEvent-*` (sc-3980): per person, the same switch as the bell's More, below the page's buttons. */
export function MuteEvent({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const heading = useId();

  return (
    <section className="card event-mute" aria-labelledby={heading}>
      <h2 id={heading}>{t('eventMute.heading')}</h2>
      <p className="muted">{t('eventMute.note')}</p>
      <MuteSwitch eventId={eventId} />
      <Link className="link-button" to="/app/account/notifications">
        {t('notifications.settings')}
      </Link>
    </section>
  );
}
