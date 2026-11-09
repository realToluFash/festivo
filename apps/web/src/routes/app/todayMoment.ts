import type { ListedEvent } from '@soirely/api-client';
import {
  type CalendarItem,
  eventDays,
  formatEventClock,
  formatEventShortDay,
  formatEventWeekday,
  shownPhase,
  today,
  wallDay,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

import type {
  AgendaDay,
  AgendaItem,
  EventCard,
  Moment,
  Now,
  ShownEvent,
  StripBar,
} from '../../components/today.ts';
import { meshFor } from '../../mesh.ts';

export interface Reader {
  timeZone: string;
  locale: string;
}

export function shownEvent(event: ListedEvent): ShownEvent {
  return { id: event.id, name: event.name, mesh: meshFor(event.id) };
}

const SHORT_DAY: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };

function daysFrom(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00Z`) - Date.parse(`${from}T00:00Z`)) / 86_400_000);
}

function hourIn(now: Date, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone }).format(now),
  );
}

/** A wall day, `2026-11-03`, written in the reader's language. */
function dayWords(day: string, locale: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(
    new Date(`${day}T00:00:00Z`),
  );
}

function howFar(from: string, to: string, t: TFunction): string {
  const days = daysFrom(from, to);

  return days === 1 ? t('today.tomorrow') : t('today.inDays', { count: days });
}

/** Its day, or its first and last day, in its own zone, as Events writes them. */
function eventDates(event: ListedEvent, locale: string, t: TFunction): string {
  const days = eventDays(event);

  if (days.kind === 'calledOffOn')
    return t('events.calledOffOn', {
      date: formatEventShortDay(days.concludedAt, event.timeZone, locale),
    });

  const first = formatEventWeekday(days.startsAt, event.timeZone, locale);

  return days.kind === 'oneDay'
    ? first
    : t('events.days', { first, last: formatEventWeekday(days.endsAt, event.timeZone, locale) });
}

function agendaItem(item: CalendarItem<ListedEvent>, reader: Reader, t: TFunction): AgendaItem {
  const { event } = item;
  const clock = (at: string) => formatEventClock(at, event.timeZone, reader.locale);

  if (item.kind === 'milestone')
    return {
      time: clock(item.milestone.at),
      title: item.milestone.title,
      event: shownEvent(event),
      note: item.milestone.note ?? '',
    };

  const day = daysFrom(wallDay(event.startsAt, event.timeZone), item.day) + 1;
  const time = item.first
    ? clock(event.startsAt)
    : item.last
      ? clock(event.endsAt)
      : t('today.allDay');
  const title = item.first
    ? t('today.starts', { name: event.name })
    : item.last
      ? t('today.ends', { name: event.name })
      : t('today.continues', { name: event.name });

  return {
    time,
    title,
    event: shownEvent(event),
    note: item.multiDay ? t('today.dayOf', { day, total: event.dayCount }) : '',
  };
}

function card(
  event: ListedEvent,
  live: boolean,
  on: string,
  reader: Reader,
  t: TFunction,
): EventCard {
  const until = daysFrom(on, wallDay(event.startsAt, event.timeZone));
  const draft = event.status === 'draft';
  const count = draft
    ? t('events.draft')
    : live
      ? t('today.dayOfCapital', { day: 1 - until, total: event.dayCount })
      : until <= 1
        ? t('today.tomorrowCapital')
        : t('today.inDaysCapital', { count: until });

  return {
    event: shownEvent(event),
    name: event.name,
    dates: eventDates(event, reader.locale, t),
    count,
    live,
    draft,
    stage: !draft && !live && until <= 7 ? t('today.finalWeek') : null,
    ready: null,
  };
}

function nowOf(event: ListedEvent, on: string, reader: Reader, t: TFunction): Now {
  const day = daysFrom(wallDay(event.startsAt, event.timeZone), on) + 1;
  const last = wallDay(event.endsAt, event.timeZone);
  const place = event.venue?.name ?? event.venue?.address?.formatted ?? null;
  const dayLine = t('today.dayOfCapital', { day, total: event.dayCount });
  const ends = {
    date: dayWords(last, reader.locale, SHORT_DAY),
    time: formatEventClock(event.endsAt, event.timeZone, reader.locale),
  };

  return {
    event: shownEvent(event),
    name: event.name,
    live: place == null ? dayLine : t('today.dayAndPlace', { day: dayLine, place }),
    ends:
      last === on
        ? t('today.endsToday', ends)
        : daysFrom(on, last) === 1
          ? t('today.endsTomorrow', ends)
          : t('today.endsOn', ends),
    // Only the dates are known: what is happening, the rail and arrivals have no source yet, so a moment that is not `full` never draws them.
    happening: '',
    until: '',
    behind: '',
    next: { time: '', title: '' },
    arrived: 0,
    expected: 0,
    rail: [],
    at: 0,
  };
}

/** Today from the events the API returns (sc-29090, sc-30413): only what their dates and milestones can say. */
export function todayMoment(
  loaded: { events: readonly ListedEvent[]; at: Date },
  now: Date,
  reader: Reader,
  name: string,
  t: TFunction,
): Moment {
  const shown = today(loaded, now, { ...reader, hour: hourIn(now, reader.timeZone) });
  const on = wallDay(now, reader.timeZone);
  const first = loaded.events.length === 0;
  const empty = shown.week.every(({ items }) => items.length === 0);
  const kind = first ? 'first' : shown.now != null ? 'day' : empty ? 'quiet' : 'plan';
  const weekIndex = (day: string) => daysFrom(on, day);

  const bars: StripBar[] = [];
  for (const { items } of shown.week)
    for (const item of items) {
      if (item.kind !== 'event' || !item.multiDay) continue;
      if (bars.some((bar) => bar.event.id === item.event.id)) continue;

      const start = Math.max(0, weekIndex(wallDay(item.event.startsAt, item.event.timeZone)));
      const end = Math.min(6, weekIndex(wallDay(item.event.endsAt, item.event.timeZone)));
      const openLeft = start === 0 && !item.first;
      const day = daysFrom(wallDay(item.event.startsAt, item.event.timeZone), on) + 1;

      bars.push({
        event: shownEvent(item.event),
        start,
        span: end - start + 1,
        label: openLeft
          ? t('today.dayOf', { day, total: item.event.dayCount })
          : t('today.days', { count: item.event.dayCount }),
        openLeft,
      });
    }

  const covered = (id: string, index: number) =>
    bars.some((bar) => bar.event.id === id && index >= bar.start && index < bar.start + bar.span);
  const days = shown.week.map(({ day, today: isToday, items }, index) => ({
    weekday: dayWords(day, reader.locale, { weekday: 'short' }),
    number: dayWords(day, reader.locale, { day: 'numeric' }),
    today: isToday,
    dots: [...new Map(items.map((item) => [item.event.id, item.event])).values()]
      .filter((event) => !covered(event.id, index))
      .map(shownEvent),
  }));

  const shortDay = (day: string) => dayWords(day, reader.locale, SHORT_DAY);
  const agenda: AgendaDay[] = shown.week
    .filter(({ today: isToday, items }) => isToday || items.length > 0)
    .map(({ day, today: isToday, items }) => ({
      date: day,
      day: isToday ? t('today.today') : shortDay(day),
      when: isToday ? shortDay(day) : howFar(on, day, t),
      today: isToday,
      items: items.map((item) => agendaItem(item, reader, t)),
    }));

  const soonest = shown.events.find((event) => event.status !== 'draft' && event !== shown.now);
  const soonestDay = soonest == null ? null : wallDay(soonest.startsAt, soonest.timeZone);
  const sub =
    kind === 'first'
      ? t('today.firstSub')
      : soonest == null || soonestDay == null
        ? t('today.nothingThisWeek')
        : daysFrom(on, soonestDay) < 7
          ? t('today.startsOnWeekday', {
              name: soonest.name,
              weekday: dayWords(soonestDay, reader.locale, { weekday: 'long' }),
            })
          : t('today.startsOnDate', { name: soonest.name, date: shortDay(soonestDay) });
  const greeting = kind === 'first' ? 'welcome' : shown.greeting;
  const nextDay =
    shown.nextUp == null ? null : wallDay(shown.nextUp.startsAt, shown.nextUp.timeZone);

  return {
    kind,
    full: false,
    eyebrow: dayWords(on, reader.locale, { weekday: 'long', month: 'long', day: 'numeric' }),
    hello: name === '' ? t(`today.hello.${greeting}`) : t(`today.helloName.${greeting}`, { name }),
    lead: null,
    sub,
    days,
    bars,
    agenda,
    nothing: kind === 'day' ? t('today.nothingElseToday') : t('today.nothingToday'),
    nextUp:
      shown.nextUp == null || nextDay == null
        ? null
        : {
            event: shownEvent(shown.nextUp),
            name: shown.nextUp.name,
            when: t('today.dateAndHowFar', {
              date: shortDay(nextDay),
              far: howFar(on, nextDay, t),
            }),
          },
    events: shown.events.map((event) =>
      card(event, shownPhase(event, loaded.at, now) === 'happening_now', on, reader, t),
    ),
    now: shown.now == null ? null : nowOf(shown.now, on, reader, t),
  };
}
