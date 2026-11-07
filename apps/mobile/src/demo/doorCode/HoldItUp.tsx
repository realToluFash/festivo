import { type RefObject, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glyph } from '../../components/Glyph.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { SETTLED_MS } from '../../components/Screen.tsx';
import {
  moveScreenReaderFocus,
  type ScreenReaderTarget,
} from '../../components/screenReaderFocus.ts';
import { useFocusBack, useWindowTurn } from '../../components/Sheet.tsx';
import { type TextHandle, Text } from '../../components/Text.tsx';
import { TURNS_WITH_THE_APP } from '../../layout/orientations.ts';
import { useLayout } from '../../layout/useLayout.ts';
import { useReducedMotion } from '../../reducedMotion.ts';
import { tokens } from '../../theme/tokens.ts';
import { useModalOpen } from '../../updateRequired.ts';
import { HELD_MS } from '../people/PeopleSample.ts';
import { AskLayer, type AskProps, TextAction } from '../../components/Summary.tsx';
import { cardLine, type DoorCode, type HoldStart } from './DoorCodeModel.ts';
import { DoorQr } from './DoorQr.tsx';
import { joinCodeSaid, newLine, stopLine, W } from './DoorCodeWords.ts';

export const SEND_MS = 1200;
const JOIN_MS = 2500;

const SIZES = {
  phone: { qr: 300, code: 44, title: 17, top: 40, gap: 28, actions: tokens.space3xl },
  tabletPortrait: { qr: 480, code: 64, title: 20, top: 110, gap: 24, actions: tokens.space5xl },
  tabletLandscape: { qr: 480, code: 64, title: 20, top: 24, gap: 24, actions: tokens.space5xl },
} as const;

/** The code as a sign for the briefing: white, the QR and the code large, the count a polite status; the Asks in its own window. */
export function HoldItUp({
  open,
  code,
  start,
  locale,
  opener,
  onClose,
  onRenew,
  onStopped,
  onJoin,
}: {
  open: boolean;
  code: DoorCode;
  start: HoldStart;
  locale: string;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onRenew: () => void;
  onStopped: () => void;
  onJoin: () => void;
}) {
  const kind = useLayout().kind;
  const size = SIZES[kind];
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { shown, gone } = useWindowTurn(useModalOpen(open));
  const [ask, setAsk] = useState(start.ask);
  const [stopping, setStopping] = useState(start.stopping);
  const [failed, setFailed] = useState(start.failed ? W.stopFailed : null);
  const held = useRef(start.stopping);
  const title = useRef<TextHandle>(null);
  const later = useRef({ onStopped, onJoin });
  const count = cardLine(code, locale);
  const job = [code.role, code.job].filter((part) => part != null).join(' · ');

  useFocusBack(open, opener);
  useReadOut(count, { quietAtMount: true });

  useEffect(() => {
    later.current = { onStopped, onJoin };
  }, [onStopped, onJoin]);

  useEffect(() => {
    if (!shown) return;
    const focus = setTimeout(() => moveScreenReaderFocus(title.current), SETTLED_MS);

    return () => clearTimeout(focus);
  }, [shown]);

  useEffect(() => {
    if (!start.joins) return;
    const joined = setTimeout(() => later.current.onJoin(), JOIN_MS);

    return () => clearTimeout(joined);
  }, [start.joins]);

  useEffect(() => {
    if (!stopping) return;
    const done = setTimeout(
      () => {
        setStopping(false);
        setAsk(null);
        later.current.onStopped();
      },
      held.current ? HELD_MS : SEND_MS,
    );
    held.current = false;

    return () => clearTimeout(done);
  }, [stopping]);

  const asking: AskProps | null =
    ask === 'new'
      ? {
          title: W.newTitle,
          line: newLine(code.code, code.used),
          keep: { label: W.keepThis, testID: 'door.hold.new.keep' },
          confirm: { label: W.makeNew, testID: 'door.hold.new.confirm' },
          onKeep: () => setAsk(null),
          onConfirm: () => {
            setAsk(null);
            onRenew();
          },
        }
      : ask === 'stop'
        ? {
            title: W.stopTitle,
            line: stopLine(code.used),
            keep: { label: W.keepIt, off: stopping, testID: 'door.hold.stop.keep' },
            confirm: {
              label: W.stop,
              removes: true,
              busy: stopping ? W.stopping : undefined,
              testID: 'door.hold.stop.confirm',
            },
            failed,
            onKeep: () => {
              if (stopping) return;
              setAsk(null);
              setFailed(null);
            },
            onConfirm: () => {
              setFailed(null);
              setStopping(true);
            },
          }
        : null;
  const covered = asking != null;

  return (
    <Modal
      visible={shown}
      animationType={reduced ? 'fade' : 'slide'}
      supportedOrientations={TURNS_WITH_THE_APP}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={asking == null ? onClose : asking.onKeep}
      onDismiss={gone}
    >
      <View
        style={[styles.screen, { paddingTop: insets.top }]}
        accessibilityViewIsModal
        onAccessibilityEscape={onClose}
        accessibilityElementsHidden={covered}
        importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}
        testID="door.hold"
      >
        <View style={styles.bar}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={W.close}
            testID="door.hold.close"
          >
            <Glyph name="x" size={22} ink={tokens.colorInk} weight={2.2} />
          </Pressable>
          <Text
            ref={title}
            size={size.title}
            weight="bold"
            accessible={covered ? false : undefined}
            accessibilityRole="header"
          >
            {W.doorCode}
          </Text>
          <View style={styles.close} />
        </View>
        <ScrollView
          contentContainerStyle={[
            styles.body,
            { paddingTop: size.top, gap: size.gap, paddingBottom: insets.bottom + tokens.space3xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.sign}>
            <DoorQr code={code.code} side={size.qr} />
            <Text
              size={size.code}
              weight="bold"
              accessible={covered ? false : undefined}
              accessibilityLabel={joinCodeSaid(code.code)}
              style={[
                styles.code,
                { letterSpacing: size.code * 0.04, lineHeight: size.code * 1.1 },
              ]}
            >
              {code.code}
            </Text>
            <Text
              size={17}
              weight="semibold"
              accessible={covered ? false : undefined}
              style={styles.centre}
            >
              {job}
            </Text>
            <Text
              size={16}
              weight="medium"
              accessible={covered ? false : undefined}
              style={[styles.centre, styles.secondary, styles.figures]}
              testID="door.hold.count"
            >
              {count}
            </Text>
          </View>
          <View style={[styles.actions, { columnGap: size.actions }]}>
            <TextAction label={W.makeNew} onPress={() => setAsk('new')} testID="door.hold.new" />
            <TextAction
              label={W.stop}
              removes
              onPress={() => setAsk('stop')}
              testID="door.hold.stop"
            />
          </View>
        </ScrollView>
      </View>
      {asking != null && <AskLayer {...asking} />}
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colorCard },
  pressed: { opacity: tokens.opacityPressed },
  bar: {
    minHeight: tokens.sizeHit + tokens.spaceXxs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: tokens.spaceXxs,
    paddingLeft: tokens.spaceSm,
    paddingRight: tokens.spaceLg,
  },
  close: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { alignItems: 'center', paddingHorizontal: tokens.space3xl },
  sign: { alignItems: 'center', gap: 14 },
  code: { textAlign: 'center', fontVariant: ['tabular-nums'] },
  centre: { textAlign: 'center' },
  secondary: { color: tokens.colorInkSecondary },
  figures: { fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
});
