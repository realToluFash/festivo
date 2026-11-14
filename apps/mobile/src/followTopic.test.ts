import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = () => void;

const sources = vi.hoisted(() => [] as { listeners: Map<string, Listener> }[]);
const settings = vi.hoisted(() => ({ mercureUrl: 'http://hub.test/.well-known/mercure' }));

vi.mock('./config.ts', () => ({ config: settings }));
vi.mock('react-native-sse', () => ({
  default: class {
    listeners = new Map<string, Listener>();
    constructor() {
      sources.push(this);
    }
    addEventListener(type: string, listener: Listener): void {
      this.listeners.set(type, listener);
    }
    close(): void {}
  },
}));

const { followReadingAgain } = await import('./followTopic.ts');

const EVERY_MS = 10_000;
const subscribe = async () => ({
  token: 't',
  expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
});

describe('reading again while the hub is down', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sources.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads every so often until a line opens, and again from when it drops', async () => {
    const read = vi.fn();
    const stop = followReadingAgain('topic', subscribe, read, EVERY_MS);
    await vi.advanceTimersByTimeAsync(0);
    const line = sources[0]!;

    await vi.advanceTimersByTimeAsync(EVERY_MS);
    expect(read).toHaveBeenCalledTimes(1);

    line.listeners.get('open')!();
    expect(read).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(EVERY_MS * 3);
    expect(read).toHaveBeenCalledTimes(2);

    line.listeners.get('error')!();
    await vi.advanceTimersByTimeAsync(EVERY_MS);
    expect(read).toHaveBeenCalledTimes(3);

    stop();
    await vi.advanceTimersByTimeAsync(EVERY_MS * 3);
    expect(read).toHaveBeenCalledTimes(3);
  });
});
