import {
  type ReactElement,
  type ReactNode,
  type RefCallback,
  type RefObject,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  type HostInstance,
  Keyboard,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  type RefreshControlProps,
  ScrollView,
  type ScrollViewInstance,
  type StyleProp,
  StyleSheet,
  TextInput,
  View,
  type ViewInstance,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  barFits,
  groupInWindow,
  keysOver,
  liftNeeded,
  type IntoView,
  offsetAboveKeyboard,
  scrollInsets,
  settledOffset,
  shownAboveKeys,
  shownEnd,
} from '../kit/keyboard.ts';
import {
  type FocusBackFrom,
  fieldToBlur,
  focusBackMs,
  holdEnds,
  type InputFocusTo,
  type StepCloseStep,
  stepCloseSteps,
} from '../kit/focusBack.ts';
import { stepOpeners } from '../kit/stepOpeners.ts';
import { tokens } from '../theme/tokens.ts';
import { focusedField, watchCheckedField, watchFocusedField } from './focusedField.ts';
import { type ScreenReaderTarget, moveScreenReaderFocus } from './screenReaderFocus.ts';
import {
  LIFT,
  keyboardTopNow,
  settledLift,
  putKeysDownThen,
  useKeysUp,
  watchKeyboardTop,
} from './keyboardWatch.ts';

interface ScreenScrollView {
  ref: RefObject<ScrollViewInstance | null>;
  /** Called when the scroll view itself resizes, which a child's onLayout does not see. */
  resized: Set<() => void>;
  /** Where a view at the screen's top measures in the window. */
  origin: { current: number };
  /** The offset the native scroll view last reported. */
  offset: RefObject<number>;
  /** Keeps the content at least its height now and `more`, until a scroll, a drag or TalkBack's own, brings the view's end back inside the content's real end, or the keys come up again. */
  hold(more: number): void;
  /** Whether a view taking input focus scrolls itself into sight, which Android does by default. */
  focusScrolls(on: boolean): void;
}

const ScreenScroll = createContext<ScreenScrollView | null>(null);

interface ScreenDock {
  /** The height between the scroll view's top and the keys, or null while the keys are down. */
  room: number | null;
  /** Whether the keys cover the screen's end, the only time a bar needs resting on them. */
  covered: boolean;
  /** Whether a bar rests on the keys now. */
  docked: boolean;
  show(docked: Docked | null): void;
}

export interface DockInset {
  horizontal: number;
  vertical: number;
}

interface Docked {
  children: ReactNode;
  inset: DockInset;
  measured: (height: number) => void;
}

const Dock = createContext<ScreenDock | null>(null);

const Origin = createContext(0);

// At the app's root, not a Screen's: under the frame's header a Screen's root starts lower.
export function WindowOrigin({ children }: { children: ReactNode }) {
  const probe = useRef<ViewInstance>(null);
  const [origin, setOrigin] = useState<number | null>(null);

  return (
    <View
      ref={probe}
      onLayout={() => probe.current?.measureInWindow((_x, y) => setOrigin(y))}
      style={styles.fill}
    >
      {origin != null && <Origin.Provider value={origin}>{children}</Origin.Provider>}
    </View>
  );
}

export interface AboveKeyboard {
  ref: RefObject<ViewInstance | null>;
  onLayout: () => void;
}

// Not scrollResponderScrollNativeHandleToKeyboard: it measures as if the scroll view began at
// the top of the window, so under a header it stops short and leaves the button behind the keys.
// Not measureInWindow on the group either: under Fabric it reads a scroll offset that can lag the
// native one, so after the keys' own scroll to the field it can find the button uncovered.
function liftAboveKeyboard(
  scroll: ScreenScrollView | null,
  group: ViewInstance | null,
  keyboardTop: number | null,
): void {
  const view = scroll?.ref.current;
  const content = view?.getInnerViewRef();
  const scrollHost = view?.getNativeScrollRef();
  if (scroll == null || view == null || content == null || scrollHost == null) return;
  if (group == null || keyboardTop == null) return;

  group.measureLayout(content, (_x, contentY, _w, height) => {
    scrollHost.measureInWindow((_sx, scrollTop, _sw, scrollHeight) => {
      const lift = (focusY?: number) => {
        const offset = scroll.offset.current;
        const groupY = groupInWindow({ scrollTop, contentY, offset });
        const shown = shownEnd(keyboardTop, { y: scrollTop, height: scrollHeight });
        const focusTop =
          focusY == null ? undefined : groupInWindow({ scrollTop, contentY: focusY, offset });
        const group = { y: groupY, height };
        if (!liftNeeded({ shown, group, focusTop, scrollTop, margin: tokens.spaceLg })) return;

        view.scrollTo({
          y: offsetAboveKeyboard({
            contentY,
            height,
            scrollTop,
            keyboardTop: shown,
            margin: tokens.spaceLg,
            focusY,
          }),
          animated: true,
        });
      };
      // The field typed in comes first: a group under it lifts only as far as keeps it in sight (sc-11978).
      const field = focusedField();
      if (field == null) lift();
      else
        field.measureLayout(
          content,
          (_fx, focusY) => lift(focusY),
          () => lift(),
        );
    });
  });
}

