import { useIsFocused } from 'expo-router';
import {
  type ReactNode,
  type Ref,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  KeyboardAvoidingView,
  type LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  View,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SETTLED_MS } from '../../components/Screen.tsx';
import {
  type ScreenReaderTarget,
  moveScreenReaderFocus,
} from '../../components/screenReaderFocus.ts';
import { useFocusBack, useWindowTurn } from '../../components/Sheet.tsx';
import { type TextHandle, Text } from '../../components/Text.tsx';
import { Toast } from '../../components/Toast.tsx';
import { TURNS_WITH_THE_APP } from '../../layout/orientations.ts';
import { useReducedMotion } from '../../reducedMotion.ts';
import { tokens } from '../../theme/tokens.ts';
import { useModalOpen } from '../../updateRequired.ts';
import { Glyph } from '../../components/Glyph.tsx';
import { useShell } from './Frame.tsx';
import { TextAction } from './SummaryRows.tsx';

type Opener = RefObject<ScreenReaderTarget | null>;

/** A window taken down with its page is still going for a moment, and iOS loses one put up meanwhile. */
const going = { until: 0 };
const GOING_MS = SETTLED_MS * 2;

function useClearOfGoing(): boolean {
  const [clear, setClear] = useState(false);

  useEffect(() => {
    const wait = setTimeout(() => setClear(true), Math.max(0, going.until - Date.now()));

    return () => clearTimeout(wait);
  }, []);

  return clear;
}

/** Up only while its page is the one showing; an Ask or a menu closes when another page comes over it, a task's screen waits. */
function Window({
  open,
  onClose,
  opener,
  slides = false,
  waitsAway = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  opener: Opener;
  slides?: boolean;
  waitsAway?: boolean;
  children: ReactNode;
}) {
  useFocusBack(open, opener);
  const reduced = useReducedMotion();
  const here = useIsFocused();
  const clear = useClearOfGoing();
  const { shown, gone } = useWindowTurn(useModalOpen(open && here && clear));
  const showing = useRef(false);

  useLayoutEffect(() => {
    showing.current = shown;
  }, [shown]);
  useLayoutEffect(
    () => () => {
      if (showing.current) going.until = Date.now() + GOING_MS;
    },
    [],
  );
  useEffect(() => {
    if (open && !here && !waitsAway) onClose();
  }, [open, here, waitsAway, onClose]);

  return (
    <Modal
      visible={shown}
      transparent
      animationType={reduced ? 'none' : slides ? 'slide' : 'fade'}
      supportedOrientations={TURNS_WITH_THE_APP}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
      onDismiss={gone}
    >
      {children}
    </Modal>
  );
}

export interface AskProps {
  title: string;
  line: string;
  keep: { label: string; testID?: string };
  confirm: { label: string; testID?: string; removes?: boolean };
  onKeep: () => void;
  onConfirm: () => void;
  testID?: string;
}

/** B's one question: what happens, in words, then the way back first and the verb last, red when it removes. Two actions too wide for one line stack with the verb on top (sc-22092). */
export function AskLayer({ title, line, keep, confirm, onKeep, onConfirm, testID }: AskProps) {
  const { layout } = useShell();
  const heading = useRef<TextHandle>(null);
  const [widths, setWidths] = useState({ room: 0, keep: 0, confirm: 0 });
  const measured = widths.room > 0 && widths.keep > 0 && widths.confirm > 0;
  const stacked = measured && widths.keep + tokens.space3xl + widths.confirm > widths.room;
  const laid = (part: keyof typeof widths) => (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    setWidths((now) => (now[part] === width ? now : { ...now, [part]: width }));
  };
  const keepAction = (
    <View key="keep" onLayout={laid('keep')}>
      <TextAction label={keep.label} onPress={onKeep} testID={keep.testID} />
    </View>
  );
  const confirmAction = (
    <View key="confirm" onLayout={laid('confirm')}>
      <TextAction
        label={confirm.label}
        onPress={onConfirm}
        removes={confirm.removes ?? false}
        testID={confirm.testID}
      />
    </View>
  );

  useEffect(() => {
    const focus = setTimeout(() => moveScreenReaderFocus(heading.current), SETTLED_MS);

    return () => clearTimeout(focus);
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, styles.askScrim]}>
      <View
        style={[styles.dialog, { maxWidth: layout === 'phone' ? 340 : 400 }]}
        accessibilityViewIsModal
        onAccessibilityEscape={onKeep}
        testID={testID}
      >
        <Text ref={heading} size={18} weight="bold" accessibilityRole="header">
          {title}
        </Text>
        <Text size={15} weight="medium" style={styles.secondary}>
          {line}
        </Text>
        <View
          style={[stacked ? styles.askStack : styles.askActions, !measured && styles.unmeasured]}
          onLayout={laid('room')}
        >
          {stacked ? [confirmAction, keepAction] : [keepAction, confirmAction]}
        </View>
      </View>
    </View>
  );
}

