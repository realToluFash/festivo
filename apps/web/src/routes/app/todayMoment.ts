import type { ListedEvent } from '@soirely/api-client';
import {
  type TodayAgendaItem,
  type TodayCard,
  type TodayNow,
  type TodaySub,
  eventDayWords,
  formatEventClock,
  todayView,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

import type { AgendaItem, EventCard, Moment, Now, ShownEvent } from '../../components/today.ts';
import { meshFor } from '../../mesh.ts';

export interface Reader {
  timeZone: string;
  locale: string;
}

export function shownEvent(event: ListedEvent): ShownEvent {
  return { id: event.id, name: event.name, mesh: meshFor(event.id) };
}

const SHORT_DAY: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };

/** A wall day, `2026-11-03`, written in the reader's language. */
function dayWords(day: string, locale: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(
    new Date(`${day}T00:00:00Z`),
  );
}

function howFar(days: number, t: TFunction): string {
  return days === 1 ? t('today.tomorrow') : t('today.inDays', { count: days });
}

/** Its day, or its first and last day, in its own zone, as Events writes them. */
function eventDates(event: ListedEvent, now: Date, locale: string, t: TFunction): string {
  const days = eventDayWords(event, now, locale);

  switch (days.kind) {
    case 'calledOffOn':
      return t('events.calledOffOn', { date: days.date });
    case 'oneDay':
      return days.day;
    case 'days':
      return t('events.days', { first: days.first, last: days.last });
  }
}

function agendaItem(item: TodayAgendaItem<ListedEvent>, reader: Reader, t: TFunction): AgendaItem {
  const { event } = item;
  const clock = (at: string) => formatEventClock(at, event.timeZone, reader.locale);

  if (item.kind === 'milestone')
    return {
      time: clock(item.milestone.at),
      title: item.milestone.title,
      event: shownEvent(event),
      note: item.milestone.note ?? '',
    };

  return {
    time:
      item.kind === 'starts'
        ? clock(event.startsAt)
        : item.kind === 'ends'
          ? clock(event.endsAt)
          : t('today.allDay'),
    title: t(`today.${item.kind}`, { name: event.name }),
    event: shownEvent(event),
    note: item.multiDay ? t('today.dayOf', { day: item.day, total: event.dayCount }) : '',
  };
}

function card(one: TodayCard<ListedEvent>, now: Date, reader: Reader, t: TFunction): EventCard {
  const { event, count } = one;

  return {
    event: shownEvent(event),
    name: event.name,
    dates: eventDates(event, now, reader.locale, t),
    count:
      count.kind === 'draft'
        ? t('events.draft')
        : count.kind === 'dayOf'
          ? t('today.dayOfCapital', { day: count.day, total: count.total })
          : count.kind === 'today'
            ? t('today.today')
            : count.days === 1
              ? t('today.tomorrowCapital')
              : t('today.inDaysCapital', { count: count.days }),
    live: one.live,
    draft: one.draft,
    stage: one.finalWeek ? t('today.finalWeek') : null,
    ready: null,
  };
}

function nowOf(now: TodayNow<ListedEvent>, reader: Reader, t: TFunction): Now {
  const { event } = now;
  const place = event.venue?.name ?? event.venue?.address?.formatted ?? null;
  const dayLine = t('today.dayOfCapital', { day: now.dayToday, total: event.dayCount });
  const ends = {
    date: dayWords(now.lastDay, reader.locale, SHORT_DAY),
    time: formatEventClock(event.endsAt, event.timeZone, reader.locale),
  };

  return {
    event: shownEvent(event),
    name: event.name,
    live: place == null ? dayLine : t('today.dayAndPlace', { day: dayLine, place }),
    ends:
      now.endsIn === 0
        ? t('today.endsToday', ends)
        : now.endsIn === 1
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

function subOf(sub: TodaySub<ListedEvent>, reader: Reader, t: TFunction): string {
  switch (sub.kind) {
    case 'first':
      return t('today.firstSub');
    case 'nothingThisWeek':
      return t('today.nothingThisWeek');
    case 'startsToday':
      return t('today.startsTodayAt', {
        name: sub.event.name,
        time: formatEventClock(sub.event.startsAt, sub.event.timeZone, reader.locale),
      });
    case 'startsOn':
      return sub.withinWeek
        ? t('today.startsOnWeekday', {
            name: sub.event.name,
            weekday: dayWords(sub.day, reader.locale, { weekday: 'long' }),
          })
        : t('today.startsOnDate', {
            name: sub.event.name,
            date: dayWords(sub.day, reader.locale, SHORT_DAY),
          });
  }
}

/** Today from the events the API returns (sc-29090, sc-30413), in words: the domain's `todayView` decides what it shows. */
export function todayMoment(
  loaded: { events: readonly ListedEvent[]; at: Date },
  now: Date,
  reader: Reader,
  name: string,
  t: TFunction,
): Moment {
  const view = todayView(loaded, now, reader);
  const shortDay = (day: string) => dayWords(day, reader.locale, SHORT_DAY);

  return {
    kind: view.kind,
    full: false,
    eyebrow: dayWords(view.on, reader.locale, { weekday: 'long', month: 'long', day: 'numeric' }),
    hello:
      name === ''
        ? t(`today.hello.${view.greeting}`)
        : t(`today.helloName.${view.greeting}`, { name }),
    lead: null,
    sub: subOf(view.sub, reader, t),
    days: view.days.map(({ day, today: isToday, dots }) => ({
      weekday: dayWords(day, reader.locale, { weekday: 'short' }),
      number: dayWords(day, reader.locale, { day: 'numeric' }),
      today: isToday,
      dots: dots.map(shownEvent),
    })),
    bars: view.bars.map(({ event, start, span, openLeft, dayToday, lane }) => ({
      event: shownEvent(event),
      start,
      span,
      label: openLeft
        ? t('today.dayOf', { day: dayToday, total: event.dayCount })
        : t('today.days', { count: event.dayCount }),
      openLeft,
      lane,
    })),
    agenda: view.agenda.map(({ day, today: isToday, daysAway, items }) => ({
      date: day,
      day: isToday ? t('today.today') : shortDay(day),
      when: isToday ? shortDay(day) : howFar(daysAway, t),
      today: isToday,
      items: items.map((item) => agendaItem(item, reader, t)),
    })),
    nothing: view.kind === 'day' ? t('today.nothingElseToday') : t('today.nothingToday'),
    nextUp:
      view.nextUp == null
        ? null
        : {
            event: shownEvent(view.nextUp.event),
            name: view.nextUp.event.name,
            when: t('today.dateAndHowFar', {
              date: shortDay(view.nextUp.day),
              far: howFar(view.nextUp.daysAway, t),
            }),
          },
    events: view.cards.map((one) => card(one, now, reader, t)),
    now: view.now == null ? null : nowOf(view.now, reader, t),
  };
}
