import { type EventPhase } from '@soirely/domain';

export const PHASE_WORD = {
  draft: 'events.draft',
  live: 'events.live',
  happening_now: 'events.happeningNow',
  paused: 'events.paused',
  finished: 'events.finished',
} as const satisfies Record<EventPhase, string>;

/** A refusal's two lines, worded from the reloaded event's phase: past its end the clock moved it, not a colleague, so it says so. */
export const CHANGED_WORDS = {
  draft: ['eventLive.changedElsewhere', 'eventLive.nowState_draft'],
  live: ['eventLive.changedElsewhere', 'eventLive.nowState_live'],
  happening_now: ['eventLive.changedElsewhere', 'eventLive.nowState_live'],
  paused: ['eventLive.changedElsewhere', 'eventLive.nowState_paused'],
  finished: ['eventEnd.alreadyOver', 'eventLive.nowState_finished'],
} as const satisfies Record<EventPhase, readonly [string, string]>;
