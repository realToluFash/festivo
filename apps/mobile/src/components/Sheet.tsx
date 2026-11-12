import {
  Fragment,
  type ReactNode,
  type RefObject,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  sheetDragCloses,
  sheetDragSpeed,
  sheetDragStarts,
  sheetKeysCover,
  sheetPadding,
  sheetUnderKeys,
  sheetWindows,
} from '../kit/sheet.ts';
import { useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { glide } from '../motion.ts';
import { useReducedMotion } from '../reducedMotion.ts';
import { useModalOpen } from '../updateRequired.ts';
import { useKeyboardTop, useKeysUp } from './keyboardWatch.ts';
import { SETTLED_MS } from './Screen.tsx';
import { type ScreenReaderTarget, moveScreenReaderFocus } from './screenReaderFocus.ts';
import { Text } from './Text.tsx';

type SheetProps = {
  open: boolean;
  /** System back and VoiceOver's escape; the sheet's own buttons close it themselves. */
  onClose: () => void;
  /** Given, a tap on the scrim closes the sheet, and a screen reader names it so. */
  scrimLabel?: string;
  /** While a request that closing would not stop runs, back, the escape and the scrim do nothing (sc-25667). */
  held?: boolean;
  /** Where screen reader focus goes back to once the sheet has gone. */
  opener: RefObject<ScreenReaderTarget | null>;
  /** Its heading takes screen reader focus as it opens, so TalkBack is given nothing to name the window by. */
  headingTakesFocus?: boolean;
  testID?: string;
  children: ReactNode;
};

type SheetPlaces = {
  put: (id: string, sheet: ReactNode) => void;
  subscribe: (heard: () => void) => () => void;
  current: () => ReadonlyMap<string, ReactNode>;
};

const Places = createContext<SheetPlaces | null>(null);

function sheetPlaces(): SheetPlaces {
  let sheets: ReadonlyMap<string, ReactNode> = new Map();
  const listeners = new Set<() => void>();

  return {
    put: (id, sheet) => {
      const next = new Map(sheets);
      if (sheet == null) next.delete(id);
      else next.set(id, sheet);
      sheets = next;
      listeners.forEach((heard) => heard());
    },
    subscribe: (heard) => {
      listeners.add(heard);
      return () => listeners.delete(heard);
    },
    current: () => sheets,
  };
}

/** Draws every Sheet opened inside it here, so a part hidden with display: none keeps its sheet open (sc-11053). */
export function SheetsAtRoot({ children }: { children: ReactNode }) {
  const [places] = useState(sheetPlaces);

  return (
    <Places.Provider value={places}>
      {children}
      <PlacedSheets places={places} />
    </Places.Provider>
  );
}

function PlacedSheets({ places }: { places: SheetPlaces }) {
  const sheets = useSyncExternalStore(places.subscribe, places.current);

  return [...sheets].map(([id, sheet]) => <Fragment key={id}>{sheet}</Fragment>);
}

/** The app's one dialog frame (sc-8606): a bottom sheet on a phone, a centred card on a tablet. */
export function Sheet(props: SheetProps) {
  const places = useContext(Places);
  const id = useId();
  const sheet = <SheetFrame {...props} />;

  useLayoutEffect(() => {
    places?.put(id, sheet);
  });
  useLayoutEffect(() => () => places?.put(id, null), [places, id]);

  return places == null ? sheet : null;
}

function SheetFrame({
  open,
  onClose,
  scrimLabel,
  held = false,
  opener,
  headingTakesFocus = false,
  testID,
  children,
}: SheetProps) {
  const close = held ? () => undefined : onClose;
  const { kind, height } = useLayout();
  const insets = useSafeAreaInsets();
  const phone = kind === 'phone';
  const underKeys = sheetUnderKeys(Platform.OS, phone);
  const keysUp = useKeysUp();
  const [windowHeight, setWindowHeight] = useState<number | null>(null);
  const keysTop = useKeyboardTop();
  const keysCover = sheetKeysCover({ underKeys, keysUp, windowHeight, keysTop });
  const padding = sheetPadding({ phone, keysCover, insets });
  useFocusBack(open, opener);
  const reduced = useReducedMotion();
  const [onScreen, setOnScreen] = useState(false);
  const [laidOut, setLaidOut] = useState(false);
  const { present, scrim, frame, shift, fade } = useSheetMotion(
    open,
    { laidOut, onScreen },
    phone,
    reduced,
    height,
  );
  const drags = phone && scrimLabel != null;
  const drag = useSheetDrag({ shift, fade, reduced, held, keysCover, onClose });
  const { shown, gone } = useWindowTurn(useModalOpen(present));
  const unnamed = useUnnamedWindow(
    Platform.OS === 'android' && headingTakesFocus && shown,
    onScreen,
  );
  if (!shown && (onScreen || laidOut)) {
    setOnScreen(false);
    setLaidOut(false);
  }

  return (
    <Modal
      visible={shown}
      transparent
      animationType="none"
      // An iOS modal is portrait-only by default, and a rotation under it measures the keys sideways.
      supportedOrientations={['portrait', 'landscape']}
      // Load-bearing for the keys too: without them Android fits the modal to the bars and ends it at the keys.
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}
      onShow={() => setOnScreen(true)}
      onDismiss={gone}
    >
      {Platform.OS === 'android' && headingTakesFocus && <SilentWindowName />}
      {/* A modal is its own window: iOS never resizes it for the keyboard, Android not with the props above. */}
      <KeyboardAvoidingView
        style={styles.fill}
        behavior="padding"
        enabled={!underKeys}
        onLayout={(event) => {
          setWindowHeight(event.nativeEvent.layout.height);
          setLaidOut(true);
        }}
      >
        <View
          style={[
            styles.scrim,
            phone ? styles.scrimPhone : styles.scrimTablet,
            {
              paddingTop: padding.scrimTop,
              paddingLeft: padding.scrimLeft,
              paddingRight: padding.scrimRight,
            },
          ]}
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: phone ? tokens.scrimSheet : tokens.scrimDialog, opacity: scrim },
            ]}
            pointerEvents="none"
          />
          {scrimLabel != null && (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={close}
              disabled={held}
              accessibilityRole="button"
              accessibilityLabel={scrimLabel}
              accessibilityState={{ disabled: held }}
            />
          )}
          <Animated.View
            style={[
              styles.frame,
              phone ? styles.framePhone : styles.frameTablet,
              { paddingBottom: padding.frameBottom },
              frame,
            ]}
            accessibilityViewIsModal
            importantForAccessibility={unnamed ? 'no-hide-descendants' : 'auto'}
            onAccessibilityEscape={close}
            onLayout={drag.onLayout}
            {...(drags ? drag.handlers : {})}
            testID={testID}
          >
            <Revealed.Provider value={!unnamed}>{children}</Revealed.Provider>
            {drags && <View style={styles.grabber} pointerEvents="none" />}
            {/* The avoiding view's padding can stop short of the keys as they rise, so card shows there, never the screen. */}
            {phone && !underKeys && (
              <View style={[styles.skirt, { height }]} pointerEvents="none" />
            )}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** A dialog's buttons as [fd]'s dialog sets them: stacked on a phone, and on a tablet a row at the card's end. */
