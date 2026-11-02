import { describe, expect, it, vi } from 'vitest';

import SOURCE from '../public/push-worker.js?raw';

type Listener = (event: { waitUntil: (work: Promise<unknown>) => void } & object) => void;

function worker(windows: { url: string; navigate: () => Promise<unknown> }[]) {
  const listeners = new Map<string, Listener>();
  const clients = {
    claim: vi.fn(async () => {}),
    matchAll: vi.fn(async () => windows),
    openWindow: vi.fn(async () => null),
  };
  const self = {
    location: { origin: 'https://app.soirely.test' },
    clients,
    registration: { showNotification: vi.fn(async () => {}) },
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
  };
  new Function('self', SOURCE)(self);

  const fire = async (type: string, event: object): Promise<void> => {
    let work: Promise<unknown> = Promise.resolve();
    listeners.get(type)?.({ ...event, waitUntil: (pending) => (work = pending) });
    await work;
  };

  return { clients, fire };
}

function click(place: string) {
  return { notification: { close: vi.fn(), data: { place } } };
}

describe('the push worker (sc-3980)', () => {
  it('takes control of the open tabs as it activates', async () => {
    const { clients, fire } = worker([]);

    await fire('activate', {});

    expect(clients.claim).toHaveBeenCalledTimes(1);
  });

  it("opens a clicked push's place in the open tab, and focuses it", async () => {
    const focus = vi.fn(async () => {});
    const tab = { url: 'https://app.soirely.test/app', navigate: vi.fn(async () => ({ focus })) };
    const { clients, fire } = worker([tab]);

    await fire('notificationclick', click('/app/events/e1'));

    expect(tab.navigate).toHaveBeenCalledWith('https://app.soirely.test/app/events/e1');
    expect(focus).toHaveBeenCalledTimes(1);
    expect(clients.openWindow).not.toHaveBeenCalled();
  });

  it('opens a window when the tab refuses to be navigated', async () => {
    const tab = {
      url: 'https://app.soirely.test/app',
      navigate: vi.fn(async () => {
        throw new TypeError('not controlled');
      }),
    };
    const { clients, fire } = worker([tab]);

    await fire('notificationclick', click('/app/events/e1'));

    expect(clients.openWindow).toHaveBeenCalledWith('https://app.soirely.test/app/events/e1');
  });

  it('opens a window when no tab of the app is open', async () => {
    const { clients, fire } = worker([{ url: 'https://else.test/', navigate: vi.fn() }]);

    await fire('notificationclick', click('/app/notifications'));

    expect(clients.openWindow).toHaveBeenCalledWith('https://app.soirely.test/app/notifications');
  });
});
