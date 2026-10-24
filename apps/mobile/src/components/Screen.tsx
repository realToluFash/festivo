import {
  type ReactNode,
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
  Keyboard,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  ScrollView,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
  findNodeHandle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  barFits,
  coveredBy,
  groupInWindow,
  keysOver,
  offsetAboveKeyboard,
  offsetIntoView,
  scrollInsets,
  shownEnd,
} from '../kit/keyboard.ts';
import { tokens } from '../theme/tokens.ts';
import { LIFT, keyboardTopNow, settledLift, watchKeyboardTop } from './keyboardWatch.ts';

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

interface ScreenDock {
  /** The height between the scroll view's top and the keys, or null while the keys are down. */
  room: number | null;
  /** Whether the keys cover the screen's end, the only time a bar needs resting on them. */
  covered: boolean;
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
    scrollHost.measureInWindow((_sx, scrollTop, _sw, scrollHeight) => {
      const groupY = groupInWindow({ scrollTop, contentY, offset: scroll.offset.current });
      const shown = shownEnd(keyboardTop, { y: scrollTop, height: scrollHeight });
      if (!coveredBy(shown, { y: groupY, height }, tokens.spaceLg)) return;

      view.scrollTo({
        y: offsetAboveKeyboard({
          contentY,
          height,
          scrollTop,
          keyboardTop: shown,
          margin: tokens.spaceLg,
        }),
        animated: true,
      });
    });
  });
}

/** For a field and the button under it, spread on their View. It lifts again when an error grows the group. */
export function useAboveKeyboard(): AboveKeyboard {
  const scroll = useContext(ScreenScroll);
  const ref = useRef<View>(null);
  const keyboardTop = useRef<number | null>(keyboardTopNow(scroll?.origin.current ?? 0));

  useEffect(() => {
    const { lift, cancel } = settledLift(() =>
      liftAboveKeyboard(scroll, ref.current, keyboardTop.current),
    );
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

    return () => {
      cancel();
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

// VoiceOver drops a focus asked for while a sheet is still sliding away, and the scroll has to land first.
const SETTLED_MS = 500;

/** Brings the view wholly into sight once it mounts, unless it already is, then moves screen reader focus to it, or on Android, where TalkBack ignores that focus (sc-9950), reads its words out. */
export function useBroughtIntoView(words: string): RefObject<View | null> {
  const scroll = useContext(ScreenScroll);
  const ref = useRef<View>(null);

  useEffect(() => {
    const view = scroll?.ref.current;
    const content = (view as InnerViewRef | null | undefined)?.getInnerViewRef();
    const scrollHost = view?.getNativeScrollRef();

    if (scroll != null && view != null && content != null && scrollHost != null) {
      ref.current?.measureLayout(content, (_x, contentY, _w, height) => {
        scrollHost.measureInWindow((_sx, _sy, _sw, shown) => {
          const y = offsetIntoView({
            contentY,
            height,
            offset: scroll.offset.current,
            shown,
            margin: tokens.spaceLg,
          });
          if (y != null) view.scrollTo({ y, animated: true });
        });
      });
    }

    const focus = setTimeout(() => {
      if (Platform.OS === 'android') {
        AccessibilityInfo.announceForAccessibility(words);
        return;
      }
      const node = findNodeHandle(ref.current);
      if (node != null) AccessibilityInfo.setAccessibilityFocus(node);
    }, SETTLED_MS);

    return () => clearTimeout(focus);
  }, [scroll, words]);

  return ref;
}

/** The scroll context a ScrollView provides, and the props that keep it in step with that view. */
function useScreenScrollView() {
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

  const follow = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = event.nativeEvent.contentOffset.y;
  };

  return {
    screenScroll,
    scrollProps: {
      ref: scrollView,
      onLayout: () => screenScroll.resized.forEach((resized) => resized()),
      onScroll: follow,
      onScrollEndDrag: follow,
      onMomentumScrollEnd: follow,
    },
  };
}

/** A scrolling column inside a Screen that does not scroll, so what it holds can bring itself into view. */
export function ScrollColumn({
  children,
  style,
  contentContainerStyle,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const { screenScroll, scrollProps } = useScreenScrollView();

  return (
    <ScreenScroll.Provider value={screenScroll}>
      <ScrollView {...scrollProps} style={style} contentContainerStyle={contentContainerStyle}>
        {children}
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
  const { screenScroll, scrollProps } = useScreenScrollView();
  const avoider = useRef<View>(null);
  const keyboardTop = useRef<number | null>(null);
  const [keysCover, setKeysCover] = useState(0);
  const [room, setRoom] = useState<number | null>(null);
  const [docked, setDocked] = useState<Docked | null>(null);
  const dock = useMemo<ScreenDock>(
    () => ({ room, covered: keysCover > 0, show: setDocked }),
    [room, keysCover],
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
      contentContainerStyle={[styles.content, contentStyle]}
      // So the first tap after typing hits the control rather than only
      // dismissing the keyboard, which otherwise makes every button in a
      // form need pressing twice.
      keyboardShouldPersistTaps="handled"
      {...scrollInsets(LIFT, docked != null)}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, styles.content, contentStyle]}>{children}</View>
  );

  return (
    <ScreenScroll.Provider value={scroll ? screenScroll : null}>
      <Dock.Provider value={scroll ? dock : null}>
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
  root: { flex: 1, backgroundColor: tokens.colorPage },
  fill: { flex: 1 },
  content: { padding: tokens.spaceXxl, gap: tokens.spaceXl },
});
