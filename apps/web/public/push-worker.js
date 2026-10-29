// Web Push for the bell (sc-3980). The API sends { title, body, place }; a click opens the place.

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
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);

      return open == null
        ? self.clients.openWindow(place)
        : open.navigate(place).then((client) => (client ?? open).focus());
    }),
  );
});
