import {
  type ComponentProps,
  type ReactNode,
  type Ref,
  type RefObject,
  useRef,
  useState,
} from 'react';
import {
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

import {
  FocusedScreen as Focused,
  type Layer,
  type Opener,
  Window,
} from '../../components/FocusedScreen.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Glyph } from '../../components/Glyph.tsx';
import { useShell } from './Frame.tsx';
import { AskLayer, type AskProps } from './AskLayer.tsx';
import { TextAction } from './SummaryRows.tsx';

export { AskLayer, type AskProps } from './AskLayer.tsx';
export { type FocusVerb, type Layer } from '../../components/FocusedScreen.tsx';

/** An Ask from a page: a dialog in a window of its own. */
export function Ask({ open, opener, ...ask }: AskProps & { open: boolean; opener: Opener }) {
  return (
    <Window open={open} onClose={ask.onKeep} opener={opener}>
      {open && <AskLayer {...ask} />}
    </Window>
  );
}

/** The app's FocusedScreen in the demo's frame, with an Ask drawn over it in its window. */
export function FocusedScreen({
  ask,
  over,
  ...screen
}: Omit<ComponentProps<typeof Focused>, 'phone'> & { ask?: AskProps | null }) {
  const { layout } = useShell();
  const cover: Layer | null =
    ask != null
      ? {
          layer: (
            <>
              {over?.layer}
              <AskLayer {...ask} />
            </>
          ),
          onClose: ask.onKeep,
        }
      : (over ?? null);

  return <Focused {...screen} phone={layout === 'phone'} over={cover} />;
}

export interface MenuChoice<T extends string> {
  value: T;
  word: string;
  count: number;
}

const MENU_WIDTH = 220;
const MENU_LEAST = 144;

export interface Anchor {
  x: number;
  y: number;
  width: number;
}

export function anchorUnder(trigger: RefObject<ViewInstance | null>, then: (at: Anchor) => void) {
  trigger.current?.measureInWindow((x, y, width, height) => then({ x, y: y + height, width }));
}

/** A menu under what opened it, its right edge in line; capped at the room under it, it scrolls inside with a fade at its foot. */
export function AnchoredMenu({
  at,
  onClose,
  opener,
  width = MENU_WIDTH,
  align = 'end',
  over,
  scrollRef,
  children,
  testID,
}: {
  at: Anchor | null;
  onClose: () => void;
  opener: Opener;
  width?: number;
  align?: 'start' | 'end';
  /** Drawn over the menu in its window, as FocusedScreen's `over` is. */
  over?: ReactNode;
  scrollRef?: Ref<ScrollViewInstance>;
  children: ReactNode;
  testID?: string;
}) {
  const frame = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [seen, setSeen] = useState({ panel: 0, content: 0, offset: 0 });
  const top = (at?.y ?? 0) + tokens.spaceXxs;
  const room = frame.height - top - Math.max(insets.bottom, tokens.spaceLg);
  const more = seen.content - seen.offset - seen.panel > 1;

  return (
    <Window open={at != null} onClose={onClose} opener={opener}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close the menu"
      />
      {at != null && (
        <View
          style={[
            styles.menu,
            {
              top,
              left: menuLeft(at, width, align, frame.width),
              width,
              maxHeight: Math.max(room, MENU_LEAST),
            },
          ]}
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
          testID={testID}
        >
          <View style={styles.menuClip}>
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
      {over}
    </Window>
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
