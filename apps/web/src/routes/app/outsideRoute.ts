import { useMatch } from 'react-router';

/** Where an event is opened from a list of them: the event it was chosen from, for the way back if it has gone (sc-68438). */
export function openedFrom(state: unknown): string | null {
  const from = (state as { from?: unknown } | null)?.from;

  return typeof from === 'string' ? from : null;
}

/** The event under the address, whether or not the account still holds it. */
export function useRoutedEventId(): string | null {
  const id = useMatch('/app/events/:eventId/*')?.params.eventId;

  return id == null || id === 'new' ? null : id;
}
