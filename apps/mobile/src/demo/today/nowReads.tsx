import {
  formatEventClock,
  NOW_READ_GIVES_UP_MS,
  NOW_STALE_AFTER_MS,
  nowLineDueAt,
  nowShown,
} from '@soirely/domain';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SecondaryButton } from '../../components/Buttons.tsx';
import { DemoOnly } from '../../steps/Lines.tsx';

import {
  type Answer,
  afterRead,
  asOfWords,
  landedAt,
  outcomeOf,
  READ_EVERY_MS,
  type Reads,
} from './nowAge.ts';

/** `?reads=` on the event day (sc-62416): the line drawn as it stands, in its day form, or the reads running live with the demo's own answers. */
export const READS_STATES = ['asOf', 'asOfDay', 'live'] as const;

export type ReadsState = (typeof READS_STATES)[number];

export function isReadsState(raw: string | null | undefined): raw is ReadsState {
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

/** Each state's reads at the sample's clock: the static two never change, and live starts with a read landing as Today opens. */
function startOf(state: ReadsState, clock: Date): Reads {
  if (state === 'asOf') return landedAt(new Date(clock.getTime() - 2 * MINUTE), true);
  if (state === 'asOfDay') return landedAt(wallAt('2026-11-05', '23:52'), true);

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
  const [startedFor, setStartedFor] = useState(`${state}|${clock}`);

  if (startedFor !== `${state}|${clock}`) {
    setStartedFor(`${state}|${clock}`);
    setReads(startOf(state ?? 'live', start));
    setNow(start);
  }

  useEffect(() => {
    if (state !== 'live') return;

    const read = () => {
      const given = ANSWERS[answer];
      const answered = () => {
        const at = demoNow();

        setReads((was) => afterRead(was, outcomeOf(given), at));
        setNow(at);
      };

      if (given.kind === 'noAnswer') return setTimeout(answered, NOW_READ_GIVES_UP_MS);

      answered();

      return undefined;
    };
    const waiting: ReturnType<typeof setTimeout>[] = [];
    const run = () => {
      const timer = read();

      if (timer != null) waiting.push(timer);
    };

    run();
    const every = setInterval(run, READ_EVERY_MS);

    return () => {
      clearInterval(every);
      waiting.forEach((timer) => clearTimeout(timer));
    };
  }, [state, answer, demoNow]);

  const due = nowLineDueAt(reads, now)?.getTime() ?? null;

  useEffect(() => {
    if (state !== 'live' || due == null) return;

    const timer = setTimeout(() => setNow(demoNow()), Math.max(0, due - demoNow().getTime()));

    return () => clearTimeout(timer);
  }, [state, due, now, demoNow]);

  if (state == null) return { built: false, asOf: null, controls: null };

  const shown = nowShown(reads, now);
  const asOf = shown.asOf == null ? null : asOfWords(shown.asOf, now, EVENT_ZONE, locale, t);
  const controls =
    state === 'live' ? (
      <DemoOnly
        title={`Demo only: how Soirely answers Now's reads. Now reads every 50 seconds, and once at each choice here. ${
          reads.landed == null
            ? 'No read has landed yet.'
            : `The last read landed at ${formatEventClock(reads.landed.at.toISOString(), EVENT_ZONE, locale)}.`
        } The line shows once a read has failed and that one is more than ${NOW_STALE_AFTER_MS / 1000} seconds old; a read with no answer fails after ${NOW_READ_GIVES_UP_MS / 1000} seconds.`}
      >
        {(Object.keys(ANSWERS) as AnswerName[]).map((name) => (
          <SecondaryButton
            key={name}
            label={answer === name ? `${ANSWER_NAMES[name]} · chosen` : ANSWER_NAMES[name]}
            onPress={() => setAnswer(name)}
            testID={`reads.${name}`}
          />
        ))}
      </DemoOnly>
    ) : null;

  return { built: shown.schedule == null, asOf, controls };
}
