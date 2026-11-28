import AsyncStorage from '@react-native-async-storage/async-storage';
import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';

import type { RunOfShowCardWords } from './kit/runOfShowCard.ts';

/** The API's push collapses on the same key, so this device's card and the server's replace each other (sc-66580). */
const KEY_PREFIX = 'run-of-show:';
const KEY_HASH_LENGTH = 40;
export const RUN_OF_SHOW_CHANNEL = 'run_of_show';
const EVENT_DAY_PUSH = 'soirely.eventDayPush';

export async function runOfShowCardKey(
  eventId: string,
  day: string,
  place: string | null,
): Promise<string> {
  const hash = await digestStringAsync(
    CryptoDigestAlgorithm.SHA256,
    `${eventId}|${day}|${place ?? ''}`,
  );

  return KEY_PREFIX + hash.slice(0, KEY_HASH_LENGTH);
}

/** The web's path for the track, which a tap opens on the night as the server's card does. */
export function runOfShowCardPlace(eventId: string, day: string, place: string | null): string {
  return `/app/events/${encodeURIComponent(eventId)}/schedule?track=${encodeURIComponent(`${day}|${place ?? ''}`)}`;
}

/** Event day's Push switch, as last read: offline, the card still follows it. */
export async function rememberEventDayPush(on: boolean): Promise<void> {
  await AsyncStorage.setItem(EVENT_DAY_PUSH, on ? 'on' : 'off').catch(() => {});
}

async function eventDayPushOn(): Promise<boolean> {
  return (await AsyncStorage.getItem(EVENT_DAY_PUSH).catch(() => null)) !== 'off';
}

export interface RunOfShowCardTrack {
  eventId: string;
  day: string;
  place: string | null;
  recipient: string;
}

/** Only while push is allowed here and Event day's Push is on. */
export async function putUpRunOfShowCard(
  track: RunOfShowCardTrack,
  words: RunOfShowCardWords,
): Promise<void> {
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  if (!(await eventDayPushOn())) return;

  await Notifications.scheduleNotificationAsync({
    identifier: await runOfShowCardKey(track.eventId, track.day, track.place),
    content: {
      title: words.title,
      body: words.lines.join('\n'),
      data: {
        place: runOfShowCardPlace(track.eventId, track.day, track.place),
        recipient: track.recipient,
        silent: true,
      },
      sound: false,
      interruptionLevel: 'passive',
    },
    trigger: Platform.OS === 'android' ? { channelId: RUN_OF_SHOW_CHANNEL } : null,
  });
}

export function isRunOfShowCard(notification: Notifications.Notification): boolean {
  return (
    notification.request.identifier.startsWith(KEY_PREFIX) ||
    notification.request.content.data?.silent === true
  );
}

/** Signing out takes every card down, the server's and this device's. */
export async function takeDownRunOfShowCards(): Promise<void> {
  const shown = await Notifications.getPresentedNotificationsAsync();

  await Promise.all(
    shown
      .filter(isRunOfShowCard)
      .map((one) => Notifications.dismissNotificationAsync(one.request.identifier)),
  );
}

let fromCard: string | null = null;
let following = false;

/** A tap on a card opens the night from the card until the app goes to the background or the night is left. */
export function openedFromCard(eventId: string): void {
  fromCard = eventId;
  if (following) return;
  following = true;
  AppState.addEventListener('change', (state) => {
    if (state === 'background') fromCard = null;
  });
}

export function leftNight(): void {
  fromCard = null;
}

export function isFromCard(eventId: string): boolean {
  return fromCard === eventId;
}
