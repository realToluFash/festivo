import { api } from './api.ts';

const WORKER = '/push-worker.js';

/** Run on every signed-in load, not only after the ask: a push target ends with the session it was registered under. */
export async function subscribeWebPush(): Promise<void> {
  if (
    typeof Notification === 'undefined' ||
    Notification.permission !== 'granted' ||
    !('serviceWorker' in navigator) ||
    typeof PushManager === 'undefined'
  ) {
    return;
  }

  const key = base64UrlBytes(await api.webPushKey());
  if (key.length === 0) return;

  const registration = await navigator.serviceWorker.register(WORKER);
  let subscription = await registration.pushManager.getSubscription();

  if (subscription != null && !sameKey(subscription.options.applicationServerKey, key)) {
    await subscription.unsubscribe();
    subscription = null;
  }

  subscription ??= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key,
  });

  const { endpoint, keys } = subscription.toJSON();
  if (endpoint == null || keys?.p256dh == null || keys.auth == null) return;

  await api.registerPushTarget({
    kind: 'web',
    address: endpoint,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
  });
}

function base64UrlBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));

  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function sameKey(held: ArrayBuffer | null, key: Uint8Array): boolean {
  if (held == null) return false;
  const bytes = new Uint8Array(held);

  return bytes.length === key.length && bytes.every((byte, index) => byte === key[index]);
}
