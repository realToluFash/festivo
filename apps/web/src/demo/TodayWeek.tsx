import { useTranslation } from 'react-i18next';

import { Head } from '../components/TodayParts.tsx';
import type { AgendaDay, Open } from '../components/today.ts';
import type { Moment, RowBar } from './today.ts';

/** The product's bar, placed in its row rather than on a line of its own (sc-37302). */
function Bar({ bar }: { bar: RowBar }) {
  const shape = bar.openLeft ? 'today-bar is-open' : 'today-bar';

  return (
    <div className={`${shape} is-${bar.event.mesh} from-${bar.start} span-${bar.span}`}>
      <span className="today-bar-words">
        <span className="today-bar-name">{bar.event.name}</span>
        <span className="today-bar-length">{`\u00a0· ${bar.label}`}</span>
      </span>
    </div>
  );
}

function Strip({ moment }: { moment: Moment }) {
  const { t } = useTranslation();
  const rows = Array.from(
    { length: Math.max(0, ...moment.bars.map((bar) => bar.lane + 1)) },
    (_, lane) => moment.bars.filter((bar) => bar.lane === lane),
  );

  return (
    <div className="today-panel today-strip has-bars">
      <ol className="today-days">
        {moment.days.map((day) => (
          <li key={day.number} className={day.today ? 'today-day is-today' : 'today-day'}>
            <span className="today-weekday">{day.today ? t('today.today') : day.weekday}</span>
            <span className="today-date">{day.number}</span>
            <span className="today-dots">
              {day.dots.map((event) => (
                <span key={event.id} className={`today-dot is-${event.mesh}`} />
              ))}
              {day.dots.length > 0 && (
                <span className="visually-hidden">
                  {day.dots.map((event) => event.name).join(', ')}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
      {rows.map((row, lane) => (
        <div key={lane} className="today-bar-row">
          {row.map((bar) => (
            <Bar key={bar.event.id} bar={bar} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Agenda({ days, nothing }: { days: AgendaDay[]; nothing: string }) {
  return (
    <div className="today-panel today-agenda">
      {days.map((day) => (
        <div key={day.date} className="today-agenda-day">
          <h3 className="today-agenda-head">
            <span className={day.today ? 'today-agenda-name is-today' : 'today-agenda-name'}>
              {day.day}
            </span>
            <span className="today-agenda-when">{`· ${day.when}`}</span>
          </h3>
          {day.items.length === 0 ? (
            <p className="today-agenda-nothing">{nothing}</p>
          ) : (
            <ul className="today-rows">
              {day.items.map((item) => (
                <li key={`${item.time} ${item.title}`} className="today-item">
                  <span className="today-item-time">{item.time}</span>
                  <span className={`today-item-bar is-${item.event.mesh}`} aria-hidden="true" />
                  <span className="today-item-words">
                    <span className="today-item-title">{item.title}</span>
                    <span className="today-item-event">{item.event.name}</span>
                  </span>
                  {item.note !== '' && <span className="today-chip is-note">{item.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

/** This week when its bars take more than one row (`?week=rows`): what sc-37302 asks the product's strip to do. */
export function ThisWeekInRows({ moment, open }: { moment: Moment; open: Open }) {
  const { t } = useTranslation();

  return (
    <section className="today-section" aria-labelledby="today-week">
      <Head
        id="today-week"
        title={t('today.thisWeek')}
        link={{ label: t('nav.calendar'), onClick: () => open({ to: 'calendar' }) }}
      />
      <Strip moment={moment} />
      <Agenda days={moment.agenda} nothing={moment.nothing} />
    </section>
  );
}