export function SheetActions({ children }: { children: ReactNode }) {
  const phone = useLayout().kind === 'phone';

  return <View style={phone ? styles.actionsStacked : styles.actionsRow}>{children}</View>;
}

/** Keeps the Modal up until its exit has played, so the sheet can leave rather than vanish. */
function useSheetMotion(
  shown: boolean,
  window: { laidOut: boolean; onScreen: boolean },
  phone: boolean,
  reduced: boolean,
  height: number,
) {
  const { laidOut, onScreen } = window;
  const [present, setPresent] = useState(shown);
  const [scrim] = useState(() => new Animated.Value(0));
  const [shift] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(0));
  const slides = phone && !reduced;
  const travel = useRef(0);

  if (shown && !present) setPresent(true);

  useEffect(() => {
    travel.current = phone ? height : tokens.motionRise;
  });

  useEffect(() => {
    if (!present) return;
    const away = travel.current;

    if (shown) {
      // An entry started before the window's views exist is lost on an iPad, so it waits for their layout, and onShow, when it comes, replays it (sc-23267).
      if (!laidOut || onScreen) {
        scrim.setValue(0);
        fade.setValue(0);
      }
      shift.setValue(reduced ? 0 : away);
      if (!laidOut) return;

      let run: Animated.CompositeAnimation | undefined;
      const next = requestAnimationFrame(() => {
        run = Animated.parallel([
          glide(scrim, 1, tokens.motionBase),
          glide(fade, 1, slides ? 0 : tokens.motionBase),
          glide(shift, 0, slides ? tokens.motionSlow : tokens.motionBase),
        ]);
        run.start(({ finished }) => {
          if (!finished) return;
          scrim.setValue(1);
          fade.setValue(1);
          shift.setValue(0);
        });
      });

      return () => {
        cancelAnimationFrame(next);
        run?.stop();
      };
    }

    const leave = slides || reduced ? tokens.motionBase : tokens.motionFast;
    const run = Animated.parallel([
      glide(scrim, 0, leave),
      slides ? glide(shift, away, leave) : glide(fade, 0, leave),
    ]);
    run.start(({ finished }) => {
      if (finished) setPresent(false);
    });
    return () => run.stop();
  }, [shown, laidOut, onScreen, present, slides, reduced, scrim, shift, fade]);

  return {
    present,
    scrim,
    shift,
    fade,
    frame: { opacity: fade, transform: [{ translateY: shift }] },
  };
}

