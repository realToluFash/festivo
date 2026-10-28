export const MILESTONE_OWNERS = ['event', 'you', 'automatic'] as const;

export type MilestoneOwner = (typeof MILESTONE_OWNERS)[number];

export interface Milestone {
  at: string;
  title: string;
  note: string | null;
  owner: MilestoneOwner;
  area: string;
  action: { label: string; link: string } | null;
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

/** The earliest at or after `now`; an overdue "You" milestone is undone while its area returns it, so it stays. */
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

export function namesZone(eventZone: string, readerZone: string): boolean {
  return canonicalZone(eventZone) !== canonicalZone(readerZone);
}

const EVENT_AREA = 'events';

const DAY = 24 * 60 * 60 * 1000;

/** An Ended event's own milestones have passed by its state, not by a clock that reads whole seconds while its end is stamped to the second (sc-16709). */
function standingOf(milestone: Milestone, now: Date, ended: boolean): MilestoneStanding {
  if (ended && milestone.area === EVENT_AREA) return 'passed';
  if (new Date(milestone.at).getTime() >= now.getTime()) return 'upcoming';

  return milestone.owner === 'you' ? 'overdue' : 'passed';
}

function earliestFirst(milestones: readonly Milestone[]): Milestone[] {
  return milestones
    .map((milestone, index) => ({ milestone, index, time: new Date(milestone.at).getTime() }))
    .sort((a, b) => a.time - b.time || a.index - b.index)
    .map(({ milestone }) => milestone);
}

function dayNumber(moment: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(moment);
  const part = (type: string) => Number(parts.find((one) => one.type === type)?.value);

  return Date.UTC(part('year'), part('month') - 1, part('day'));
}

function canonicalZone(zone: string): string {
  try {
    return new Intl.DateTimeFormat('en', { timeZone: zone }).resolvedOptions().timeZone;
  } catch {
    return zone;
  }
}
