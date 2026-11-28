import type { StaffEntry } from '@soirely/api-client';

const opened = new Map<string, StaffEntry>();

/** The row the Staff list opened, so a link screen whose person the roster no longer has says they were removed, by name. */
export function openedFrom(eventId: string, entry: StaffEntry): void {
  opened.set(eventId, entry);
}

export function openedEntry(eventId: string, staffId: string): StaffEntry | null {
  const entry = opened.get(eventId);

  return entry?.id === staffId ? entry : null;
}
