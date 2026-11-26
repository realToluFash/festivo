import { type EventPhase } from '@soirely/domain';

export const PHASE_WORD = {
  draft: 'events.draft',
  live: 'events.live',
  happening_now: 'events.happeningNow',
  paused: 'events.paused',
  finished: 'events.finished',
} as const satisfies Record<EventPhase, string>;
