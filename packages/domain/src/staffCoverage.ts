import { zoneOffsets } from './events.ts';

/** Coverage of an event's jobs by their shifts (sc-3908), computed and never stored; sc-101's scheduled hours read the same shifts through it. Every moment is epoch milliseconds. */

export const COVERAGE_STEP_MS = 30 * 60_000;

const DAY_MS = 24 * 60 * 60_000;

export interface CoverageShift {
  job: string;
  startsAt: number;
  endsAt: number;
  needed: number;
  on: number;
}

export interface CoverageCount {
  on: number;
  needed: number;
}

export interface CoverageSpan extends CoverageCount {
  start: number;
  end: number;
}

export interface CoverageGap {
  start: number;
  end: number;
  short: number;
}

export interface JobCoverage {
  job: string;
  cells: (CoverageCount | null)[];
  spans: CoverageSpan[];
  gaps: CoverageGap[];
}

export interface CoverageWindow {
  start: number;
  end: number;
  steps: number[];
  long: boolean;
}

function toStep(moment: number, timeZone: string, round: (n: number) => number): number {
  const offset = zoneOffsets(timeZone)?.(moment) ?? 0;

  return round((moment + offset) / COVERAGE_STEP_MS) * COVERAGE_STEP_MS - offset;
}

/** 24 hours or more on the zone's clock: the last moment on a later date at the first's clock time or after, so a spring clock change's 23 h 30 still counts. */
export function spansADay(first: number, last: number, timeZone: string): boolean {
  const offset = zoneOffsets(timeZone);
  if (offset == null) return last - first >= DAY_MS;

  return last + offset(last) - (first + offset(first)) >= DAY_MS;
}

/** From the earlier of the event's start and its first shift's start to the later of their ends, in steps on the event's hour and half hour; `long` at 24 hours or more on its clock. */
export function coverageWindow(
  event: { startsAt: number; endsAt: number },
  shifts: readonly Pick<CoverageShift, 'startsAt' | 'endsAt'>[],
  timeZone: string,
): CoverageWindow {
  const first = Math.min(event.startsAt, ...shifts.map((one) => one.startsAt));
  const last = Math.max(event.endsAt, ...shifts.map((one) => one.endsAt));
  const start = toStep(first, timeZone, Math.floor);
  const end = toStep(last, timeZone, Math.ceil);
  const steps: number[] = [];
  for (let at = start; at < end; at += COVERAGE_STEP_MS) steps.push(at);

  return { start, end, steps, long: spansADay(first, last, timeZone) };
}

function countAt(shifts: readonly CoverageShift[], moment: number): CoverageCount {
  return shifts.reduce(
    (sum, one) =>
      one.startsAt <= moment && moment < one.endsAt
        ? { on: sum.on + one.on, needed: sum.needed + one.needed }
        : sum,
    { on: 0, needed: 0 },
  );
}

const shortOf = (count: CoverageCount) => count.needed - count.on;

/** Each job in `jobs` that has shifts: each step at the moment in it when the job is shortest, the spans where its numbers hold steady, and its gaps. */
export function jobCoverage(
  jobs: readonly string[],
  shifts: readonly CoverageShift[],
  window: Pick<CoverageWindow, 'steps'>,
): JobCoverage[] {
  return jobs.flatMap((job) => {
    const own = shifts.filter((one) => one.job === job);
    if (own.length === 0) return [];
    const marks = [...new Set(own.flatMap((one) => [one.startsAt, one.endsAt]))].sort(
      (a, b) => a - b,
    );

    const cells = window.steps.map((step) =>
      [step, ...marks.filter((one) => one > step && one < step + COVERAGE_STEP_MS)]
        .map((moment) => countAt(own, moment))
        .filter((count) => count.needed > 0)
        .reduce<CoverageCount | null>(
          (worst, count) => (worst == null || shortOf(count) > shortOf(worst) ? count : worst),
          null,
        ),
    );

    const spans: CoverageSpan[] = [];
    marks.slice(0, -1).forEach((start, index) => {
      const end = marks[index + 1] as number;
      const count = countAt(own, start);
      if (count.needed === 0) return;
      const last = spans.at(-1);
      if (
        last != null &&
        last.end === start &&
        last.on === count.on &&
        last.needed === count.needed
      )
        last.end = end;
      else spans.push({ start, end, ...count });
    });

    const gaps: CoverageGap[] = [];
    for (const span of spans) {
      const short = shortOf(span);
      if (short <= 0) continue;
      const last = gaps.at(-1);
      if (last != null && last.end === span.start && last.short === short) last.end = span.end;
      else gaps.push({ start: span.start, end: span.end, short });
    }

    return [{ job, cells, spans, gaps }];
  });
}
