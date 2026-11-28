import { Navigate, useLocation, useParams } from 'react-router';

import { inPlace, partOfHash } from './openInPlace.ts';

/** `/edit` was the full-page Edit details; its address now opens the event's page, with the part its hash named open in place (sc-48602). */
export function EditRedirect() {
  const { eventId = '' } = useParams();
  const { hash } = useLocation();
  const part = partOfHash(hash);

  if (part == null) return <Navigate replace to={`/app/events/${encodeURIComponent(eventId)}`} />;

  const { to, state } = inPlace(eventId, part);

  return <Navigate replace to={to} state={state} />;
}