type SheetDragNow = {
  shift: Animated.Value;
  fade: Animated.Value;
  reduced: boolean;
  held: boolean;
  keysCover: number | null;
  onClose: () => void;
};

type SheetTouch = {
  from: number;
  x0: number;
  y0: number;
  samples: { y: number; t: number }[];
  dragging: boolean;
};

/** Driven by the raw touches, which reach the frame from any child, so no responder negotiation can starve it (sc-27948). */
function sheetDrag(first: SheetDragNow) {
  let now = first;
  // The scrim fills the modal's window from its top, so the frame's y there is where a touch's pageY meets it.
  let frame = { top: 0, height: 0 };
  let touch: SheetTouch | null = null;
  const back = () => {
    const { shift, fade, reduced } = now;
    if (!reduced) {
      glide(shift, 0, tokens.motionBase).start();
      return;
    }
    glide(fade, 0, tokens.motionBase / 2).start(() => {
      shift.setValue(0);
      glide(fade, 1, tokens.motionBase / 2).start();
    });
  };
  // Claimed once the drag is the sheet's, so the content under the strip does not also act on it.
  const { panHandlers } = PanResponder.create({
    onMoveShouldSetPanResponderCapture: () => touch?.dragging === true,
    onPanResponderTerminationRequest: () => false,
  });

  return {
    handlers: {
      ...panHandlers,
      onTouchStart: ({ nativeEvent }: GestureResponderEvent) => {
        const { pageX, pageY, timestamp, touches } = nativeEvent;
        if (touch?.dragging) back();
        touch =
          touches.length === 1
            ? {
                from: pageY - frame.top,
                x0: pageX,
                y0: pageY,
                samples: [{ y: pageY, t: timestamp }],
                dragging: false,
              }
            : null;
      },
      onTouchMove: ({ nativeEvent }: GestureResponderEvent) => {
        if (touch == null) return;
        const { pageX, pageY, timestamp } = nativeEvent;
        const dy = pageY - touch.y0;
        touch.dragging ||= sheetDragStarts({ from: touch.from, dx: pageX - touch.x0, dy });
        if (!touch.dragging) return;
        touch.samples = [...touch.samples, { y: pageY, t: timestamp }];
        now.shift.setValue(Math.max(0, dy));
      },
      onTouchEnd: ({ nativeEvent }: GestureResponderEvent) => {
        const ended = touch;
        touch = null;
        if (!ended?.dragging) return;
        const closes = sheetDragCloses({
          dy: nativeEvent.pageY - ended.y0,
          vy: sheetDragSpeed(ended.samples, { y: nativeEvent.pageY, t: nativeEvent.timestamp }),
          height: frame.height,
          keysCover: now.keysCover,
          held: now.held,
        });
        if (closes) now.onClose();
        else back();
      },
      onTouchCancel: () => {
        const cancelled = touch;
        touch = null;
        if (cancelled?.dragging) back();
      },
    },
    onLayout: (event: LayoutChangeEvent) => {
      const { y, height } = event.nativeEvent.layout;
      frame = { top: y, height };
    },
    follow: (next: SheetDragNow) => {
      now = next;
    },
  };
}

/** A phone sheet that closes on a tap outside follows a drag down from its top strip, and closes past half or on a flick (sc-27948). */
function useSheetDrag(now: SheetDragNow) {
  const [drag] = useState(() => sheetDrag(now));
  useLayoutEffect(() => drag.follow(now));

  return drag;
}

