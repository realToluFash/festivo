import { useEffect, useReducer } from 'react';

import { useShell } from '../../components/settingsShell.ts';
import type { Shown } from '../events/EventsModel.ts';
import type { AreaKey } from '../events/EventsSample.ts';
import { type Action, reduce } from './SeatingActs.ts';
import type { SeatingState } from './SeatingModel.ts';
import { SeatingPhone } from './SeatingPhone.tsx';
import { startOf } from './SeatingStart.ts';
import { SeatingTablet } from './SeatingTablet.tsx';

const SAVE_MS = 700;
const PRINT_MS = 1500;
const LOAD_MS = 1200;
const REFRESH_MS = 1000;

/** Each wait is its own timer, so a save landing never restarts a document being prepared. */
function useWait(
  off: boolean,
  ms: number,
  go: (action: Action) => void,
  type: 'saved' | 'printed' | 'loaded' | 'refreshed',
) {
  useEffect(() => {
    if (off) return undefined;
    const timer = setTimeout(() => go({ type }), ms);
    return () => clearTimeout(timer);
  }, [off, ms, go, type]);
}

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

  useWait(m.held || m.save !== 'saving', SAVE_MS, go, 'saved');
  useWait(m.held || m.preparing == null, PRINT_MS, go, 'printed');
  useWait(m.held || m.load !== 'loading', LOAD_MS, go, 'loaded');
  useWait(m.held || !m.refreshing, REFRESH_MS, go, 'refreshed');

  const props = { m, go, event, now, more, onMore, onArea };
  return layout === 'phone' ? <SeatingPhone {...props} /> : <SeatingTablet {...props} />;
}
