import { type ReactNode, type Ref, type RefObject, useEffect, useState } from 'react';
import {
  Keyboard,
  type KeyboardEvent,
  LayoutAnimation,
  Modal,
  Platform,
  StyleSheet,
  type TextInputInstance,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { LiveAlert } from '../kit/makeLive.ts';
import { TURNS_WITH_THE_APP } from '../layout/orientations.ts';
import { useReducedMotion } from '../reducedMotion.ts';
import { tokens } from '../theme/tokens.ts';
import { useModalOpen } from '../updateRequired.ts';
import { EventField } from './EventField.tsx';
import { Glyph } from './Glyph.tsx';
import { BoxField } from './MomentPick.tsx';
import { ReadOut } from './ReadOut.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { useShellLayout } from './settingsShell.ts';
import { SilentWindowName, useFocusBack, useWindowTurn } from './Sheet.tsx';
import { ASK_WIDTH, AskLayer } from './Summary.tsx';
import { Text } from './Text.tsx';

function followKeys({ duration, easing }: KeyboardEvent): void {
  if (duration > 0) LayoutAnimation.configureNext({ duration, update: { type: easing } });
}

/** Up from under the keys while Host 1 is typed in, as Members' handover is. */
function useKeysLift(asking: boolean): number | null {
  const layout = useShellLayout();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [keys, setKeys] = useState(false);

  useEffect(() => {
    if (!asking) return undefined;
    const ios = Platform.OS === 'ios';
    const up = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (event) => {
      if (!reduced) followKeys(event);
      setKeys(true);
    });
    const down = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', (event) => {
      if (!reduced) followKeys(event);
      setKeys(false);
    });

    return () => {
      up.remove();
      down.remove();
    };
  }, [asking, reduced]);

  return asking && keys && layout !== 'portrait' ? insets.top + tokens.spaceLg : null;
}

function MarkedLine({ words, testID }: { words: string; testID: string }) {
  return (
    <ReadOut
      words={words}
      interrupts
      accessibilityRole="alert"
      style={styles.marked}
      testID={testID}
    >
      <View style={styles.mark}>
        <Glyph name="alert" size={18} ink={tokens.colorInkSecondary} weight={2.2} />
      </View>
      <Text size={15} weight="medium" style={styles.markedWords}>
        {words}
      </Text>
    </ReadOut>
  );
}

/** A's alert on every layout, in its own window so one alert can turn into the next, its title taking focus as it does. */
export function MakeLiveAlert({
  alert,
  typed,
  hostRef,
  opener,
  extra,
  onTyped,
  onKeep,
  onConfirm,
  testID,
}: {
  alert: LiveAlert | null;
  /** What is in Host 1. */
  typed: string;
  hostRef?: Ref<TextInputInstance> | undefined;
  opener: RefObject<ScreenReaderTarget | null>;
  /** Anything more the alert says, under its later line. */
  extra?: ReactNode;
  onTyped: (typed: string) => void;
  onKeep: () => void;
  onConfirm: () => void;
  testID: string;
}) {
  const reduced = useReducedMotion();
  const open = alert != null;
  const { shown, gone } = useWindowTurn(useModalOpen(open));
  const host = alert?.host ?? null;
  const making = alert?.confirm?.busy != null;
  const top = useKeysLift(host != null);

  useFocusBack(open, opener);

  const hostsNow = alert?.hostsNow ?? null;
  const parts = [
    hostsNow != null && (
      <View key="hostsNow" style={styles.lines} testID={`${testID}.hostsNow`}>
        <Text size={15} weight="medium" style={[styles.secondary, styles.later]}>
          {hostsNow.line}
        </Text>
        <View role="list">
          {hostsNow.names.map((one) => (
            <Text key={one} role="listitem" size={15} weight="semibold" style={styles.later}>
              {`• ${one}`}
            </Text>
          ))}
        </View>
      </View>
    ),
    host != null && (
      <EventField key="host" label={host.label} error={host.error} help={host.help}>
        <BoxField
          ref={hostRef}
          value={typed}
          onChangeText={(text) => onTyped(text.replace(/[\r\n]+/g, ' '))}
          autoFocus
          multiline
          scrollEnabled={false}
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="go"
          enterKeyHint="go"
          submitBehavior="submit"
          onSubmitEditing={onConfirm}
          wrong={host.error != null}
          submitting={making}
          accessibilityLabel={host.label}
          accessibilityHint={host.help}
          testID={`${testID}.host`}
        />
      </EventField>
    ),
    alert?.reason != null && (
      <MarkedLine key="reason" words={alert.reason} testID={`${testID}.reason`} />
    ),
    alert?.later != null && (
      <Text
        key="later"
        size={15}
        weight="medium"
        style={[styles.secondary, styles.later]}
        testID={`${testID}.later`}
      >
        {alert.later}
      </Text>
    ),
    extra != null && (
      <View key="extra" style={styles.lines}>
        {extra}
      </View>
    ),
    alert?.failedLast != null && (
      <MarkedLine key="failed" words={alert.failedLast} testID={`${testID}.failed`} />
    ),
  ].filter(Boolean);

  return (
    <Modal
      visible={shown}
      transparent
      animationType={reduced ? 'none' : 'fade'}
      supportedOrientations={TURNS_WITH_THE_APP}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onKeep}
      onDismiss={gone}
    >
      {Platform.OS === 'android' && <SilentWindowName />}
      {alert != null && (
        <View style={styles.fill} collapsable={false} onAccessibilityEscape={onKeep}>
          <AskLayer
            key={alert.turn}
            title={alert.title}
            line={alert.line}
            alert={alert.alert}
            failed={alert.failed}
            body={parts.length > 0 ? <View style={styles.lines}>{parts}</View> : undefined}
            keep={{ ...alert.keep, testID: `${testID}.keep` }}
            confirm={
              alert.confirm == null ? null : { ...alert.confirm, testID: `${testID}.confirm` }
            }
            width={ASK_WIDTH}
            top={top}
            onKeep={onKeep}
            onConfirm={onConfirm}
            testID={`${testID}.${alert.turn}`}
          />
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  lines: { gap: tokens.spaceXs },
  later: { lineHeight: 15 * 1.45 },
  secondary: { color: tokens.colorInkSecondary },
  marked: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  mark: { marginTop: tokens.spaceHair },
  markedWords: { flex: 1, minWidth: 0, lineHeight: 15 * 1.45 },
});
