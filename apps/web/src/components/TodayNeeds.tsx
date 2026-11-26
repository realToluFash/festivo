import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { EventCover } from './TodayParts.tsx';
import { Glyph } from './Glyph.tsx';
import type { Moment, Need, Open } from './today.ts';
import './todayNeeds.css';

function NeedRow({ need, first, open }: { need: Need; first: boolean; open: Open }) {
  const { t } = useTranslation();
  const due = need.late ? 'today-due is-late' : first ? 'today-due is-first' : 'today-due';
  const { action } = need;

  return (
    <li className="today-need">
      <button
        type="button"
        className="today-need-open"
        aria-label={t('today.needRow', {
          title: need.title,
          event: need.event.name,
          due: need.due,
        })}
        onClick={() => open({ to: 'event', id: need.event.id, name: need.event.name })}
      >
        <EventCover event={need.event} className="today-need-cover" />
        <span className="today-need-words">
          <span className="today-need-title">{need.title}</span>
          <span className="today-need-event">{need.event.name}</span>
        </span>
        <span className={due}>
          {need.late && <Glyph name="clock" size={14} weight={2.4} />}
          {need.due}
        </span>
      </button>
      {action != null && (
        <span className="today-need-act">
          <Link
            className={first ? 'today-act is-primary' : 'today-act'}
            to={action.link}
            aria-label={t('today.needAction', { action: action.label, event: need.event.name })}
          >
            <span className="today-act-pill">{action.label}</span>
          </Link>
        </span>
      )}
    </li>
  );
}

/** Needs you (sc-61015): the rows sc-29884 lists in the app, with a button where the milestone carries an action. Nothing while `needs` is null: loading, failed, or a first run. */
export function NeedsYou({ moment, open }: { moment: Moment; open: Open }) {
  const { t } = useTranslation();
  const { needs } = moment;

  if (needs == null) return null;

  const count = needs.length;

  return (
    <section className="today-section" aria-labelledby="today-needs">
      <div className="today-head">
        <h2 id="today-needs" aria-label={count > 0 ? t('today.needsHead', { count }) : undefined}>
          {t('today.needsYou')}
        </h2>
        {count > 0 && (
          <span className="today-count" aria-hidden="true">
            {count}
          </span>
        )}
      </div>
      <div className="today-panel today-needs">
        {count === 0 ? (
          <div className="today-clear">
            <span className="today-tick" aria-hidden="true">
              <Glyph name="tick" size={19} weight={2.6} />
            </span>
            <span className="today-need-words">
              <span className="today-need-title">{t('today.nothingNeedsYou')}</span>
              <span className="today-need-event">{t('today.upToDate')}</span>
            </span>
          </div>
        ) : (
          <ul className="today-rows">
            {needs.map((need, index) => (
              <NeedRow
                key={`${need.event.id}|${need.title}`}
                need={need}
                first={index === 0}
                open={open}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
