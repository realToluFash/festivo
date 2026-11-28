import { Link, useNavigate } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { EventCover } from '../components/TodayParts.tsx';
import { actionWords, headWords, type Moment, type Need, rowWords } from './today.ts';

function NeedRow({ need, first }: { need: Need; first: boolean }) {
  const navigate = useNavigate();
  const due = need.late ? 'today-due is-late' : first ? 'today-due is-first' : 'today-due';

  return (
    <li className="today-need">
      <button
        type="button"
        className="today-need-open"
        aria-label={rowWords(need)}
        onClick={() => void navigate(`/demo/events/${need.event.id}`)}
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
      {need.action != null && (
        <span className="today-need-act">
          <Link
            className={first ? 'today-act is-primary' : 'today-act'}
            to={need.action.link}
            aria-label={actionWords(need) ?? undefined}
          >
            <span className="today-act-pill">{need.action.label}</span>
          </Link>
        </span>
      )}
    </li>
  );
}

/** Needs you (sc-61015): sc-29884's rows, with a button where the milestone carries an action. */
export function NeedsYou({ moment }: { moment: Moment }) {
  if (moment.needs == null) return null;

  const count = moment.needs.length;

  return (
    <section className="today-section" aria-label="Needs you">
      {/* The heading is read with its count from one key, "Needs you, 1 thing"; the product's Head reads the count after it. */}
      <div className="today-head">
        <h2 aria-label={count > 0 ? headWords(count) : undefined}>Needs you</h2>
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
              <span className="today-need-title">Nothing needs you</span>
              <span className="today-need-event">You’re up to date on every event.</span>
            </span>
          </div>
        ) : (
          <ul className="today-rows">
            {moment.needs.map((need, index) => (
              <NeedRow key={need.key} need={need} first={index === 0} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
