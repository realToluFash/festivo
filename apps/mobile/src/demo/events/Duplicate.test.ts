import { describe, expect, it } from 'vitest';

import {
  DUPLICATE_STATES,
  START_REFUSED,
  copyOf,
  duplicateStart,
  reduceDuplicate,
  startsAfter,
} from './Duplicate.ts';
import { EVENT_STATES } from './EventsModel.ts';
import { sampleEvent } from './EventsSample.ts';

const STARTS = { date: '2027-11-05', time: '15:00' };

describe('Duplicate’s states (sc-48601)', () => {
  it('are the opening state and the app’s five, all on the event’s page', () => {
    expect(DUPLICATE_STATES).toEqual([
      'duplicate',
      'duplicateCreating',
      'duplicateStartsBlank',
      'duplicateStartsRefused',
      'duplicateNotCreated',
      'duplicateCreated',
    ]);
    for (const state of DUPLICATE_STATES) expect(EVENT_STATES).toContain(state);
  });

  it('start a year on, on the same weekday and time', () => {
    expect(startsAfter({ date: '2026-11-06', time: '15:00' })).toEqual(STARTS);
  });

  it('seed each state', () => {
    expect(duplicateStart('duplicate', STARTS)).toEqual({
      starts: STARTS,
      status: 'editing',
      error: null,
      focus: null,
    });
    expect(duplicateStart('duplicateCreating', STARTS).status).toBe('creating');
    expect(duplicateStart('duplicateStartsBlank', STARTS)).toEqual({
      starts: { date: '', time: '' },
      status: 'editing',
      error: 'Choose when the copy starts.',
      focus: 'date',
    });
    expect(duplicateStart('duplicateStartsRefused', STARTS)).toMatchObject({
      starts: STARTS,
      error: START_REFUSED,
      focus: 'date',
    });
    expect(duplicateStart('duplicateNotCreated', STARTS).status).toBe('failed');
    expect(duplicateStart('duplicateCreated', STARTS).status).toBe('created');
  });
});

describe('Create draft', () => {
  it('refuses a half left empty without sending, focus on that half', () => {
    const run = { ...duplicateStart(null, STARTS), starts: { date: STARTS.date, time: '' } };
    expect(reduceDuplicate(run, { type: 'create' })).toMatchObject({
      status: 'editing',
      error: 'Choose the time the copy starts.',
      focus: 'time',
    });
  });

  it('clears the error once both halves are chosen, and Not created once anything is picked', () => {
    const blank = duplicateStart('duplicateStartsBlank', STARTS);
    const half = reduceDuplicate(blank, {
      type: 'picked',
      starts: { date: STARTS.date, time: '' },
    });
    expect(half.error).toBe('Choose when the copy starts.');
    expect(reduceDuplicate(half, { type: 'picked', starts: STARTS }).error).toBeNull();
    expect(
      reduceDuplicate(duplicateStart('duplicateNotCreated', STARTS), {
        type: 'picked',
        starts: STARTS,
      }).status,
    ).toBe('editing');
  });

  it('tries again after Not created, and ignores a press while it sends', () => {
    const creating = reduceDuplicate(duplicateStart('duplicateNotCreated', STARTS), {
      type: 'create',
    });
    expect(creating.status).toBe('creating');
    expect(reduceDuplicate(creating, { type: 'create' })).toBe(creating);
    expect(reduceDuplicate(creating, { type: 'created' }).status).toBe('created');
  });
});

describe('the copy', () => {
  it('is a draft with the same name, the chosen start, the original’s length and no hosts', () => {
    const wedding = sampleEvent('evt-wed-4');
    if (wedding == null) throw new Error('The sample has the wedding.');
    const copy = copyOf(wedding, '2027-11-05T15:00:00.000Z');
    expect(copy).toMatchObject({
      name: wedding.name,
      status: 'draft',
      hosts: [],
      startsAt: '2027-11-05T15:00:00.000Z',
      concludedAt: null,
    });
    expect(Date.parse(copy.endsAt) - Date.parse(copy.startsAt)).toBe(
      Date.parse(wedding.endsAt) - Date.parse(wedding.startsAt),
    );
  });
});
