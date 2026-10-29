// Web Push for the bell (sc-3980). The API sends { title, body, place }; a click opens the place.

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const message = event.data?.json() ?? {};

  event.waitUntil(
    self.registration.showNotification(message.title ?? '', {
      body: message.body ?? undefined,
      data: { place: message.place ?? '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const place = new URL(event.notification.data?.place ?? '/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((windows) => {
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open == null) return self.clients.openWindow(place);

      return open
        .navigate(place)
        .then((client) => (client ?? open).focus())
        .catch(() => self.clients.openWindow(place));
    }),
  );
});
