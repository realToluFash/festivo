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

export interface NeedKey {
  at: string;
  title: string;
  startsAt: string;
  name: string;
}

/** Earliest first; a tie goes by the event's start, then its name, then the milestone's title, in the reader's language. Today's Needs you and the Calendar's Only what needs you both order by it. */
export function needOrder(a: NeedKey, b: NeedKey): number {
  return (
    Date.parse(a.at) - Date.parse(b.at) ||
    Date.parse(a.startsAt) - Date.parse(b.startsAt) ||
    a.name.localeCompare(b.name) ||
    a.title.localeCompare(b.title)
  );
}

function keyOf({ event, milestone }: { event: YouEvent; milestone: Milestone }): NeedKey {
  return {
    at: milestone.at,
    title: milestone.title,
    startsAt: event.startsAt,
    name: event.shown.name,
  };
}

/** The You milestones the reader can act on, in needOrder. */
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
    .sort((a, b) => needOrder(keyOf(a), keyOf(b)))
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
