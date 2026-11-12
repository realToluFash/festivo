import { useTranslation } from 'react-i18next';

import { Notice } from './Notice.tsx';
import { Glyph } from './Glyph.tsx';
import type {
  AgendaDay,
  DayRange,
  EventCard,
  Moment,
  Open,
  ShownEvent,
  StripBar,
} from './today.ts';
import './today.css';

/** An event's cover, in its own colours from the option tokens. */
export function EventCover({ event, className }: { event: ShownEvent; className: string }) {
  return <span className={`today-cover is-${event.mesh} ${className}`} aria-hidden="true" />;
}

export function Head({
  id,
  title,
  count,
  countWords,
  link,
}: {
  id: string;
  title: string;
  count?: number;
  /** What a screen reader hears after the title for the count. */
  countWords?: string;
  link?: { label: string; onClick: () => void };
}) {
  return (
    <div className="today-head">
      <h2 id={id}>{title}</h2>
      {count != null && count > 0 && (
        <span className="today-count">
          <span aria-hidden="true">{count}</span>
          {countWords != null && <span className="visually-hidden">{countWords}</span>}
        </span>
      )}
      {link != null && (
        <button type="button" className="today-head-link" onClick={link.onClick}>
          {link.label}
          <Glyph name="chevron" size={15} />
        </button>
      )}
    </div>
  );
}

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

function Strip({ moment }: { moment: Moment }) {
  const { t } = useTranslation();
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

export function ThisWeek({ moment, open }: { moment: Moment; open: Open }) {
  const { t } = useTranslation();
  const { nextUp } = moment;

  return (
    <section className="today-section" aria-labelledby="today-week">
      <Head
        id="today-week"
        title={t('today.thisWeek')}
        link={{ label: t('nav.calendar'), onClick: () => open({ to: 'calendar' }) }}
      />
      <Strip moment={moment} />
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

const FIRST = '\u0001';
const LAST = '\u0002';

/** The range in its locale's words, each date whole (sc-39091): the opening word stays with the first date, and the connector ends the first date's line where it fits there, or starts the last date's. */
function RangeWords({ range }: { range: DayRange }) {
  const { t } = useTranslation();
  const words = t('events.days', { first: FIRST, last: LAST });
  const [lead = '', afterFirst = ''] = words.split(FIRST);
  const [between = '', trail = ''] = afterFirst.split(LAST);

  return (
    <>
      <span className="today-event-piece">
        {lead}
        <span className="today-event-date">{range.first}</span>
      </span>
      {between}
      <span className="today-event-date">{range.last}</span>
      {trail}
    </>
  );
}

function EventRow({ card, full, open }: { card: EventCard; full: boolean; open: Open }) {
  const { t } = useTranslation();
  const ready = full ? card.ready : null;

  return (
    <li>
      <button
        type="button"
        className="today-event"
        onClick={() => open({ to: 'event', id: card.event.id, name: card.name })}
      >
        <EventCover event={card.event} className="today-event-cover" />
        <span className="today-event-words">
          <span className="today-event-name">{card.name}</span>
          <span className="today-event-when">
            {!card.live && !card.draft && (
              <>
                <span className="today-event-count">{`${card.count} ·`}</span>{' '}
              </>
            )}
            {typeof card.dates === 'string' ? (
              <span className="today-event-dates">{card.dates}</span>
            ) : (
              <span className="today-event-dates is-range">
                <RangeWords range={card.dates} />
              </span>
            )}
          </span>
          {(card.draft || card.live || card.stage != null) && (
            <span className="today-chips">
              {card.draft && <span className="today-chip is-draft">{t('events.draft')}</span>}
              {card.live && (
                <span className="today-chip is-live">
                  <span className="today-live-dot" aria-hidden="true" />
                  {t('today.liveCount', { words: card.count.toLocaleLowerCase() })}
                </span>
              )}
              {card.stage != null && <span className="today-chip is-stage">{card.stage}</span>}
            </span>
          )}
          {ready != null && (
            <span className="today-ready">
              {ready.percent > 0 && (
                <svg className="today-ready-bar" width="100%" height="4" aria-hidden="true">
                  <rect className="today-ready-track" width="100%" height="4" rx="2" />
                  <rect
                    className={`today-ready-fill is-${card.event.mesh}`}
                    width={`${ready.percent}%`}
                    height="4"
                    rx="2"
                  />
                </svg>
              )}
              <span className="today-ready-words">{ready.words}</span>
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

export function YourEvents({ moment, open }: { moment: Moment; open: Open }) {
  const { t } = useTranslation();

  return (
    <section className="today-section" aria-labelledby="today-events">
      <Head
        id="today-events"
        title={t('today.yourEvents')}
        link={{ label: t('today.allEvents'), onClick: () => open({ to: 'events' }) }}
      />
      <ul className="today-panel today-events">
        {moment.events.map((card) => (
          <EventRow key={card.event.id} card={card} full={moment.full} open={open} />
        ))}
      </ul>
    </section>
  );
}

const STEPS = [
  ['today.firstStep.nameTitle', 'today.firstStep.nameBody'],
  ['today.firstStep.placeTitle', 'today.firstStep.placeBody'],
  ['today.firstStep.liveTitle', 'today.firstStep.liveBody'],
] as const;

/** A first run, before the organisation has an event: three steps and, for a role that can create one, the way in; for one that cannot, Events' `firstAsk` Notice. */
export function FirstRun({ open, create }: { open: Open; create: boolean }) {
  const { t } = useTranslation();

  return (
    <section className="today-first" aria-labelledby="today-first">
      <div className="today-head">
        <h2 id="today-first" className="today-first-title">
          {t('today.firstTitle')}
        </h2>
      </div>
      <p className="today-first-line">{t('today.firstIntro')}</p>
      {!create && (
        <Notice kind="quiet" standing>
          {t('events.firstRunAskOwner')}
        </Notice>
      )}
      <ol className="today-panel today-steps">
        {STEPS.map(([title, line], index) => (
          <li key={title} className="today-step">
            <span className="today-step-number" aria-hidden="true">
              {t('today.stepNumber', { n: index + 1 })}
            </span>
            <span className="today-need-words">
              <span className="today-step-title">{t(title)}</span>
              <span className="today-step-line">{t(line)}</span>
            </span>
          </li>
        ))}
      </ol>
      {create && (
        <button type="button" className="today-create" onClick={() => open({ to: 'create' })}>
          <Glyph name="plus" size={18} />
          {t('today.startFirst')}
        </button>
      )}
    </section>
  );
}
