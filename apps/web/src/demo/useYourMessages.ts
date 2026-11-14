import { useEffect } from 'react';

import { useLater } from '../useLater.ts';
import { type Channel, HOLD_MS, type Press, SEND_MS, type Visit, startOf } from './guest.ts';
import {
  focusAfter,
  landed,
  openedFromPage,
  saved,
  saving,
  switchPressed,
} from './guestMessages.ts';

type Go = (change: (was: Visit) => Partial<Visit>, want?: string) => void;

export interface YourMessagesActions {
  press: (press: 'stop' | 'undo') => void;
  toggle: (channel: Channel) => void;
  retry: () => void;
  open: () => void;
  back: () => void;
}

const HELD = new Set([
  'messagesStopSaving',
  'messagesUndoSaving',
  'messagesSwitchSaving',
  'messagesLoading',
]);

/** sc-3969's presses on sample data: the button and Undo record after a short save, a switch at once (sc-3950). */
export function useYourMessages(visit: Visit, state: string | null, go: Go): YourMessagesActions {
  const later = useLater();
  const { yours } = visit;

  useEffect(() => {
    if (state == null || !HELD.has(state)) return;
    const held = startOf(state).yours.busy;
    const timer = setTimeout(
      () => go(landed, held == null ? undefined : focusAfter(held)),
      HOLD_MS,
    );

    return () => clearTimeout(timer);
  }, [state, go]);

  function send(press: Press, retrying: boolean): void {
    if (yours.busy != null) return;
    if (press !== 'stop' && press !== 'undo') {
      go((was) => switchPressed(was, press), focusAfter(press));
      return;
    }

    go((was) => saving(was, press, retrying));
    later(SEND_MS, () => go((was) => saved(was, press), focusAfter(press)));
  }

  return {
    press: (press) => send(press, false),
    toggle: (channel) => go((was) => switchPressed(was, channel)),
    retry: () => {
      if (yours.failed != null) send(yours.failed, true);
    },
    open: () => go(openedFromPage, 'yoursHead'),
    back: () => go(() => ({ page: 'event' }), 'h1'),
  };
}
