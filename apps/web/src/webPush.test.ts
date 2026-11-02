import { afterEach, describe, expect, it, vi } from 'vitest';

import { subscribeWebPush } from './webPush.ts';

const KEY = 'AQID';
const SUBSCRIPTION = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  keys: { p256dh: 'p', auth: 'a' },
};

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function browser(held: { key: number[] } | null) {
  const sent: { line: string; body: unknown }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    sent.push({
      line: `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
    });

    return init?.method === 'PUT' ? new Response(null, { status: 204 }) : json({ webPushKey: KEY });
  });

  const fresh = { toJSON: () => SUBSCRIPTION };
  const unsubscribe = vi.fn(async () => true);
  const subscribe = vi.fn(async () => fresh);
  const existing =
    held == null
      ? null
      : {
          options: { applicationServerKey: new Uint8Array(held.key).buffer },
          unsubscribe,
          toJSON: () => SUBSCRIPTION,
        };
  const register = vi.fn(async () => ({
    pushManager: { getSubscription: async () => existing, subscribe },
  }));

  vi.stubGlobal('Notification', { permission: 'granted' });
  vi.stubGlobal('PushManager', class {});
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { register },
    configurable: true,
  });

  return { sent, register, subscribe, unsubscribe };
}

describe('Web Push on this browser (sc-3980)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('subscribes with the API key and registers the subscription', async () => {
    const { sent, register, subscribe } = browser(null);

    await subscribeWebPush();

    expect(register).toHaveBeenCalledWith('/push-worker.js');
    expect(subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: new Uint8Array([1, 2, 3]),
    });
    expect(sent.at(-1)).toEqual({
      line: 'PUT /api/auth/push-targets',
      body: { kind: 'web', address: SUBSCRIPTION.endpoint, keys: SUBSCRIPTION.keys },
    });
  });

  it('registers a subscription already held under the same key, for this session', async () => {
    const { sent, subscribe, unsubscribe } = browser({ key: [1, 2, 3] });

    await subscribeWebPush();

    expect(subscribe).not.toHaveBeenCalled();
    expect(unsubscribe).not.toHaveBeenCalled();
    expect(sent.at(-1)?.line).toBe('PUT /api/auth/push-targets');
  });

  it('replaces a subscription held under another key', async () => {
    const { subscribe, unsubscribe } = browser({ key: [9, 9, 9] });

    await subscribeWebPush();

    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(subscribe).toHaveBeenCalledOnce();
  });

  it('does nothing until push is allowed here', async () => {
    const { sent, register } = browser(null);
    vi.stubGlobal('Notification', { permission: 'default' });

    await subscribeWebPush();

    expect(register).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });
});
