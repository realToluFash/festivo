/** The rest keep the order they came in. */
export function thisDeviceFirst<T extends { id: string }>(
  sessions: readonly T[],
  thisDevice: string | null,
): T[] {
  const here = sessions.filter((session) => session.id === thisDevice);

  return [...here, ...sessions.filter((session) => session.id !== thisDevice)];
}
