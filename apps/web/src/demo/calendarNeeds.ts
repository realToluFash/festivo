import { type Milestone, agendaDays, calendarDays, monthOfDay, wallDay } from '@soirely/domain';

import {
  type Item,
  type Listed,
  type MarkItem,
  type NeedsSeed,
  type Show,
  CAL_WORDS as W,
  TODAY,
  firstOf,
  timeOf,
} from './calendar.ts';
import { KW, kitchenAt } from './kitchen.ts';
import { dueOrder, needsMe } from './needsYou.ts';

const AREAS = ['events', 'seating', 'vendors', 'budget', 'menu'] as const;

interface Owed {
  event: string;
  at: string;
  title: string;
  area: (typeof AREAS)[number];
  kitchen?: boolean;
}

const OWED: readonly Owed[] = [
  { event: 'evt-wed-4', at: '2026-11-02T23:59:00Z', title: 'Agree the toasts', area: 'seating' },
  { event: 'evt-wed-4', at: '2026-11-03T09:00:00Z', title: 'Confirm the cake', area: 'vendors' },
  {
    event: 'evt-wed-4',
    at: '2026-11-03T23:59:00Z',
    title: 'Pay the band’s balance',
    area: 'budget',
  },
  { event: 'evt-wed-4', at: '2026-11-04T12:00:00Z', title: 'Confirm the florist', area: 'vendors' },
  {
    event: 'evt-wed-4',
    at: '2026-11-04T18:00:00Z',
    title: 'Send the seating plan to the venue',
    area: 'seating',
  },
  {
    event: 'evt-wed-4',
    at: '2026-11-04T23:59:00Z',
    title: 'Give final numbers to the kitchen',
    area: 'menu',
    kitchen: true,
  },
  {
    event: 'evt-wed-4',
    at: '2026-11-04T23:59:00Z',
    title: 'Seat the last 12 guests',
    area: 'seating',
  },
  {
    event: 'evt-gala-4',
    at: '2026-11-09T17:00:00Z',
    title: 'Pay the venue’s deposit',
    area: 'budget',
  },
  {
    event: 'evt-gala-4',
    at: '2026-11-10T11:00:00Z',
    title: 'Seat the patrons’ tables',
    area: 'seating',
  },
  {
    event: 'evt-ireti-2',
    at: '2026-11-11T23:59:00Z',
    title: 'Give final numbers to the kitchen',
    area: 'menu',
    kitchen: true,
  },
];

export function heldOn(eventId: string, seed: NeedsSeed): string[] {
  if (seed === 'readOnly') return AREAS.map((area) => `${area}.read`);

  return AREAS.map((area) =>
    eventId === 'evt-gala-4' && area === 'seating' ? `${area}.read` : `${area}.manage`,
  );
}

/** The You milestones the needs* links seed, so every other state keeps the sample as it was. */
export function seeded(events: readonly Listed[], seed: NeedsSeed): Listed[] {
  return events.map((event) => {
    const owed = OWED.filter(
      (one) =>
        one.event === event.id &&
        !(seed === 'todayEmpty' && wallDay(one.at, event.timeZone) === TODAY),
    ).map((one): Milestone => ({
      at: one.at,
      title: one.title,
      note: null,
      owner: 'you',
      area: one.area,
      action: one.kitchen === true ? { label: KW.openSheet, link: kitchenAt(event.id) } : null,
    }));

    return {
      ...event,
      milestones: [...event.milestones, ...owed],
      permissions: heldOn(event.id, seed),
    };
  });
}

/** Only what needs you: Today's needsMe rows, each on its event's own day, in Today's dueOrder; across events a tie goes by the event's start, then its name, as the app's needOrder. */
export function needsDays(events: readonly Listed[], locale: string): Map<string, Item[]> {
  const days = new Map<string, MarkItem[]>();

  for (const event of events) {
    for (const milestone of event.milestones) {
      if (!needsMe(milestone, event.permissions ?? [])) continue;

      const day = wallDay(milestone.at, event.timeZone);

      days.set(day, [...(days.get(day) ?? []), { kind: 'milestone', event, milestone, day }]);
    }
  }

  const order = dueOrder(locale);
  const byName = new Intl.Collator(locale);
  const tie = (a: MarkItem, b: MarkItem) =>
    Date.parse(a.milestone.at) - Date.parse(b.milestone.at) ||
    Date.parse(a.event.startsAt) - Date.parse(b.event.startsAt) ||
    byName.compare(a.event.name, b.event.name) ||
    order(a.milestone, b.milestone);

  return new Map([...days].map(([day, items]) => [day, items.sort(tie)]));
}

export function daysFor(
  events: readonly Listed[],
  show: Show,
  locale: string,
): Map<string, Item[]> {
  return show === 'needs' ? needsDays(events, locale) : calendarDays(events, show);
}

export function isOverdue(milestone: Milestone, now: Date): boolean {
  return Date.parse(milestone.at) <= now.getTime();
}

/** Where Today and Agenda land under needs: the day asked for when it holds a row, else the month's next that does, else its last, else its empty line. */
export function needsLanding(days: ReadonlyMap<string, Item[]>, from: string): string {
  const month = monthOfDay(from);
  const held = agendaDays(month, days).map(({ day }) => day);

  return held.find((day) => day >= from) ?? held.at(-1) ?? firstOf(month);
}

export function needsLabel(item: MarkItem, locale: string, now: Date): string {
  const words = isOverdue(item.milestone, now) ? W.needsRowLabelOverdue : W.needsRowLabel;

  return words(
    item.milestone.title,
    item.event.name,
    timeOf(item.event, item.milestone.at, locale),
  );
}
