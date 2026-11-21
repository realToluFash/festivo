import AsyncStorage from '@react-native-async-storage/async-storage';
import { type CheckIn, asCheckIn } from '@soirely/api-client';

import type { WaitingArrival } from './doorScan.ts';

/** The door's list as last downloaded, kept on this device so the scanner works with no connection (sc-1301). It holds digests, never codes. */
export interface KeptList {
  checkIn: CheckIn;
  savedAt: string;
}

const listKey = (eventId: string) => `door.list.${eventId}`;
const waitingKey = (eventId: string) => `door.waiting.${eventId}`;

function parsed(raw: string | null): unknown {
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export async function keepList(eventId: string, kept: KeptList): Promise<void> {
  await AsyncStorage.setItem(listKey(eventId), JSON.stringify(kept)).catch(() => {});
}

export async function keptList(eventId: string): Promise<KeptList | null> {
  const value = parsed(await AsyncStorage.getItem(listKey(eventId)).catch(() => null)) as {
    checkIn?: unknown;
    savedAt?: unknown;
  } | null;
  const checkIn = value?.checkIn == null ? null : asCheckIn(value.checkIn);

  return checkIn == null || typeof value?.savedAt !== 'string'
    ? null
    : { checkIn, savedAt: value.savedAt };
}

export async function keepWaiting(
  eventId: string,
  waiting: readonly WaitingArrival[],
): Promise<void> {
  await AsyncStorage.setItem(waitingKey(eventId), JSON.stringify(waiting)).catch(() => {});
}

export async function keptWaiting(eventId: string): Promise<WaitingArrival[]> {
  const value = parsed(await AsyncStorage.getItem(waitingKey(eventId)).catch(() => null));

  return Array.isArray(value)
    ? value.filter(
        (one): one is WaitingArrival =>
          typeof one === 'object' &&
          one != null &&
          typeof (one as WaitingArrival).guestId === 'string' &&
          typeof (one as WaitingArrival).at === 'string',
      )
    : [];
}
