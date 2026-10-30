import type { IntoView } from './keyboard.ts';

/** Long enough for the opener to reach TalkBack's tree, which drops a hover on a view it has not yet seen (sc-9950), and short of the focus TalkBack puts back on its own. */
export const TALKBACK_FOCUS_BACK_MS = 50;

/** How long a closing step stays once the keys are down, so TalkBack's focus is on its opener before the step's Cancel goes, and an opening step's opener once its field has input focus, so TalkBack's focus is on the field before the opener goes (sc-22392). Longer costs only the moment both show. */
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

/** What takes input focus from the field as a step closes: the opener itself, a control TalkBack says as it takes it, or a holder TalkBack does not read, beside an opener that cannot take it, a line of words. */
export type InputFocusTo = 'opener' | 'holder';

/** A step in closing a step back to its opener. `holdScroll` keeps the screen's content at its height and the keys' height until a scroll, a drag or TalkBack's own, brings the view's end back inside the content's real end (`holdEnds`), or, after `finish`, the keys come up again, so neither the keys going down nor the step going pulls the scroll back: at the end of the page that pull carries the focused button under the keys still showing, and TalkBack follows it as a manual scroll onto the field (sc-18587). Until `finish` it also stops Android scrolling an opener or holder out of sight to itself as it takes input focus: that jump carries Cancel out of sight under TalkBack's focus, which TalkBack then puts on Cancel's neighbour, Save or the next card, before or instead of the opener (sc-18588). `takeInputFocus` gives input focus `to` the opener or to a holder TalkBack does not read, and waits `atMs` for it to land; `putKeysDown` waits until the keys are down and the scroll they move has landed; each later `atMs` counts from there, or from the close when nothing waits. `settleOpener` brings the opener `into` sight, no further than keeps the control that closed the step in sight, and moves screen reader focus to it once the scroll has landed with `read`, or when it was out of sight as it took input focus, which TalkBack does not follow then (sc-18588), unless the scroll carries the closer out of sight: TalkBack then moves its own focus back from it to the opener, past the step hidden as it closes (sc-22357); it waits for that move when there is one. `finish` takes the step away, and with `focusBack` sends focus after it to the opener. */
export type StepCloseStep =
  | { do: 'holdScroll' }
  | { do: 'showOpener' }
  | { do: 'takeInputFocus'; atMs: number; to: InputFocusTo }
  | { do: 'putKeysDown' }
  | { do: 'settleOpener'; into: IntoView; read: boolean }
  | { do: 'finish'; focusBack: boolean; atMs: number };

/** How a step closes back to its opener on `os`. At once: the step goes, and focus follows it to the opener. In order, on Android with TalkBack on: the scroll is held, the opener shows above the step, so nothing above it moves when the step goes and TalkBack's focus on it stays in sight, input focus goes `to` the opener or its holder, the keys go down, and only then does the step go, so TalkBack's focus is never left on a view that has gone. Blurring the field while it holds input focus would hand that focus to the first focusable view, the header's back row, which TalkBack follows (sc-18587). An opener in sight that takes input focus is said by TalkBack as it does, and any move after says it again (sc-18588), so nothing moves TalkBack's focus to it later; a holder takes it for a line of words, which is read once the keys' scroll has landed (sc-18587). */
export function stepCloseSteps(
  os: string,
  screenReaderOn: boolean,
  to: InputFocusTo,
): StepCloseStep[] {
  if (os !== 'android' || !screenReaderOn) return [{ do: 'finish', focusBack: true, atMs: 0 }];

  const holder = to === 'holder';

  return [
    { do: 'holdScroll' },
    { do: 'showOpener' },
    { do: 'takeInputFocus', atMs: INPUT_FOCUS_TAKEN_MS, to },
    { do: 'putKeysDown' },
    { do: 'settleOpener', into: 'outOfSight', read: holder },
    { do: 'finish', focusBack: false, atMs: TALKBACK_FOCUS_TAKEN_MS },
  ];
}

/** Whether a scroll at `offset`, in a view `viewHeight` tall, has brought the view's end back inside content `contentHeight` tall as it is without the hold, so letting the hold go moves nothing in sight. Measured before the step went, the end would be the step's, and letting go past it clamps the scroll mid-drag by the step's height (sc-18587). */
export function holdEnds(offset: number, viewHeight: number, contentHeight: number): boolean {
  return offset + viewHeight <= Math.max(contentHeight, viewHeight) + 1;
}

/** Whether a scroll that landed at `offset` is the one asked for to `askedTo`, which keeps the hold. */
export function scrollAsked(askedTo: number | null, offset: number): boolean {
  return askedTo != null && Math.abs(offset - askedTo) < 1;
}

/** The field whose blur puts the keys down when a step closes: the one holding input focus now, or else one of the step's own, or else the one that raised the keys. A field's blur hides the keys whichever field raised them, and one of the step's is still mounted, where JS can have lost track of focus as Gboard swaps a password's keys, and Keyboard.dismiss then hides nothing (sc-18588). */
export function fieldToBlur<Field>(
  focusedNow: Field | null | undefined,
  ofTheStep: Field | null,
  raisedTheKeys: Field | null,
): Field | null {
  return focusedNow ?? ofTheStep ?? raisedTheKeys;
}

/** Whether a step opens in order on `os`: its opener stays, above the step, until the step's field has taken input focus, which TalkBack follows. An opener that goes as the step comes leaves TalkBack's focus on nothing, and TalkBack puts it on the header's back row and says "Settings" before the field (sc-22392). */
export function stepOpensInOrder(os: string, screenReaderOn: boolean): boolean {
  return os === 'android' && screenReaderOn;
}
