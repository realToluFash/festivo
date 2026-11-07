import { useEffect, useReducer } from 'react';

import { useShell } from '../../components/settingsShell.ts';
import type { Shown } from '../events/EventsModel.ts';
import type { AreaKey } from '../events/EventsSample.ts';
import { reduce } from './SeatingActs.ts';
import type { SeatingState } from './SeatingModel.ts';
import { SeatingPhone } from './SeatingPhone.tsx';
import { startOf } from './SeatingStart.ts';
import { SeatingTablet } from './SeatingTablet.tsx';

const SAVE_MS = 700;
const PRINT_MS = 1500;
const LOAD_MS = 1200;
const REFRESH_MS = 1000;

/** Seating A in the event's frame, on sample data: nothing reaches the API, and each wait is a timer. */
export function SeatingScreen({
  state,
  event,
  now,
  more,
  onMore,
  onArea,
}: {
  state: SeatingState | null;
  event: Shown;
  now: Date;
  more: boolean;
  onMore: (open: boolean) => void;
  onArea: (area: AreaKey) => void;
}) {
  const { layout } = useShell();
  const [m, go] = useReducer(reduce, null, () => startOf(state, layout));

  useEffect(() => {
    if (m.held) return undefined;
    const waits: [boolean, number, () => void][] = [
      [m.save === 'saving', SAVE_MS, () => go({ type: 'saved' })],
      [m.preparing != null, PRINT_MS, () => go({ type: 'printed' })],
      [m.load === 'loading', LOAD_MS, () => go({ type: 'loaded' })],
      [m.refreshing, REFRESH_MS, () => go({ type: 'refreshed' })],
    ];
    const timers = waits.filter(([on]) => on).map(([, ms, done]) => setTimeout(done, ms));
    return () => timers.forEach(clearTimeout);
  }, [m.held, m.save, m.preparing, m.load, m.refreshing]);

  const props = { m, go, event, now, more, onMore, onArea };
  return layout === 'phone' ? <SeatingPhone {...props} /> : <SeatingTablet {...props} />;
}
