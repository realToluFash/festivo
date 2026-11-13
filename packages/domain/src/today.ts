import {
  type CalendarEvent,
  type CalendarItem,
  addDays,
  calendarDays,
  wallDay,
} from './calendar.ts';
import { type HomeEvent, eventsHome } from './eventsHome.ts';

export type TodayEvent = HomeEvent & CalendarEvent;

export type Greeting = 'morning' | 'afternoon' | 'evening';

export interface WeekDay<E extends TodayEvent> {
  day: string;
  today: boolean;
  items: CalendarItem<E>[];
}

/** Where signing in lands (sc-29090), drawn from the events' own dates: nothing here is waiting on a source the API does not have. */
export interface Today<E extends TodayEvent> {
  greeting: Greeting;
  /** The event under way, whose cover Today takes as Now. */
  now: E | null;
  /** Seven days from the reader's today, each with what falls on it in its event's own zone. */
  week: WeekDay<E>[];
  /** The next event after a week with nothing in it. */
  nextUp: E | null;
  /** Under way, then still to come, soonest first, then drafts. */
  events: E[];
}

export function greetingAt(hour: number): Greeting {
  return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
}

export function today<E extends TodayEvent>(
  loaded: { events: readonly E[]; at: Date },
  now: Date,
  reader: { timeZone: string; hour: number; locale: string },
): Today<E> {
  const home = eventsHome(
    { unfinished: loaded.events, past: [], pastTotal: 0, at: loaded.at },
    now,
    reader.locale,
  );
  const shown = [...home.happeningNow, ...home.upcoming];
  const days = calendarDays(shown, 'all');
  const first = wallDay(now, reader.timeZone);
  const week = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(first, index);

    return { day, today: index === 0, items: days.get(day) ?? [] };
  });
  const last = week[week.length - 1]?.day ?? first;

  return {
    greeting: greetingAt(reader.hour),
    now: home.happeningNow[0] ?? null,
    week,
    nextUp: week.some(({ items }) => items.length > 0)
      ? null
      : (home.upcoming.find((event) => wallDay(event.startsAt, event.timeZone) > last) ?? null),
    events: [...shown, ...home.drafts],
  };
}
