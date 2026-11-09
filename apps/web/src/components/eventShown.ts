import { type EventPhase } from '@soirely/domain';

import { PHASE_WORD } from '../routes/app/events/eventWords.ts';
import type { MarkKind } from './SettingsParts.tsx';

/** An event's phase as a list shows it: a Finished event that never started is Called off. */
export type Shown = EventPhase | 'calledOff';

export const SHOWN_WORD = {
  ...PHASE_WORD,
  calledOff: 'events.calledOff',
} as const satisfies Record<Shown, string>;

export function tagKind(shown: Shown): MarkKind | 'now' {
  switch (shown) {
    case 'draft':
      return 'waiting';
    case 'live':
      return 'yes';
    case 'happening_now':
      return 'now';
    case 'paused':
      return 'paused';
    case 'finished':
    case 'calledOff':
      return 'ended';
  }
}
