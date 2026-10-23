import {
  type ReactNode,
  type RefObject,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Keyboard,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  coveredBy,
  groupInWindow,
  keyboardInWindow,
  keyboardLift,
  keysOver,
  offsetAboveKeyboard,
} from '../kit/keyboard.ts';
import { tokens } from '../theme/tokens.ts';

const LIFT = keyboardLift(Platform.OS);

// Once the avoiding view shrinks it, Android's ScrollView smooth-scrolls the focused field to its
// own bottom edge over 250ms, and that can land after our lift and leave the button under the keys.
const NATIVE_FOCUS_SCROLL_MS = 400;

type InnerViewRef = ScrollView & { getInnerViewRef(): View | null };

interface ScreenScrollView {
  ref: RefObject<ScrollView | null>;
  /** Called when the scroll view itself resizes, which a child's onLayout does not see. */
  resized: Set<() => void>;
  /** Where a view at the screen's top measures in the window. */
  origin: { current: number };
  /** The offset the native scroll view last reported. */
  offset: RefObject<number>;
}

const ScreenScroll = createContext<ScreenScrollView | null>(null);

const Origin = createContext(0);

// At the app's root, not a Screen's: under the frame's header a Screen's root starts lower.
export function WindowOrigin({ children }: { children: ReactNode }) {
  const probe = useRef<View>(null);
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
  ref: RefObject<View | null>;
  onLayout: () => void;
}

// Not scrollResponderScrollNativeHandleToKeyboard: it measures as if the scroll view began at
// the top of the window, so under a header it stops short and leaves the button behind the keys.
// Not measureInWindow on the group either: under Fabric it reads a scroll offset that can lag the
// native one, so after the keys' own scroll to the field it can find the button uncovered.
function liftAboveKeyboard(
  scroll: ScreenScrollView | null,
  group: View | null,
  keyboardTop: number | null,
): void {
  const view = scroll?.ref.current;
  const content = (view as InnerViewRef | null | undefined)?.getInnerViewRef();
  const scrollHost = view?.getNativeScrollRef();
  if (scroll == null || view == null || content == null || scrollHost == null) return;
  if (group == null || keyboardTop == null) return;

  group.measureLayout(content, (_x, contentY, _w, height) => {
    scrollHost.measureInWindow((_sx, scrollTop) => {
      const groupY = groupInWindow({ scrollTop, contentY, offset: scroll.offset.current });
      if (!coveredBy(keyboardTop, { y: groupY, height }, tokens.spaceLg)) return;

      view.scrollTo({
        y: offsetAboveKeyboard({
          contentY,
          height,
          scrollTop,
          keyboardTop,
          margin: tokens.spaceLg,
        }),
        animated: true,
      });
    });
  });
}

/** Where the keyboard's top edge sits in the window, or null while the keys are down. */
function keyboardTopNow(origin: number): number | null {
  const screenY = Keyboard.isVisible() ? Keyboard.metrics()?.screenY : undefined;

  return screenY == null ? null : keyboardInWindow(screenY, origin);
}

/** Calls `changed` with the keyboard's new top edge each time the keys go up or down. Returns the unsubscribe. */
function watchKeyboardTop(
  scroll: ScreenScrollView | null,
  changed: (top: number | null) => void,
): () => void {
  const shown = Keyboard.addListener('keyboardDidShow', (event) =>
    changed(keyboardInWindow(event.endCoordinates.screenY, scroll?.origin.current ?? 0)),
  );
  const hidden = Keyboard.addListener('keyboardDidHide', () => changed(null));

  return () => {
    shown.remove();
    hidden.remove();
  };
}

/** For a field and the button under it, spread on their View. It lifts again when an error grows the group. */
export function useAboveKeyboard(): AboveKeyboard {
  const scroll = useContext(ScreenScroll);
  const ref = useRef<View>(null);
  const keyboardTop = useRef<number | null>(keyboardTopNow(scroll?.origin.current ?? 0));

  useEffect(() => {
    let settled: ReturnType<typeof setTimeout> | undefined;
    const liftNow = () => liftAboveKeyboard(scroll, ref.current, keyboardTop.current);
    const lift = () => {
      liftNow();
      if (LIFT.avoid == null) return;
      clearTimeout(settled);
      settled = setTimeout(liftNow, NATIVE_FOCUS_SCROLL_MS);
    };
    const unwatch = watchKeyboardTop(scroll, (top) => {
      keyboardTop.current = top;
      lift();
    });
    // On Android the avoiding view shrinks the scroll view after keyboardDidShow, and a scroll
    // asked for before that is clamped short.
    scroll?.resized.add(lift);

    return () => {
      clearTimeout(settled);
      unwatch();
      scroll?.resized.delete(lift);
    };
  }, [scroll]);

  return {
    ref,
    onLayout: () => liftAboveKeyboard(scroll, ref.current, keyboardTop.current),
  };
}

