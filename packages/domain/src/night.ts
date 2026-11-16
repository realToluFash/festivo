import { eventDayOf, wallOfZoned } from './runOfShow.ts';
import { type RunTimesItem, inPlannedOrder, phaseOf, runTrack, zonedAt } from './runTimes.ts';

/** One schedule item as the night screen reads it (sc-3895). */
export interface NightItem extends RunTimesItem {
  title: string;
  place: string | null;
  ownerName: string | null;
}

export interface NightTrack<I extends NightItem> {
  key: string;
  day: string;
  place: string | null;
  items: I[];
}

export type NightMark = 'done' | 'skipped' | 'notStarted';

export interface LaterRow<I extends NightItem> {
  item: I;
  mark: NightMark;
  /** A not-started row's expected start, a done row's actual start, none for a skipped row. */
  at: string | null;
}

export type NightHeader =
  { kind: 'onTime' } | { kind: 'behind'; minutes: number } | { kind: 'finished' };

export interface NightElapsed {
  minutes: number;
  over: number;
  share: number | null;
}

/** Null minutes when every item was skipped: nothing has an actual end (pm, 16 Nov). */
export interface NightEnd {
  minutesLate: number | null;
  actualEnd: string | null;
  plannedEnd: string | null;
}

export interface NightView<I extends NightItem> {
  now: I | null;
  /** The earliest not-started item before the one that is Now, when that was started out of order. */
  startedBefore: I | null;
  elapsed: NightElapsed | null;
  lastFinished: { item: I; at: string } | null;
  next: { item: I; planned: string; expected: string | null } | null;
  later: LaterRow<I>[];
  header: NightHeader;
  done: number;
  total: number;
  endsAbout: string | null;
  end: NightEnd | null;
}

const minutesOf = (rfc3339: string) => Math.floor(Date.parse(rfc3339) / 60_000);

export function nightDayOf(now: string): string {
  return eventDayOf(wallOfZoned(now));
}

function tracksOf<I extends NightItem>(items: readonly I[]): NightTrack<I>[] {
  const tracks = new Map<string, NightTrack<I>>();

  for (const item of inPlannedOrder(items)) {
    const day = eventDayOf(wallOfZoned(item.planned));
    const key = `${day}\u0000${item.place ?? ''}`;
    const track = tracks.get(key) ?? { key, day, place: item.place, items: [] };

    track.items.push(item);
    tracks.set(key, track);
  }

  return [...tracks.values()];
}

/** The picker: the tracks of the day on now, then an earlier day's only while an item on it is Now (pm, 1 Nov). */
export function nightTracks<I extends NightItem>(
  items: readonly I[],
  now: string,
): NightTrack<I>[] {
  const today = nightDayOf(now);
  const all = tracksOf(items);

  return [
    ...all.filter((track) => track.day === today),
    ...all.filter(
      (track) => track.day < today && track.items.some((item) => phaseOf(item) === 'now'),
    ),
  ];
}

export function isFinished(track: NightTrack<NightItem>): boolean {
  return track.items.every((item) => phaseOf(item) === 'done' || phaseOf(item) === 'skipped');
}

export interface EndNowRule {
  happening: boolean;
  eventsManage: boolean;
  manage: boolean;
}

/** Only once the event has nothing left to run: every picker track finished and no later event day with items (pm, 1 Nov). */
export function endNowShows<I extends NightItem>(
  items: readonly I[],
  now: string,
  rule: EndNowRule,
): boolean {
  const today = nightDayOf(now);
  const picker = nightTracks(items, now);

  return (
    picker.length > 0 &&
    picker.every(isFinished) &&
    !items.some((item) => eventDayOf(wallOfZoned(item.planned)) > today) &&
    rule.happening &&
    rule.eventsManage &&
    rule.manage
  );
}

