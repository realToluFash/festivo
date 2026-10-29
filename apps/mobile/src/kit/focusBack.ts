/** Long enough for the opener to reach TalkBack's tree, which drops a hover on a view it has not yet seen (sc-9950), and short of the focus TalkBack puts back on its own. */
export const TALKBACK_FOCUS_BACK_MS = 50;

/** How long a closing step stays once its opener has been sent the hover, so TalkBack has moved its focus there before the step's Cancel goes. Longer costs only the moment both show. */
export const TALKBACK_FOCUS_TAKEN_MS = 150;

/** Where focus comes back from: a step closed inside a card, or a page whose list returns with every row at once. */
export type FocusBackFrom = 'step' | 'page';

/** How long focus waits before going back to an opener on `os`, against `settledMs` for the scroll to land. TalkBack, once the button it activated has gone, puts its own focus on what is there and says it, so a move after that says the opener twice (sc-18588); landing first leaves it nothing to put back. A `page` return waits the whole settle on every platform: TalkBack drops a hover on rows not yet in its tree (sc-9950). VoiceOver drops a focus asked for before the scroll lands. */
export function focusBackMs(os: string, settledMs: number, from: FocusBackFrom): number {
  return os === 'android' && from === 'step'
    ? Math.min(TALKBACK_FOCUS_BACK_MS, settledMs)
    : settledMs;
}

/** A step in closing a step back to its opener. `putKeysDown` waits until the keys are down and the scroll they move has landed; each `atMs` counts from the opener showing, or from the close when it never shows. `finish` takes the step away, and with `focusBack` sends focus after it to the opener. */
export type StepCloseStep =
  | { do: 'putKeysDown' }
  | { do: 'showOpener' }
  | { do: 'focusOpener'; atMs: number }
  | { do: 'finish'; focusBack: boolean; atMs: number };

/** How a step closes back to its opener on `os`. At once: the step goes, and focus follows it to the opener. In order, on Android with TalkBack on: the keys go down, the opener shows beside the step and takes focus, and only then does the step go, so TalkBack's focus is never left on a view that has gone (sc-18588). */
export function stepCloseSteps(os: string, screenReaderOn: boolean): StepCloseStep[] {
  if (os !== 'android' || !screenReaderOn) return [{ do: 'finish', focusBack: true, atMs: 0 }];

  return [
    { do: 'putKeysDown' },
    { do: 'showOpener' },
    { do: 'focusOpener', atMs: TALKBACK_FOCUS_BACK_MS },
    { do: 'finish', focusBack: false, atMs: TALKBACK_FOCUS_BACK_MS + TALKBACK_FOCUS_TAKEN_MS },
  ];
}
