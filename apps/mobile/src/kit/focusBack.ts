import type { IntoView } from './keyboard.ts';

/** Long enough for the opener to reach TalkBack's tree, which drops a hover on a view it has not yet seen (sc-9950), and short of the focus TalkBack puts back on its own. */
export const TALKBACK_FOCUS_BACK_MS = 50;

/** How long a closing step stays once the keys are down, so TalkBack's focus is on its opener before the step's Cancel goes, and how long an opening step's field holds TalkBack's focus before it takes input focus, so the keys' scrolls carry nothing TalkBack's focus is on out of sight (sc-22392). Longer costs only the moment both show. */
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

/** A step in closing a step back to its opener. `holdScroll` keeps the screen's content at its height and the keys' height until a scroll, a drag or TalkBack's own, brings the view's end back inside the content's real end (`holdEnds`), or, after `finish`, the keys come up again, so neither the keys going down nor the step going pulls the scroll back: at the end of the page that pull carries the focused button under the keys still showing, and TalkBack follows it as a manual scroll onto the field (sc-18587). Until `finish` it also stops Android scrolling the holder out of sight to itself as it takes input focus: that jump carries Cancel out of sight under TalkBack's focus, which TalkBack then puts on Cancel's neighbour, Save or the next card, before or instead of the opener (sc-18588). `awaitMount` waits for the hold to be mounted before the opener shows: asked in one commit with it, the scroll that keeps the closer in sight stops at the content's old end, and at the page's end the opener pushes the closer out of sight, where TalkBack drops its focus, puts it on the first view in sight, a card line, the opener or the closer, and says it before `readOpener` says the opener again (sc-22995). `takeInputFocus` gives input focus to a holder TalkBack does not read, beside the opener, and waits `atMs` for it to land: a line of words cannot take input focus, and a control that takes it is said by TalkBack, as a bare name or by following it there, beside the move that reads it, so it is said twice (sc-22995); `bringOpener` then scrolls the opener out of sight into it, keeping the hold and, where the opener shows with it, the closer in sight: a scroll back up that carries the closer under the keys has TalkBack move its focus to the card's line nearest the top, or to the opener, before `readOpener` says the opener again (sc-22995); where TalkBack's focus has followed input focus out of sight, on the next change in the window TalkBack moves it from a view it cannot see to the first it can, Cancel, and says it before the opener again (sc-22357); `readOpener` then moves TalkBack's focus to the opener, before anything carries the closer out of sight under it: a line read only once the keys' scroll had landed was where TalkBack had already moved its focus from the carried-off Save, and the move said it a second time (sc-18587). `putKeysDown` waits until the keys are down and the scroll they move has landed; each later `atMs` counts from there, or from the close when nothing waits. `settleOpener` brings the opener `into` sight, no further than keeps the control that closed the step in sight. `finish` takes the step away, and with `focusBack` sends focus after it to the opener. */
export type StepCloseStep =
  | { do: 'holdScroll' }
  | { do: 'awaitMount' }
  | { do: 'showOpener' }
  | { do: 'takeInputFocus'; atMs: number }
  | { do: 'bringOpener' }
  | { do: 'readOpener' }
  | { do: 'putKeysDown' }
  | { do: 'settleOpener'; into: IntoView }
  | { do: 'finish'; focusBack: boolean; atMs: number };

/** How a step closes back to its opener on `os`. At once: the step goes, and focus follows it to the opener. In order, on Android with TalkBack on: the scroll is held, and once the hold is mounted the opener shows above the step, so nothing above it moves when the step goes and TalkBack's focus on it stays in sight, input focus goes to the holder beside it, the keys go down, and only then does the step go, so TalkBack's focus is never left on a view that has gone. Blurring the field while it holds input focus would hand that focus to the first focusable view, the header's back row, which TalkBack follows (sc-18587). TalkBack's focus is moved to the opener at once, as the holder beside it takes input focus (sc-22995, sc-18587; see `readOpener`). */
export function stepCloseSteps(os: string, screenReaderOn: boolean): StepCloseStep[] {
  if (os !== 'android' || !screenReaderOn) return [{ do: 'finish', focusBack: true, atMs: 0 }];

  return [
    { do: 'holdScroll' },
    { do: 'awaitMount' },
    { do: 'showOpener' },
    { do: 'takeInputFocus', atMs: INPUT_FOCUS_TAKEN_MS },
    { do: 'bringOpener' },
    { do: 'readOpener' },
    { do: 'putKeysDown' },
    { do: 'settleOpener', into: 'outOfSight' },
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

/** A step in opening a step from its opener. `keepOpener` keeps the opener above the step until the step's field shows, or for `atMs` when it never does. Once the field shows, `readField` moves TalkBack's focus to it `atMs` later, once it is in TalkBack's tree, and `focusField` gives it input focus `atMs` after that, so the keys' scrolls carry nothing TalkBack's focus is on out of sight. `finish` takes the opener away `atMs` later, or as soon as the field takes input focus. */
export type StepOpenStep =
  | { do: 'keepOpener'; atMs: number }
  | { do: 'readField'; atMs: number }
  | { do: 'focusField'; atMs: number }
  | { do: 'finish'; atMs: number };

/** How a step opens from its opener on `os`, against `settledMs` for a view to reach TalkBack's tree. At once: the opener goes as the step comes, and the field opens focused. In order, on Android with TalkBack on: the opener stays until TalkBack's focus is on the step's field and the field has taken input focus. An opener that goes as the step comes leaves TalkBack's focus on nothing, and TalkBack puts it on the header's back row and says "Settings" before the field; a field that takes input focus first is said by TalkBack with its own focus left on the opener, which the keys' scrolls then carry out of sight (sc-22392). */
export function stepOpenSteps(
  os: string,
  screenReaderOn: boolean,
  settledMs: number,
): StepOpenStep[] {
  if (os !== 'android' || !screenReaderOn) return [{ do: 'finish', atMs: 0 }];

  return [
    { do: 'keepOpener', atMs: settledMs },
    { do: 'readField', atMs: settledMs },
    { do: 'focusField', atMs: TALKBACK_FOCUS_TAKEN_MS },
    { do: 'finish', atMs: settledMs },
  ];
}
