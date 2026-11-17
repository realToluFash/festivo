import { formatEventClock } from '@soirely/domain';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type Answer,
  afterRead,
  asOfWords,
  lineDueAt,
  nowShows,
  outcomeOf,
  READ_EVERY_MS,
  READ_GIVES_UP_MS,
  type Reads,
} from './nowAge.ts';

/** `?reads=` on the event day (sc-62416): the line drawn as it stands, in its day form, or the reads running live with the demo's own answers. */
export const READS_STATES = ['asOf', 'asOfDay', 'live'] as const;

export type ReadsState = (typeof READS_STATES)[number];

export function isReadsState(raw: string | null): raw is ReadsState {
  return READS_STATES.some((state) => state === raw);
}

export const READS_STATE_NAMES: Record<ReadsState, string> = {
  asOf: 'reads failing for 2 min: Offline · as of 16:38',
  asOfDay: 'the last read landed yesterday: the line with its day',
  live: 'reads every 50 s, with the demo choosing how Soirely answers',
};

/** The event's zone: Ire Events is in Lagos. */
export const EVENT_ZONE = 'Africa/Lagos';

const EVENT_DAY = '2026-11-06';

const wallAt = (day: string, clock: string) => new Date(`${day}T${clock}:00+01:00`);

const MINUTE = 60_000;

const ANSWERS = {
  order: { kind: 'order' },
  unreached: { kind: 'unreached' },
  noAnswer: { kind: 'noAnswer' },
  error: { kind: 'status', status: 500 },
  refused: { kind: 'status', status: 403 },
} as const satisfies Record<string, Answer>;

type AnswerName = keyof typeof ANSWERS;

const ANSWER_NAMES: Record<AnswerName, string> = {
  order: 'Reads land',
  unreached: 'Reads do not reach Soirely',
  noAnswer: 'Reads get no answer',
  error: 'Reads meet an error (500)',
  refused: 'Reads are refused (403)',
};

const landedAt = (at: Date): Reads => ({ landed: at, failing: false, refused: false });

/** Each state's reads at the sample's clock: the static two never change, and live starts with a read landing as Today opens. */
function startOf(state: ReadsState, clock: Date): Reads {
  if (state === 'asOf')
    return { ...landedAt(new Date(clock.getTime() - 2 * MINUTE)), failing: true };
  if (state === 'asOfDay') return { ...landedAt(wallAt('2026-11-05', '23:52')), failing: true };

  return landedAt(clock);
}

export interface NowRead {
  built: boolean;
  asOf: string | null;
  /** The demo's own controls, for `live`; null otherwise. */
  controls: ReactNode;
}

/** The demo's reads for `?reads=`, on the sample's clock, which runs on from `clock` in real time. */
export function useNowReads(state: ReadsState | null, clock: string, locale: string): NowRead {
  const { t } = useTranslation();
  const [opened] = useState(() => Date.now());
  const start = useMemo(() => wallAt(EVENT_DAY, clock), [clock]);
  const demoNow = useCallback(
    () => new Date(start.getTime() + (state === 'live' ? Date.now() - opened : 0)),
    [start, state, opened],
  );
  const [reads, setReads] = useState<Reads>(() => startOf(state ?? 'live', start));
  const [answer, setAnswer] = useState<AnswerName>('order');
  const [now, setNow] = useState(start);
  /** When the last read failed, for the demo's own account of its reads; null once one lands. */
  const [failedAt, setFailedAt] = useState<Date | null>(null);
  const [startedFor, setStartedFor] = useState(`${state}|${clock}`);

  if (startedFor !== `${state}|${clock}`) {
    setStartedFor(`${state}|${clock}`);
    setReads(startOf(state ?? 'live', start));
    setNow(start);
    setFailedAt(null);
  }

  useEffect(() => {
    if (state !== 'live') return;

    const read = () => {
      const given = ANSWERS[answer];
      const answered = () => {
        const at = demoNow();
        const outcome = outcomeOf(given);

        setReads((was) => afterRead(was, outcome, at));
        setFailedAt((was) => (outcome === 'failed' ? at : outcome === 'landed' ? null : was));
        setNow(at);
      };

      if (given.kind === 'noAnswer') return window.setTimeout(answered, READ_GIVES_UP_MS);

      answered();

      return undefined;
    };
    const waiting: number[] = [];
    const run = () => {
      const timer = read();

      if (timer != null) waiting.push(timer);
    };

    run();
    const every = window.setInterval(run, READ_EVERY_MS);

    return () => {
      window.clearInterval(every);
      waiting.forEach((timer) => window.clearTimeout(timer));
    };
  }, [state, answer, demoNow]);

  const due = lineDueAt(reads, now)?.getTime() ?? null;

  useEffect(() => {
    if (state !== 'live' || due == null) return;

    const timer = window.setTimeout(
      () => setNow(demoNow()),
      Math.max(0, due - demoNow().getTime()),
    );

    return () => window.clearTimeout(timer);
  }, [state, due, now, demoNow]);

  if (state == null) return { built: false, asOf: null, controls: null };

  const shows = nowShows(reads, now);
  const asOf =
    shows.kind === 'run' && shows.asOf != null
      ? asOfWords(shows.asOf, now, EVENT_ZONE, locale, t)
      : null;
  const controls =
    state === 'live' ? (
      <details className="na-demo-only" open>
        <summary>Demo only: how Soirely answers Now&apos;s reads</summary>
        <p>
          {`Now reads every 50 seconds, and once at each choice here. ${
            reads.landed == null
              ? 'No read has landed yet.'
              : `The last read landed at ${formatEventClock(reads.landed.toISOString(), EVENT_ZONE, locale)}.`
          }${
            failedAt == null
              ? ''
              : ` A read failed at ${formatEventClock(failedAt.toISOString(), EVENT_ZONE, locale)}.`
          } The line shows once a read has failed and that one is more than 60 seconds old; a read with no answer fails after 10 seconds.`}
        </p>
        <div className="na-demo-acts" role="group" aria-label="How Soirely answers">
          {(Object.keys(ANSWERS) as AnswerName[]).map((name) => (
            <button
              key={name}
              type="button"
              className="na-demo-act"
              aria-pressed={answer === name}
              onClick={() => setAnswer(name)}
            >
              {ANSWER_NAMES[name]}
            </button>
          ))}
        </div>
      </details>
    ) : null;

  return { built: shows.kind === 'built', asOf, controls };
}
