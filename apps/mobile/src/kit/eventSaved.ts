let saved: string | null = null;

/** Edit details hands "Saved" to the event's page it goes back to, which may be the list's or a link's (sc-3595). */
export function markSaved(eventId: string): void {
  saved = eventId;
}

export function takeSaved(): string | null {
  const taken = saved;
  saved = null;

  return taken;
}

let coverRefused: { eventId: string; reason: string } | null = null;

/** New event hands a cover the API refused to the new event's page, which says the event is saved without it. */
export function markCoverRefused(eventId: string, reason: string): void {
  coverRefused = { eventId, reason };
}

export function takeCoverRefused(): { eventId: string; reason: string } | null {
  const taken = coverRefused;
  coverRefused = null;

  return taken;
}
