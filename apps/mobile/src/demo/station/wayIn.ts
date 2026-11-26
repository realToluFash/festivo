import { type CodeChoice } from '../doorCode/DoorCodeModel.ts';

/** sc-4002: who opens the kitchen stations, by a level (personal link, job or join code) or a role. */
export type Access = CodeChoice | 'Can run the floor' | 'Owner' | 'Admin' | 'Lead';

const OPENS: readonly Access[] = [
  'Can work the pass',
  'Can run the floor',
  'Owner',
  'Admin',
  'Lead',
  'Can edit',
];

export function opensStations(access: Access): boolean {
  return OPENS.includes(access);
}

export const KS = {
  title: 'Kitchen station',
  pick: 'Pick a station',
  open: (station: string) => `Open ${station}`,
  label: (line: string) => `Kitchen station, ${line}`,
  asOf: (line: string, time: string) => `${line} · as of ${time}`,
  overview: 'Overview',
  yourNight: 'Your night',
} as const;

export interface EventDay {
  startDay: string;
  timeZone: string;
  /** Its end time has passed, or it was ended. */
  finished: boolean;
  calledOff: boolean;
}

function dayIn(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** From 00:00 in the event's zone on its first day until it is Finished; never for an event called off. */
export function rowShows(event: EventDay, now: Date): boolean {
  if (event.finished || event.calledOff) return false;

  return dayIn(now, event.timeZone) >= event.startDay;
}

/** The last answered read's time, 24-hour, in the event's zone. */
export function readAt(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(at);
}

export interface Where {
  own: string | null;
  /** The last station picked on this device for this event. */
  lastPick: string | null;
  course: string | null;
}

/** sc-4015's Who opens it: their own station, else the last pick here, else the list. */
export function opensOn(where: Where): string | null {
  return where.own ?? where.lastPick;
}

export function rowLine(where: Where): string {
  const station = opensOn(where);
  if (station == null) return KS.pick;

  return where.course == null ? station : `${station} · ${where.course}`;
}

export type ShiftStation =
  { kind: 'kitchen'; name: string; dishes: number } | { kind: 'section'; name: string } | null;

/** Open {station} above Your shift: a station that dishes something, access that opens it, and the app. */
export function openButton(station: ShiftStation, access: Access, inApp: boolean): string | null {
  if (!inApp || station == null || station.kind !== 'kitchen' || station.dishes === 0) return null;

  return opensStations(access) ? KS.open(station.name) : null;
}
