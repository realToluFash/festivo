import {
  type ReactNode,
  type RefObject,
  createContext,
  useContext,
  useEffect,
  useRef,
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

import { keyboardLift } from '../kit/keyboard.ts';
import { tokens } from '../theme/tokens.ts';

const LIFT = keyboardLift(Platform.OS);

const ScreenScroll = createContext<RefObject<ScrollView | null> | null>(null);

/** For a field and the button under it: the lift alone shows the field, and leaves the button behind the keys. */
export function useAboveKeyboard(): RefObject<View | null> {
  const scroll = useContext(ScreenScroll);
  const group = useRef<View>(null);

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => {
      if (group.current == null) return;
      scroll?.current?.scrollResponderScrollNativeHandleToKeyboard(
        group.current,
        tokens.spaceLg,
        true,
      );
    });

    return () => shown.remove();
  }, [scroll]);

  return group;
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

  const padding: ViewStyle = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };

  const body = scroll ? (
    <ScrollView
      ref={scrollView}
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
    <ScreenScroll.Provider value={scroll ? scrollView : null}>
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
