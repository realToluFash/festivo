import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { eventAreaPath } from './EventNav.tsx';
import { scheduleViewPath } from './nightArea.ts';
import './night.css';

/** "Schedule · Run of show" in the header bar, only while the event is happening (sc-3895). */
export function NightSwitch({ eventId, on }: { eventId: string; on: 'night' | 'schedule' }) {
  const { t } = useTranslation();

  return (
    <nav className="nt-switch" aria-label={t('night.switch')}>
      {on === 'schedule' ? (
        <>
          <span aria-current="page">{t('schedule.title')}</span>
          <Link to={eventAreaPath(eventId, 'schedule')}>{t('runView.title')}</Link>
        </>
      ) : (
        <>
          <Link to={scheduleViewPath(eventId)}>{t('schedule.title')}</Link>
          <span aria-current="page">{t('runView.title')}</span>
        </>
      )}
    </nav>
  );
}
