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

let deleted: string | null = null;

/** An event's page hands the deleted event's name to Events, where Delete event always lands (sc-22103). */
export function markDeleted(name: string): void {
  deleted = name;
}

export function takeDeleted(): string | null {
  const taken = deleted;
  deleted = null;

  return taken;
}