/** For a field and the button under it, spread on their View. It lifts again when an error grows the group or the keys move, unless `still`: a step closing under its opener moves down, and a lift then would scroll under TalkBack's focus (sc-18588), as would one when Gboard swaps its keys as the holder takes input focus (sc-18587). */
export function useAboveKeyboard(still = false): AboveKeyboard {
  const scroll = useContext(ScreenScroll);
  const ref = useRef<ViewInstance>(null);
  const keyboardTop = useRef<number | null>(keyboardTopNow(scroll?.origin.current ?? 0));
  const stillNow = useRef(still);

  useEffect(() => {
    stillNow.current = still;
  });

  useEffect(() => {
    const { lift, cancel } = settledLift(() => {
      if (!stillNow.current) liftAboveKeyboard(scroll, ref.current, keyboardTop.current);
    });
    const unwatch = watchKeyboardTop(
      () => scroll?.origin.current ?? 0,
      (top) => {
        keyboardTop.current = top;
        lift();
      },
    );
    // On Android the avoiding view shrinks the scroll view after keyboardDidShow, and a scroll
    // asked for before that is clamped short.
    scroll?.resized.add(lift);
    // Next on the keys moves focus without the keys going up again.
    const unwatchFocus = watchFocusedField(lift);

    return () => {
      cancel();
      unwatch();
      unwatchFocus();
      scroll?.resized.delete(lift);
    };
  }, [scroll]);

  return {
    ref,
    onLayout: () => {
      if (!still) liftAboveKeyboard(scroll, ref.current, keyboardTop.current);
    },
  };
}

/** The height a group may take between the scroll view's top and the keyboard, or null while the keys are down. */
export function useRoomAboveKeyboard(): number | null {
  const room = useContext(Dock)?.room;

  return room == null ? null : room - 2 * tokens.spaceLg;
}

export interface AboveKeysProps {
  children: ReactNode;
  inset: DockInset;
  /** The height of the field the children save, kept in sight above them. */
  field: number;
}

/** Rests its children directly on the keys, outside the scroll, while they and the field fit above them; in place otherwise. */
export function AboveKeys({ children, inset, field }: AboveKeysProps) {
  const dock = useContext(Dock);
  const [height, setHeight] = useState<number | null>(null);
  const docked =
    dock?.room != null &&
    dock.covered &&
    height != null &&
    barFits({ room: dock.room, field, bar: height + 2 * inset.vertical, margin: tokens.spaceLg });

  useEffect(() => {
    if (docked) dock.show({ children, inset, measured: setHeight });
  }, [dock, docked, children, inset]);
  useEffect(() => (docked ? () => dock.show(null) : undefined), [dock, docked]);

  return docked ? null : (
    <View onLayout={(event) => setHeight(event.nativeEvent.layout.height)}>{children}</View>
  );
}

/** Brings the view to the top of the screen once it mounts, whatever the scroll it mounted into. */
export function useScrolledToTop(): RefObject<ViewInstance | null> {
  const scroll = useContext(ScreenScroll);
  const top = useRef<ViewInstance>(null);

  useEffect(() => {
    const scrollUp = () => {
      const content = scroll?.ref.current?.getInnerViewRef();
      if (top.current == null || content == null) return;
      top.current.measureLayout(content, (_x, y) => {
        scroll?.ref.current?.scrollTo({ y: Math.max(0, y - tokens.spaceLg), animated: true });
      });
    };
    // Keys that go down after the mount move the content under a scroll already asked for.
    const hidden = Keyboard.isVisible()
      ? Keyboard.addListener('keyboardDidHide', () => {
          hidden?.remove();
          scrollUp();
        })
      : null;
    scrollUp();

    return () => hidden?.remove();
  }, [scroll]);

  return top;
}

