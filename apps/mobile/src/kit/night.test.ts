import {
  ApiError,
  ERROR_TYPE_PREFIX,
  type QueuedPress,
  type Schedule,
  type ScheduleItem,
  withPresses,
} from '@soirely/api-client';
import { nightDayOf, nightTracks, nightView } from '@soirely/domain';
import { init, t } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';

import {
  clockOf,
  elapsedWords,
  endNowFor,
  endWords,
  headerWords,
  isUnreachable,
  lostWords,
  nextTimes,
  nightItemsOf,
  pressLabels,
  pressSaid,
  rowWords,
  startAction,
  subWords,
  trackLabel,
} from './night.ts';

beforeAll(() =>
  init({
    lng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  }),
);

const ZONE = 'Europe/London';
const at = (wall: string) => `${wall}:00+00:00`;

function item(
  id: string,
  title: string,
  planned: string,
  length: number | null,
  marks: Partial<Pick<ScheduleItem, 'startedAt' | 'endedAt' | 'skipped' | 'place'>> = {},
): ScheduleItem {
  return {
    id,
    title,
    startsAt: at(planned),
    startedAt: marks.startedAt == null ? null : at(marks.startedAt),
    endedAt: marks.endedAt == null ? null : at(marks.endedAt),
    skipped: marks.skipped ?? false,
    day: planned.slice(0, 10),
    lengthMinutes: length,
    place: marks.place ?? 'Ballroom',
    ownerName: id === 'dance' ? null : 'Ifeoma Nduka',
    ownerRole: null,
    note: null,
    fixedTime: false,
    showToGuests: false,
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

const speeches = (marks = {}) => item('speeches', 'Speeches', '2030-11-15T19:45', 40, marks);
const dance = (marks = {}) => item('dance', 'First dance', '2030-11-15T20:30', 15, marks);
const cake = (marks = {}) => item('cake', 'Cake cutting', '2030-11-15T20:45', 20, marks);

function viewOf(items: ScheduleItem[], now: string) {
  const track = nightTracks(nightItemsOf(schedule(items)), at(now))[0];

  if (track == null) throw new Error('no track');

  return nightView(track, at(now), ZONE);
}

const press = (itemId: string, kind: QueuedPress['kind'], pressedAt: string): QueuedPress => ({
  key: `${itemId}-${kind}`,
  eventId: 'evt-1',
  itemId,
  kind,
  title: itemId,
  pressedAt: at(pressedAt),
});

describe('what the screen offers', () => {
  it('says Finish the current item first while something is on, and Start now when nothing is', () => {
    expect(
      startAction(
        viewOf([speeches({ startedAt: '2030-11-15T19:50' }), dance()], '2030-11-15T20:02'),
        true,
      ),
    ).toBe('finishFirst');
    expect(
      startAction(
        viewOf(
          [speeches({ startedAt: '2030-11-15T19:50', endedAt: '2030-11-15T20:28' }), dance()],
          '2030-11-15T20:29',
        ),
        true,
      ),
    ).toBe('startNow');
  });

  it('offers no press to somebody who can only follow the night', () => {
    expect(startAction(viewOf([speeches(), dance()], '2030-11-15T19:40'), false)).toBe('none');
  });

  it('names the item in every press’s label', () => {
    expect(pressLabels('Speeches', t)).toEqual({
      done: 'Done: Speeches',
      skip: 'Skip: Speeches',
      startNow: 'Start now: Speeches',
      move: 'Move: Speeches',
    });
  });
});

describe('the words on the cards', () => {
  it('reads a Next running late as the planned time and about the expected one', () => {
    const view = viewOf([speeches({ startedAt: '2030-11-15T20:02' }), dance()], '2030-11-15T20:20');

    expect(nextTimes(view.next!, 'en-US', t)).toEqual({
      planned: '20:30',
      about: 'about 20:42',
      said: '20:30, about 20:42',
    });
    expect(headerWords(view.header, t)).toBe('12 min behind');
    expect(subWords(view, 'en-US', t)).toBe('0 of 2 done · ends about 20:57');
  });

  it('counts elapsed minutes, then the minutes over in words', () => {
    expect(elapsedWords({ minutes: 12, over: 0, share: 0.3 }, t)).toBe('12 min');
    expect(elapsedWords({ minutes: 44, over: 4, share: 1 }, t)).toBe('+4 min over');
  });

  it('marks Later rows Done with their start, Skipped with no time, Not started with the expected time', () => {
    const view = viewOf(
      [
        speeches({ startedAt: '2030-11-15T19:50' }),
        dance(),
        cake({ startedAt: '2030-11-15T19:00', endedAt: '2030-11-15T19:10' }),
        item('set', 'The band’s first set', '2030-11-15T21:05', 60, { skipped: true }),
        item('toss', 'Bouquet toss', '2030-11-15T22:05', 10),
      ],
      '2030-11-15T20:02',
    );

    expect(view.later.map((row) => rowWords(row, 'en-US', t))).toEqual([
      'Done · started 19:00',
      'Skipped',
      'Not started · 22:05',
    ]);
  });

  it('names a track of an earlier day by its weekday', () => {
    const [track] = nightTracks(
      nightItemsOf(
        schedule([
          item('bar', 'Late bar', '2030-11-15T23:30', 60, {
            place: 'Foyer',
            startedAt: '2030-11-15T23:30',
          }),
        ]),
      ),
      at('2030-11-16T09:10'),
    );

    expect(trackLabel(track!, nightDayOf(at('2030-11-16T09:10')), 'en-GB', t)).toBe(
      'Foyer · Friday',
    );
  });

  it('writes every time on the 24-hour clock, en-US too', () => {
    expect(clockOf(at('2030-11-15T21:50'), 'en-US')).toBe('21:50');
  });
});

describe('the end of the night', () => {
  const ran = (ended: string) =>
    viewOf(
      [
        speeches({ startedAt: '2030-11-15T19:45', endedAt: '2030-11-15T20:25' }),
        dance({ startedAt: '2030-11-15T20:30', endedAt: ended }),
      ],
      '2030-11-15T23:00',
    ).end!;

  it('says how far behind or ahead of plan, or on plan, with the line it was worked out from', () => {
    expect(endWords(ran('2030-11-15T20:57'), 'en-US', t)).toEqual({
      sentence: 'Finished 12 min behind plan.',
      workedOut: 'Last item finished at 20:57, planned to finish at 20:45.',
    });
    expect(endWords(ran('2030-11-15T20:44'), 'en-US', t).sentence).toBe(
      'Finished 1 min ahead of plan.',
    );
    expect(endWords(ran('2030-11-15T20:45'), 'en-US', t).sentence).toBe('Finished on plan.');
  });

  it('has no sentence and no line for a track whose items were all skipped', () => {
    const view = viewOf(
      [speeches({ skipped: true }), dance({ skipped: true })],
      '2030-11-15T23:00',
    );

    expect(endWords(view.end!, 'en-US', t)).toEqual({ sentence: null, workedOut: null });
  });

  const skipped = nightItemsOf(schedule([speeches({ skipped: true }), dance({ skipped: true })]));
  const manager = { permissions: ['run_of_show.manage', 'events.manage'] };

  it('links to End now once everything is finished, all-skipped tracks included', () => {
    expect(endNowFor(skipped, at('2030-11-15T23:00'), manager, true)).toBe(true);
  });

  it('keeps End now from somebody without events.manage, and from an event not happening', () => {
    expect(
      endNowFor(skipped, at('2030-11-15T23:00'), { permissions: ['run_of_show.manage'] }, true),
    ).toBe(false);
    expect(endNowFor(skipped, at('2030-11-15T23:00'), manager, false)).toBe(false);
  });

  it('keeps End now away while another track is still running', () => {
    const items = nightItemsOf(
      schedule([
        speeches({ skipped: true }),
        item('bar', 'Late bar', '2030-11-15T22:30', 60, {
          place: 'Foyer',
          startedAt: '2030-11-15T22:30',
        }),
      ]),
    );

    expect(endNowFor(items, at('2030-11-15T23:00'), manager, true)).toBe(false);
  });
});

describe('what the live region reads, and the losing replay', () => {
  it('reads a Done with what is next, and a Start and a Skip by name', () => {
    const night = schedule([speeches({ startedAt: '2030-11-15T19:50' }), dance(), cake()]);
    const [track] = nightTracks(nightItemsOf(night), at('2030-11-15T20:28'));
    const done = { ...press('speeches', 'done', '2030-11-15T20:28'), title: 'Speeches' };

    expect(pressSaid(done, withPresses(night, [done]), track!.key, at('2030-11-15T20:28'), t)).toBe(
      'Speeches done. Next: First dance.',
    );
    expect(
      pressSaid({ kind: 'start', itemId: 'dance', title: 'First dance' }, night, '', '', t),
    ).toBe('First dance started.');
    expect(
      pressSaid({ kind: 'skip', itemId: 'cake', title: 'Cake cutting' }, night, '', '', t),
    ).toBe('Cake cutting skipped.');
  });

  it('says who started it first, at what time in the event’s zone', () => {
    expect(
      lostWords(
        {
          title: 'First dance',
          by: { name: 'Ifeoma Nduka', at: '2030-11-15T20:31:00Z' },
          said: 'This item has already started.',
        },
        ZONE,
        'en-US',
        t,
      ),
    ).toBe('Already started by Ifeoma Nduka at 20:31.');
  });

  it('says the refusal’s own words when it names nobody', () => {
    expect(
      lostWords(
        {
          title: 'First dance',
          by: null,
          said: 'This item has not started yet, so it cannot be done.',
        },
        ZONE,
        'en-US',
        t,
      ),
    ).toBe('This item has not started yet, so it cannot be done.');
  });

  it('keeps a press for a network error or a failing server, not for a refusal', () => {
    const refusal = (status: number) =>
      new ApiError({ type: `${ERROR_TYPE_PREFIX}track_busy`, title: 'Busy', status });

    expect(isUnreachable(new TypeError('Network request failed'))).toBe(true);
    expect(isUnreachable(refusal(503))).toBe(true);
    expect(isUnreachable(refusal(409))).toBe(false);
  });
});
