import { type NightItem, type NightTrack, nightDayOf, nightTracks, nightView } from './night.ts';
import { type RunFigure, phaseOf, runTrack, zonedAt } from './runTimes.ts';

export const TODAY_RAIL_STOPS = 6;

export type TodayStopState = 'done' | 'now' | 'next' | 'later';

export interface TodayRun<I extends NightItem> {
  track: NightTrack<I>;
  /** The item somebody started, with when it should end by its length, and the whole minutes past that. */
  now: { item: I; until: string | null; over: number } | null;
  /** The earliest not-started item by planned start, and when it is expected (sc-1404). */
  next: { item: I; expected: string } | null;
  /** The run view's header for this track at this moment: Today works out no figure of its own. */
  figure: RunFigure;
  rail: { item: I; state: TodayStopState }[];
}

const minutesOf = (rfc3339: string) => Math.floor(Date.parse(rfc3339) / 60_000);

const byPlace = (a: NightTrack<NightItem>, b: NightTrack<NightItem>) =>
  (a.place ?? '').localeCompare(b.place ?? '');

function startedOn(track: NightTrack<NightItem>): number | null {
  const starts = track.items
    .filter((item) => phaseOf(item) === 'now')
    .map((item) => minutesOf(item.startedAt ?? item.planned));

  return starts.length === 0 ? null : Math.min(...starts);
}

function finishedLast(track: NightTrack<NightItem>): number {
  const ends = track.items
    .filter((item) => phaseOf(item) === 'done' && item.endedAt != null)
    .map((item) => minutesOf(item.endedAt ?? item.planned));

  return ends.length === 0 ? Number.NEGATIVE_INFINITY : Math.max(...ends);
}

/** The track Today follows: one with an item Now, else the one whose Next comes first, else the one that finished last (pm, 5 Nov). */
export function todayTrack<I extends NightItem>(
  items: readonly I[],
  now: string,
  timeZone: string,
): NightTrack<I> | null {
  const today = nightDayOf(now);
  const tracks = nightTracks(items, now).filter((track) => track.day === today);
  const pick = (
    of: (track: NightTrack<I>) => number | null,
    earliest: boolean,
  ): NightTrack<I> | undefined =>
    tracks
      .flatMap((track) => {
        const value = of(track);

        return value == null ? [] : [{ track, value }];
      })
      .sort(
        (a, b) => (earliest ? a.value - b.value : b.value - a.value) || byPlace(a.track, b.track),
      )
      .at(0)?.track;

  return (
    pick(startedOn, true) ??
    pick((track) => {
      const next = runTrack(track.items, now, timeZone).next;

      return next == null ? null : minutesOf(next.expected);
    }, true) ??
    pick(finishedLast, false) ??
    null
  );
}

/** Up to six stops from the one before the anchor, earlier ones filling in when fewer than six remain. */
export function todayRailWindow<T>(stops: readonly T[], anchor: number): T[] {
  const from = Math.max(0, Math.min(anchor - 1, stops.length - TODAY_RAIL_STOPS));

  return stops.slice(from, from + TODAY_RAIL_STOPS);
}

/** Today's Now from the run of show (sc-29875), or null on a day with no running order, when sc-29090's Now stays. */
export function todayRunOf<I extends NightItem>(
  items: readonly I[],
  now: string,
  timeZone: string,
): TodayRun<I> | null {
  const track = todayTrack(items, now, timeZone);

  if (track == null) return null;

  const view = nightView(track, now, timeZone);
  const run = runTrack(track.items, now, timeZone);
  const on = view.now;
  const next = run.next;
  const shown = run.rows.filter((row) => row.phase !== 'skipped').map((row) => row.item);
  const anchor = on ?? next?.item ?? null;
  const window = todayRailWindow(shown, anchor == null ? shown.length : shown.indexOf(anchor));

  return {
    track,
    now:
      on == null
        ? null
        : {
            item: on,
            until:
              on.lengthMinutes == null
                ? null
                : zonedAt(
                    new Date((minutesOf(on.startedAt ?? on.planned) + on.lengthMinutes) * 60_000),
                    timeZone,
                  ),
            over: view.elapsed?.over ?? 0,
          },
    next,
    figure: run.figure,
    rail: window.map((item) => ({
      item,
      state:
        item === on
          ? 'now'
          : item === next?.item
            ? 'next'
            : phaseOf(item) === 'done'
              ? 'done'
              : 'later',
    })),
  };
}
