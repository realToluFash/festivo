import { describe, expect, it } from 'vitest';

import {
  comingUp,
  markedMilestones,
  type Milestone,
  milestoneDistance,
  namesZone,
  nextUp,
} from './timeline.ts';

function milestone(at: string, title: string, owner: Milestone['owner'] = 'event'): Milestone {
  return { at, title, note: null, owner, area: 'events', action: null };
}

const KITCHEN = milestone('2026-10-12T12:00:00+02:00', 'Send final numbers to the kitchen', 'you');
const SEATING = milestone('2026-10-14T09:00:00+02:00', 'Seating locked', 'automatic');
const STARTS = milestone('2026-10-17T18:00:00+02:00', 'Boda starts');
const ENDS = milestone('2026-10-18T02:00:00+02:00', 'Boda ends');

describe('Next up', () => {
  it('is the earliest milestone at or after now, whatever order the areas gave', () => {
    expect(nextUp([ENDS, STARTS, SEATING], new Date('2026-10-15T00:00:00Z'))).toBe(STARTS);
  });

  it('is a milestone at the very instant it falls, and the next one an instant later', () => {
    const at = new Date(STARTS.at);

    expect(nextUp([STARTS, ENDS], at)).toBe(STARTS);
    expect(nextUp([STARTS, ENDS], new Date(at.getTime() + 1))).toBe(ENDS);
  });

  it('stays on an overdue "You" milestone until it is done', () => {
    const now = new Date('2026-10-15T00:00:00Z');

    expect(nextUp([STARTS, KITCHEN, SEATING], now)).toBe(KITCHEN);
    expect(nextUp([STARTS, SEATING], now)).toBe(STARTS);
  });

  it('is nothing once every milestone has passed', () => {
    expect(nextUp([STARTS, ENDS, SEATING], new Date('2026-10-19T00:00:00Z'))).toBeNull();
    expect(nextUp([], new Date())).toBeNull();
  });

  it('compares instants, so offsets from either side of a change of clocks sort as time does', () => {
    const before = milestone('2026-10-25T02:30:00+02:00', 'Before the clocks go back');
    const after = milestone('2026-10-25T02:15:00+01:00', 'After the clocks go back');

    expect(nextUp([after, before], new Date('2026-10-25T00:00:00Z'))).toBe(before);
    expect(markedMilestones([after, before], new Date(0)).map((one) => one.milestone)).toEqual([
      before,
      after,
    ]);
  });
});

describe('each milestone marked', () => {
  it('passes, is overdue, or is upcoming, with one Next up', () => {
    const marked = markedMilestones([STARTS, KITCHEN, SEATING], new Date('2026-10-15T00:00:00Z'));

    expect(
      marked.map(({ milestone, standing, nextUp }) => [milestone.title, standing, nextUp]),
    ).toEqual([
      ['Send final numbers to the kitchen', 'overdue', true],
      ['Seating locked', 'passed', false],
      ['Boda starts', 'upcoming', false],
    ]);
  });

  it('keeps the areas’ order for two at the same instant', () => {
    const balance = milestone(ENDS.at, 'Balance due', 'you');

    expect(markedMilestones([ENDS, balance], new Date(0)).map((one) => one.milestone)).toEqual([
      ENDS,
      balance,
    ]);
  });

  it('marks everything passed and nothing Next up once the event is over', () => {
    const marked = markedMilestones([STARTS, ENDS], new Date('2026-10-19T00:00:00Z'));

    expect(marked.every((one) => one.standing === 'passed' && !one.nextUp)).toBe(true);
  });
});

describe('Coming up', () => {
  const many = [1, 2, 3, 4, 5, 6].map((day) =>
    milestone(`2026-11-0${day}T12:00:00Z`, `Day ${day}`),
  );

  it('shows the next four from Next up on', () => {
    expect(
      comingUp(many, new Date('2026-11-01T13:00:00Z')).map((one) => one.milestone.title),
    ).toEqual(['Day 2', 'Day 3', 'Day 4', 'Day 5']);
  });

  it('carries an overdue "You" milestone, and shows nothing once everything has passed', () => {
    expect(
      comingUp([KITCHEN, STARTS], new Date('2026-10-15T00:00:00Z')).map((one) => one.milestone),
    ).toEqual([KITCHEN, STARTS]);
    expect(comingUp(many, new Date('2026-12-01T00:00:00Z'))).toEqual([]);
  });
});

describe('how far away', () => {
  const zone = 'Europe/Madrid';

  it('counts calendar dates in the event’s zone', () => {
    expect(milestoneDistance(STARTS.at, zone, new Date('2026-10-11T21:59:00Z'))).toEqual({
      kind: 'inDays',
      count: 6,
    });
    expect(milestoneDistance(STARTS.at, zone, new Date('2026-10-16T22:30:00Z'))).toEqual({
      kind: 'today',
    });
  });

  it('is now from the milestone’s instant until its date turns over', () => {
    expect(milestoneDistance(STARTS.at, zone, new Date(STARTS.at))).toEqual({ kind: 'now' });
    expect(milestoneDistance(STARTS.at, zone, new Date('2026-10-17T21:59:00Z'))).toEqual({
      kind: 'now',
    });
  });

  it('counts days ago for an overdue one', () => {
    expect(milestoneDistance(KITCHEN.at, zone, new Date('2026-10-15T08:00:00Z'))).toEqual({
      kind: 'daysAgo',
      count: 3,
    });
  });

  it('counts a span across a change of clocks as the dates it covers', () => {
    expect(
      milestoneDistance('2026-10-26T10:00:00+01:00', zone, new Date('2026-10-24T10:00:00+02:00')),
    ).toEqual({ kind: 'inDays', count: 2 });
  });
});

describe('naming the zone', () => {
  it('names it only when the reader is somewhere else', () => {
    expect(namesZone('Europe/Madrid', 'Africa/Lagos')).toBe(true);
    expect(namesZone('Europe/Madrid', 'Europe/Madrid')).toBe(false);
  });
});
