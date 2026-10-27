import { type EventStatus } from '@soirely/api-client';
import { type EventPhase } from '@soirely/domain';

export const PHASE_WORD = {
  draft: 'events.draft',
  live: 'events.live',
  happening_now: 'events.happeningNow',
  paused: 'events.paused',
  finished: 'events.finished',
} as const satisfies Record<EventPhase, string>;

export const NOW_STATE = {
  draft: 'eventLive.nowState_draft',
  live: 'eventLive.nowState_live',
  paused: 'eventLive.nowState_paused',
  ended: 'eventLive.nowState_finished',
} as const satisfies Record<EventStatus, string>;
