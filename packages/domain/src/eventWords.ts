import {
  durationWords,
  formatEventDayAndClock,
  formatWallClock,
  formatWallDay,
} from './datetime.ts';
import { type EventPhase, type EventState, calledOff } from './eventStates.ts';
import {
  EVENT_NAME_MAXIMUM,
  type EventDraft,
  type EventFormField,
  VENUE_ADDRESS_MAXIMUM,
  VENUE_NAME_MAXIMUM,
  type VenueDraft,
  clockMinutes,
  copiedEnd,
  eventFormProblems,
  skippedTime,
} from './events.ts';

/** Each client's `t`, so the words both forms say are worked out once. */
export interface Translate {
  (key: string): string;
  (key: string, values: Record<string, string | number>): string;
}

/** What the event form says under each field its checks refuse, the same on the web and in the app. */
export function eventFormErrors(
  typed: { draft: EventDraft; venue: VenueDraft; timeZone: string; currency: string },
  t: Translate,
): Partial<Record<EventFormField, string>> {
  const errors: Partial<Record<EventFormField, string>> = {};

  for (const { field, problem } of eventFormProblems(typed))
    errors[field] =
      problem === 'currencyBlank'
        ? t('orgGeneral.currencyBlank')
        : t(`eventForm.${problem}`, {
            most:
              field === 'venueName'
                ? VENUE_NAME_MAXIMUM
                : field === 'venueAddress'
                  ? VENUE_ADDRESS_MAXIMUM
                  : EVENT_NAME_MAXIMUM,
          });

  return errors;
}

/** The line under a time the clocks skip (sc-10638): what it is saved as instead. */
export function skippedLine(
  date: string,
  time: string,
  timeZone: string,
  locale: string,
  t: Translate,
): string | null {
  const skipped = skippedTime(date, time, timeZone);

  if (skipped == null) return null;

  const savedDate = skipped.savedAs.slice(0, 10);
  const words = {
    time: formatWallClock(time, locale),
    day: formatWallDay(date, locale),
    zone: timeZone,
    savedAs: formatWallClock(skipped.savedAs, locale),
  };

  return savedDate === date
    ? t('eventForm.clocksSkip', words)
    : t('eventForm.clocksSkipNextDay', { ...words, savedDay: formatWallDay(savedDate, locale) });
}

/** Duplicate's refusal of a start not fully chosen (sc-3593), and the half the cursor goes to. */
export function copyStartRefusal(
  date: string,
  time: string,
  t: Translate,
): { message: string; focus: 'date' | 'time' } | null {
  if (date !== '' && time !== '') return null;

  return {
    message: t(
      date === '' && time === ''
        ? 'eventDuplicate.startMissing'
        : date === ''
          ? 'eventDuplicate.dateMissing'
          : 'eventDuplicate.timeMissing',
    ),
    focus: date === '' ? 'date' : 'time',
  };
}

/** The line under Duplicate's Starts: the copy's end once its start is chosen, and the original's length on the clock. */
export function copyEndsLine(
  date: string,
  time: string,
  original: { startsAt: string; endsAt: string; timeZone: string },
  locale: string,
  t: Translate,
): string {
  const { timeZone } = original;
  const end = copiedEnd(date, time, timeZone, original);
  const words = durationWords(clockMinutes(original, timeZone) ?? 0, locale);
  const duration =
    words.hours != null && words.minutes != null
      ? t('eventDuplicate.hoursAndMinutes', { hourWords: words.hours, minuteWords: words.minutes })
      : (words.hours ?? words.minutes ?? '');

  return end == null
    ? t('eventDuplicate.endsUnchosen', { duration, timeZone })
    : t('eventDuplicate.ends', {
        end: formatEventDayAndClock(end, timeZone, locale),
        duration,
        timeZone,
      });
}

/** What a screen reader says when a new start has moved the end (sc-22144), or null when the end stayed. */
export function endMovedLine(
  before: EventDraft,
  after: EventDraft,
  locale: string,
  t: Translate,
): string | null {
  if (
    after.endTime === '' ||
    (after.endDate === before.endDate && after.endTime === before.endTime)
  )
    return null;

  return t('eventForm.endMoved', {
    day: formatWallDay(after.endDate, locale),
    time: formatWallClock(after.endTime, locale),
  });
}

const NOW_STATE = {
  draft: 'eventLive.nowState_draft',
  live: 'eventLive.nowState_live',
  happening_now: 'eventLive.nowState_live',
  paused: 'eventLive.nowState_paused',
  finished: 'eventLive.nowState_finished',
} as const satisfies Record<EventPhase, string>;

/** A refused lifecycle move's two lines, from the reloaded event: past its end the clock moved it, so it says so; calling off is always a colleague's act. */
export function changedWords(event: {
  status: EventState;
  phase: EventPhase;
  startsAt: string;
  concludedAt: string | null;
}): readonly [string, string] {
  if (calledOff(event)) return ['eventLive.changedElsewhere', 'eventLive.nowState_calledOff'];
  if (event.phase === 'finished') return ['eventEnd.alreadyOver', NOW_STATE.finished];

  return ['eventLive.changedElsewhere', NOW_STATE[event.phase]];
}