export function nightView<I extends NightItem>(
  track: NightTrack<I>,
  now: string,
  timeZone: string,
): NightView<I> {
  const at = minutesOf(now);
  const run = runTrack(track.items, now, timeZone);
  const ordered = run.rows.map((row) => row.item);
  const expectedOf = (item: I) =>
    run.rows.find((row) => row.item === item)?.expected ?? item.planned;
  const nowRow =
    run.rows
      .filter((row) => row.phase === 'now')
      .sort((a, b) => minutesOf(a.item.startedAt ?? '') - minutesOf(b.item.startedAt ?? ''))[0] ??
    null;
  const nowItem = nowRow?.item ?? null;
  const nextItem = run.next?.item ?? null;
  const after = nextItem == null ? [] : ordered.slice(ordered.indexOf(nextItem) + 1);
  const later = after
    .filter((item) => item !== nowItem)
    .map<LaterRow<I>>((item) => {
      const phase = phaseOf(item);

      if (phase === 'skipped') return { item, mark: 'skipped', at: null };
      if (phase === 'waiting') return { item, mark: 'notStarted', at: expectedOf(item) };

      return { item, mark: 'done', at: item.startedAt };
    });
  const finished = nowItem == null && nextItem == null;
  const recent = ordered
    .filter((item) => phaseOf(item) === 'done' && item.endedAt != null)
    .sort((a, b) => minutesOf(b.endedAt ?? '') - minutesOf(a.endedAt ?? ''))[0];
  const behind =
    run.next == null ? 0 : minutesOf(run.next.expected) - minutesOf(run.next.item.planned);

  return {
    now: nowItem,
    startedBefore: nowRow?.startedBefore ?? null,
    elapsed: nowItem == null ? null : elapsedOf(nowItem, at),
    lastFinished: recent == null ? null : { item: recent, at: recent.endedAt ?? recent.planned },
    next:
      run.next == null
        ? null
        : {
            item: run.next.item,
            planned: run.next.item.planned,
            expected: behind === 0 ? null : run.next.expected,
          },
    later,
    header: finished
      ? { kind: 'finished' }
      : behind > 0
        ? { kind: 'behind', minutes: behind }
        : { kind: 'onTime' },
    done: track.items.filter((item) => phaseOf(item) === 'done').length,
    total: track.items.length,
    endsAbout: finished ? null : endsAboutOf(ordered, expectedOf, at, timeZone),
    end: finished ? endOf(ordered, timeZone) : null,
  };
}

function elapsedOf(item: NightItem, at: number): NightElapsed {
  const minutes = Math.max(0, at - minutesOf(item.startedAt ?? item.planned));
  const length = item.lengthMinutes;

  if (length == null) return { minutes, over: 0, share: null };

  return {
    minutes,
    over: Math.max(0, minutes - length),
    share: length === 0 ? 1 : Math.min(1, minutes / length),
  };
}

function endsAboutOf<I extends NightItem>(
  ordered: readonly I[],
  expectedOf: (item: I) => string,
  at: number,
  timeZone: string,
): string | null {
  const last = ordered.filter((item) => phaseOf(item) !== 'skipped').at(-1);

  if (last == null) return null;

  const length = last.lengthMinutes ?? 0;
  const phase = phaseOf(last);
  const end =
    phase === 'waiting'
      ? minutesOf(expectedOf(last)) + length
      : phase === 'now'
        ? Math.max(minutesOf(last.startedAt ?? last.planned) + length, at)
        : minutesOf(last.endedAt ?? last.planned);

  return zonedAt(new Date(end * 60_000), timeZone);
}

/** The latest actual end against the planned end of the last item not skipped; no length ends at its planned start. */
function endOf<I extends NightItem>(ordered: readonly I[], timeZone: string): NightEnd {
  const ran = ordered.filter((item) => phaseOf(item) === 'done');
  const last = ordered.filter((item) => phaseOf(item) !== 'skipped').at(-1);

  if (ran.length === 0 || last == null)
    return { minutesLate: null, actualEnd: null, plannedEnd: null };

  const actual = Math.max(...ran.map((item) => minutesOf(item.endedAt ?? item.planned)));
  const planned = minutesOf(last.planned) + (last.lengthMinutes ?? 0);
  const zoned = (minutes: number) => zonedAt(new Date(minutes * 60_000), timeZone);

  return { minutesLate: actual - planned, actualEnd: zoned(actual), plannedEnd: zoned(planned) };
}

/** The weekday a night's `YYYY-MM-DD` falls on, in the reader's language. */
export function weekdayOf(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(`${day}T12:00:00Z`),
  );
}
