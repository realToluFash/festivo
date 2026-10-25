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
  Keyboard,
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
import { keyboardTopNow, watchKeyboardTop } from './keyboardWatch.ts';
import { SETTLED_MS } from './Screen.tsx';
import { type ScreenReaderTarget, moveScreenReaderFocus } from './screenReaderFocus.ts';

type SheetProps = {
  open: boolean;
  /** System back; the sheet's own buttons close it themselves. */
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

  return (
    <Modal
      visible={open}
      transparent
      animationType={phone ? 'slide' : 'fade'}
      // An iOS modal is portrait-only by default, and a rotation under it measures the keys sideways.
      supportedOrientations={['portrait', 'landscape']}
      // Load-bearing for the keys too: without them Android fits the modal to the bars and ends it at the keys.
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
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
          {scrimLabel != null && (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={scrimLabel}
            />
          )}
          <View
            style={[
              styles.frame,
              phone ? styles.framePhone : styles.frameTablet,
              { paddingBottom: padding.frameBottom },
            ]}
            accessibilityViewIsModal
            testID={testID}
          >
            {children}
            {/* The avoiding view's padding can stop short of the keys as they rise, so card shows there, never the screen. */}
            {phone && !underKeys && (
              <View style={[styles.skirt, { height }]} pointerEvents="none" />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** The keyboard's top edge in the sheet's window, or null while the keys are down. */
function useKeyboardTop(): number | null {
  const [top, setTop] = useState(() => keyboardTopNow(0));

  useEffect(() => watchKeyboardTop(() => 0, setTop), []);

  return top;
}

/** Hands screen reader focus back to `opener` once a sheet that was open has slid away (WCAG 2.4.3). */
function useFocusBack(open: boolean, opener: RefObject<ScreenReaderTarget | null>): void {
  const wasOpen = useRef(open);

  useEffect(() => {
    const closed = wasOpen.current && !open;
    wasOpen.current = open;
    if (!closed) return;

    const focus = setTimeout(() => moveScreenReaderFocus(opener.current), SETTLED_MS);

    return () => clearTimeout(focus);
  }, [open, opener]);
}

/** Whether the keyboard is up, changing when the avoiding view starts to move. */
export function useKeysUp(): boolean {
  const [up, setUp] = useState(() => keyboardTopNow(0) != null);

  useEffect(() => {
    // iOS's avoiding view pads on the Will events and Android's on the Did ones.
    const ios = Platform.OS === 'ios';
    const shown = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () =>
      setUp(true),
    );
    const hidden = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setUp(false),
    );

    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return up;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrim: { flex: 1 },
  scrimPhone: { justifyContent: 'flex-end', backgroundColor: tokens.scrimSheet },
  scrimTablet: {
    justifyContent: 'center',
    padding: tokens.spaceXxl,
    backgroundColor: tokens.scrimDialog,
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
  skirt: {
    position: 'absolute',
    top: '100%',
    left: -1,
    right: -1,
    backgroundColor: tokens.colorCard,
  },
});
