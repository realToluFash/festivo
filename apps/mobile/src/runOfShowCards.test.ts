import { createHash } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const stored = vi.hoisted(() => new Map<string, string>());
const appState = vi.hoisted(() => ({ listeners: [] as ((state: string) => void)[] }));
const notifications = vi.hoisted(() => ({
  getPermissionsAsync: vi.fn(async () => ({ granted: true })),
  scheduleNotificationAsync: vi.fn(async () => 'shown'),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => stored.get(key) ?? null,
    setItem: async (key: string, value: string) => void stored.set(key, value),
  },
}));
vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_: string, text: string) =>
    createHash('sha256').update(text).digest('hex'),
}));
vi.mock('expo-notifications', () => notifications);
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: {
    addEventListener: (_: string, listener: (state: string) => void) => {
      appState.listeners.push(listener);
      return { remove: () => {} };
    },
  },
}));

const {
  isFromCard,
  leftNight,
  openedFromCard,
  putUpRunOfShowCard,
  rememberEventDayPush,
  runOfShowCardKey,
} = await import('./runOfShowCards.ts');

const TRACK = { eventId: 'e1', day: '2027-03-06', place: 'Ballroom', recipient: 'u1' };
const WORDS = { title: 'Owambe · Ballroom', lines: ['Speeches · since 19:27'] };

describe('a press from the card (sc-66580)', () => {
  it('counts the night as opened from the card until the app goes to the background or the night is left', () => {
    expect(isFromCard('e1')).toBe(false);

    openedFromCard('e1');
    expect(isFromCard('e1')).toBe(true);
    expect(isFromCard('e2')).toBe(false);

    appState.listeners.forEach((listener) => listener('background'));
    expect(isFromCard('e1')).toBe(false);

    openedFromCard('e1');
    leftNight();
    expect(isFromCard('e1')).toBe(false);

    openedFromCard('e1');
    expect(isFromCard('e1')).toBe(true);
    expect(appState.listeners).toHaveLength(1);
  });
});

describe('the card’s collapse key', () => {
  it('is the one the API sends the track’s card under, so the two replace each other', async () => {
    expect(await runOfShowCardKey('e1', '2027-03-06', 'Ballroom')).toBe(
      'run-of-show:c3ac8bbec6b290de930b917fff0924f724e38f4a',
    );
  });
});

describe('putting up this device’s card', () => {
  beforeEach(() => {
    stored.clear();
    notifications.getPermissionsAsync.mockClear();
    notifications.scheduleNotificationAsync.mockClear();
    notifications.getPermissionsAsync.mockResolvedValue({ granted: true });
  });

  it('puts it up under the track’s key', async () => {
    await putUpRunOfShowCard(TRACK, WORDS);

    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'run-of-show:c3ac8bbec6b290de930b917fff0924f724e38f4a',
      }),
    );
  });

  it('puts up none with Event day’s Push off, as last read', async () => {
    await rememberEventDayPush(false);

    await putUpRunOfShowCard(TRACK, WORDS);

    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('puts up none where notifications are not allowed', async () => {
    notifications.getPermissionsAsync.mockResolvedValue({ granted: false });

    await putUpRunOfShowCard(TRACK, WORDS);

    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
