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