// VoiceOver drops a focus asked for while a sheet is still sliding away, and the scroll has to land first.
export const SETTLED_MS = 500;

interface Sight {
  when?: IntoView;
  /** The sight ends at the keys while they are up. */
  aboveKeys?: boolean;
}

function bringIntoView(
  scroll: ScreenScrollView | null,
  line: ScreenReaderTarget | null,
  animated: boolean,
  { when = 'wholly', aboveKeys = false }: Sight = {},
): void {
  const view = scroll?.ref.current;
  const content = view?.getInnerViewRef();
  const scrollHost = view?.getNativeScrollRef();
  if (scroll == null || view == null || content == null || scrollHost == null || line == null)
    return;

  // A field in another screen's scroll fails to measure here, and that screen brings it.
  line.measureLayout(
    content,
    (_x, contentY, _w, height) => {
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
        const to = settledOffset(at, when);
        if (to != null) view.scrollTo({ y: to, animated });
      });
    },
    () => {},
  );
}

/** The Field a client check focuses comes wholly into view above the keys, again once they are up and its error has grown it (sc-20721). */
function useCheckedFieldInView(scroll: ScreenScrollView): void {
  useEffect(() => {
    let cancel = () => {};
    const unwatch = watchCheckedField((field) => {
      cancel();
      const bring = () => bringIntoView(scroll, field, true, { aboveKeys: true });
      const unsettled = settleOnto(
        scroll,
        () => field,
        () => null,
        true,
        SETTLED_MS,
        {
          aboveKeys: true,
        },
      );
      // Keys that rise for the field, and Android's avoiding view shrinking under them, cover it afresh.
      const shown = Keyboard.addListener('keyboardDidShow', bring);
      scroll.resized.add(bring);
      const done = setTimeout(() => cancel(), 2 * SETTLED_MS);
      cancel = () => {
        unsettled();
        shown.remove();
        scroll.resized.delete(bring);
        clearTimeout(done);
      };
    });

    return () => {
      cancel();
      unwatch();
    };
  }, [scroll]);
}

/** Brings `shown` into sight as far as `when`, and again once it has settled, and moves screen reader focus to `read` after `readMs`; returns what cancels the steps still to come. */
function settleOnto(
  scroll: ScreenScrollView | null,
  shown: () => ScreenReaderTarget | null,
  read: () => ScreenReaderTarget | null,
  animated: boolean,
  readMs = SETTLED_MS,
  { when = 'wholly', aboveKeys = false }: Sight = {},
): () => void {
  bringIntoView(scroll, shown(), animated, { when, aboveKeys });

  // Content that shrinks around the line as it mounts can stop the first scroll short (sc-9382).
  const settled = setTimeout(
    () => bringIntoView(scroll, shown(), animated, { when, aboveKeys }),
    SETTLED_MS,
  );
  const focus = setTimeout(() => moveScreenReaderFocus(read()), readMs);

  return () => {
    clearTimeout(settled);
    clearTimeout(focus);
  };
}

export interface BroughtIntoView {
  shown: RefObject<ViewInstance | null>;
  read: RefObject<ViewInstance | null>;
}

/** Brings `shown` wholly into sight once it mounts, unless it already is, then moves screen reader focus to `read` (`readRef` when given). */
export function useBroughtIntoView(readRef?: RefObject<ViewInstance | null>): BroughtIntoView {
  const scroll = useContext(ScreenScroll);
  const ref = useRef<ViewInstance>(null);
  const ownRead = useRef<ViewInstance>(null);
  const read = readRef ?? ownRead;

  useEffect(
    () =>
      settleOnto(
        scroll,
        () => ref.current,
        () => read.current,
        true,
      ),
    [scroll, read],
  );

  return { shown: ref, read };
}

export interface FocusedOnAnswer<Read extends ScreenReaderTarget> {
  shown: RefObject<ViewInstance | null>;
  read: RefObject<Read | null>;
}

