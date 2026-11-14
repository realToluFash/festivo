import type { CardPhoto } from '../eventsList.ts';
import type { Mesh } from '../mesh.ts';
import { EventThumb } from './EventCard.tsx';
import './today.css';
import './eventSide.css';

/** The event at the head of its own sidebar: its cover or colour, its name, and its phase and how soon. */
export function EventSideCard({
  event,
  when,
}: {
  event: { name: string; mesh: Mesh; photo: CardPhoto | null };
  when: string;
}) {
  return (
    <div className="ev-side-card">
      <EventThumb event={event} size={40} />
      <span className="today-grow">
        <span className="ev-side-name">{event.name}</span>
        <span className="ev-side-when">{when}</span>
      </span>
    </div>
  );
}
