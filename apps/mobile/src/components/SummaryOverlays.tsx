import { useIsFocused } from 'expo-router';
import {
  createContext,
  createRef,
  type ReactNode,
  type Ref,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { SETTLED_MS, useFocusOnAnswer, useWindowOrigin } from './Screen.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { SilentWindowName, useFocusBack, useUnnamedWindow, useWindowTurn } from './Sheet.tsx';
import { Text, type TextHandle } from './Text.tsx';
import { Toast } from './Toast.tsx';
import { TURNS_WITH_THE_APP } from '../layout/orientations.ts';
import { useReducedMotion } from '../reducedMotion.ts';
import { menuInModal, menuMost } from '../kit/anchoredMenu.ts';
import { tokens } from '../theme/tokens.ts';
import { useModalOpen } from '../updateRequired.ts';
import { Glyph } from './Glyph.tsx';
import { AskLayer, type AskProps } from './AskLayer.tsx';
import { TextAction } from './SummaryRows.tsx';
import { FocusNav, type FocusVerb } from './FocusNav.tsx';
import { useShellLayout } from './settingsShell.ts';

export { AskLayer, type AskProps } from './AskLayer.tsx';

type Opener = RefObject<ScreenReaderTarget | null>;

const stay = () => {};

/** A window taken down with its page is still going for a moment, and iOS loses one put up meanwhile. */
const going = { until: 0 };
const GOING_MS = SETTLED_MS * 2;

// onShow comes as an Android window starts to slide or fade in, RN's modal animations run config_shortAnimTime, and TalkBack names the window once it has arrived.
const WINDOW_ARRIVES_MS = 200;

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
  onShow,
  children,
}: {
  open: boolean;
  onClose: () => void;
  opener: Opener;
  slides?: boolean;
  waitsAway?: boolean;
  onShow?: () => void;
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
      onShow={onShow}
      onDismiss={gone}
    >
      {children}
    </Modal>
  );
}

/** An Ask from a page: a dialog in a window of its own, and `over` it a menu it opens, in the same window. */
export function Ask({
  open,
  opener,
  over,
  ...ask
}: AskProps & { open: boolean; opener: Opener; over?: Layer | null }) {
  return (
    <Window open={open} onClose={over?.onClose ?? ask.onKeep} opener={opener}>
      {open && <AskLayer covered={over != null} {...ask} />}
      {open && over?.layer}
    </Window>
  );
}

