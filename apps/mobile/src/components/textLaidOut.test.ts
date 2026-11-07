import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEXT_SCALE_LAID_OUT } from './textScaleLaidOutEvent.ts';

const native = vi.hoisted(() => ({
  platform: { OS: 'android' },
  addListener: vi.fn(),
}));

vi.mock('react-native', () => ({
  Platform: native.platform,
  DeviceEventEmitter: { addListener: native.addListener },
}));

async function freshStore(os: string) {
  native.platform.OS = os;
  vi.resetModules();
  return import('./textLaidOut.ts');
}

function emitLaidOut(): void {
  const [, laidOut] = native.addListener.mock.calls[0] as [string, () => void];
  laidOut();
}

beforeEach(() => {
  native.addListener.mockReset();
});

describe('textLaidOut on Android', () => {
  it('adds one native listener for the event, however many subscribe', async () => {
    const { subscribeTextLaidOut } = await freshStore('android');

    subscribeTextLaidOut(() => undefined);
    subscribeTextLaidOut(() => undefined);

    expect(native.addListener).toHaveBeenCalledOnce();
    expect(native.addListener).toHaveBeenCalledWith(TEXT_SCALE_LAID_OUT, expect.any(Function));
  });

  it('counts each layout and calls every listener', async () => {
    const { subscribeTextLaidOut, textLayoutsAtNewScale } = await freshStore('android');
    const first = vi.fn();
    const second = vi.fn();
    subscribeTextLaidOut(first);
    subscribeTextLaidOut(second);

    emitLaidOut();

    expect(textLayoutsAtNewScale()).toBe(1);
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it('gives a listener subscribed after a layout the new count', async () => {
    const { subscribeTextLaidOut, textLayoutsAtNewScale } = await freshStore('android');
    const unsubscribe = subscribeTextLaidOut(() => undefined);
    emitLaidOut();
    unsubscribe();

    const late = vi.fn();
    subscribeTextLaidOut(late);

    expect(textLayoutsAtNewScale()).toBe(1);
    expect(native.addListener).toHaveBeenCalledOnce();
    emitLaidOut();
    expect(late).toHaveBeenCalledOnce();
    expect(textLayoutsAtNewScale()).toBe(2);
  });

  it('stops calling a listener once it unsubscribes', async () => {
    const { subscribeTextLaidOut } = await freshStore('android');
    const listener = vi.fn();
    subscribeTextLaidOut(listener)();

    emitLaidOut();

    expect(listener).not.toHaveBeenCalled();
  });
});

describe.each(['ios', 'web'])('textLaidOut on %s', (os) => {
  it('adds no native listener and keeps the count at 0', async () => {
    const { subscribeTextLaidOut, textLayoutsAtNewScale } = await freshStore(os);

    subscribeTextLaidOut(() => undefined);

    expect(native.addListener).not.toHaveBeenCalled();
    expect(textLayoutsAtNewScale()).toBe(0);
  });
});
