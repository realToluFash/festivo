import { describe, expect, it } from 'vitest';

import { type EventDraft, eventNameLength, eventProblems, filledEndDate } from './events.ts';

const DRAFT: EventDraft = {
  name: 'Adaeze and Tunde',
  startDate: '2026-11-14',
  startTime: '16:00',
  endDate: '2026-11-15',
  endTime: '02:00',
};

describe('the new event form', () => {
  it('accepts a named event that ends after it starts', () => {
    expect(eventProblems(DRAFT)).toEqual([]);
  });

  it('refuses a blank name, spaces included', () => {
    expect(eventProblems({ ...DRAFT, name: '   ' })).toEqual([
      { field: 'name', problem: 'nameBlank' },
    ]);
  });

  it('counts the name after trimming, up to 120 characters', () => {
    expect(eventProblems({ ...DRAFT, name: ` ${'x'.repeat(120)} ` })).toEqual([]);
    expect(eventProblems({ ...DRAFT, name: 'x'.repeat(121) })).toEqual([
      { field: 'name', problem: 'nameTooLong' },
    ]);
    expect(eventNameLength('  Ìrè 🎉  ')).toBe(5);
  });

  it('says which of the start and the end is missing, a date or a time alone included', () => {
    expect(eventProblems({ ...DRAFT, startTime: '' })).toEqual([
      { field: 'startsAt', problem: 'startMissing' },
    ]);
    expect(eventProblems({ ...DRAFT, endDate: '' })).toEqual([
      { field: 'endsAt', problem: 'endMissing' },
    ]);
  });

  it('refuses an end before the start and accepts one equal to it', () => {
    expect(eventProblems({ ...DRAFT, endDate: '2026-11-14', endTime: '15:59' })).toEqual([
      { field: 'endsAt', problem: 'endBeforeStart' },
    ]);
    expect(eventProblems({ ...DRAFT, endDate: '2026-11-14', endTime: '16:00' })).toEqual([]);
  });

  it('lists every problem at once, in the order of the fields', () => {
    expect(
      eventProblems({ name: '', startDate: '', startTime: '', endDate: '', endTime: '' }).map(
        ({ field }) => field,
      ),
    ).toEqual(['name', 'startsAt', 'endsAt']);
  });
});

describe('the end date', () => {
  it('takes the start date while it is empty, and keeps one already chosen', () => {
    expect(filledEndDate('2026-11-14', '')).toBe('2026-11-14');
    expect(filledEndDate('2026-11-14', '2026-11-16')).toBe('2026-11-16');
  });
});
