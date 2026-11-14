import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SCHEME_CHANNEL,
  SCHEME_KEY,
  __resetColourScheme,
  followAccountScheme,
  holdScheme,
  keyStep,
  nextScheme,
  savedScheme,
  startColourScheme,
} from './colourScheme.ts';

class FakeChannel {
  static open: FakeChannel[] = [];
  posted: unknown[] = [];
  onmessage: ((message: MessageEvent<unknown>) => void) | null = null;

  constructor(readonly name: string) {
    FakeChannel.open.push(this);
  }

  postMessage(message: unknown): void {
    this.posted.push(message);
  }

  close(): void {}
}

const root = document.documentElement;

beforeEach(() => {
  FakeChannel.open = [];
  vi.stubGlobal('BroadcastChannel', FakeChannel);
  localStorage.removeItem(SCHEME_KEY);
  __resetColourScheme();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.removeItem(SCHEME_KEY);
  __resetColourScheme();
});

describe('before the first paint', () => {
  it('opens in the scheme this browser last showed', () => {
    localStorage.setItem(SCHEME_KEY, 'garden');

    startColourScheme();

    expect(root.dataset.scheme).toBe('garden');
  });

  it('opens in Violet when this browser never had a choice', () => {
    startColourScheme();

    expect(root.dataset.scheme).toBe('violet');
  });

  it('opens in Violet when what is stored is no scheme', () => {
    localStorage.setItem(SCHEME_KEY, 'Garden');

    startColourScheme();

    expect(root.dataset.scheme).toBe('violet');
  });

  it('opens in Violet when storage cannot be read, as in a private window', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    startColourScheme();

    expect(root.dataset.scheme).toBe('violet');
  });
});

describe('the account’s scheme', () => {
  it('is Violet, on the page and in storage, while the person has never chosen', () => {
    localStorage.setItem(SCHEME_KEY, 'citrus');
    startColourScheme();

    followAccountScheme(null);

    expect(root.dataset.scheme).toBe('violet');
    expect(localStorage.getItem(SCHEME_KEY)).toBe('violet');
  });

  it('is told to every other open tab on a save, and taken from theirs', () => {
    startColourScheme();
    const [channel] = FakeChannel.open;

    savedScheme('cobalt');

    expect(channel?.name).toBe(SCHEME_CHANNEL);
    expect(channel?.posted).toEqual(['cobalt']);
    expect(root.dataset.scheme).toBe('cobalt');

    channel?.onmessage?.(new MessageEvent('message', { data: 'sorbet' }));

    expect(root.dataset.scheme).toBe('sorbet');
    expect(localStorage.getItem(SCHEME_KEY)).toBe('sorbet');
  });

  it('gives way to a page held in its own scheme, and comes back when it lets go', () => {
    startColourScheme();
    followAccountScheme('garden');

    const release = holdScheme('cobalt');
    followAccountScheme('berry');

    expect(root.dataset.scheme).toBe('cobalt');

    release();

    expect(root.dataset.scheme).toBe('berry');
  });
});

describe('the arrow keys over the swatches', () => {
  it('move forward on Right and Down, back on Left and Up, and wrap', () => {
    expect(keyStep('ArrowRight')).toBe(1);
    expect(keyStep('ArrowDown')).toBe(1);
    expect(keyStep('ArrowLeft')).toBe(-1);
    expect(keyStep('ArrowUp')).toBe(-1);
    expect(keyStep('Tab')).toBeNull();
    expect(nextScheme('terracotta', 1)).toBe('violet');
    expect(nextScheme('violet', -1)).toBe('terracotta');
    expect(nextScheme('garden', 1)).toBe('citrus');
  });
});
