import { type Milestone, levelOf, milestoneDistance, wallDay } from '@soirely/domain';

import type { Need, ShownEvent } from '../../kit/today.ts';

export interface YouEvent {
  shown: ShownEvent;
  startsAt: string;
  timeZone: string;
  permissions: readonly string[];
  milestones: readonly Milestone[];
}

/** The reader's own milestone, in an area their role changes on this event. */
export function isYours(
  { owner, area }: Pick<Milestone, 'owner' | 'area'>,
  permissions: readonly string[],
): boolean {
  return owner === 'you' && levelOf(permissions, area) === 'change';
}

/** Calendar days in the event's zone. `day` writes a wall day the reader's way, with the year when today's is another. */
export function dueOf(
  at: string,
  timeZone: string,
  now: Date,
  day: (date: string, withYear: boolean) => string,
): { words: string; late: boolean } {
  const distance = milestoneDistance(at, timeZone, now);
  const dueDay = wallDay(at, timeZone);

  switch (distance.kind) {
    case 'now':
      return { words: 'Overdue', late: true };
    case 'daysAgo':
      return {
        words: distance.count === 1 ? '1 day overdue' : `${distance.count} days overdue`,
        late: true,
      };
    case 'today':
      return { words: 'Due today', late: false };
    case 'inDays':
      return {
        words:
          distance.count === 1
            ? 'Due tomorrow'
            : `Due ${day(dueDay, dueDay.slice(0, 4) !== wallDay(now, timeZone).slice(0, 4))}`,
        late: false,
      };
  }
}

/** The You milestones the reader can act on, earliest first; a tie goes by the event's start, then its name. */
export function needsOf(
  events: readonly YouEvent[],
  now: Date,
  day: (date: string, withYear: boolean) => string,
): Need[] {
  return events
    .flatMap((event) =>
      event.milestones
        .filter((milestone) => isYours(milestone, event.permissions))
        .map((milestone) => ({ event, milestone })),
    )
    .sort(
      (a, b) =>
        Date.parse(a.milestone.at) - Date.parse(b.milestone.at) ||
        Date.parse(a.event.startsAt) - Date.parse(b.event.startsAt) ||
        a.event.shown.name.localeCompare(b.event.shown.name),
    )
    .map(({ event, milestone }) => {
      const { words, late } = dueOf(milestone.at, event.timeZone, now, day);

      // The kit's Need asks for an action, and no row in the app has one (sc-3914): NeedsYou never reads it.
      return { event: event.shown, title: milestone.title, due: words, late, action: '' };
    });
}

export function headLabel(count: number): string {
  return count === 1 ? 'Needs you, 1 thing' : `Needs you, ${count} things`;
}

export function rowLabel({ title, event, due }: Pick<Need, 'title' | 'event' | 'due'>): string {
  return `${title}, ${event.name}, ${due}`;
}
