import { Link } from 'react-router';

import type { ShownEvent } from './today.ts';
import './deskEvents.css';

/** The desk sidebar's Your events: a dot in each event's colour and its name, each a link to its page and never selected. With nothing to list there is no heading. */
export function DeskEvents({
  heading,
  events,
  to,
}: {
  heading: string;
  events: readonly ShownEvent[];
  to: (id: string) => string;
}) {
  if (events.length === 0) return null;

  return (
    <div className="today-side-events">
      <h2 className="today-caps">{heading}</h2>
      <ul className="today-places">
        {events.map(({ id, name, mesh }) => (
          <li key={id}>
            <Link className="today-place" to={to(id)}>
              <span className={`today-dot is-${mesh} is-side`} aria-hidden="true" />
              <span className="today-grow today-ellipsis">{name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
