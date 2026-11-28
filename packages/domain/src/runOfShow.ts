/** When an event day turns over, in the event's zone: an item at 00:30 sits on the day before (sc-3895, Decided 1 Nov). */
export const EVENT_DAY_TURNS_AT_HOUR = 5;

const pad2 = (n: number): string => String(n).padStart(2, '0');

function wallMs(wall: string): number {
  return Date.UTC(
    Number(wall.slice(0, 4)),
    Number(wall.slice(5, 7)) - 1,
    Number(wall.slice(8, 10)),
    Number(wall.slice(11, 13) || '0'),
    Number(wall.slice(14, 16) || '0'),
  );
}

function wallFrom(ms: number): string {
  const d = new Date(ms);

  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/** The wall-clock `YYYY-MM-DDTHH:mm` of an RFC 3339 time written in the event zone's offset, as the API writes every schedule time. */
export function wallOfZoned(rfc3339: string): string {
  return rfc3339.slice(0, 16);
}

/** The event day a wall-clock start sits on, `YYYY-MM-DD`: an event day runs from 05:00 to 05:00. */
export function eventDayOf(wall: string): string {
  return wallFrom(wallMs(wall) - EVENT_DAY_TURNS_AT_HOUR * 3_600_000).slice(0, 10);
}

/** A wall-clock time moved by whole minutes, across midnight as the calendar does, with no zone to skip an hour. */
export function wallPlusMinutes(wall: string, minutes: number): string {
  return wallFrom(wallMs(wall) + minutes * 60_000);
}

/** Every event day from the first to the last, inclusive. */
export function eventDaysBetween(firstDay: string, lastDay: string): string[] {
  const days: string[] = [];
  for (let at = wallMs(firstDay); at <= wallMs(lastDay); at += 86_400_000) {
    days.push(wallFrom(at).slice(0, 10));
  }

  return days;
}
