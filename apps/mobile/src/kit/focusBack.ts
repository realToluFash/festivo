/** Long enough for the opener to reach TalkBack's tree, which drops a hover on a view it has not yet seen (sc-9950), and short of the focus TalkBack puts back on its own. */
export const TALKBACK_FOCUS_BACK_MS = 50;

/** How long focus waits before going back to a step's opener on `os`, against `settledMs` for the scroll to land. TalkBack, once the button it activated has gone, puts its own focus on what is there and says it, so a move after that says the opener twice (sc-18588); landing first leaves it nothing to put back. VoiceOver drops a focus asked for before the scroll lands. */
export function focusBackMs(os: string, settledMs: number): number {
  return os === 'android' ? Math.min(TALKBACK_FOCUS_BACK_MS, settledMs) : settledMs;
}
