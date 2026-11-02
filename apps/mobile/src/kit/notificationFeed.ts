/** Mark all read says what the server did once it has answered: all read, or not saved. */
export async function markAllRead(client: {
  readAllNotifications(): Promise<number>;
}): Promise<{ said: 'notifications.allRead'; left: number } | { said: 'eventMute.notSaved' }> {
  try {
    return { said: 'notifications.allRead', left: await client.readAllNotifications() };
  } catch {
    return { said: 'eventMute.notSaved' };
  }
}