/** With a screen reader on, once a tap's `answer` shows, brings `shown` (or `read`, with nothing on `shown`) wholly into sight and moves focus to `read` (`readRef` when given), and again with each new answer; with `answer` undefined, or no screen reader, nothing moves (sc-11032). */
export function useFocusOnAnswer<Read extends ScreenReaderTarget = ViewInstance>(
  answer: unknown,
  readRef?: RefObject<Read | null>,
  readMs = SETTLED_MS,
): FocusedOnAnswer<Read> {
  const scroll = useContext(ScreenScroll);
  const shown = useRef<ViewInstance>(null);
  const ownRead = useRef<Read>(null);
  const read = readRef ?? ownRead;

  useEffect(() => {
    if (answer === undefined) return;

    let gone = false;
    let cancel = () => {};
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      if (!on || gone) return;

      // TalkBack moves its focus onto the rows a running scroll passes, over the words it is saying (sc-11563).
      cancel = settleOnto(
        scroll,
        () => shown.current ?? read.current,
        () => read.current,
        false,
        readMs,
      );
    });

    return () => {
      gone = true;
      cancel();
    };
  }, [answer, read, scroll, readMs]);

  return { shown, read };
}

/** A step closed without a change, back to the opener `to` names; a new one for each close (sc-11173). */
export interface StepClosed {
  to: string;
}

export function stepClosed(to: string): StepClosed {
  return { to };
}

/** With a screen reader on, once `closed` is set, moves focus to the opener it names, or to `fallback` when that opener is not there (sc-11173); `opener(key)` is the ref each opener takes. `from` is where focus comes back from, which `focusBackMs` times. */
export function useFocusBackToOpener(
  closed: StepClosed | undefined,
  fallback?: RefObject<ScreenReaderTarget | null>,
  from: FocusBackFrom = 'step',
): (key: string) => RefCallback<ViewInstance> {
  const [openers] = useState(() => stepOpeners<ViewInstance>());
  const target = useMemo<RefObject<ScreenReaderTarget | null>>(
    () => ({
      get current() {
        return openers.target(closed?.to ?? null, fallback?.current ?? null);
      },
    }),
    [closed, fallback, openers],
  );
  useFocusOnAnswer(closed, target, focusBackMs(Platform.OS, SETTLED_MS, from));

  return openers.ref;
}

export interface StepClose {
  /** The opener's ref, in place of `opener(key)`. */
  opener: RefCallback<ViewInstance>;
  /** The step is closing in order, and its opener shows above it until focus has reached it, so nothing above the opener moves when the step goes (sc-18588). */
  closing: boolean;
  close(): void;
}

export interface HeldStepClose extends StepClose {
  /** Holds input focus in the place of a line of words, which cannot take it, where TalkBack does not read it; rendered while the line shows, first in a View of its own with the line. The close turns scroll-to-focus off while it takes focus, so Save stays put (sc-18587). */
  holder: ReactElement;
}

