/** An event a departing member leads (sc-614), as MembersController::workList sends it: soonest first. */
export interface LedEvent {
  id: string;
  title: string;
}

export function asLedEvents(raw: unknown): LedEvent[] {
  const events = (raw as Record<string, unknown> | null)?.events;

  if (!Array.isArray(events)) {
    throw new Error(
      'The API answered a work list in a shape this client does not know. Check MembersController::workList in services/api.',
    );
  }

  return events.flatMap((event: unknown) => {
    const { id, title } = (event ?? {}) as Record<string, unknown>;

    return typeof id === 'string' && typeof title === 'string' ? [{ id, title }] : [];
  });
}
