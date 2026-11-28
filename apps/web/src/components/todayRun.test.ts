import type { Schedule, ScheduleItem } from '@soirely/api-client';
import i18next from 'i18next';
import { describe, expect, it } from 'vitest';

import { runNowOf } from './todayRun.ts';

const at = (time: string) => `2030-11-15T${time}:00+00:00`;

function item(
  id: string,
  title: string,
  time: string,
  more: Partial<ScheduleItem> = {},
): ScheduleItem {
  return {
    id,
    title,
    startsAt: at(time),
    startedAt: null,
    endedAt: null,
    skipped: false,
    course: null,
    courseNotice: false,
    day: '2030-11-15',
    lengthMinutes: null,
    place: null,
    ownerName: null,
    ownerRole: null,
    note: null,
    fixedTime: false,
    showToGuests: false,
    version: 1,
    ...more,
  };
}

function schedule(items: ScheduleItem[]): Schedule {
  return {
    timeZone: 'Europe/London',
    earliest: at('05:00'),
    latest: '2030-11-16T03:00:00+00:00',
    itemsMaximum: 200,
    items,
  };
}

const done = (id: string, title: string, time: string, ended: string) =>
  item(id, title, time, { lengthMinutes: 30, startedAt: at(time), endedAt: at(ended) });
const DINNER = done('it_dinner', 'Dinner is served', '18:00', '18:30');
const SPEECHES = item('it_speeches', 'Speeches', '18:30', {
  lengthMinutes: 20,
  startedAt: at('18:30'),
});
const DANCE = item('it_dance', 'First dance', '19:00', { lengthMinutes: 15 });

const t = i18next.getFixedT('en');
const words = (items: ScheduleItem[], time: string) =>
  runNowOf(schedule(items), new Date(`2030-11-15T${time}:00Z`), 'en-GB', t);

describe('Now’s words from the run of show (sc-61017)', () => {
  it('reads an item Now until its end, On time, with Next', () => {
    expect(words([DINNER, SPEECHES, DANCE], '18:40')).toMatchObject({
      headline: 'Speeches',
      until: 'until 18:50',
      untilSaid: null,
      figure: { words: 'On time', said: 'On time' },
      next: { time: '19:00', title: 'First dance' },
    });
  });

  it('reads the minutes over once past the end, in full to a screen reader, and how far behind Next runs', () => {
    expect(words([DINNER, SPEECHES, DANCE], '19:02')).toMatchObject({
      until: '12 min over',
      untilSaid: '12 minutes over',
      figure: { words: '2 min behind', said: '2 minutes behind' },
    });
  });

  it('has no until line for an item with no length', () => {
    const open = { ...SPEECHES, lengthMinutes: null };

    expect(words([DINNER, open, DANCE], '18:40')).toMatchObject({
      headline: 'Speeches',
      until: null,
    });
  });

  it('says Nothing is on between two items, with Next', () => {
    const spoken = { ...SPEECHES, endedAt: at('18:45') };

    expect(words([DINNER, spoken, DANCE], '18:50')).toMatchObject({
      headline: 'Nothing is on',
      until: null,
      next: { title: 'First dance' },
    });
  });

  it('says Last item under way with no Next while the last item is Now', () => {
    const spoken = { ...SPEECHES, endedAt: at('18:45') };
    const dancing = { ...DANCE, startedAt: at('19:00') };

    expect(words([DINNER, spoken, dancing], '19:05')).toMatchObject({
      headline: 'First dance',
      figure: { words: 'Last item under way' },
      next: null,
    });
  });

  it('says That’s everything. with no figure and no Next once every item is Done or Skipped', () => {
    const spoken = { ...SPEECHES, endedAt: at('18:45') };
    const skipped = { ...DANCE, skipped: true };

    expect(words([DINNER, spoken, skipped], '19:30')).toMatchObject({
      headline: 'That’s everything.',
      figure: null,
      next: null,
    });
  });

  it('is null on a day with no running order', () => {
    expect(words([], '18:40')).toBeNull();
  });

  it('says until with its article at one o’clock in Spanish and Portuguese', () => {
    const late = item('it_late', 'Last dance', '00:40', {
      day: '2030-11-15',
      startsAt: '2030-11-16T00:40:00+00:00',
      startedAt: '2030-11-16T00:40:00+00:00',
      lengthMinutes: 50,
    });
    const run = (lng: string, locale: string) =>
      runNowOf(schedule([late]), new Date('2030-11-16T00:50:00Z'), locale, i18next.getFixedT(lng));

    expect(run('es', 'es-ES')?.until).toBe('hasta la 01:30');
    expect(run('pt', 'pt-PT')?.until).toBe('até à 01:30');
  });
});
