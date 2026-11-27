import type { DoorCodeCard, OrganisationEvent } from '@soirely/api-client';
import { type RefObject, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

import { type CodeClock, countLine, heldLine, saidCode, shownCode } from '../kit/doorCodes.ts';
import { TURNS_WITH_THE_APP } from '../layout/orientations.ts';
import { useLayout } from '../layout/useLayout.ts';
import { useReducedMotion } from '../reducedMotion.ts';
import { tokens } from '../theme/tokens.ts';
import { useModalOpen } from '../updateRequired.ts';
import { AskLayer } from './AskLayer.tsx';
import { type CodeAsk, useCodeAsk } from './useCodeAsk.ts';
import { Glyph } from './Glyph.tsx';
import { useReadOut } from './ReadOut.tsx';
import { SETTLED_MS } from './Screen.tsx';
import { moveScreenReaderFocus, type ScreenReaderTarget } from './screenReaderFocus.ts';
import { useFocusBack, useWindowTurn } from './Sheet.tsx';
import { TextAction } from './Summary.tsx';
import { type TextHandle, Text } from './Text.tsx';
import { useLitScreen } from './useLitScreen.ts';

const SIZES = {
  phone: { qr: 300, code: 44, title: 17, top: 40, gap: 28, actions: tokens.space3xl },
  tabletPortrait: { qr: 480, code: 64, title: 20, top: 110, gap: 24, actions: tokens.space5xl },
  tabletLandscape: { qr: 480, code: 64, title: 20, top: 24, gap: 24, actions: tokens.space5xl },
} as const;

/** The code as a sign for the briefing: white, the QR and the code large, the count a polite status; the Asks in its own window. */
export function ShowDoorCode({
  open,
  code,
  event,
  clock,
  opener,
  onClose,
  onAnswer,
}: {
  open: boolean;
  code: DoorCodeCard;
  event: OrganisationEvent;
  clock: CodeClock;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onAnswer: (was: string, card: DoorCodeCard, kind: CodeAsk['kind']) => void;
}) {
  const { t } = useTranslation();
  const size = SIZES[useLayout().kind];
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { shown, gone } = useWindowTurn(useModalOpen(open));
  const title = useRef<TextHandle>(null);
  const ask = useCodeAsk(event.id, clock, onAnswer);
  const count = countLine(code, clock, t);
  const asking = ask.asking?.open === true ? ask.props(code, t, 'door.show.ask') : null;
  const covered = asking != null;

  useLitScreen(shown);
  useFocusBack(open, opener);
  useReadOut(count, { quietAtMount: true });

  useEffect(() => {
    if (!shown) return;
    const focus = setTimeout(() => moveScreenReaderFocus(title.current), SETTLED_MS);

    return () => clearTimeout(focus);
  }, [shown]);

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
        testID="door.show"
      >
        <View style={styles.bar}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('doorCodes.close')}
            testID="door.show.close"
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
            {t('doorCodes.doorCode')}
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
            <View
              style={[styles.qr, { width: size.qr, height: size.qr }]}
              accessible={!covered}
              accessibilityRole="image"
              accessibilityLabel={t('doorCodes.qrSaid', { code: saidCode(code.code) })}
            >
              <SvgXml xml={code.qrSvg} width={size.qr} height={size.qr} />
            </View>
            <Text
              size={size.code}
              weight="bold"
              accessible={covered ? false : undefined}
              accessibilityLabel={t('doorCodes.said', { code: saidCode(code.code) })}
              style={[
                styles.code,
                { letterSpacing: size.code * 0.04, lineHeight: size.code * 1.1 },
              ]}
            >
              {shownCode(code.code)}
            </Text>
            <Text
              size={17}
              weight="semibold"
              accessible={covered ? false : undefined}
              style={styles.centre}
            >
              {heldLine(code, t)}
            </Text>
            <Text
              size={16}
              weight="medium"
              accessible={covered ? false : undefined}
              style={[styles.centre, styles.secondary, styles.figures]}
              testID="door.show.count"
            >
              {count}
            </Text>
          </View>
          <View style={[styles.actions, { columnGap: size.actions }]}>
            <TextAction
              label={t('doorCodes.makeNew')}
              onPress={() => ask.askAbout('new', code)}
              testID="door.show.new"
            />
            <TextAction
              label={t('doorCodes.stop')}
              removes
              onPress={() => ask.askAbout('stop', code)}
              testID="door.show.stop"
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
  qr: { backgroundColor: tokens.colorCard },
  code: { textAlign: 'center', fontVariant: ['tabular-nums'] },
  centre: { textAlign: 'center' },
  secondary: { color: tokens.colorInkSecondary },
  figures: { fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
});
