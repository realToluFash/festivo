import { eventDayOf } from './runOfShow.ts';

/** One schedule item as the run view reads it: every time a wall-clock `YYYY-MM-DDTHH:mm` in the event's zone. */
export interface RunTimesItem {
  id: string;
  planned: string;
  lengthMinutes: number | null;
  fixedTime: boolean;
  startedAt: string | null;
  endedAt: string | null;
}

export type RunPhase = 'waiting' | 'now' | 'done';

export type RunFigure =
  { kind: 'onTime' } | { kind: 'behind'; minutes: number } | { kind: 'last' } | { kind: 'done' };

export interface RunRow<I extends RunTimesItem> {
  item: I;
  phase: RunPhase;
  /** A not-started item's expected start, only when it differs from its planned one. */
  expected: string | null;
  /** The earliest not-started item before an item started out of order. */
  startedBefore: I | null;
}

export interface RunCollision<I extends RunTimesItem> {
  before: I;
  fixed: I;
}

export interface RunTrack<I extends RunTimesItem> {
  rows: RunRow<I>[];
  figure: RunFigure;
  collisions: RunCollision<I>[];
  /** The first not-started item by planned start, and when it is expected. */
  next: { item: I; expected: string } | null;
}

/** What the event's clock reads at a moment, `YYYY-MM-DDTHH:mm`, as the run view's now. */
export function wallAt(moment: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(moment);
  const part = (type: string) => parts.find((one) => one.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

function minutesOf(wall: string): number {
  return (
    Date.UTC(
      Number(wall.slice(0, 4)),
      Number(wall.slice(5, 7)) - 1,
      Number(wall.slice(8, 10)),
      Number(wall.slice(11, 13)),
      Number(wall.slice(14, 16)),
    ) / 60_000
  );
}

function wallOf(minutes: number): string {
  return new Date(minutes * 60_000).toISOString().slice(0, 16);
}

export function phaseOf(item: RunTimesItem): RunPhase {
  return item.endedAt != null ? 'done' : item.startedAt != null ? 'now' : 'waiting';
}

/** Order on a track is by planned start; two at the same minute keep the order they came in. */
export function inPlannedOrder<I extends RunTimesItem>(items: readonly I[]): I[] {
  return [...items].sort((a, b) => minutesOf(a.planned) - minutesOf(b.planned));
}

/**
 * sc-1404's rules for one track. A not-started item is expected at the latest of its planned start, the
 * expected end of the item before it and now; a fixed-time item at its planned start, always. A running
 * item ends at the later of its actual start plus its length and now; no length counts as 0. Items passed
 * over by one started out of order keep their times and move nothing after them.
 */
export function runTrack<I extends RunTimesItem>(items: readonly I[], now: string): RunTrack<I> {
  const at = minutesOf(now);
  const ordered = inPlannedOrder(items);
  const lastStarted = ordered.reduce(
    (last, item, index) => (phaseOf(item) === 'waiting' ? last : index),
    -1,
  );
  const starts = new Map<string, number>();
  const ends = new Map<string, number>();
  let end = Number.NEGATIVE_INFINITY;

  ordered.forEach((item, index) => {
    const length = item.lengthMinutes ?? 0;
    const phase = phaseOf(item);
    const planned = minutesOf(item.planned);

    if (phase === 'done') {
      end = minutesOf(item.endedAt ?? item.planned);
      ends.set(item.id, end);
      return;
    }
    if (phase === 'now') {
      end = Math.max(minutesOf(item.startedAt ?? item.planned) + length, at);
      ends.set(item.id, end);
      return;
    }

    const start = item.fixedTime ? planned : Math.max(planned, end, at);

    starts.set(item.id, start);
    ends.set(item.id, start + length);
    if (index > lastStarted) end = start + length;
  });

  const rows = ordered.map<RunRow<I>>((item, index) => {
    const phase = phaseOf(item);
    const start = starts.get(item.id);

    return {
      item,
      phase,
      expected: start != null && start !== minutesOf(item.planned) ? wallOf(start) : null,
      startedBefore:
        phase === 'waiting'
          ? null
          : (ordered.slice(0, index).find((one) => phaseOf(one) === 'waiting') ?? null),
    };
  });

  const nextItem = ordered.find((item) => phaseOf(item) === 'waiting') ?? null;
  const next =
    nextItem == null
      ? null
      : {
          item: nextItem,
          expected: wallOf(starts.get(nextItem.id) ?? minutesOf(nextItem.planned)),
        };

  const collisions = ordered.flatMap<RunCollision<I>>((item, index) => {
    const before = ordered[index - 1];

    if (!item.fixedTime || phaseOf(item) !== 'waiting' || before == null) return [];
    if (phaseOf(before) === 'done') return [];

    return (ends.get(before.id) ?? 0) > minutesOf(item.planned) ? [{ before, fixed: item }] : [];
  });

  return { rows, figure: figureOf(ordered, next), collisions, next };
}

function figureOf<I extends RunTimesItem>(
  ordered: readonly I[],
  next: { item: I; expected: string } | null,
): RunFigure {
  if (ordered.every((item) => phaseOf(item) === 'done')) return { kind: 'done' };
  if (next == null) return { kind: 'last' };
  if (ordered.every((item) => phaseOf(item) === 'waiting')) return { kind: 'onTime' };

  const behind = minutesOf(next.expected) - minutesOf(next.item.planned);

  return behind <= 0 ? { kind: 'onTime' } : { kind: 'behind', minutes: behind };
}

/** A track is one place on one event day; an item with no place is on the event's one track, Main. */
export function runTracks<I extends RunTimesItem & { place: string | null }>(
  items: readonly I[],
): { day: string; place: string | null; items: I[] }[] {
  const tracks = new Map<string, { day: string; place: string | null; items: I[] }>();

  for (const item of inPlannedOrder(items)) {
    const day = eventDayOf(item.planned);
    const key = `${day}\u0000${item.place ?? ''}`;
    const track = tracks.get(key) ?? { day, place: item.place, items: [] };

    track.items.push(item);
    tracks.set(key, track);
  }

  return [...tracks.values()];
}
