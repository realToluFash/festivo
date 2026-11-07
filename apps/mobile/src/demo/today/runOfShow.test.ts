import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';

import en from '../../i18n/locales/en.json';
import { momentOf, sayIn } from '../today.ts';
import { COUNTS, figureOf } from './arrived.ts';
import {
  LONG_TITLE,
  RAIL_STOPS,
  type RunItem,
  railLabels,
  railWindow,
  runNowOf,
  trackAt,
  withRun,
} from './runOfShow.ts';

const us = sayIn('en-US');
const NAME = 'Adaeze & Tunde’s wedding';
const nowAt = (state: Parameters<typeof trackAt>[0]) => {
  const { clock, items } = trackAt(state);

  return runNowOf(NAME, items, clock, us);
};

describe('the rail’s six, on a track of ten', () => {
  const ten = Array.from({ length: 10 }, (_, index) => index + 1);

  it('starts at the item before Now', () => {
    expect(railWindow(ten, 3)).toEqual([3, 4, 5, 6, 7, 8]);
  });

  it('fills from earlier items near the end', () => {
    expect(railWindow(ten, 8)).toEqual([5, 6, 7, 8, 9, 10]);
  });

  it('starts at the first when the first is Now', () => {
    expect(railWindow(ten, 0)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('shows the last six when everything is done', () => {
    expect(railWindow(ten, 10)).toEqual([5, 6, 7, 8, 9, 10]);
  });

  it('shows a track of six or fewer whole', () => {
    expect(railWindow([1, 2, 3, 4], 2)).toEqual([1, 2, 3, 4]);
  });
});

describe('the rail’s labels', () => {
  const ends = (box: { left: number; width: number }) => box.left + box.width;

  it.each([327, 345, 682, 1000])('never share space on a rail %d pt wide', (width) => {
    for (let count = 1; count <= RAIL_STOPS; count += 1) {
      const boxes = railLabels(count, width, 64, 4);

      expect(boxes[0]?.left).toBeCloseTo(0);
      expect(ends(boxes.at(-1) ?? { left: 0, width: 0 })).toBeLessThanOrEqual(width + 0.001);
      boxes.slice(1).forEach((box, index) => {
        expect(box.left - ends(boxes[index] ?? box)).toBeGreaterThanOrEqual(4 - 0.001);
      });
    }
  });

  it('gives each of six about 51 pt on an iPhone SE, and 64 pt where there is room', () => {
    expect(railLabels(6, 327, 64, 4)[2]?.width).toBeCloseTo(51.2, 1);
    expect(railLabels(6, 682, 64, 4).map(({ width }) => width)).toEqual(Array(6).fill(64));
  });

  it('centres a middle label on its stop where there is room', () => {
    const box = railLabels(6, 682, 64, 4)[2];

    expect((box?.left ?? 0) + 32).toBeCloseTo((682 / 5) * 2);
  });
});

describe('an item is Now', () => {
  const on = nowAt('on');

  it('says until its actual start plus its length, and the figure from Next', () => {
    expect([on.headline, on.until, on.figure?.words]).toEqual([
      'Drinks reception',
      'until 17:30',
      '10 min behind',
    ]);
    expect(on.figure?.said).toBe('10 minutes behind');
    expect(on.next).toEqual({ time: '17:30', title: 'Guests take their seats' });
    expect(on.band).toBe('Now · Drinks reception, until 17:30');
  });

  it('leaves the skipped item off the rail, and starts it at the item before Now', () => {
    expect(on.rail.map(({ title, state }) => [title, state])).toEqual([
      ['Photos', 'done'],
      ['Drinks reception', 'now'],
      ['Guests take their seats', 'next'],
      ['Dinner is served', 'later'],
      ['Speeches', 'later'],
      ['Cake cutting', 'later'],
    ]);
  });

  it('reads the rail as one line, each stop with its state', () => {
    expect(on.railSaid).toBe(
      '15:00 Photos, done; 16:00 Drinks reception, now; 17:20 Guests take their seats, next; 18:00 Dinner is served, still to come; 19:30 Speeches, still to come; 21:00 Cake cutting, still to come',
    );
  });

  it('runs over in whole minutes, and Next moves with it', () => {
    const over = nowAt('over');

    expect([over.until, over.figure?.words, over.next?.time, over.band]).toEqual([
      '12 min over',
      '22 min behind',
      '17:42',
      'Now · Drinks reception, 12 min over',
    ]);
  });

  it('with no length, has no until line and never goes over', () => {
    const open = nowAt('open');

    expect([open.headline, open.until, open.figure?.words, open.band]).toEqual([
      'Speeches',
      null,
      'On time',
      'Now · Speeches',
    ]);
  });

  it('keeps a title of 120 characters whole', () => {
    expect(nowAt('long').headline).toBe(LONG_TITLE);
    expect(LONG_TITLE).toHaveLength(120);
  });
});

describe('the last item is Now', () => {
  const last = nowAt('last');

  it('has no Next, and the figure is the run view’s Last item under way', () => {
    expect([last.headline, last.until, last.next, last.figure?.words]).toEqual([
      'First dance',
      'until 22:05',
      null,
      'Last item under way',
    ]);
    expect(last.band).toBe('Now · First dance, until 22:05');
    expect(last.rail.at(-1)).toMatchObject({ title: 'First dance', state: 'now' });
  });
});

describe('a track past midnight, on the event day from 05:00', () => {
  it('puts 00:30 after 22:00, so 22:00 is Next', () => {
    const items: RunItem[] = [
      { planned: '00:30', title: 'Carriages', length: 30, phase: 'waiting' },
      { planned: '22:00', title: 'Last dance', length: 60, phase: 'waiting' },
    ];
    const run = runNowOf(NAME, items, '21:30', us);

    expect(run.next?.title).toBe('Last dance');
    expect(run.rail.map(({ title }) => title)).toEqual(['Last dance', 'Carriages']);
  });

  it('runs an item started at 23:30 for an hour 10 min over at 00:40', () => {
    const items: RunItem[] = [
      { planned: '23:30', title: 'Last dance', length: 60, phase: 'now', started: '23:30' },
      { planned: '00:30', title: 'Carriages', length: 30, phase: 'waiting' },
    ];
    const run = runNowOf(NAME, items, '00:40', us);

    expect([run.until, run.figure?.words, run.next]).toEqual([
      '10 min over',
      '10 min behind',
      { time: '00:40', title: 'Carriages' },
    ]);
  });
});

describe('nothing is Now', () => {
  it('between two items, still with Next, the figure and the rail', () => {
    const between = nowAt('between');

    expect([between.happening, between.headline, between.until, between.figure?.words]).toEqual([
      false,
      'Nothing is on',
      null,
      '18 min behind',
    ]);
    expect(between.next).toEqual({ time: '17:38', title: 'Guests take their seats' });
    expect(between.rail[0]).toMatchObject({ title: 'Drinks reception', state: 'done' });
    expect(between.band).toBe('Live · Adaeze & Tunde’s wedding');
  });

  it('before the first, on time, the rail from the first item', () => {
    const before = nowAt('before');

    expect([before.headline, before.figure?.words, before.next?.title]).toEqual([
      'Nothing is on',
      'On time',
      'Guests arrive',
    ]);
    expect(before.rail.map(({ state }) => state)).toEqual([
      'next',
      'later',
      'later',
      'later',
      'later',
      'later',
    ]);
  });

  it('after the last, with no Next and no figure, the last six on the rail', () => {
    const done = nowAt('done');

    expect([done.headline, done.next, done.figure]).toEqual(['That’s everything.', null, null]);
    expect(done.rail.map(({ title }) => title)).toEqual([
      'Drinks reception',
      'Guests take their seats',
      'Dinner is served',
      'Speeches',
      'Cake cutting',
      'First dance',
    ]);
    expect(done.band).toBe('Live · Adaeze & Tunde’s wedding');
  });
});

describe('Next', () => {
  it('is the earliest not started by plan, after an out-of-order Start now', () => {
    const items: RunItem[] = [
      { planned: '18:00', title: 'Dinner', length: 60, phase: 'done' },
      { planned: '19:00', title: 'Speeches', length: 30, phase: 'waiting' },
      { planned: '19:30', title: 'Cake', length: 15, phase: 'now', started: '19:05' },
    ];

    expect(runNowOf(NAME, items, '19:10', us).next?.title).toBe('Speeches');
  });
});

describe('the figure beside Next, as sc-29978 draws it', () => {
  const i18n = createInstance();
  void i18n.init({
    resources: { en: { translation: en } },
    lng: 'en',
    interpolation: { escapeValue: false },
    initAsync: false,
  });
  const day = momentOf('day', us, i18n.getFixedT('en'));
  const numbers = new Intl.NumberFormat('en-US');

  it('is sc-29978’s figure, from its counts', () => {
    const figure = figureOf(COUNTS.some, numbers);

    expect(withRun(day, 'on', figure, us)?.figure).toEqual(figure);
    expect(figure?.spoken).toBe('141 of 152 arrived');
  });

  it('follows the phone’s numbers, and has no ring with nobody Coming', () => {
    expect(withRun(day, 'on', figureOf(COUNTS.thousands, numbers), us)?.figure?.spoken).toBe(
      '1,204 of 1,250 arrived',
    );
    expect(withRun(day, 'on', figureOf(COUNTS.nobodyComing, numbers), us)?.figure).toMatchObject({
      of: null,
      share: null,
    });
  });

  it('is not there before anyone has arrived', () => {
    expect(withRun(day, 'on', figureOf(COUNTS.none, numbers), us)?.figure).toBeNull();
  });

  it('is drawn by sc-29978’s part, with no second copy of it or its helpers', () => {
    const cover = readFileSync(join(import.meta.dirname, 'RunCover.tsx'), 'utf8');

    expect(cover).toContain(
      "import { ArrivedFigure, Chips, WhiteButton } from './ArrivedCover.tsx';",
    );
    expect(cover).not.toMatch(/function (Ring|Chips|WhiteButton)\b|react-native-svg/u);
  });
});
