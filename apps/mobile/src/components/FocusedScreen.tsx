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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { TURNS_WITH_THE_APP } from '../layout/orientations.ts';
import { useReducedMotion } from '../reducedMotion.ts';
import { tokens } from '../theme/tokens.ts';
import { useModalOpen } from '../updateRequired.ts';
import { Glyph } from './Glyph.tsx';
import { SETTLED_MS } from './Screen.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { useFocusBack, useWindowTurn } from './Sheet.tsx';
import { TurningMark } from './StateTag.tsx';
import { Text } from './Text.tsx';
import { Toast } from './Toast.tsx';

export type Opener = RefObject<ScreenReaderTarget | null>;

const stay = () => {};

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
export function Window({
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

export interface FocusVerb {
  label: string;
  on: boolean;
  onPress: () => void;
  removes?: boolean;
  /** While its request is out: the turning mark and its words in Ink 2, off until the answer. */
  busy?: boolean;
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
  waits = false,
  onCancel,
  cancelTestID,
  opener,
  phone,
  over,
  toast,
  scrollRef,
  fills = false,
  gap = tokens.spaceLg,
  children,
  testID,
}: {
  open: boolean;
  title: string;
  verb: FocusVerb | null;
  back?: string | undefined;
  /** False for a sheet that applies what is tapped: nothing at the left, and the verb closes it. */
  cancels?: boolean;
  /** True while a save is out: Cancel, the escape and the scrub wait in Ink 3 until it answers. */
  waits?: boolean;
  onCancel: () => void;
  cancelTestID?: string;
  opener: Opener;
  phone: boolean;
  /** Drawn over the screen in its own window, since iOS shows one window at a time. */
  over?: Layer | null;
  toast?: { words: string; onClose: () => void } | null;
  scrollRef?: Ref<ScrollViewInstance>;
  fills?: boolean;
  gap?: number;
  children: ReactNode;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const covered = over != null;
  const bottom = phone ? insets.bottom : 0;
  const cancel = waits ? stay : onCancel;
  const close = over != null ? over.onClose : cancel;

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
            onAccessibilityEscape={cancel}
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
              waits={waits}
              onCancel={cancel}
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
                contentContainerStyle={[
                  styles.body,
                  { gap, paddingBottom: bottom + tokens.space5xl },
                ]}
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
  waits,
  onCancel,
  cancelTestID,
}: {
  title: string;
  verb: FocusVerb | null;
  back: string | undefined;
  cancels: boolean;
  waits: boolean;
  onCancel: () => void;
  cancelTestID?: string | undefined;
}) {
  const { t } = useTranslation();
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
          disabled={waits}
          onLayout={cancelLaid}
          style={({ pressed }) => [
            styles.navButton,
            back != null && styles.navBack,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={back ?? t('focusedScreen.cancel')}
          accessibilityState={waits ? { disabled: true } : undefined}
          testID={cancelTestID}
        >
          {back != null && (
            <Glyph name="back" size={20} ink={tokens.colorAccentText} weight={2.4} />
          )}
          <Text
            size={17}
            weight="medium"
            accessible={false}
            style={waits ? styles.waiting : styles.accent}
          >
            {back == null ? t('focusedScreen.cancel') : short ? t('focusedScreen.back') : back}
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
          style={({ pressed }) => [
            styles.navButton,
            verb.busy === true && styles.navBusy,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={verb.label}
          accessibilityState={{ disabled: !verb.on, busy: verb.busy === true }}
          testID={verb.testID}
        >
          {verb.busy === true && <TurningMark side={14} />}
          <Text
            size={17}
            weight="semibold"
            accessible={false}
            style={{
              color:
                verb.busy === true
                  ? tokens.colorInkSecondary
                  : !verb.on
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

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flex: 1, minWidth: 0 },
  accent: { color: tokens.colorAccentText },
  pressed: { opacity: tokens.opacityPressed },
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
  body: { paddingTop: tokens.spaceXl, paddingHorizontal: tokens.spaceXxl },
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
  navBusy: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  waiting: { color: tokens.colorInkTertiary },
  navTitle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toast: { position: 'absolute', left: tokens.spaceXl, right: tokens.spaceXl },
});
