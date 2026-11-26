import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

type StaffPage = 'roster' | 'jobs' | 'stations' | 'hours';

/** The Staff page's tab row, as sc-3910's Design draws it, with sc-234's Hours worked last. */
export function StaffTabs({ on, eventId }: { on: StaffPage; eventId: string }) {
  const { t } = useTranslation();
  const base = `/app/events/${encodeURIComponent(eventId)}/staff`;
  const tabs: readonly { page: StaffPage; words: string; to: string }[] = [
    { page: 'roster', words: t('roster.roster'), to: `${base}/roster` },
    { page: 'jobs', words: t('jobs.tab'), to: `${base}/jobs` },
    { page: 'stations', words: t('stations.tab'), to: `${base}/stations` },
    { page: 'hours', words: t('hours.tab'), to: `${base}/hours` },
  ];

  return (
    <nav className="sn-tabs" aria-label={t('roster.title')}>
      {tabs.map((tab) =>
        tab.page === on ? (
          <span key={tab.page} className="sn-tab" aria-current="page">
            {tab.words}
          </span>
        ) : (
          <Link key={tab.page} className="sn-tab" to={tab.to}>
            {tab.words}
          </Link>
        ),
      )}
    </nav>
  );
}
