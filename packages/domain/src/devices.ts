/** The rest keep the order they came in. */
export function thisDeviceFirst<T extends { thisDevice: boolean }>(sessions: readonly T[]): T[] {
  return [
    ...sessions.filter((session) => session.thisDevice),
    ...sessions.filter((session) => !session.thisDevice),
  ];
}

/** Without this device in the list, Soirely cannot tell which is this one, so every session ends. */
export function othersOf(sessions: readonly { id: string; thisDevice: boolean }[]): {
  count: number;
  sessionId: string | null;
} {
  const here = sessions.find((session) => session.thisDevice);

  return here == null
    ? { count: sessions.length, sessionId: null }
    : { count: sessions.length - 1, sessionId: here.id };
}
