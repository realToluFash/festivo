/** The rest keep the order they came in. */
export function thisDeviceFirst<T extends { id: string }>(
  sessions: readonly T[],
  thisDevice: string | null,
): T[] {
  const here = sessions.filter((session) => session.id === thisDevice);

  return [...here, ...sessions.filter((session) => session.id !== thisDevice)];
}

/** Without this device in the list, Soirely cannot tell which is this one, so every session ends. */
export function othersOf(
  sessions: readonly { id: string }[],
  thisDevice: string | null,
): { count: number; sessionId: string | null } {
  return sessions.some((session) => session.id === thisDevice)
    ? { count: sessions.length - 1, sessionId: thisDevice }
    : { count: sessions.length, sessionId: null };
}