/** An Ask from a page: a dialog in a window of its own. */
export function Ask({ open, opener, ...ask }: AskProps & { open: boolean; opener: Opener }) {
  return (
    <Window open={open} onClose={ask.onKeep} opener={opener}>
      {open && <AskLayer {...ask} />}
    </Window>
  );
}

export interface FocusVerb {
  label: string;
  on: boolean;
  onPress: () => void;
  removes?: boolean;
  testID?: string;
}

export interface Layer {
  layer: ReactNode;
  onClose: () => void;
}

/** A task's own screen: Cancel, the title and the verb across the top; the whole screen on a phone, a sheet on an iPad. */
export function FocusedScreen({
  open,
  title,
  verb,
  back,
  cancels = true,
  onCancel,
  cancelTestID,
  opener,
  ask,
  over,
  toast,
  scrollRef,
  fills = false,
  children,
  testID,
}: {
  open: boolean;
  title: string;
  verb: FocusVerb | null;
  back?: string | undefined;
  /** False for a sheet that applies what is tapped: nothing at the left, and the verb closes it. */
  cancels?: boolean;
  onCancel: () => void;
  cancelTestID?: string;
  opener: Opener;
  ask?: AskProps | null;
  /** Drawn over the screen in its own window, as the Ask is, since iOS shows one window at a time. */
  over?: Layer | null;
  toast?: { words: string; onClose: () => void } | null;
  scrollRef?: Ref<ScrollViewInstance>;
  fills?: boolean;
  children: ReactNode;
  testID?: string;
}) {
  const { layout } = useShell();
  const insets = useSafeAreaInsets();
  const phone = layout === 'phone';
  const asking = ask != null;
  const covered = asking || over != null;
  const bottom = phone ? insets.bottom : 0;
  const close = asking ? ask.onKeep : over != null ? over.onClose : onCancel;

  return (
    <Window open={open} onClose={close} opener={opener} slides={phone} waitsAway>
      {/* Whatever the keys take from the bottom stays the screen's white, or the dimmed page on an iPad. */}
      <KeyboardAvoidingView
        style={[styles.fill, phone ? styles.screen : styles.dimmed]}
        behavior="padding"
      >
        <View style={phone ? styles.fill : [styles.sheetScrim, { paddingTop: insets.top + 20 }]}>
          <View
            style={
              phone ? [styles.screen, { paddingTop: insets.top }] : [styles.sheet, styles.sheetUp]
            }
            accessibilityViewIsModal
            onAccessibilityEscape={onCancel}
            accessibilityElementsHidden={covered}
            importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}
            testID={testID}
          >
            <FocusNav
              key={`${back ?? ''}:${title}`}
              title={title}
              verb={verb}
              back={back}
              cancels={cancels}
              onCancel={onCancel}
              cancelTestID={cancelTestID}
            />
            {fills ? (
              <View style={[phone ? styles.fill : styles.sheetFill, { paddingBottom: bottom }]}>
                {children}
              </View>
            ) : (
              <ScrollView
                ref={scrollRef}
                style={phone ? styles.fill : styles.sheetBody}
                contentContainerStyle={[styles.body, { paddingBottom: bottom + tokens.space5xl }]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
            )}
          </View>
          {toast != null && (
            <View style={[styles.toast, { bottom: Math.max(insets.bottom, tokens.spaceLg) }]}>
              <Toast key={toast.words} words={toast.words} onClose={toast.onClose} />
            </View>
          )}
          {over?.layer}
          {asking && <AskLayer {...ask} />}
        </View>
      </KeyboardAvoidingView>
    </Window>
  );
}

