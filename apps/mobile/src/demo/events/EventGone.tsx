import { EventNotFound } from '../../components/Events.tsx';
import { backToEvents } from './EventFrame.tsx';
import { ListFrame } from './EventsList.tsx';

/** sc-1468: a deleted event's Guests answers as an event that never existed does (sc-64), on the Events frame. */
export function EventGone() {
  return (
    <ListFrame offline={null}>
      <EventNotFound onBack={backToEvents} />
    </ListFrame>
  );
}
