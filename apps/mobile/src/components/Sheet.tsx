import {
  Fragment,
  type ReactNode,
  type RefObject,
  createContext,
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
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sheetKeysCover, sheetPadding, sheetUnderKeys } from '../kit/sheet.ts';
import { useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { glide } from '../motion.ts';
import { useReducedMotion } from '../reducedMotion.ts';
import { useModalOpen } from '../updateRequired.ts';
import { keyboardTopNow, useKeysUp, watchKeyboardTop } from './keyboardWatch.ts';
import { SETTLED_MS } from './Screen.tsx';
import { type ScreenReaderTarget, moveScreenReaderFocus } from './screenReaderFocus.ts';

type SheetProps = {
  open: boolean;
  /** System back and VoiceOver's escape; the sheet's own buttons close it themselves. */
  onClose: () => void;
  /** Given, a tap on the scrim closes the sheet, and a screen reader names it so. */
  scrimLabel?: string;
  /** Where screen reader focus goes back to once the sheet has gone. */
  opener: RefObject<ScreenReaderTarget | null>;
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

function SheetFrame({ open, onClose, scrimLabel, opener, testID, children }: SheetProps) {
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
  const { present, scrim, frame } = useSheetMotion(open, onScreen, phone, reduced, height);
  const shown = useModalOpen(present);
  if (!shown && onScreen) setOnScreen(false);

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
      onRequestClose={onClose}
      onShow={() => setOnScreen(true)}
    >
      {/* A modal is its own window: iOS never resizes it for the keyboard, Android not with the props above. */}
      <KeyboardAvoidingView
        style={styles.fill}
        behavior="padding"
        enabled={!underKeys}
        onLayout={(event) => setWindowHeight(event.nativeEvent.layout.height)}
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
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={scrimLabel}
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
            onAccessibilityEscape={onClose}
            testID={testID}
          >
            {children}
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
  onScreen: boolean,
  phone: boolean,
  reduced: boolean,
  height: number,
) {
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
      shift.setValue(reduced ? 0 : away);
      // Started before the Modal's window is up, an iPad lost the native-driven entry and kept the card at opacity 0 (sc-23267).
      if (!onScreen) return;
      const run = Animated.parallel([
        glide(scrim, 1, tokens.motionBase),
        glide(fade, 1, slides ? 0 : tokens.motionBase),
        glide(shift, 0, slides ? tokens.motionSlow : tokens.motionBase),
      ]);
      run.start();
      return () => run.stop();
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
  }, [shown, onScreen, present, slides, reduced, scrim, shift, fade]);

  return { present, scrim, frame: { opacity: fade, transform: [{ translateY: shift }] } };
}

/** The keyboard's top edge in the sheet's window, or null while the keys are down. */
function useKeyboardTop(): number | null {
  const [top, setTop] = useState(() => keyboardTopNow(0));

  useEffect(() => watchKeyboardTop(() => 0, setTop), []);

  return top;
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
  skirt: {
    position: 'absolute',
    top: '100%',
    left: -1,
    right: -1,
    backgroundColor: tokens.colorCard,
  },
});
