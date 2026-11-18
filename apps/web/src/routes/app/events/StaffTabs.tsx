import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

type StaffPage = 'roster' | 'jobs';

/** The Staff page's tab row (sc-3908), as sc-3910's Design draws it; Stations and Hours worked add theirs when they ship. */
export function StaffTabs({ on, eventId }: { on: StaffPage; eventId: string }) {
  const { t } = useTranslation();
  const base = `/app/events/${encodeURIComponent(eventId)}/staff`;
  const tabs: readonly { page: StaffPage; words: string; to: string }[] = [
    { page: 'roster', words: t('roster.roster'), to: `${base}/roster` },
    { page: 'jobs', words: t('jobs.tab'), to: `${base}/jobs` },
  ];

  return (
    <nav className="sn-tabs" aria-label={t('jobs.tabs')}>
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
