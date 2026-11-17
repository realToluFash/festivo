import { useTranslation } from 'react-i18next';

import { Glyph } from '../components/Glyph.tsx';
import type { AgendaDay, Open, StripBar } from '../components/today.ts';
import { EventCover, Head } from '../components/TodayParts.tsx';
import { lettersAtEveryWidth, type Moment, type WeekDay } from './today.ts';

function Bar({ bar }: { bar: StripBar }) {
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

function Weekday({ day }: { day: WeekDay }) {
  const { t } = useTranslation();

  if (day.today) {
    return <span className="today-weekday">{t('today.today')}</span>;
  }

  return (
    <span className="today-weekday">
      <span className="today-weekday-short">{day.weekday}</span>
      <span className="today-weekday-narrow" aria-hidden="true">
        {day.narrow}
      </span>
      <span className="today-weekday-spoken">{day.spoken}</span>
    </span>
  );
}

function Strip({ moment, letters }: { moment: Moment; letters: boolean }) {
  const rows = Array.from(
    { length: Math.max(0, ...moment.bars.map((bar) => bar.lane + 1)) },
    (_, lane) => moment.bars.filter((bar) => bar.lane === lane),
  );

  return (
    <div
      className={
        moment.bars.length > 0 ? 'today-panel today-strip has-bars' : 'today-panel today-strip'
      }
    >
      <ol className={letters ? 'today-days has-letters' : 'today-days'}>
        {moment.days.map((day) => (
          <li key={day.number} className={day.today ? 'today-day is-today' : 'today-day'}>
            <Weekday day={day} />
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

/** The product's This week, with each day but today writing its narrow weekday at 360 px and narrower, and in Portuguese at every width (sc-61548). */
export function ThisWeek({ moment, open }: { moment: Moment; open: Open }) {
  const { t, i18n } = useTranslation();
  const { nextUp } = moment;

  return (
    <section className="today-section" aria-labelledby="today-week">
      <Head
        id="today-week"
        title={t('today.thisWeek')}
        link={{ label: t('nav.calendar'), onClick: () => open({ to: 'calendar' }) }}
      />
      <Strip
        moment={moment}
        letters={lettersAtEveryWidth(i18n.resolvedLanguage ?? i18n.language)}
      />
      {nextUp == null ? (
        <Agenda days={moment.agenda} nothing={moment.nothing} />
      ) : (
        <div className="today-panel today-quiet">
          <p className="today-quiet-line">{t('today.nothingOnThisWeek')}</p>
          <button
            type="button"
            className="today-next"
            onClick={() => open({ to: 'event', id: nextUp.event.id, name: nextUp.name })}
          >
            <EventCover event={nextUp.event} className="today-need-cover" />
            <span className="today-next-words">
              <span className="today-caps">{t('today.nextUp')}</span>
              <span className="today-next-line">
                {nextUp.name}
                <span className="today-next-when">{` · ${nextUp.when}`}</span>
              </span>
            </span>
            <Glyph name="chevron" size={17} />
          </button>
        </div>
      )}
    </section>
  );
}
