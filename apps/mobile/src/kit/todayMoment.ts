import type { ListedEvent } from '@soirely/api-client';
import {
  type TodayAgendaItem,
  type TodayCard,
  type TodayNow,
  type TodaySub,
  formatEventClock,
  notThisYear,
  todayView,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

import {
  type AgendaItem,
  type EventCard,
  meshFor,
  type Moment,
  type Now,
  type ShownEvent,
} from './today.ts';
import { daysWords } from './eventsList.ts';

export interface Reader {
  timeZone: string;
  locale: string;
}

export function shownEvent(event: ListedEvent): ShownEvent {
  return {
    id: event.id,
    name: event.name,
    mesh: meshFor(event.id),
    photo: event.cover == null ? null : { cover: event.cover, type: event.type },
  };
}

const SHORT_DAY: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };

/** A wall day, `2026-11-03`, written in the reader's language. */
function dayWords(day: string, locale: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(
    new Date(`${day}T00:00:00Z`),
  );
}

/** An event's day, the wall day of `moment` in its zone, with its year when that is not this year in the event's zone (sc-30413). */
function dateWords(
  day: string,
  moment: string,
  event: ListedEvent,
  now: Date,
  locale: string,
): string {
  return dayWords(
    day,
    locale,
    notThisYear(event.timeZone, now, moment) ? { ...SHORT_DAY, year: 'numeric' } : SHORT_DAY,
  );
}

function howFar(days: number, t: TFunction): string {
  return days === 1 ? t('todayScreen.tomorrow') : t('todayScreen.inDays', { count: days });
}

function agendaItem(item: TodayAgendaItem<ListedEvent>, reader: Reader, t: TFunction): AgendaItem {
  const { event } = item;
  const clock = (at: string) => formatEventClock(at, event.timeZone, reader.locale);

  if (item.kind === 'milestone')
    return {
      time: clock(item.milestone.at),
      allDay: false,
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
          : t('todayScreen.allDay'),
    allDay: item.kind === 'continues',
    title: t(`todayScreen.${item.kind}`, { name: event.name }),
    event: shownEvent(event),
    note: item.multiDay ? t('todayScreen.dayOf', { day: item.day, total: event.dayCount }) : '',
  };
}

function card(one: TodayCard<ListedEvent>, now: Date, reader: Reader, t: TFunction): EventCard {
  const { event, count } = one;

  return {
    event: shownEvent(event),
    name: event.name,
    dates: daysWords(event, now, reader.locale, true, t),
    count:
      count.kind === 'draft'
        ? t('todayScreen.draft')
        : count.kind === 'dayOf'
          ? t('todayScreen.dayOfCapital', { day: count.day, total: count.total })
          : count.kind === 'today'
            ? t('todayScreen.today')
            : count.days === 1
              ? t('todayScreen.tomorrowCapital')
              : t('todayScreen.inDaysCapital', { count: count.days }),
    live: one.live,
    draft: one.draft,
    stage: one.finalWeek ? t('todayScreen.finalWeek') : null,
    ready: null,
  };
}

function nowOf(now: TodayNow<ListedEvent>, at: Date, reader: Reader, t: TFunction): Now {
  const { event } = now;
  const place = event.venue?.name ?? event.venue?.address?.formatted ?? null;
  const dayLine = t('todayScreen.dayOfCapital', { day: now.dayToday, total: event.dayCount });
  const ends = {
    date: dateWords(now.lastDay, event.endsAt, event, at, reader.locale),
    time: formatEventClock(event.endsAt, event.timeZone, reader.locale),
  };

  return {
    event: shownEvent(event),
    name: event.name,
    live: place == null ? dayLine : t('todayScreen.dayAndPlace', { day: dayLine, place }),
    ends:
      now.endsIn === 0
        ? t('todayScreen.endsToday', ends)
        : now.endsIn === 1
          ? t('todayScreen.endsTomorrow', ends)
          : t('todayScreen.endsOn', ends),
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

function subOf(sub: TodaySub<ListedEvent>, now: Date, reader: Reader, t: TFunction): string {
  switch (sub.kind) {
    case 'first':
      return t('todayScreen.firstSub');
    case 'nothingThisWeek':
      return t('todayScreen.nothingThisWeek');
    case 'startsToday':
      return t('todayScreen.startsTodayAt', {
        name: sub.event.name,
        time: formatEventClock(sub.event.startsAt, sub.event.timeZone, reader.locale),
      });
    case 'startsOn':
      return sub.withinWeek
        ? t('todayScreen.startsOnWeekday', {
            name: sub.event.name,
            weekday: dayWords(sub.day, reader.locale, { weekday: 'long' }),
          })
        : t('todayScreen.startsOnDate', {
            name: sub.event.name,
            date: dateWords(sub.day, sub.event.startsAt, sub.event, now, reader.locale),
          });
  }
}

/** Today from the events the API returns (sc-29090), in words: the domain's `todayView` decides what it shows. */
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
    name: view.kind === 'day' ? 'dayNow' : view.kind === 'plan' ? 'planNow' : view.kind,
    kind: view.kind,
    full: false,
    time: '',
    eyebrow: dayWords(view.on, reader.locale, { weekday: 'long', month: 'long', day: 'numeric' }),
    hello:
      name === ''
        ? t(`todayScreen.hello.${view.greeting}`)
        : t(`todayScreen.helloName.${view.greeting}`, { name }),
    lead: null,
    sub: subOf(view.sub, now, reader, t),
    needs: null,
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
        ? t('todayScreen.dayOf', { day: dayToday, total: event.dayCount })
        : t('todayScreen.days', { count: event.dayCount }),
      openLeft,
      lane,
    })),
    agenda: view.agenda.map(({ day, today: isToday, daysAway, items }) => ({
      date: day,
      day: isToday ? t('todayScreen.today') : shortDay(day),
      when: isToday ? shortDay(day) : howFar(daysAway, t),
      today: isToday,
      items: items.map((item) => agendaItem(item, reader, t)),
    })),
    nothing:
      view.kind === 'day' ? t('todayScreen.nothingElseToday') : t('todayScreen.nothingToday'),
    nextUp:
      view.nextUp == null
        ? null
        : {
            event: shownEvent(view.nextUp.event),
            name: view.nextUp.event.name,
            when: t('todayScreen.dateAndHowFar', {
              date: dateWords(
                view.nextUp.day,
                view.nextUp.event.startsAt,
                view.nextUp.event,
                now,
                reader.locale,
              ),
              far: howFar(view.nextUp.daysAway, t),
            }),
          },
    events: view.cards.map((one) => card(one, now, reader, t)),
    now: view.now == null ? null : nowOf(view.now, now, reader, t),
  };
}
