/** How long the header's back row stays hidden after a step lets it go: past the focus a closing step sends, at 50 ms on Android (`TALKBACK_FOCUS_BACK_MS`), and past TalkBack's own at 0.14 s. */
export const BACK_ROW_HELD_MS = 500;

export interface BackRowHiding {
  hide(hidden: boolean): void;
  stop(): void;
}

/** Hides the back row at once and shows it `heldMs` later, unless hidden again first. Shown in the moment a focused Save goes, it is where TalkBack puts its own focus, and says "Settings, Button" before the confirmation (sc-18587). */
export function backRowHiding(
  setHidden: (hidden: boolean) => void,
  heldMs = BACK_ROW_HELD_MS,
): BackRowHiding {
  let showing: ReturnType<typeof setTimeout> | undefined;
  const stop = () => clearTimeout(showing);

  return {
    hide(hidden) {
      stop();
      if (hidden) setHidden(true);
      else showing = setTimeout(() => setHidden(false), heldMs);
    },
    stop,
  };
}
