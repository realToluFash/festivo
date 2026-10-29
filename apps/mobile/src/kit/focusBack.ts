import type { IntoView } from './keyboard.ts';

/** Long enough for the opener to reach TalkBack's tree, which drops a hover on a view it has not yet seen (sc-9950), and short of the focus TalkBack puts back on its own. */
export const TALKBACK_FOCUS_BACK_MS = 50;

/** How long a closing step stays once the keys are down, so TalkBack's focus is on its opener before the step's Cancel goes. Longer costs only the moment both show. */
export const TALKBACK_FOCUS_TAKEN_MS = 150;

/** Where focus comes back from: a step closed inside a card, or a page whose list returns with every row at once. */
export type FocusBackFrom = 'step' | 'page';

/** How long focus waits before going back to an opener on `os`, against `settledMs` for the scroll to land. TalkBack, once the button it activated has gone, puts its own focus on what is there and says it, so a move after that says the opener twice (sc-18588); landing first leaves it nothing to put back. A `page` return waits the whole settle on every platform: TalkBack drops a hover on rows not yet in its tree (sc-9950). VoiceOver drops a focus asked for before the scroll lands. */
export function focusBackMs(os: string, settledMs: number, from: FocusBackFrom): number {
  return os === 'android' && from === 'step'
    ? Math.min(TALKBACK_FOCUS_BACK_MS, settledMs)
    : settledMs;
}

/** How long the holder is given to take input focus from the field before the keys go down. */
export const INPUT_FOCUS_TAKEN_MS = TALKBACK_FOCUS_BACK_MS;

/** A step in closing a step back to its opener. `holdScroll` keeps the screen's content at its height and the keys' height until a scroll, a drag or TalkBack's own, brings the view's end back inside the content's real end (`holdEnds`), or the keys come up again, so neither the keys going down nor the step going pulls the scroll back: at the end of the page that pull carries the focused button under the keys still showing, and TalkBack follows it as a manual scroll onto the field (sc-18587). `takeInputFocus` gives input focus `to` the opener or to a holder TalkBack does not read, and waits `atMs` for it to land; `putKeysDown` waits until the keys are down and the scroll they move has landed; each later `atMs` counts from there, or from the close when nothing waits. `settleOpener` brings the opener `into` sight and moves screen reader focus to it once the scroll has landed. `finish` takes the step away, and with `focusBack` sends focus after it to the opener. */
export type StepCloseStep =
  | { do: 'holdScroll' }
  | { do: 'showOpener' }
  | { do: 'takeInputFocus'; atMs: number; to: 'opener' | 'holder' }
  | { do: 'putKeysDown' }
  | { do: 'settleOpener'; into: IntoView }
  | { do: 'finish'; focusBack: boolean; atMs: number };

/** How a step closes back to its opener on `os`, against `settledMs` for a scroll to land. At once: the step goes, and focus follows it to the opener. In order, on Android with TalkBack on: the opener shows beside the step, a holder takes input focus from the field, the keys go down, TalkBack's focus moves to the opener once their scroll has landed, and only then does the step go, so TalkBack's focus is never left on a view that has gone. Blurring the field while it holds input focus would hand that focus to the first focusable view, the header's back row, which TalkBack follows (sc-18587). An opener given input focus is said by TalkBack, and said again by any move after (sc-18588), and the scroll as the keys go down drags TalkBack's focus off it onto the words beside it, so the holder TalkBack does not read takes input focus and the opener is read once, after the scroll (sc-18587, sc-18588). */
export function stepCloseSteps(
  os: string,
  screenReaderOn: boolean,
  settledMs: number,
): StepCloseStep[] {
  if (os !== 'android' || !screenReaderOn) return [{ do: 'finish', focusBack: true, atMs: 0 }];

  return [
    { do: 'holdScroll' },
    { do: 'showOpener' },
    { do: 'takeInputFocus', atMs: INPUT_FOCUS_TAKEN_MS, to: 'holder' },
    { do: 'putKeysDown' },
    { do: 'settleOpener', into: 'outOfSight' },
    { do: 'finish', focusBack: false, atMs: settledMs + TALKBACK_FOCUS_TAKEN_MS },
  ];
}

/** Whether a scroll at `offset`, in a view `viewHeight` tall, has brought the view's end back inside content `contentHeight` tall as it is without the hold, so letting the hold go moves nothing in sight. Measured before the step went, the end would be the step's, and letting go past it clamps the scroll mid-drag by the step's height (sc-18587). */
export function holdEnds(offset: number, viewHeight: number, contentHeight: number): boolean {
  return offset + viewHeight <= Math.max(contentHeight, viewHeight) + 1;
}

/** The field whose blur puts the keys down when a step closes: the one holding input focus now, or else the one that raised the keys, which leaves them up once it has given input focus up (sc-18588). */
export function fieldToBlur<Field>(
  focusedNow: Field | null | undefined,
  raisedTheKeys: Field | null,
): Field | null {
  return focusedNow ?? raisedTheKeys;
}
