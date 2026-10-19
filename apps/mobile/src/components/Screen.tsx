import {
  type ReactNode,
  type RefObject,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { keyboardLift, coveredBy, offsetAboveKeyboard } from '../kit/keyboard.ts';
import { tokens } from '../theme/tokens.ts';

const LIFT = keyboardLift(Platform.OS);

type InnerViewRef = ScrollView & { getInnerViewRef(): View | null };

interface ScreenScrollView {
  ref: RefObject<ScrollView | null>;
  /** Called when the scroll view itself resizes, which a child's onLayout does not see. */
  resized: Set<() => void>;
}

const ScreenScroll = createContext<ScreenScrollView | null>(null);

export interface AboveKeyboard {
  ref: RefObject<View | null>;
  onLayout: () => void;
}

// Not scrollResponderScrollNativeHandleToKeyboard: it measures as if the scroll view began at
// the top of the window, so under a header it stops short and leaves the button behind the keys.
function liftAboveKeyboard(
  scroll: RefObject<ScrollView | null> | undefined,
  group: View | null,
  keyboardTop: number | null,
): void {
  const view = scroll?.current;
  const content = (view as InnerViewRef | null | undefined)?.getInnerViewRef();
  const scrollHost = view?.getNativeScrollRef();
  if (view == null || content == null || scrollHost == null) return;
  if (group == null || keyboardTop == null) return;

  group.measureInWindow((_gx, groupY, _gw, groupHeight) => {
    if (!coveredBy(keyboardTop, { y: groupY, height: groupHeight }, tokens.spaceLg)) return;

    group.measureLayout(content, (_x, contentY, _w, height) => {
      scrollHost.measureInWindow((_sx, scrollTop) => {
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
  });
}

/** For a field and the button under it, spread on their View. It lifts again when an error grows the group. */
export function useAboveKeyboard(): AboveKeyboard {
  const scroll = useContext(ScreenScroll);
  const ref = useRef<View>(null);
  const keyboardTop = useRef<number | null>(
    Keyboard.isVisible() ? (Keyboard.metrics()?.screenY ?? null) : null,
  );

  useEffect(() => {
    const lift = () => {
      if (keyboardTop.current != null)
        liftAboveKeyboard(scroll?.ref, ref.current, keyboardTop.current);
    };
    const shown = Keyboard.addListener('keyboardDidShow', (event) => {
      keyboardTop.current = event.endCoordinates.screenY;
      lift();
    });
    const hidden = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = null;
    });
    // On Android the avoiding view shrinks the scroll view after keyboardDidShow, and a scroll
    // asked for before that is clamped short.
    scroll?.resized.add(lift);

    return () => {
      shown.remove();
      hidden.remove();
      scroll?.resized.delete(lift);
    };
  }, [scroll]);

  return {
    ref,
    onLayout: () => liftAboveKeyboard(scroll?.ref, ref.current, keyboardTop.current),
  };
}

/** The height a group may take between the scroll view's top and the keyboard, or null while the keys are down. */
export function useRoomAboveKeyboard(): number | null {
  const scroll = useContext(ScreenScroll);
  const [room, setRoom] = useState<number | null>(null);

  useEffect(() => {
    let keyboardTop: number | null = Keyboard.isVisible()
      ? (Keyboard.metrics()?.screenY ?? null)
      : null;
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
    const shown = Keyboard.addListener('keyboardDidShow', (event) => {
      keyboardTop = event.endCoordinates.screenY;
      measure();
    });
    const hidden = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop = null;
      measure();
    });
    scroll?.resized.add(measure);
    measure();

    return () => {
      shown.remove();
      hidden.remove();
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
  const scrollView = useRef<ScrollView>(null);
  const [screenScroll] = useState<ScreenScrollView>(() => ({
    ref: scrollView,
    resized: new Set(),
  }));

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
          <KeyboardAvoidingView style={styles.fill} behavior={LIFT.avoid}>
            {body}
          </KeyboardAvoidingView>
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
