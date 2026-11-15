import { formatWallClock } from './datetime.ts';
import {
  type RunFigure,
  type RunTimesItem,
  type RunTrack,
  runTrack,
  runTracks,
} from './runTimes.ts';

/** A catalogue key under `runView` and its slots, for each client to put through its own `t`. */
export type RunWords = readonly [key: string, values?: Record<string, string | number>];

export interface RunTrackShown<I extends RunTimesItem> {
  key: string;
  /** The place, or the event's one track; with its day when the schedule spans more than one. */
  name: RunWords;
  /** The place alone, for the phone's track picker. */
  place: string;
  track: RunTrack<I>;
}

/** One table per place on each event day, in the order their first items start. */
export function runShown<I extends RunTimesItem & { place: string | null }>(
  items: readonly I[],
  now: string,
  main: string,
  dayName: (day: string) => string,
): RunTrackShown<I>[] {
  const tracks = runTracks(items);
  const days = new Set(tracks.map((track) => track.day));

  return tracks.map((track) => {
    const place = track.place ?? main;

    return {
      key: `${track.day}|${track.place ?? ''}`,
      name:
        days.size > 1
          ? ['runView.trackOnDay', { place, day: dayName(track.day) }]
          : ['runView.place', { place }],
      place,
      track: runTrack(track.items, now),
    };
  });
}

export function figureWords(figure: RunFigure): RunWords {
  switch (figure.kind) {
    case 'onTime':
      return ['runView.onTime'];
    case 'behind':
      return ['runView.behind', { count: figure.minutes }];
    case 'last':
      return ['runView.last'];
    case 'done':
      return ['runView.allDone'];
  }
}

/** What assistive technology is told when the heading changes, with the track's name. */
export function figureSaid(track: string, figure: RunFigure): RunWords {
  switch (figure.kind) {
    case 'onTime':
      return ['runView.saidOnTime', { track }];
    case 'behind':
      return ['runView.saidBehind', { track, count: figure.minutes }];
    case 'last':
      return ['runView.saidLast', { track }];
    case 'done':
      return ['runView.saidDone', { track }];
  }
}

/** The line that ends each table: what is next and when, or that nothing follows. */
export function nextWords<I extends RunTimesItem & { title: string }>(
  track: RunTrack<I>,
  locale: string,
): RunWords {
  if (track.figure.kind === 'done') return ['runView.allDone'];
  if (track.next == null) return ['runView.nothingAfter'];

  const { item, expected } = track.next;
  const time = formatWallClock(expected, locale);

  return expected === item.planned
    ? ['runView.nextAt', { title: item.title, time }]
    : ['runView.nextAbout', { title: item.title, time }];
}

/** "Cake cutting would run into Fireworks at 22:00". */
export function collisionWords<I extends RunTimesItem & { title: string }>(
  before: I,
  fixed: I,
  locale: string,
): RunWords {
  return [
    'runView.collision',
    { before: before.title, fixed: fixed.title, time: formatWallClock(fixed.planned, locale) },
  ];
}
