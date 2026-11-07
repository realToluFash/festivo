import { Glyph } from '../components/Glyph.tsx';
import {
  type AgendaDay,
  EVENTS,
  type EventCard,
  type EventKey,
  type Moment,
  type Need,
  type StripBar,
} from './today.ts';

export type Tell = (words: string) => void;

/** An event's cover, in its own colours from the option tokens. */
export function EventCover({ event, className }: { event: EventKey; className: string }) {
  return <span className={`today-cover is-${event} ${className}`} aria-hidden="true" />;
}

function Head({
  id,
  title,
  count,
  link,
}: {
  id: string;
  title: string;
  count?: number;
  link?: { label: string; onClick: () => void };
}) {
  return (
    <div className="today-head">
      <h2 id={id}>{title}</h2>
      {count != null && count > 0 && (
        <span className="today-count">
          <span aria-hidden="true">{count}</span>
          <span className="visually-hidden">{`, ${count} ${count === 1 ? 'thing' : 'things'}`}</span>
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

function NeedRow({ need, first, tell }: { need: Need; first: boolean; tell: Tell }) {
  const event = EVENTS[need.event].name;
  const due = need.late ? 'today-due is-late' : first ? 'today-due is-first' : 'today-due';

  return (
    <li className="today-need">
      <button
        type="button"
        className="today-need-open"
        onClick={() => tell(`${need.title} opens in ${event}, which has its own design.`)}
      >
        <EventCover event={need.event} className="today-need-cover" />
        <span className="today-need-words">
          <span className="today-need-title">{need.title}</span>
          <span className="today-need-event">{event}</span>
        </span>
        <span className={due}>
          {need.late && <Glyph name="clock" size={14} weight={2.4} />}
          {need.due}
        </span>
      </button>
      <span className="today-need-act">
        <button
          type="button"
          className={first ? 'today-act is-primary' : 'today-act'}
          aria-label={`${need.action}, ${need.title}`}
          onClick={() => tell(`${need.action} opens in ${event}, which has its own design.`)}
        >
          <span className="today-act-pill">{need.action}</span>
        </button>
      </span>
    </li>
  );
}

export function NeedsYou({ moment, tell }: { moment: Moment; tell: Tell }) {
  if (moment.needs == null) return null;

  return (
    <section className="today-section" aria-labelledby="today-needs">
      <Head id="today-needs" title="Needs you" count={moment.needs.length} />
      <div className="today-panel today-needs">
        {moment.needs.length === 0 ? (
          <div className="today-clear">
            <span className="today-tick" aria-hidden="true">
              <Glyph name="tick" size={19} weight={2.6} />
            </span>
            <span className="today-need-words">
              <span className="today-need-title">Nothing needs you</span>
              <span className="today-need-event">You’re up to date on every event.</span>
            </span>
          </div>
        ) : (
          <ul className="today-rows">
            {moment.needs.map((need, index) => (
              <NeedRow key={need.title} need={need} first={index === 0} tell={tell} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Bar({ bar }: { bar: StripBar }) {
  const shape = bar.openLeft ? 'today-bar is-open' : 'today-bar';

  return (
    <div className={`${shape} is-${bar.event} from-${bar.start} span-${bar.span}`}>
      <span className="today-bar-words">
        <span className="today-bar-name">{EVENTS[bar.event].name}</span>
        <span className="today-bar-length">{`\u00a0· ${bar.label}`}</span>
      </span>
    </div>
  );
}

function Strip({ moment }: { moment: Moment }) {
  return (
    <div
      className={
        moment.bars.length > 0 ? 'today-panel today-strip has-bars' : 'today-panel today-strip'
      }
    >
      <ol className="today-days">
        {moment.days.map((day) => (
          <li key={day.number} className={day.today ? 'today-day is-today' : 'today-day'}>
            <span className="today-weekday">{day.today ? 'Today' : day.weekday}</span>
            <span className="today-date">{day.number}</span>
            <span className="today-dots">
              {day.dots.map((event) => (
                <span key={event} className={`today-dot is-${event}`} />
              ))}
              {day.dots.length > 0 && (
                <span className="visually-hidden">
                  {day.dots.map((event) => EVENTS[event].name).join(', ')}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
      {moment.bars.map((bar) => (
        <Bar key={bar.event} bar={bar} />
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
                  <span className={`today-item-bar is-${item.event}`} aria-hidden="true" />
                  <span className="today-item-words">
                    <span className="today-item-title">{item.title}</span>
                    <span className="today-item-event">{EVENTS[item.event].name}</span>
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

export function ThisWeek({ moment, tell }: { moment: Moment; tell: Tell }) {
  const { nextUp } = moment;

  return (
    <section className="today-section" aria-labelledby="today-week">
      <Head
        id="today-week"
        title="This week"
        link={{ label: 'Calendar', onClick: () => tell('Calendar has its own design.') }}
      />
      <Strip moment={moment} />
      {nextUp == null ? (
        <Agenda days={moment.agenda} nothing={moment.nothing} />
      ) : (
        <div className="today-panel today-quiet">
          <p className="today-quiet-line">Nothing on this week</p>
          <button
            type="button"
            className="today-next"
            onClick={() => tell(`${nextUp.name} has its own design.`)}
          >
            <EventCover event={nextUp.event} className="today-need-cover" />
            <span className="today-next-words">
              <span className="today-caps">Next up</span>
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

function EventRow({ card, full, tell }: { card: EventCard; full: boolean; tell: Tell }) {
  const when = card.live || card.draft ? card.dates : `${card.count} · ${card.dates}`;
  const ready = full ? card.ready : null;

  return (
    <li>
      <button
        type="button"
        className="today-event"
        onClick={() => tell(`${card.name} has its own design.`)}
      >
        <EventCover event={card.event} className="today-event-cover" />
        <span className="today-event-words">
          <span className="today-event-name">{card.name}</span>
          <span className="today-event-when">{when}</span>
          {(card.draft || card.live || card.stage != null) && (
            <span className="today-chips">
              {card.draft && <span className="today-chip is-draft">Draft</span>}
              {card.live && (
                <span className="today-chip is-live">
                  <span className="today-live-dot" aria-hidden="true" />
                  {`Live · ${card.count.toLowerCase()}`}
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
                    className={`today-ready-fill is-${card.event}`}
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

export function YourEvents({ moment, tell }: { moment: Moment; tell: Tell }) {
  return (
    <section className="today-section" aria-labelledby="today-events">
      <Head
        id="today-events"
        title="Your events"
        link={{ label: 'All events', onClick: () => tell('Events has its own design.') }}
      />
      <ul className="today-panel today-events">
        {moment.events.map((card) => (
          <EventRow key={card.event} card={card} full={moment.full} tell={tell} />
        ))}
      </ul>
    </section>
  );
}

const STEPS = [
  ['Name it and give it a date', 'One day, or several.'],
  ['Add where it is', 'An address, or “to be confirmed” for now.'],
  ['Make it live', 'It stays a draft until you do.'],
] as const;

export function FirstRun({ tell }: { tell: Tell }) {
  return (
    <section className="today-first" aria-labelledby="today-first">
      <div className="today-head">
        <h2 id="today-first" className="today-first-title">
          Set up your first event
        </h2>
      </div>
      <p className="today-first-line">
        Give it a name, a date and a place. What needs you, and what’s coming, shows here.
      </p>
      <ol className="today-panel today-steps">
        {STEPS.map(([title, line], index) => (
          <li key={title} className="today-step">
            <span className="today-step-number" aria-hidden="true">
              {index + 1}
            </span>
            <span className="today-need-words">
              <span className="today-step-title">{title}</span>
              <span className="today-step-line">{line}</span>
            </span>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="today-create"
        onClick={() => tell('Create an event has its own design.')}
      >
        <Glyph name="plus" size={18} />
        Start your first event
      </button>
    </section>
  );
}
