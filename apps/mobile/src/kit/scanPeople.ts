import type { CheckIn } from '@soirely/api-client';
import { REPLY_KEY, companionShown, doorSeatLine, replyDate } from '@soirely/domain';
import type { TFunction } from 'i18next';

import { clockOf } from './checkIn.ts';
import type { ScanRead } from './doorScan.ts';
import { markOf } from './guestRows.ts';

export interface Person {
  id: string;
  name: string;
  companion: boolean;
  /** Their seat or "No seat yet", under the name; null on an event nobody is seated on (sc-60684). */
  seat: string | null;
  line: string;
  mark: 'arrived' | ReturnType<typeof markOf>;
  arrived: boolean;
}

export function peopleOf(
  t: TFunction,
  read: Extract<ScanRead, { kind: 'guest' }>,
  checkIn: CheckIn,
  twice: boolean,
  locale: string,
): Person[] {
  const { timeZone } = checkIn;
  const arrivedLine = (arrival: { at: string; by: string | null }) =>
    arrival.by == null
      ? t('checkIn.arrivedAt', { time: clockOf(arrival.at) })
      : t('checkIn.arrivedAtBy', { time: clockOf(arrival.at), name: arrival.by });
  const { guest } = read;
  const word = t(REPLY_KEY[guest.reply]);
  const hostLine =
    guest.arrival != null
      ? twice
        ? arrivedLine(guest.arrival)
        : `${word} · ${arrivedLine(guest.arrival)}`
      : read.notComingSince != null
        ? t('guestList.replied', {
            reply: word,
            date: replyDate(read.notComingSince, timeZone, locale),
          })
        : word;
  const names = guest.companions.map((one) => one.fullName);

  return [
    {
      id: guest.id,
      name: guest.fullName,
      companion: false,
      seat: doorSeatLine(t, checkIn, guest.seat),
      line: hostLine,
      mark: guest.arrival != null ? 'arrived' : markOf(guest.reply),
      arrived: guest.arrival != null,
    },
    ...guest.companions.map((one, at) => ({
      id: one.id,
      name: companionShown(t, guest.fullName, names, at),
      companion: true,
      seat: doorSeatLine(t, checkIn, one.seat),
      line:
        one.arrival != null
          ? t('checkIn.scan.companionLine', { line: arrivedLine(one.arrival) })
          : one.state === 'held'
            ? t('checkIn.scan.companionHeld')
            : t('checkIn.scan.companionLine', { line: t(REPLY_KEY[one.state]) }),
      mark: one.arrival != null ? ('arrived' as const) : markOf(one.state),
      arrived: one.arrival != null,
    })),
  ];
}

export function saidOf(people: readonly Person[], twice: boolean, nothingNew: string): string {
  return people
    .map((one) => [one.name, one.seat, one.line].filter((part) => part != null).join(', '))
    .concat(twice ? [nothingNew] : [])
    .join('. ');
}
