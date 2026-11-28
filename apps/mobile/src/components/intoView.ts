import { Keyboard } from 'react-native';

import {
  type InContent,
  type IntoView,
  offsetShowingFoot,
  settledAnswer,
  settledOffsetKeeping,
  shownAboveKeys,
} from '../kit/keyboard.ts';
import { scrollAsked } from '../kit/focusBack.ts';
import { type ToastRest, restAboveToast } from '../kit/toastRest.ts';
import { tokens } from '../theme/tokens.ts';
import { keyboardTopNow } from './keyboardWatch.ts';
import type { ScreenScrollView } from './Screen.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';

// VoiceOver drops a focus asked for while a sheet is still sliding away, and the scroll has to land first.
export const SETTLED_MS = 500;

export interface Sight {
  when?: IntoView;
  /** The sight ends at the keys while they are up. */
  aboveKeys?: boolean;
  /** Stays wholly in sight as the scroll goes back up, when the view can show with it. */
  keep?: ScreenReaderTarget | null;
  /** The scroll keeps the hold, as `scrollHolding`. */
  holding?: boolean;
  /** A view taller than the sight shows its foot, as offsetShowingFoot. */
  foot?: boolean;
}

/** What bringIntoView reads of a scroll: a screen's, or one in its own window. */
export type SightScroll = Pick<ScreenScrollView, 'ref' | 'offset' | 'origin'> &
  Partial<Pick<ScreenScrollView, 'scrollHolding'>>;

export function bringIntoView(
  scroll: SightScroll | null,
  line: ScreenReaderTarget | null,
  animated: boolean,
  { when = 'wholly', aboveKeys = false, keep = null, holding = false, foot = false }: Sight = {},
  measured: (found: { to: number | null } | null) => void = () => {},
): void {
  const view = scroll?.ref.current;
  const content = view?.getInnerViewRef();
  const scrollHost = view?.getNativeScrollRef();
  if (scroll == null || view == null || content == null || scrollHost == null || line == null)
    return measured(null);

  const kept = (then: (at: InContent | null) => void) =>
    keep == null
      ? then(null)
      : keep.measureLayout(
          content,
          (_x, contentY, _w, height) => then({ contentY, height }),
          () => then(null),
        );

  // A field in another screen's scroll fails to measure here, and that screen brings it.
  line.measureLayout(
    content,
    (_x, contentY, _w, height) => {
      kept((keptAt) =>
        scrollHost.measureInWindow((_sx, y, _sw, scrollHeight) => {
          const keyboardTop = aboveKeys ? keyboardTopNow(scroll.origin.current) : null;
          const shown = shownAboveKeys(keyboardTop, { y, height: scrollHeight });
          const at = {
            contentY,
            height,
            offset: scroll.offset.current,
            shown,
            margin: tokens.spaceLg,
          };
          const to = foot ? offsetShowingFoot(at) : settledOffsetKeeping(at, when, keptAt);
          if (to != null && holding && scroll.scrollHolding != null) scroll.scrollHolding(to);
          else if (to != null) view.scrollTo({ y: to, animated });
          measured({ to });
        }),
      );
    },
    () => measured(null),
  );
}

/** Measures where `line` rests above the toast whose top is at `toastTop` in the window, with `room` already given to the content's foot, as restAboveToast has it; null when it cannot be measured (sc-86228). */
export function restOverToast(
  scroll: SightScroll | null,
  line: ScreenReaderTarget | null,
  toastTop: number,
  room: number,
  measured: (rest: ToastRest | null) => void,
): void {
  const view = scroll?.ref.current;
  const content = view?.getInnerViewRef();
  const scrollHost = view?.getNativeScrollRef();
  if (scroll == null || view == null || content == null || scrollHost == null || line == null)
    return measured(null);

  line.measureLayout(
    content,
    (_x, contentY, _w, height) =>
      content.measureInWindow((_cx, _cy, _cw, contentHeight) =>
        scrollHost.measureInWindow((_sx, scrollTop, _sw, scrollHeight) =>
          measured(
            restAboveToast({
              contentY,
              height,
              offset: scroll.offset.current,
              scrollTop,
              scrollHeight,
              toastTop,
              content: contentHeight - room,
              margin: tokens.spaceLg,
            }),
          ),
        ),
      ),
    () => measured(null),
  );
}

/** Brings the scroll back inside its content's end, once the content has shrunk under it, and says where it scrolled to, null when it stayed. */
export function keepInsideEnd(
  scroll: SightScroll | null,
  measured: (to: number | null) => void = () => {},
): void {
  const view = scroll?.ref.current;
  const content = view?.getInnerViewRef();
  const scrollHost = view?.getNativeScrollRef();
  if (scroll == null || view == null || content == null || scrollHost == null)
    return measured(null);

  content.measureInWindow((_cx, _cy, _cw, contentHeight) =>
    scrollHost.measureInWindow((_sx, _sy, _sw, scrollHeight) => {
      const end = Math.max(0, contentHeight - scrollHeight);
      if (scroll.offset.current <= end) return measured(null);
      view.scrollTo({ y: end, animated: false });
      measured(end);
    }),
  );
}

/** Calls `then` once the scroll has reached `to`, at once when there is no scroll to make; returns what stops waiting. */
export function whenLanded(
  scroll: ScreenScrollView,
  to: number | null,
  then: () => void,
): () => void {
  if (to == null || scrollAsked(to, scroll.offset.current)) {
    then();
    return () => {};
  }
  const landing = (y: number) => {
    if (!scrollAsked(to, y)) return;
    stop();
    then();
  };
  const stop = () => scroll.scrolled.delete(landing);
  scroll.scrolled.add(landing);

  return stop;
}

/** Brings `shown` wholly into sight above the keys now and once it has settled, and again as the keys rise (and fall, with `alsoOnHide`) or the scroll view resizes, until two settles have passed; says so through `answering` as settledAnswer does, calls `inView` as the first scroll lands, and returns what stops it sooner. With `jump`, each scroll is made at once and `inView` is called as the first is asked, so a screen reader's move asked then reaches the native view after it: under a gliding scroll TalkBack's focus, pushed off the button, steps onto each view the scroll passes, and its own scroll onto one of them can stop the glide short (sc-43907). */
export function followIntoView(
  scroll: ScreenScrollView,
  shown: () => ScreenReaderTarget | null,
  {
    alsoOnHide = false,
    answering = () => {},
    inView,
    jump = false,
  }: {
    alsoOnHide?: boolean;
    answering?: (on: boolean) => void;
    inView?: (() => void) | undefined;
    jump?: boolean | undefined;
  } = {},
): () => void {
  const sight = { aboveKeys: true };
  let landing = inView;
  let stopLanding = () => {};
  const bring = () => {
    const then = landing;
    landing = undefined;
    bringIntoView(scroll, shown(), !jump, sight, (found) => {
      if (then == null || found == null) return;
      if (jump) then();
      else stopLanding = whenLanded(scroll, found.to, then);
    });
  };
  // Keys that rise, and Android's avoiding view shrinking under them, cover it afresh.
  const keys = [Keyboard.addListener('keyboardDidShow', bring)];
  if (alsoOnHide) keys.push(Keyboard.addListener('keyboardDidHide', bring));
  scroll.resized.add(bring);
  const unwatch = () => {
    keys.forEach((key) => key.remove());
    scroll.resized.delete(bring);
  };

  return settledAnswer(bring, SETTLED_MS, (on) => {
    answering(on);
    if (on) return;
    unwatch();
    stopLanding();
  });
}
