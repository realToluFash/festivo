import { Glyph } from '../components/Glyph.tsx';
import type { Tell } from '../components/SettingsParts.tsx';
import { EventCover, Head } from '../components/TodayParts.tsx';
import { EVENTS, type Moment, type Need, shown } from './today.ts';

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
        <EventCover event={shown(need.event)} className="today-need-cover" />
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

/** Needs you stays the demo's: the product has nothing to fill it from yet (sc-29884). */
export function NeedsYou({ moment, tell }: { moment: Moment; tell: Tell }) {
  if (moment.needs == null) return null;

  const count = moment.needs.length;

  return (
    <section className="today-section" aria-labelledby="today-needs">
      <Head
        id="today-needs"
        title="Needs you"
        count={count}
        countWords={`, ${count} ${count === 1 ? 'thing' : 'things'}`}
      />
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