/** Every modal window in the app, wherever it is drawn: iOS has one stack of them, not one per SheetsAtRoot. */
const appWindows = sheetWindows();

/** iOS cannot put a window up while another is going, so a modal waits its turn; `gone` is its onDismiss (sc-23267). */
export function useWindowTurn(wanted: boolean): { shown: boolean; gone: () => void } {
  const id = useId();
  const waits = useSyncExternalStore(appWindows.subscribe, () => appWindows.waits(id));
  const shown = wanted && !waits;
  const gone = useCallback(() => appWindows.lower(id), [id]);

  useLayoutEffect(() => {
    if (shown) {
      appWindows.raise(id);
      return;
    }
    if (Platform.OS !== 'ios') {
      appWindows.lower(id);
      return;
    }
    // onDismiss comes once iOS has taken the window down; the timer keeps a lost one from holding every sheet back.
    const lost = setTimeout(() => appWindows.lower(id), SETTLED_MS);

    return () => clearTimeout(lost);
  }, [id, shown]);
  useLayoutEffect(() => gone, [gone]);

  return { shown, gone };
}

/** Hidden until TalkBack has announced the window, counted from when Android has put it up and, as it opens, `arriving` ms more while it slides or fades in, so a heading that takes focus is read once, when focus reaches it; a new `step` in a window that stays up hides it again. Hiding does not stop Android naming the window by its first text: `SilentWindowName` does that (sc-11032). */
export function useUnnamedWindow(
  hides: boolean,
  onScreen: boolean,
  step: unknown = null,
  arriving = 0,
): boolean {
  const [announced, setAnnounced] = useState<{ step: unknown } | null>(null);
  if (!onScreen && announced != null) setAnnounced(null);
  const waiting = announced == null || announced.step !== step;
  const opening = announced == null;

  useEffect(() => {
    if (!hides || !onScreen || !waiting) return;
    const wait = (opening ? arriving : 0) + SETTLED_MS / 2;
    const shown = setTimeout(() => setAnnounced({ step }), wait);

    return () => clearTimeout(shown);
  }, [hides, onScreen, waiting, opening, arriving, step]);

  return hides && waiting;
}

// U+200B: a name TalkBack speaks as nothing.
const SILENT = '\u200b';

/** Android names a window by the first text it holds, hidden or not, and TalkBack said that name ("Cancel", "Turn") on its own before focus reached the title (sc-11032). */
export function SilentWindowName() {
  return (
    <View
      style={styles.windowName}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text accessible={false} importantForAccessibility="no">
        {SILENT}
      </Text>
    </View>
  );
}

const Revealed = createContext(true);

/** False while a sheet that names no window hides its content, so a heading waits to take focus until it can (sc-11032). */
export function useSheetRevealed(): boolean {
  return useContext(Revealed);
}

/** Hands screen reader focus back to `opener` once a sheet or dialog that was open has gone (WCAG 2.4.3). */
export function useFocusBack(open: boolean, opener: RefObject<ScreenReaderTarget | null>): void {
  const wasOpen = useRef(open);

  useEffect(() => {
    const closed = wasOpen.current && !open;
    wasOpen.current = open;
    if (!closed) return;

    const focus = setTimeout(() => moveScreenReaderFocus(opener.current), SETTLED_MS);

    return () => clearTimeout(focus);
  }, [open, opener]);
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // Above everything else in the window, so Android, which orders a window's texts top to bottom, takes it first.
  windowName: { position: 'absolute', top: -1, left: 0, width: 1, height: 1, opacity: 0 },
  scrim: { flex: 1 },
  scrimPhone: { justifyContent: 'flex-end' },
  scrimTablet: {
    justifyContent: 'center',
    padding: tokens.spaceXxl,
  },
  frame: {
    flexShrink: 1,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  framePhone: {
    borderBottomWidth: 0,
    borderTopLeftRadius: tokens.radiusSheet,
    borderTopRightRadius: tokens.radiusSheet,
  },
  frameTablet: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 480,
    borderRadius: tokens.radiusCardPhone,
  },
  actionsStacked: { gap: tokens.spaceSm },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tokens.spaceMd,
  },
  grabber: {
    position: 'absolute',
    top: tokens.spaceSm,
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: tokens.colorControlBorder,
  },
  skirt: {
    position: 'absolute',
    top: '100%',
    left: -1,
    right: -1,
    backgroundColor: tokens.colorCard,
  },
});
