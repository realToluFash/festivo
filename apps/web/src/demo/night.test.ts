import { describe, expect, it } from 'vitest';

import {
  NIGHT_PAGES,
  at,
  dismiss,
  elapsedOf,
  endNowShows,
  expectedStarts,
  nightAt,
  pickerTracks,
  pressDone,
  pressSkip,
  pressStart,
  queuedWords,
  timeIn,
  trackView,
  tryNow,
  weekdayIn,
} from './night.ts';

function hall(state: string, locale = 'en-US') {
  const { night } = nightAt(state);
  const track = night.tracks.find((one) => one.id === 'hall');

  if (track == null) throw new Error('no Ballroom');

  return trackView(night, track, locale);
}

describe('the event day', () => {
  it('puts 00:30 after 22:00 on the night before', () => {
    expect(at('00:30')).toBeGreaterThan(at('22:00'));
    expect(at('04:59')).toBeLessThan(at('05:00', 1));
  });

  it('writes every time on the 24-hour clock, in every locale', () => {
    expect(timeIn('en-US', at('21:50'))).toBe('21:50');
    expect(timeIn('en-GB', at('21:50'))).toBe('21:50');
    expect(timeIn('fr-FR', at('21:50'))).toBe('21:50');
    expect(weekdayIn('en-US', 0)).toBe('Friday');
    expect(weekdayIn('fr-FR', 0)).toBe('vendredi');
  });

  it('lists an earlier day’s track after today’s places only while its item is Now', () => {
    const { night, menuOpen } = nightAt('picker_earlier_day');
    const labels = pickerTracks(night).map((track) => trackView(night, track, 'en-US').label);

    expect(menuOpen).toBe(true);
    expect(labels).toEqual(['Ballroom', 'Garden', 'Foyer · Friday']);

    const done = pressDone(night, 'foyer', 'bar');

    expect(pickerTracks(done).map((track) => track.place)).toEqual(['Ballroom', 'Garden']);
  });
});

describe('Now, Next and Later', () => {
  it('draws the populated night on plan', () => {
    const view = hall('populated');

    expect(view.now?.title).toBe('Speeches');
    expect(view.elapsed).toEqual({ words: '12 min', over: false, share: 12 / 40 });
    expect(view.next?.item.title).toBe('First dance');
    expect(view.next?.expected).toBeNull();
    expect(view.header).toEqual({ kind: 'onTime' });
    expect(view.later.map((row) => row.item.title)).toEqual([
      'Cake cutting',
      'The band’s first set',
      'Bouquet toss',
      'Dancing',
      'Last song',
    ]);
  });

  it('measures behind from Next, so the header and the Next card agree', () => {
    const view = hall('behind');

    expect(view.header).toEqual({ kind: 'behind', minutes: 12 });
    expect(view.next?.expected).toBe('20:42');
    expect(hall('behind', 'en-GB').next?.expected).toBe('20:42');
  });

  it('says over in words once an item passes its length', () => {
    expect(hall('running_over').elapsed).toEqual({ words: '+4 min over', over: true, share: 1 });
  });

  it('never goes over with no length', () => {
    const item = {
      id: 'x',
      planned: 0,
      title: 'x',
      length: null,
      owner: null,
      phase: 'now' as const,
      started: 0,
    };

    expect(elapsedOf(item, 90)).toEqual({ words: '1 h 30 min', over: false, share: null });
  });

  it('keeps Next the earliest not-started item after an out-of-order start', () => {
    const view = hall('later_started');

    expect(view.now?.title).toBe('Cake cutting');
    expect(view.nowBefore).toBe('Started before First dance.');
    expect(view.next?.item.title).toBe('First dance');
    expect(view.later.map((row) => row.item.id)).not.toContain('cake');
  });

  it('puts the out-of-order item back in Later once it is done', () => {
    const view = hall('later_started_done');

    expect(view.now).toBeNull();
    expect(view.lastFinished).toBe('Cake cutting finished at 20:51.');
    expect(view.later[0]).toMatchObject({ mark: 'done', time: 'started 20:31' });
  });

  it('gives a skipped item no time, and the items after it continue from the one before', () => {
    const view = hall('later_skipped');
    const { night } = nightAt('later_skipped');
    const items = night.tracks[0]?.items ?? [];

    expect(view.later[0]).toMatchObject({ mark: 'skipped', time: null });
    expect(expectedStarts(items, night.clock).get('set')).toBe(at('21:05'));
  });
});