/** Closes a step back to the opener `to` names in the steps `stepCloseSteps` gives, with input focus going `inputFocusTo` the opener, a control, or to the `holder` it returns, beside a line of words; `finish` takes the step away, with what `useFocusBackToOpener` moves focus back from, or nothing when focus is already there (sc-18588). Without the holder rendered nothing takes input focus, and blurring the field hands focus to the header's back row (sc-18587). */
export function useStepClose(
  opener: (key: string) => RefCallback<ViewInstance>,
  to: string,
  inputFocusTo: 'opener',
  finish: (closed: StepClosed | undefined) => void,
): StepClose;
export function useStepClose(
  opener: (key: string) => RefCallback<ViewInstance>,
  to: string,
  inputFocusTo: 'holder',
  finish: (closed: StepClosed | undefined) => void,
): HeldStepClose;
export function useStepClose(
  opener: (key: string) => RefCallback<ViewInstance>,
  to: string,
  inputFocusTo: InputFocusTo,
  finish: (closed: StepClosed | undefined) => void,
): StepClose | HeldStepClose {
  const scroll = useContext(ScreenScroll);
  const [closing, setClosing] = useState(false);
  const started = useRef(false);
  const view = useRef<ViewInstance | null>(null);
  const holder = useRef<ViewInstance | null>(null);
  const inputFocus = useRef<ViewInstance | null>(null);
  const field = useRef<HostInstance | null>(null);
  const finishNow = useRef(finish);
  const afterShown = useRef<readonly StepCloseStep[]>([]);
  const cancel = useRef(() => {});
  const named = opener(to);
  const ref = useCallback(
    (shown: ViewInstance | null) => {
      named(shown);
      view.current = shown;
    },
    [named],
  );

  useEffect(() => {
    finishNow.current = finish;
  });

  // A field that has since given input focus up leaves the keys up, which only its own blur puts down (sc-18588).
  const raisedBy = useRef<HostInstance | null>(null);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => {
      raisedBy.current = TextInput.State.currentlyFocusedInput() ?? raisedBy.current;
    });
    const hidden = Keyboard.addListener('keyboardDidHide', () => {
      raisedBy.current = null;
    });

    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  const run = useCallback(
    (all: readonly StepCloseStep[]): (() => void) => {
      const cancels: (() => void)[] = [];

      function runFrom(steps: readonly StepCloseStep[]): void {
        for (const [at, step] of steps.entries()) {
          if (step.do === 'holdScroll') {
            scroll?.hold(Keyboard.metrics()?.height ?? 0);
            scroll?.focusScrolls(false);
            cancels.push(() => scroll?.focusScrolls(true));
            continue;
          }
          if (step.do === 'showOpener') {
            afterShown.current = steps.slice(at + 1);
            setClosing(true);
            break;
          }
          if (step.do === 'takeInputFocus') {
            inputFocus.current = step.to === 'holder' ? holder.current : view.current;
            inputFocus.current?.setNativeProps({ hasTVPreferredFocus: true });
            const taken = setTimeout(() => runFrom(steps.slice(at + 1)), step.atMs);
            cancels.push(() => clearTimeout(taken));
            break;
          }
          if (step.do === 'putKeysDown') {
            cancels.push(
              putKeysDownThen(
                () => {
                  // Fabric merges the flag into every later clone of the view, so it would take focus again on each update.
                  inputFocus.current?.setNativeProps({ hasTVPreferredFocus: false });
                  runFrom(steps.slice(at + 1));
                },
                SETTLED_MS,
                field.current,
              ),
            );
            break;
          }
          if (step.do === 'settleOpener') {
            cancels.push(
              settleOnto(
                scroll,
                () => view.current,
                () => (step.read ? view.current : null),
                false,
                SETTLED_MS,
                { when: step.into },
              ),
            );
            continue;
          }

          const done = setTimeout(() => {
            started.current = false;
            scroll?.focusScrolls(true);
            setClosing(false);
            finishNow.current(step.focusBack ? stepClosed(to) : undefined);
          }, step.atMs);
          cancels.push(() => clearTimeout(done));
        }
      }

      runFrom(all);

      return () => cancels.forEach((stop) => stop());
    },
    [scroll, to],
  );

  useEffect(() => () => cancel.current(), []);

  useEffect(() => {
    if (!closing) return;

    // Not cancelled when `finish` ends the closing: the opener's settle has to run after the step has gone (sc-9382).
    const before = cancel.current;
    const stop = run(afterShown.current);
    cancel.current = () => {
      before();
      stop();
    };
  }, [closing, run]);

  const close = useCallback(() => {
    if (started.current) return;
    started.current = true;
    field.current = fieldToBlur(TextInput.State.currentlyFocusedInput(), raisedBy.current);

    let gone = false;
    cancel.current = () => {
      gone = true;
    };
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      if (gone) return;
      cancel.current = run(stepCloseSteps(Platform.OS, on, SETTLED_MS, inputFocusTo));
    });
  }, [run, inputFocusTo]);

  const held = useMemo(() => <FocusHolder holder={holder} />, []);

  return inputFocusTo === 'holder'
    ? { opener: ref, holder: held, closing, close }
    : { opener: ref, closing, close };
}

/** Holds input focus where TalkBack does not read it. */
function FocusHolder({ holder }: { holder: RefObject<ViewInstance | null> }) {
  return (
    <View ref={holder} style={styles.holder} collapsable={false} importantForAccessibility="no" />
  );
}