/** In a list opened from the screen, ‹ and where it goes back to in Cancel's place; "Back" when the title needs the room, as iOS does. */
function FocusNav({
  title,
  verb,
  back,
  cancels,
  onCancel,
  cancelTestID,
}: {
  title: string;
  verb: FocusVerb | null;
  back: string | undefined;
  cancels: boolean;
  onCancel: () => void;
  cancelTestID?: string | undefined;
}) {
  const [sides, setSides] = useState({ cancel: 0, verb: 0 });
  const [short, setShort] = useState(false);
  const fits = back == null || short;
  const cancelLaid = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    setSides((now) => ({ ...now, cancel: width }));
  };

  return (
    <View style={styles.nav}>
      {cancels ? (
        <Pressable
          onPress={onCancel}
          onLayout={cancelLaid}
          style={({ pressed }) => [
            styles.navButton,
            back != null && styles.navBack,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={back ?? 'Cancel'}
          testID={cancelTestID}
        >
          {back != null && (
            <Glyph name="back" size={20} ink={tokens.colorAccentText} weight={2.4} />
          )}
          <Text size={17} weight="medium" accessible={false} style={styles.accent}>
            {back == null ? 'Cancel' : short ? 'Back' : back}
          </Text>
        </Pressable>
      ) : (
        <View style={styles.navButton} onLayout={cancelLaid} />
      )}
      <View
        style={[
          styles.navTitle,
          { left: sides.cancel + tokens.spaceLg, right: sides.verb + tokens.spaceLg },
        ]}
        pointerEvents="none"
      >
        <Text
          size={17}
          weight="bold"
          numberOfLines={fits ? 1 : undefined}
          onTextLayout={
            fits
              ? undefined
              : (event) => {
                  if (event.nativeEvent.lines.length > 1) setShort(true);
                }
          }
          accessibilityRole="header"
        >
          {title}
        </Text>
      </View>
      <View style={styles.grow} />
      {verb != null && (
        <Pressable
          onPress={verb.on ? verb.onPress : undefined}
          disabled={!verb.on}
          onLayout={(event) => {
            const width = event.nativeEvent.layout.width;
            setSides((now) => ({ ...now, verb: width }));
          }}
          style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={verb.label}
          accessibilityState={{ disabled: !verb.on }}
          testID={verb.testID}
        >
          <Text
            size={17}
            weight="semibold"
            accessible={false}
            style={{
              color: !verb.on
                ? tokens.colorInkTertiary
                : verb.removes === true
                  ? tokens.colorBroken
                  : tokens.colorAccentText,
            }}
          >
            {verb.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export interface MenuChoice<T extends string> {
  value: T;
  word: string;
  count: number;
}

/** The filter beside a header: the word and its count, and a menu anchored under it with a tick on the current. */
export function FilterMenu<T extends string>({
  choices,
  value,
  onChoose,
  name,
  testID,
}: {
  choices: readonly MenuChoice<T>[];
  value: T;
  onChoose: (value: T) => void;
  name: string;
  testID: string;
}) {
  const trigger = useRef<ViewInstance>(null);
  const [at, setAt] = useState<{ x: number; y: number; width: number } | null>(null);
  const current = choices.find((choice) => choice.value === value) ?? choices[0];
  const close = () => setAt(null);
  const open = at != null;
  const openMenu = () => {
    trigger.current?.measureInWindow((x, y, width, height) => setAt({ x, y: y + height, width }));
  };

  return (
    <>
      <TextAction
        ref={trigger}
        label={`${current?.word ?? ''} · ${current?.count ?? 0}`}
        after="down"
        onPress={openMenu}
        accessibilityLabel={`${name}: ${current?.word ?? ''}, ${current?.count ?? 0}`}
        testID={testID}
      />
      <Window open={open} onClose={close} opener={trigger}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close the menu"
        />
        {at != null && (
          <View
            style={[styles.menu, { top: at.y + tokens.spaceXxs, left: menuLeft(at) }]}
            accessibilityViewIsModal
            onAccessibilityEscape={close}
          >
            {choices.map((choice) => (
              <MenuRow
                key={choice.value}
                choice={choice}
                on={choice.value === value}
                onPress={() => {
                  close();
                  onChoose(choice.value);
                }}
                testID={`${testID}.${choice.value}`}
              />
            ))}
          </View>
        )}
      </Window>
    </>
  );
}

const MENU_WIDTH = 220;

function menuLeft(at: { x: number; width: number }): number {
  return Math.max(tokens.spaceLg, at.x + at.width - MENU_WIDTH);
}

function MenuRow<T extends string>({
  choice,
  on,
  onPress,
  testID,
}: {
  choice: MenuChoice<T>;
  on: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && styles.menuPressed]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${choice.word}, ${choice.count}`}
      testID={testID}
    >
      <View style={styles.menuTick}>
        {on && <Glyph name="tick" size={16} ink={tokens.colorAccentText} weight={2.6} />}
      </View>
      <Text
        size={16}
        weight={on ? 'semibold' : 'medium'}
        accessible={false}
        style={[styles.grow, on && styles.accent]}
      >
        {choice.word}
      </Text>
      <Text size={15} weight="medium" accessible={false} style={[styles.secondary, styles.count]}>
        {String(choice.count)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  pressed: { opacity: tokens.opacityPressed },
  askScrim: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spaceXxl,
    backgroundColor: tokens.scrimDialog,
  },
  dialog: {
    width: '100%',
    gap: tokens.spaceSm,
    padding: tokens.space3xl,
    paddingBottom: tokens.spaceLg,
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorCard,
  },
  askActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    columnGap: tokens.space3xl,
    paddingTop: tokens.spaceXs,
  },
  askStack: { alignItems: 'flex-end', paddingTop: tokens.spaceXs },
  unmeasured: { opacity: 0 },
  screen: { flex: 1, backgroundColor: tokens.colorCard },
  sheetScrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spaceXxl,
  },
  dimmed: { backgroundColor: tokens.scrimDialog },
  sheet: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '100%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorCard,
  },
  sheetUp: {
    ...tokens.elevationNative.popover.ios,
    elevation: tokens.elevationNative.popover.android.elevation,
  },
  sheetBody: { flexGrow: 0 },
  sheetFill: { flexShrink: 1, minHeight: 0 },
  body: { paddingTop: tokens.spaceXl, paddingHorizontal: tokens.spaceXxl, gap: tokens.spaceLg },
  nav: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spaceSm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorBorder,
  },
  navButton: {
    minHeight: tokens.sizeHit,
    minWidth: tokens.sizeHit,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceLg,
  },
  navBack: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceHair, paddingLeft: 6 },
  navTitle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menu: {
    position: 'absolute',
    width: MENU_WIDTH,
    paddingVertical: tokens.spaceXs,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.spaceXl,
    backgroundColor: tokens.colorCard,
    ...tokens.elevationNative.popover.ios,
    elevation: tokens.elevationNative.popover.android.elevation,
  },
  menuRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingHorizontal: tokens.spaceLg,
  },
  menuPressed: { backgroundColor: tokens.colorInset },
  menuTick: { width: 18, alignItems: 'center' },
  count: { fontVariant: ['tabular-nums'] },
  toast: { position: 'absolute', left: tokens.spaceXl, right: tokens.spaceXl },
});