describe('the presses', () => {
  it('moves the clock on a minute and reads out each change', () => {
    const { night } = nightAt('populated');
    const done = pressDone(night, 'hall', 'speeches');

    expect(done.clock).toBe(night.clock + 1);
    expect(done.said).toBe('Speeches done. Next: First dance.');
    expect(pressStart(done, 'hall', 'dance').said).toBe('First dance started.');
    expect(pressSkip(done, 'hall', 'cake').said).toBe('Cake cutting skipped.');
  });

  it('refuses a second Now on a track', () => {
    const { night } = nightAt('populated');

    expect(pressStart(night, 'hall', 'cake')).toBe(night);
  });

  it('counts presses made offline and sends them on Try now', () => {
    const { night } = nightAt('offline');
    const done = pressDone(night, 'hall', 'speeches');

    expect(done.queued).toBe(3);
    expect(queuedWords(1)).toBe('1 press waiting to send.');
    expect(tryNow(done)).toMatchObject({
      online: true,
      queued: 0,
      said: 'Connected. Presses sent.',
    });
  });

  it('keeps a losing replay’s alert until it is dismissed or the next press', () => {
    const { night } = nightAt('replay_lost');

    expect(night.lost?.by).toBe('Ifeoma Nduka');
    expect(dismiss(night).lost).toBeNull();
    expect(pressDone(night, 'hall', 'dance').lost).toBeNull();
  });

  it('words a losing replay that names nobody with the 409’s own words', () => {
    expect(nightAt('replay_lost_unnamed').night.lost).toEqual({
      title: 'First dance',
      by: null,
      said: 'This item has not started yet, so it cannot be done.',
    });
  });
});

describe('the end of the night', () => {
  it('says behind, ahead or on plan from the last item not skipped', () => {
    expect(hall('end_behind').finished?.sentence).toBe('Finished 12 min behind plan.');
    expect(hall('end_ahead').finished?.sentence).toBe('Finished 6 min ahead of plan.');
    expect(hall('end_on_plan').finished?.sentence).toBe('Finished on plan.');
    expect(hall('end_behind').finished?.workedOut).toBe(
      'Last item finished at 00:42, planned to finish at 00:30.',
    );
  });

  it('says no sentence and no worked-out line when every item was skipped', () => {
    let { night } = nightAt('populated');
    for (const id of ['booth', 'bar', 'carriages']) night = pressSkip(night, 'foyer', id);
    const foyer = night.tracks.find((one) => one.id === 'foyer');

    if (foyer == null) throw new Error('no Foyer');

    expect(trackView(night, foyer, 'en-US').finished).toMatchObject({
      sentence: null,
      workedOut: null,
    });
  });

  it('shows End now only once the event has nothing left to run, to events.manage', () => {
    expect(endNowShows(nightAt('end_behind').night)).toBe(true);
    expect(hall('end_other_running').finished?.endNow).toBe(false);
    expect(endNowShows(nightAt('end_behind', { as: 'no-events-manage' }).night)).toBe(false);
    expect(endNowShows(nightAt('end_behind', { as: 'reader' }).night)).toBe(false);
    expect(endNowShows({ ...nightAt('end_behind').night, laterDayHasItems: true })).toBe(false);
  });
});

describe('the boards', () => {
  it('has a state for every one the Design section lists', () => {
    const states = NIGHT_PAGES.flatMap((page) => page.states).map((link) =>
      new URL(link.to, 'http://x').searchParams.get('state'),
    );

    expect(states).toEqual(
      expect.arrayContaining([
        'populated',
        'behind',
        'gap',
        'running_over',
        'later_chosen_busy',
        'later_chosen_free',
        'later_started',
        'later_started_done',
        'later_skipped',
        'offline',
        'replay_lost',
        'replay_lost_unnamed',
        'read_only',
        'end_behind',
        'end_ahead',
        'end_on_plan',
        'end_other_running',
        'loading',
        'empty_track',
        'picker_earlier_day',
      ]),
    );
  });

  it('turns the picker into the plain place name with one track', () => {
    expect(nightAt('populated', { oneTrack: true }).night.tracks).toHaveLength(1);
    expect(nightAt('empty_track').night.tracks).toHaveLength(0);
  });
});
