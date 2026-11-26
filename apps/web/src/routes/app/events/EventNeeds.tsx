import type { OrganisationEvent } from '@soirely/api-client';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Glyph } from '../../../components/Glyph.tsx';
import { Head } from '../../../components/SettingsParts.tsx';
import { dateLocale } from '../../../i18n/index.ts';
import { needRows } from './eventNeeds.ts';
import type { TimelineRead } from './Timeline.tsx';
import './eventNeeds.css';

/** The Overview's Needs you: the event's own You milestones the reader can act on, from the same load as Next up and All dates (sc-32801). */
export function EventNeeds({
  event,
  timeline: { load, now, retry },
}: {
  event: OrganisationEvent;
  timeline: TimelineRead;
}) {
  const { t } = useTranslation();
  const rows =
    load.kind === 'loaded'
      ? needRows(
          load.timeline.milestones,
          event.permissions,
          load.timeline.timeZone,
          now,
          dateLocale(),
          t,
        )
      : [];
  const loaded = load.kind === 'loaded';

  return (
    <section className="desk-block" aria-labelledby="ev-needs-you">
      <Head
        title={
          <span id="ev-needs-you" className="ev-needs-title">
            <span aria-hidden="true" className="ev-needs-title">
              {t('eventPage.needsYou')}
              {rows.length > 0 && <span className="ev-needs-count">{rows.length}</span>}
            </span>
            <span className="visually-hidden">
              {rows.length > 0
                ? t('eventNeeds.headCount', { count: rows.length })
                : t('eventPage.needsYou')}
            </span>
          </span>
        }
      />
      {load.kind === 'loading' && <p className="desk-line">{t('timeline.loading')}</p>}
      {load.kind === 'failed' && (
        <div className="ev-needs-failed">
          <p className="desk-line">{t('timeline.failed')}</p>
          <button type="button" className="button" onClick={retry}>
            {t('timeline.retry')}
          </button>
        </div>
      )}
      {loaded && rows.length === 0 && (
        <div className="ev-needs-clear">
          <span className="ev-needs-tick" aria-hidden="true">
            <Glyph name="tick" size={19} weight={2.6} />
          </span>
          <span className="ev-need-title">{t('eventNeeds.nothing')}</span>
        </div>
      )}
      {rows.length > 0 && (
        <ul className="ev-needs">
          {rows.map(({ key, milestone, due, late }) => (
            <li key={key} className="ev-need">
              <span className="ev-need-words">
                <span className="ev-need-title">{milestone.title}</span>
                <span className={late ? 'ev-need-due is-late' : 'ev-need-due'}>
                  {late && <Glyph name="clock" size={14} weight={2.4} />}
                  {due}
                </span>
              </span>
              {milestone.action != null && (
                <Link className="ev-need-act" to={milestone.action.link}>
                  {milestone.action.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