/** Focus back to the row a page was opened from, as `useFocusBackToOpener` on a `page` return; rendered inside a list's ScrollColumn so the row comes into view. */
export function FocusBack({
  closed,
  fallback,
  children,
}: {
  closed: StepClosed | undefined;
  fallback?: RefObject<ScreenReaderTarget | null>;
  children: (opener: (key: string) => RefCallback<ViewInstance>) => ReactNode;
}) {
  return children(useFocusBackToOpener(closed, fallback, 'page'));
}

/** The scroll context a ScrollView provides, and the props that keep it in step with that view. */
function useScreenScrollView() {
  const windowOrigin = useContext(Origin);
  const origin = useRef(windowOrigin);
  const scrollView = useRef<ScrollViewInstance>(null);
  const offset = useRef(0);
  const contentHeight = useRef(0);
  const [held, setHeld] = useState<number | null>(null);
  const [scrollsToFocus, setScrollsToFocus] = useState(true);
  const [screenScroll] = useState<ScreenScrollView>(() => ({
    ref: scrollView,
    resized: new Set(),
    origin,
    offset,
    hold: (more) => setHeld(contentHeight.current + more),
    focusScrolls: setScrollsToFocus,
  }));
  useEffect(() => {
    origin.current = windowOrigin;
  }, [windowOrigin]);
  useCheckedFieldInView(screenScroll);
  const keysUp = useKeysUp();
  const keysWereUp = useRef(keysUp);
  useEffect(() => {
    const cameUp = keysUp && !keysWereUp.current;
    keysWereUp.current = keysUp;
    if (cameUp) setHeld(null);
  }, [keysUp]);

  const follow = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement } = event.nativeEvent;
    offset.current = contentOffset.y;
    if (
      held != null &&
      holdEnds(contentOffset.y, layoutMeasurement.height, contentHeight.current)
    ) {
      setHeld(null);
    }
  };

  return {
    screenScroll,
    scrollProps: {
      ref: scrollView,
      onLayout: () => screenScroll.resized.forEach((resized) => resized()),
      onScroll: follow,
      onScrollEndDrag: follow,
      onMomentumScrollEnd: follow,
      scrollsChildToFocus: scrollsToFocus,
    },
    heldStyle: held == null ? undefined : { minHeight: held },
    onContentLayout: (event: LayoutChangeEvent) => {
      contentHeight.current = event.nativeEvent.layout.height;
    },
  };
}

