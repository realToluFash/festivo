import { eventDayOf, wallOfZoned } from './runOfShow.ts';

/** One schedule item as the run view reads it: every time RFC 3339 in the event zone's offset, as the API writes it, so a length is added to real time across a change of clocks. */
export interface RunTimesItem {
  id: string;
  planned: string;
  lengthMinutes: number | null;
  fixedTime: boolean;
  startedAt: string | null;
  endedAt: string | null;
  /** Marked as not happening (sc-3895): it takes no time, and the items after it continue from the one before. */
  skipped?: boolean;
}

export type RunPhase = 'waiting' | 'now' | 'done' | 'skipped';

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

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** A moment as RFC 3339 to the minute, written in the offset the event's zone has at that moment: the run view's now and every expected time. */
export function zonedAt(moment: Date, timeZone: string): string {
  const minute = Math.floor(moment.getTime() / 60_000) * 60_000;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(minute));
  const part = (type: string) => Number(parts.find((one) => one.type === type)?.value ?? 0);
  const wall = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'));
  const offset = (wall - minute) / 60_000;
  const sign = offset < 0 ? '-' : '+';
  const zone = `${sign}${pad2(Math.floor(Math.abs(offset) / 60))}:${pad2(Math.abs(offset) % 60)}`;

  return `${new Date(wall).toISOString().slice(0, 16)}:00${zone}`;
}

function minutesOf(rfc3339: string): number {
  return Math.floor(Date.parse(rfc3339) / 60_000);
}

export function phaseOf(item: RunTimesItem): RunPhase {
  if (item.skipped === true) return 'skipped';

  return item.endedAt != null ? 'done' : item.startedAt != null ? 'now' : 'waiting';
}

/** Order on a track is by planned start; two at the same minute keep the order they came in. */
export function inPlannedOrder<I extends RunTimesItem>(items: readonly I[]): I[] {
  return [...items].sort((a, b) => minutesOf(a.planned) - minutesOf(b.planned));
}

export function runTrack<I extends RunTimesItem>(
  items: readonly I[],
  now: string,
  timeZone: string,
): RunTrack<I> {
  const zonedOf = (minutes: number): string => zonedAt(new Date(minutes * 60_000), timeZone);
  const at = minutesOf(now);
  const ordered = inPlannedOrder(items);
  const lastStarted = ordered.reduce(
    (last, item, index) => (phaseOf(item) === 'now' || phaseOf(item) === 'done' ? index : last),
    -1,
  );
  const starts = new Map<string, number>();
  const ends = new Map<string, number>();
  let end = Number.NEGATIVE_INFINITY;

  ordered.forEach((item, index) => {
    const length = item.lengthMinutes ?? 0;
    const phase = phaseOf(item);
    const planned = minutesOf(item.planned);

    if (phase === 'skipped') return;
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
      expected: start != null && start !== minutesOf(item.planned) ? zonedOf(start) : null,
      startedBefore:
        phase === 'waiting' || phase === 'skipped'
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
          expected: zonedOf(starts.get(nextItem.id) ?? minutesOf(nextItem.planned)),
        };

  const collisions = ordered.flatMap<RunCollision<I>>((item, index) => {
    const before = ordered[index - 1];

    if (!item.fixedTime || phaseOf(item) !== 'waiting' || before == null) return [];
    if (phaseOf(before) === 'done' || phaseOf(before) === 'skipped') return [];

    return (ends.get(before.id) ?? 0) > minutesOf(item.planned) ? [{ before, fixed: item }] : [];
  });

  return { rows, figure: figureOf(ordered, next), collisions, next };
}

function figureOf<I extends RunTimesItem>(
  ordered: readonly I[],
  next: { item: I; expected: string } | null,
): RunFigure {
  if (ordered.every((item) => phaseOf(item) === 'done' || phaseOf(item) === 'skipped'))
    return { kind: 'done' };
  if (next == null) return { kind: 'last' };
  if (ordered.every((item) => phaseOf(item) === 'waiting' || phaseOf(item) === 'skipped'))
    return { kind: 'onTime' };

  const behind = minutesOf(next.expected) - minutesOf(next.item.planned);

  return behind <= 0 ? { kind: 'onTime' } : { kind: 'behind', minutes: behind };
}

/** A track is one place on one event day; an item with no place is on the event's one track, Main. */
export function runTracks<I extends RunTimesItem & { place: string | null }>(
  items: readonly I[],
): { day: string; place: string | null; items: I[] }[] {
  const tracks = new Map<string, { day: string; place: string | null; items: I[] }>();

  for (const item of inPlannedOrder(items)) {
    const day = eventDayOf(wallOfZoned(item.planned));
    const key = `${day}\u0000${item.place ?? ''}`;
    const track = tracks.get(key) ?? { day, place: item.place, items: [] };

    track.items.push(item);
    tracks.set(key, track);
  }

  return [...tracks.values()];
}
