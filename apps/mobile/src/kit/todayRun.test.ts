import type { Schedule, ScheduleItem } from '@soirely/api-client';
import { init, t } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';

import { runNowOf, runScheduleFor } from './todayRun.ts';

beforeAll(() =>
  init({
    lng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  }),
);

const ZONE = 'Europe/London';
const NAME = 'Adaeze & Tunde’s wedding';
const at = (wall: string) => `${wall}:00+00:00`;
const moment = (wall: string) => new Date(at(wall));

function item(
  title: string,
  planned: string,
  length: number | null,
  marks: Partial<Pick<ScheduleItem, 'startedAt' | 'endedAt' | 'skipped'>> = {},
): ScheduleItem {
  return {
    id: title,
    title,
    startsAt: at(`2030-11-15T${planned}`),
    startedAt: marks.startedAt == null ? null : at(`2030-11-15T${marks.startedAt}`),
    endedAt: marks.endedAt == null ? null : at(`2030-11-15T${marks.endedAt}`),
    skipped: marks.skipped ?? false,
    day: '2030-11-15',
    lengthMinutes: length,
    place: 'Ballroom',
    ownerName: null,
    ownerRole: null,
    note: null,
    fixedTime: false,
    showToGuests: false,
    course: null,
    courseNotice: false,
    version: 1,
  };
}

const schedule = (items: ScheduleItem[]): Schedule => ({
  timeZone: ZONE,
  earliest: at('2030-11-15T06:00'),
  latest: at('2030-11-16T02:00'),
  itemsMaximum: 200,
  items,
});

const photos = item('Photos', '15:00', 45, { startedAt: '15:00', endedAt: '15:50' });
const drinks = (marks = {}) => item('Drinks reception', '16:00', 80, marks);
const seats = (marks = {}) => item('Guests take their seats', '17:20', 40, marks);
const speeches = (marks = {}) => item('Speeches', '18:00', null, marks);

const nowAt = (items: ScheduleItem[], wall: string) =>
  runNowOf(NAME, schedule(items), moment(`2030-11-15T${wall}`), 'en-GB', t);

describe('Today’s Now in words (sc-29875)', () => {
  it('an item Now: its title, until when, the figure and Next’s expected start', () => {
    const run = nowAt([photos, drinks({ startedAt: '16:10' }), seats()], '16:40');

    expect(run).toMatchObject({
      happening: true,
      headline: 'Drinks reception',
      until: 'until 17:30',
      figure: { words: '10 min behind', said: '10 minutes behind' },
      next: { time: '17:30', title: 'Guests take their seats' },
      band: 'Now · Drinks reception, until 17:30',
      track: '2030-11-15|Ballroom',
    });
  });

  it('over its length: whole minutes over, said in full, and on the band', () => {
    const run = nowAt([photos, drinks({ startedAt: '16:10' }), seats()], '17:42');

    expect(run?.until).toBe('12 min over');
    expect(run?.untilSaid).toBe('12 minutes over');
    expect(run?.figure?.words).toBe('22 min behind');
    expect(run?.band).toBe('Now · Drinks reception, 12 min over');
  });

  it('an item with no length: no until line, and the band names it alone', () => {
    const run = nowAt(
      [photos, speeches({ startedAt: '18:05' }), item('Cake', '21:00', 15)],
      '20:00',
    );

    expect(run?.until).toBeNull();
    expect(run?.band).toBe('Now · Speeches');
  });

  it('between two items: Nothing is on, with Next and the figure, and the band stays Live', () => {
    const run = nowAt([photos, drinks({ startedAt: '16:00', endedAt: '17:15' }), seats()], '17:18');

    expect(run).toMatchObject({
      happening: false,
      headline: 'Nothing is on',
      until: null,
      figure: { words: 'On time' },
      next: { title: 'Guests take their seats' },
      band: `Live · ${NAME}`,
    });
  });

  it('the last item Now: no Next, and Last item under way', () => {
    const run = nowAt([photos, drinks({ startedAt: '16:00' })], '16:30');

    expect(run?.next).toBeNull();
    expect(run?.figure?.words).toBe('Last item under way');
  });

  it('every item done: That’s everything., with no Next and no figure', () => {
    const run = nowAt([photos, drinks({ startedAt: '16:00', endedAt: '17:15' })], '18:00');

    expect(run).toMatchObject({ headline: 'That’s everything.', figure: null, next: null });
  });

  it('reads the rail as one line of times, whole titles and states, leaving a skipped item off', () => {
    const run = nowAt(
      [
        photos,
        item('Confetti walk', '15:45', 15, { skipped: true }),
        drinks({ startedAt: '16:10' }),
        seats(),
      ],
      '16:40',
    );

    expect(run?.railSaid).toBe(
      '15:00 Photos, done; 16:00 Drinks reception, now; 17:20 Guests take their seats, next',
    );
  });

  it('is null on a day with no running order', () => {
    expect(nowAt([], '16:00')).toBeNull();
  });
});

describe('runScheduleFor', () => {
  it('reads the running order for a role that holds run_of_show.read', () => {
    expect(runScheduleFor({ id: 'evt-1', permissions: ['events.read', 'run_of_show.read'] })).toBe(
      'evt-1',
    );
  });

  it('reads nothing for a role without run_of_show.read, so Now stays sc-29090’s', () => {
    expect(runScheduleFor({ id: 'evt-1', permissions: ['events.read'] })).toBeNull();
  });

  it('reads nothing with no event under way', () => {
    expect(runScheduleFor(null)).toBeNull();
  });
});
