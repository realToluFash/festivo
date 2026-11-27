import { dayDate, wallDay } from './calendar.ts';
import { type EventState, eventPhase } from './eventStates.ts';
import { levelOf } from './roles.ts';

export const MILESTONE_OWNERS = ['event', 'you', 'automatic'] as const;

export type MilestoneOwner = (typeof MILESTONE_OWNERS)[number];

export interface Milestone {
  at: string;
  title: string;
  note: string | null;
  owner: MilestoneOwner;
  area: string;
  action: { label: string; link: string } | null;
  /** A "You" milestone its area has seen through: passed, never overdue (sc-4022). */
  done?: boolean;
}

export interface EventTimeline {
  timeZone: string;
  milestones: Milestone[];
}

export type MilestoneStanding = 'passed' | 'overdue' | 'upcoming';

export interface MarkedMilestone {
  milestone: Milestone;
  standing: MilestoneStanding;
  nextUp: boolean;
}

/** The earliest at or after `now`; an overdue "You" milestone stays until its area marks it done or stops returning it. */
export function nextUp(
  milestones: readonly Milestone[],
  now: Date,
  ended = false,
): Milestone | null {
  const sorted = earliestFirst(milestones);

  return sorted.find((milestone) => standingOf(milestone, now, ended) !== 'passed') ?? null;
}

export function markedMilestones(
  milestones: readonly Milestone[],
  now: Date,
  ended = false,
): MarkedMilestone[] {
  const next = nextUp(milestones, now, ended);

  return earliestFirst(milestones).map((milestone) => ({
    milestone,
    standing: standingOf(milestone, now, ended),
    nextUp: milestone === next,
  }));
}

export function comingUp(
  milestones: readonly Milestone[],
  now: Date,
  ended = false,
  count = 4,
): MarkedMilestone[] {
  return markedMilestones(milestones, now, ended)
    .filter((marked) => marked.standing !== 'passed')
    .slice(0, count);
}

export type MilestoneDistance =
  | { kind: 'now' }
  | { kind: 'today' }
  | { kind: 'inDays'; count: number }
  | { kind: 'daysAgo'; count: number };

/** Counted in calendar dates in the event's zone, where its date is read. */
export function milestoneDistance(at: string, timeZone: string, now: Date): MilestoneDistance {
  const moment = new Date(at);
  const days = Math.round((dayNumber(moment, timeZone) - dayNumber(now, timeZone)) / DAY);

  if (days > 0) return { kind: 'inDays', count: days };
  if (days < 0) return { kind: 'daysAgo', count: -days };

  return moment.getTime() <= now.getTime() ? { kind: 'now' } : { kind: 'today' };
}

/** The reader's own milestone, still to do, in an area their role changes on this event. */
export function isYours(
  { owner, area, done }: Pick<Milestone, 'owner' | 'area' | 'done'>,
  permissions: readonly string[],
): boolean {
  return owner === 'you' && done !== true && levelOf(permissions, area) === 'change';
}

/** A row of Needs you: the reader's own milestone, on an event that has not finished (sc-61015). A Finished event needs nothing; its areas keep their milestones as the event's record. */
export function isNeed(
  milestone: Pick<Milestone, 'owner' | 'area' | 'done'>,
  event: { permissions: readonly string[]; status: EventState; startsAt: string; endsAt: string },
  now: Date,
): boolean {
  return eventPhase(event, now) !== 'finished' && isYours(milestone, event.permissions);
}

export interface NeedKey {
  at: string;
  title: string;
  startsAt: string;
  name: string;
}

/** Earliest first; a tie goes by the event's start, then its name, then the milestone's title, in the reader's language. */
export function needOrder(a: NeedKey, b: NeedKey): number {
  return (
    Date.parse(a.at) - Date.parse(b.at) ||
    Date.parse(a.startsAt) - Date.parse(b.startsAt) ||
    a.name.localeCompare(b.name) ||
    a.title.localeCompare(b.title)
  );
}

export type NeedDue =
  | { kind: 'overdue'; late: true }
  | { kind: 'overdueDays'; late: true; count: number }
  | { kind: 'dueToday'; late: false }
  | { kind: 'dueTomorrow'; late: false }
  | { kind: 'dueOn'; late: false; day: string; withYear: boolean };

/** How a milestone's due reads, in calendar days in the event's zone: a date carries its year only when its day falls in another year than today (sc-29884). Each client words it in its own keys. */
export function needDue(at: string, timeZone: string, now: Date): NeedDue {
  const distance = milestoneDistance(at, timeZone, now);

  switch (distance.kind) {
    case 'now':
      return { kind: 'overdue', late: true };
    case 'daysAgo':
      return { kind: 'overdueDays', late: true, count: distance.count };
    case 'today':
      return { kind: 'dueToday', late: false };
    case 'inDays': {
      if (distance.count === 1) return { kind: 'dueTomorrow', late: false };

      const day = wallDay(at, timeZone);

      return {
        kind: 'dueOn',
        late: false,
        day,
        withYear: day.slice(0, 4) !== wallDay(now, timeZone).slice(0, 4),
      };
    }
  }
}

export function namesZone(eventZone: string, readerZone: string): boolean {
  return canonicalZone(eventZone) !== canonicalZone(readerZone);
}

const EVENT_AREA = 'events';

const DAY = 24 * 60 * 60 * 1000;

/** An Ended event's own milestones have passed by its state, not by a clock that reads whole seconds while its end is stamped to the second (sc-16709). */
function standingOf(milestone: Milestone, now: Date, ended: boolean): MilestoneStanding {
  if (ended && milestone.area === EVENT_AREA) return 'passed';
  if (new Date(milestone.at).getTime() >= now.getTime()) return 'upcoming';

  return milestone.owner === 'you' && milestone.done !== true ? 'overdue' : 'passed';
}

function earliestFirst(milestones: readonly Milestone[]): Milestone[] {
  return milestones
    .map((milestone, index) => ({ milestone, index, time: new Date(milestone.at).getTime() }))
    .sort((a, b) => a.time - b.time || a.index - b.index)
    .map(({ milestone }) => milestone);
}

function dayNumber(moment: Date, timeZone: string): number {
  return dayDate(wallDay(moment, timeZone)).getTime();
}

function canonicalZone(zone: string): string {
  try {
    return new Intl.DateTimeFormat('en', { timeZone: zone }).resolvedOptions().timeZone;
  } catch {
    return zone;
  }
}
