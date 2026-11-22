import { usePreventRemove } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { holdLeaving, keptEditing, leaveThen, leaveWithoutAsking } from '../leaveHeld.ts';

export type LeaveAsk = {
  leave: (go: () => void) => void;
  keep: () => void;
  discard: () => void;
  /** Saved: the form leaves without asking. */
  release: () => void;
};

/** Every way out of a form holding a change, Back and the swipe back among them, shows its Cancel's ask (sc-82245). */
export function useLeaveAsk(changed: boolean, openAsk: () => void): LeaveAsk {
  const pending = useRef<(() => void) | null>(null);
  const opening = useRef(openAsk);
  useEffect(() => {
    opening.current = openAsk;
  });

  const drop = usePreventRemove(changed, ({ repeat }) => leaveThen(repeat));

  useEffect(
    () =>
      changed
        ? holdLeaving((go) => {
            pending.current = go;
            opening.current();
          }, drop)
        : undefined,
    [changed, drop],
  );

  const leave = useCallback((go: () => void) => leaveThen(go), []);
  const keep = useCallback(() => {
    pending.current = null;
    keptEditing();
  }, []);
  const discard = useCallback(() => {
    const go = pending.current;
    pending.current = null;
    go?.();
  }, []);
  const release = useCallback(() => {
    pending.current = null;
    if (changed) leaveWithoutAsking();
    drop();
  }, [changed, drop]);

  return useMemo(() => ({ leave, keep, discard, release }), [leave, keep, discard, release]);
}