/** The height a group may take between the scroll view's top and the keyboard, or null while the keys are down. */
export function useRoomAboveKeyboard(): number | null {
  const scroll = useContext(ScreenScroll);
  const [room, setRoom] = useState<number | null>(null);

  useEffect(() => {
    let keyboardTop = keyboardTopNow(scroll?.origin.current ?? 0);
    const measure = () => {
      const scrollHost = scroll?.ref.current?.getNativeScrollRef();
      if (keyboardTop == null || scrollHost == null) {
        setRoom(null);
        return;
      }
      const top = keyboardTop;
      scrollHost.measureInWindow((_x, scrollTop) => {
        setRoom(top - scrollTop - 2 * tokens.spaceLg);
      });
    };
    const unwatch = watchKeyboardTop(scroll, (top) => {
      keyboardTop = top;
      measure();
    });
    scroll?.resized.add(measure);
    measure();

    return () => {
      unwatch();
      scroll?.resized.delete(measure);
    };
  }, [scroll]);

  return room;
}

/** Brings the view to the top of the screen once it mounts, whatever the scroll it mounted into. */
export function useScrolledToTop(): RefObject<View | null> {
  const scroll = useContext(ScreenScroll);
  const top = useRef<View>(null);

  useEffect(() => {
    const scrollUp = () => {
      // RN declares getInnerViewRef in ScrollView.js but not in its .d.ts; measureLayout needs that element.
      const content = (scroll?.ref.current as InnerViewRef | null | undefined)?.getInnerViewRef();
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
  const windowOrigin = useContext(Origin);
  const origin = useRef(windowOrigin);
  const scrollView = useRef<ScrollView>(null);
  const offset = useRef(0);
  const [screenScroll] = useState<ScreenScrollView>(() => ({
    ref: scrollView,
    resized: new Set(),
    origin,
    offset,
  }));
  useEffect(() => {
    origin.current = windowOrigin;
  }, [windowOrigin]);
  const avoider = useRef<View>(null);
  const keyboardTop = useRef<number | null>(null);
  const [keysCover, setKeysCover] = useState(0);
  // Not KeyboardAvoidingView: it takes the screen's top as a prop and does not re-read it when the
  // frame's header shrinks under the keys, so the freed height ends up as padding above them.
  const avoid = useCallback(() => {
    const top = keyboardTop.current;
    if (top == null) {
      setKeysCover(0);
      return;
    }
    avoider.current?.measureInWindow((_x, y, _w, height) =>
      setKeysCover(keysOver({ y, height }, top)),
    );
  }, []);
  useEffect(() => {
    if (LIFT.avoid == null) return;
    keyboardTop.current = keyboardTopNow(origin.current);
    avoid();

    return watchKeyboardTop(screenScroll, (top) => {
      keyboardTop.current = top;
      avoid();
    });
  }, [screenScroll, avoid]);

  const followOffset = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = event.nativeEvent.contentOffset.y;
  };

  const padding: ViewStyle = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };

  const body = scroll ? (
    <ScrollView
      ref={scrollView}
      onLayout={() => screenScroll.resized.forEach((resized) => resized())}
      onScroll={followOffset}
      onScrollEndDrag={followOffset}
      onMomentumScrollEnd={followOffset}
      style={styles.fill}
      contentContainerStyle={[styles.content, contentStyle]}
      // So the first tap after typing hits the control rather than only
      // dismissing the keyboard, which otherwise makes every button in a
      // form need pressing twice.
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets={LIFT.adjustScrollInsets}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, styles.content, contentStyle]}>{children}</View>
  );

  return (
    <ScreenScroll.Provider value={scroll ? screenScroll : null}>
      <View style={[styles.root, padding, style]}>
        {LIFT.avoid == null ? (
          body
        ) : (
          <View ref={avoider} onLayout={avoid} style={[styles.fill, { paddingBottom: keysCover }]}>
            {body}
          </View>
        )}
      </View>
    </ScreenScroll.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.colorPage },
  fill: { flex: 1 },
  content: { padding: tokens.spaceXxl, gap: tokens.spaceXl },
});