export type { FocusVerb } from './FocusNav.tsx';

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
  cancelLabel,
  waits = false,
  onCancel,
  cancelTestID,
  opener,
  ask,
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
  cancelLabel?: string | undefined;
  /** True while a save is out: Cancel, the escape and the scrub wait in Ink 3 until it answers. */
  waits?: boolean;
  onCancel: () => void;
  cancelTestID?: string;
  opener: Opener;
  ask?: AskProps | null;
  /** Drawn over the screen in its own window, as the Ask is, since iOS shows one window at a time. */
  over?: Layer | null;
  toast?: { words: string; onClose: () => void } | null;
  scrollRef?: Ref<ScrollViewInstance>;
  fills?: boolean;
  gap?: number;
  children: ReactNode;
  testID?: string;
}) {
  const layout = useShellLayout();
  const [onScreen, setOnScreen] = useState(false);
  if (!open && onScreen) setOnScreen(false);
  const insets = useSafeAreaInsets();
  const phone = layout === 'phone';
  const asking = ask != null;
  const covered = asking || over != null;
  const { heading, shown, hidden, focus } = useTitleTakesFocus(title, onScreen, covered);
  const bottom = phone ? insets.bottom : 0;
  const cancel = waits ? stay : onCancel;
  const close = asking ? ask.onKeep : over != null ? over.onClose : cancel;

  return (
    <Window
      open={open}
      onClose={close}
      opener={opener}
      slides={phone}
      waitsAway
      onShow={() => setOnScreen(true)}
    >
      {Platform.OS === 'android' && <SilentWindowName />}
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
            importantForAccessibility={covered || hidden ? 'no-hide-descendants' : 'auto'}
            ref={shown}
            testID={testID}
          >
            <FocusNav
              key={`${back ?? ''}:${title}`}
              title={title}
              titleRef={heading}
              verb={verb}
              back={back}
              cancels={cancels}
              cancelLabel={cancelLabel}
              waits={waits}
              onCancel={cancel}
              cancelTestID={cancelTestID}
            />
            {fills ? (
              <View style={[phone ? styles.fill : styles.sheetFill, { paddingBottom: bottom }]}>
                <TitleFocus.Provider value={focus}>{children}</TitleFocus.Provider>
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
                <TitleFocus.Provider value={focus}>{children}</TitleFocus.Provider>
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

/** Where a focused screen's title focus goes: `first` takes it in the title's place while `coming` (sc-11032). */
export interface TitleFocusing {
  first: RefObject<ViewInstance | null>;
  /** Focus has not yet moved for this step, so whatever holds `first` now is read as focus lands on it. */
  coming: () => boolean;
}

export const TitleFocus = createContext<TitleFocusing | null>(null);

function titleFocusing(): TitleFocusing & { moved: () => void; restart: () => void } {
  let moved = false;

  return {
    first: createRef<ViewInstance>(),
    coming: () => !moved,
    moved: () => {
      moved = true;
    },
    restart: () => {
      moved = false;
    },
  };
}

/** Once its window is up, and again with each new title in a window that stays up, the title takes screen reader focus, or `first` when it is there as focus moves; nothing moves while an ask covers the screen (sc-11032). */
function useTitleTakesFocus(
  title: string,
  onScreen: boolean,
  covered: boolean,
): {
  heading: RefObject<TextHandle | null>;
  shown: RefObject<ViewInstance | null>;
  hidden: boolean;
  focus: TitleFocusing;
} {
  const heading = useRef<TextHandle>(null);
  const reduced = useReducedMotion();
  const hidden = useUnnamedWindow(
    Platform.OS === 'android',
    onScreen,
    title,
    reduced ? 0 : WINDOW_ARRIVES_MS,
  );
  const step = onScreen && !hidden ? title : undefined;
  const asked = useRef(covered);
  const [focus] = useState(titleFocusing);
  useEffect(() => {
    asked.current = covered;
  });
  useEffect(() => focus.restart(), [focus, step]);

  // Read only as focus moves, since `shown` is the screen: the move is what ends `coming`.
  const target = useMemo<RefObject<ScreenReaderTarget | null>>(
    () => ({
      get current() {
        focus.moved();
        return asked.current ? null : (focus.first.current ?? heading.current);
      },
    }),
    [focus],
  );
  // In the gap between the reveal and the move, TalkBack names the window or puts its own focus back, and the title is heard twice.
  const { shown } = useFocusOnAnswer(step, target, Platform.OS === 'android' ? 0 : SETTLED_MS);

  return { heading, shown, hidden, focus };
}

export interface MenuChoice<T extends string> {
  value: T;
  word: string;
  count: number;
}

const MENU_WIDTH = 220;

export interface Anchor {
  x: number;
  y: number;
  width: number;
}

export function anchorUnder(trigger: RefObject<ViewInstance | null>, then: (at: Anchor) => void) {
  trigger.current?.measureInWindow((x, y, width, height) => then({ x, y: y + height, width }));
}

/** An open menu's anchor, measured again once a turned window settles; a button the turn took away closes it. */
export function useAnchorFollowsTurn(
  trigger: RefObject<ViewInstance | null>,
  open: boolean,
  then: (at: Anchor | null) => void,
) {
  const { width, height } = useWindowDimensions();
  const size = useRef({ width, height });

  useEffect(() => {
    const turned = size.current.width !== width || size.current.height !== height;
    size.current = { width, height };
    if (!open || !turned) return;
    const wait = setTimeout(() => {
      if (trigger.current == null) then(null);
      else anchorUnder(trigger, then);
    }, SETTLED_MS);

    return () => clearTimeout(wait);
  }, [width, height, open, trigger, then]);
}

interface MenuProps {
  at: Anchor | null;
  onClose: () => void;
  width?: number;
  align?: 'start' | 'end';
  /** How far under what opened it. */
  below?: number;
  /** Where it must end above, in measureInWindow's frame as `at` is: the keys' top less a gap; the window's foot otherwise. */
  floor?: number | null;
  /** Above the scrolling items: a search field. */
  head?: ReactNode;
  scrollRef?: Ref<ScrollViewInstance>;
  children: ReactNode;
  testID?: string;
}

/** A menu under what opened it, its right edge in line; capped at the room under it, it scrolls inside with a fade at its foot. */
export function AnchoredMenu({
  opener,
  over,
  ...menu
}: MenuProps & {
  opener: Opener;
  /** Drawn over the menu in its window, as FocusedScreen's `over` is. */
  over?: ReactNode;
}) {
  return (
    <Window open={menu.at != null} onClose={menu.onClose} opener={opener}>
      <MenuLayer {...menu} />
      {over}
    </Window>
  );
}

/** AnchoredMenu's menu without a window of its own, for a window that is already up: an Ask's. */
export function MenuLayer({
  at,
  onClose,
  width = MENU_WIDTH,
  align = 'end',
  below = tokens.spaceXxs,
  floor = null,
  head,
  scrollRef,
  children,
  testID,
}: MenuProps) {
  const { t } = useTranslation();
  const frame = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const origin = useWindowOrigin();
  const [seen, setSeen] = useState({ panel: 0, content: 0, offset: 0 });
  const place = menuInModal({ under: at?.y ?? 0, below, floor, origin });
  const top = place.top;
  const room = menuMost(place, frame.height - Math.max(insets.bottom, tokens.spaceLg));
  const more = seen.content - seen.offset - seen.panel > 1;

  return (
    <>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('frame.closeMenu')}
      />
      {at != null && (
        <View
          style={[
            styles.menu,
            {
              top,
              left: menuLeft(at, width, align, frame.width),
              width,
              maxHeight: room,
            },
          ]}
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
          testID={testID}
        >
          <View style={styles.menuClip}>
            {head}
            <ScrollView
              ref={scrollRef}
              bounces={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.menuBody}
              scrollEventThrottle={16}
              onLayout={(event) => {
                const panel = event.nativeEvent.layout.height;
                setSeen((now) => (now.panel === panel ? now : { ...now, panel }));
              }}
              onContentSizeChange={(_width, content) =>
                setSeen((now) => (now.content === content ? now : { ...now, content }))
              }
              onScroll={(event) => {
                const offset = event.nativeEvent.contentOffset.y;
                setSeen((now) => ({ ...now, offset }));
              }}
            >
              {children}
            </ScrollView>
            {more && <MenuFade />}
          </View>
        </View>
      )}
    </>
  );
}

function MenuFade() {
  return (
    <View style={styles.menuFade} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="menuFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={tokens.colorCard} stopOpacity={0} />
            <Stop offset="1" stopColor={tokens.colorCard} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#menuFade)" />
      </Svg>
    </View>
  );
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
  const [at, setAt] = useState<Anchor | null>(null);
  const current = choices.find((choice) => choice.value === value) ?? choices[0];
  const close = () => setAt(null);

  return (
    <>
      <TextAction
        ref={trigger}
        label={`${current?.word ?? ''} · ${current?.count ?? 0}`}
        after="down"
        onPress={() => anchorUnder(trigger, setAt)}
        accessibilityLabel={`${name}: ${current?.word ?? ''}, ${current?.count ?? 0}`}
        testID={testID}
      />
      <AnchoredMenu at={at} onClose={close} opener={trigger}>
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
      </AnchoredMenu>
    </>
  );
}

function menuLeft(at: Anchor, width: number, align: 'start' | 'end', across: number): number {
  if (align === 'start' && at.x + width <= across - tokens.spaceXxl) return at.x;
  return Math.max(tokens.spaceLg, at.x + at.width - width);
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
  menu: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.spaceXl,
    backgroundColor: tokens.colorCard,
    ...tokens.elevationNative.popover.ios,
    elevation: tokens.elevationNative.popover.android.elevation,
  },
  menuClip: { flexShrink: 1, borderRadius: tokens.spaceXl - 1, overflow: 'hidden' },
  menuBody: { paddingVertical: tokens.spaceXs },
  menuFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: tokens.space6xl },
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