/** A scrolling column inside a Screen that does not scroll, so what it holds can bring itself into view. */
export function ScrollColumn({
  children,
  style,
  contentContainerStyle,
  refreshControl,
  away = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  refreshControl?: ReactElement<RefreshControlProps> | undefined;
  /** Out of the layout behind another column; back in, it shows where it was left. */
  away?: boolean;
}) {
  const { screenScroll, scrollProps, heldStyle, onContentLayout } = useScreenScrollView();
  const docked = useContext(Dock)?.docked ?? false;
  const left = useRef<number | null>(null);
  const restore = () => {
    if (away || left.current == null) return;
    screenScroll.ref.current?.scrollTo({ y: left.current, animated: false });
  };

  useEffect(() => {
    if (away) left.current = screenScroll.offset.current > 0 ? screenScroll.offset.current : null;
    else restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [away]);

  return (
    <ScreenScroll.Provider value={screenScroll}>
      <ScrollView
        {...scrollProps}
        onScroll={(event) => {
          if (away) return;
          scrollProps.onScroll(event);
          if (
            left.current != null &&
            Math.abs(event.nativeEvent.contentOffset.y - left.current) < 1
          ) {
            left.current = null;
          }
        }}
        onScrollBeginDrag={() => {
          left.current = null;
        }}
        onContentSizeChange={restore}
        style={style}
        contentContainerStyle={[styles.grow, heldStyle]}
        refreshControl={refreshControl}
        keyboardShouldPersistTaps="handled"
        {...scrollInsets(LIFT, docked)}
      >
        <View onLayout={onContentLayout} style={contentContainerStyle}>
          {children}
        </View>
      </ScrollView>
    </ScreenScroll.Provider>
  );
}

/**
 * The documented way to build a screen. Use this, not a bare View.
 *
 * Android runs edge to edge, so the layout owns the area behind the status and
 * navigation bars and something has to keep content out of them. A screen built
 * on a bare View looks correct on the simulator it was written on and puts a
 * button under the home indicator on the next device.
 *
 * Insets are applied as PADDING on an outer view rather than as a margin,
 * because a margin leaves the background colour short of the bar and shows the
 * window behind it.
 *
 * `useSafeAreaInsets` rather than SafeAreaView: the hook gives the numbers, so
 * a screen that wants the inset at the bottom but not the top — a docked footer
 * over a full-bleed header — can say so. SafeAreaView is all or nothing.
 */
export interface ScreenProps {
  children: ReactNode;
  /** Scrolls by default. Off for a screen that owns its own scrolling. */
  scroll?: boolean;
  /** Which edges to inset. Default is all four. */
  edges?: readonly ('top' | 'bottom' | 'left' | 'right')[];
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

const ALL_EDGES = ['top', 'bottom', 'left', 'right'] as const;

export function Screen({
  children,
  scroll = true,
  edges = ALL_EDGES,
  style,
  contentStyle,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { screenScroll, scrollProps, heldStyle, onContentLayout } = useScreenScrollView();
  const avoider = useRef<ViewInstance>(null);
  const keyboardTop = useRef<number | null>(null);
  const [keysCover, setKeysCover] = useState(0);
  const [room, setRoom] = useState<number | null>(null);
  const [docked, setDocked] = useState<Docked | null>(null);
  const barDocked = docked != null;
  const dock = useMemo<ScreenDock>(
    () => ({ room, covered: keysCover > 0, docked: barDocked, show: setDocked }),
    [room, keysCover, barDocked],
  );
  // Not KeyboardAvoidingView: it takes the screen's top as a prop and does not re-read it when the
  // frame's header shrinks under the keys, so the freed height ends up as padding above them.
  const avoid = useCallback(() => {
    const top = keyboardTop.current;
    if (top == null) {
      setKeysCover(0);
      setRoom(null);
      return;
    }
    avoider.current?.measureInWindow((_x, y, _w, height) => {
      const cover = keysOver({ y, height }, top);
      setKeysCover(cover);
      setRoom(top - y);
    });
  }, []);
  // iOS needs the cover too, but only to rest a docked bar on the keys: its scroll view lifts itself.
  useEffect(() => {
    keyboardTop.current = keyboardTopNow(screenScroll.origin.current);
    avoid();

    return watchKeyboardTop(
      () => screenScroll.origin.current,
      (top) => {
        keyboardTop.current = top;
        avoid();
      },
    );
  }, [screenScroll, avoid]);

  const padding: ViewStyle = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };

  const body = scroll ? (
    <ScrollView
      {...scrollProps}
      style={styles.fill}
      contentContainerStyle={[styles.grow, heldStyle]}
      // So the first tap after typing hits the control rather than only
      // dismissing the keyboard, which otherwise makes every button in a
      // form need pressing twice.
      keyboardShouldPersistTaps="handled"
      {...scrollInsets(LIFT, docked != null)}
    >
      <View onLayout={onContentLayout} style={[styles.content, contentStyle]}>
        {children}
      </View>
    </ScrollView>
  ) : (
    <View style={[styles.fill, styles.content, contentStyle]}>{children}</View>
  );

  return (
    <ScreenScroll.Provider value={scroll ? screenScroll : null}>
      <Dock.Provider value={dock}>
        <View style={[styles.root, padding, style]}>
          <View
            ref={avoider}
            onLayout={avoid}
            style={[
              styles.fill,
              { paddingBottom: LIFT.avoid != null || docked != null ? keysCover : 0 },
            ]}
          >
            {body}
            {docked != null && (
              <View
                style={{
                  paddingHorizontal: docked.inset.horizontal,
                  paddingVertical: docked.inset.vertical,
                }}
              >
                <View onLayout={(event) => docked.measured(event.nativeEvent.layout.height)}>
                  {docked.children}
                </View>
              </View>
            )}
          </View>
        </View>
      </Dock.Provider>
    </ScreenScroll.Provider>
  );
}

const styles = StyleSheet.create({
  // Android gives no input focus to a view without a size.
  holder: { position: 'absolute', width: 1, height: 1 },
  root: { flex: 1, backgroundColor: tokens.colorPage },
  fill: { flex: 1 },
  // The content's own view, without the hold's minHeight, measures where the page really ends.
  grow: { flexGrow: 1 },
  content: { padding: tokens.spaceXxl, gap: tokens.spaceXl },
});
