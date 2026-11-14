import { hostNameOf, makeLiveHostError } from '@soirely/domain';
import { type RefObject, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  type KeyboardEvent,
  LayoutAnimation,
  Modal,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glyph } from '../../components/Glyph.tsx';
import { BoxField } from '../../components/MomentPick.tsx';
import { ReadOut } from '../../components/ReadOut.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { useShell } from '../../components/settingsShell.ts';
import { SilentWindowName, useFocusBack, useWindowTurn } from '../../components/Sheet.tsx';
import { ASK_WIDTH, AskLayer } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { TURNS_WITH_THE_APP } from '../../layout/orientations.ts';
import { useReducedMotion } from '../../reducedMotion.ts';
import { tokens } from '../../theme/tokens.ts';
import { useModalOpen } from '../../updateRequired.ts';
import { OWNER, type WaitsCheck } from '../messages/CheckWaits.ts';
import { formatCount } from '../messages/MessagesSample.ts';
import { WaitBlock } from '../messages/WaitBlock.tsx';
import { EventField } from './EventEdits.tsx';
import { LIVE, t } from './EventsWords.ts';
import {
  type LiveAction,
  type MakeLive,
  MAKING_MS,
  type Reach,
  SENDING_MS,
  liveAlertOf,
  makeLiveStart,
  reachedOf,
  reduceMakeLive,
} from './MakeLive.ts';

/** Make live's run: the answers come back after a beat, and `onLive` turns the page Live, with Host 1 when it was asked. */
export function useMakeLive(
  state: string | null,
  reach: Reach,
  onLive: (host: string | null) => void,
) {
  const [s, setS] = useState(() => makeLiveStart(state));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live = useRef(onLive);

  useEffect(() => {
    live.current = onLive;
  }, [onLive]);
  useEffect(
    () => () => {
      if (timer.current != null) clearTimeout(timer.current);
    },
    [],
  );

  const act = (action: LiveAction) => setS((now) => reduceMakeLive(now, action, reach));
  const answer = (action: LiveAction, ms: number, then?: () => void) => {
    timer.current = setTimeout(() => {
      then?.();
      act(action);
    }, ms);
  };

  return {
    s,
    open: (asksHost: boolean) => act({ type: 'open', asksHost }),
    keep: () => act({ type: 'keep' }),
    typed: () => act({ type: 'typed' }),
    closeToast: () => act({ type: 'toastClosed' }),
    confirm: (typed: string) => {
      const { turn } = s;
      if (turn.at !== 'question' || turn.making) return;
      const hostError = turn.host == null ? null : makeLiveHostError(typed, t);
      act({ type: 'confirm', hostError });
      if (hostError != null) return;
      const host = turn.host == null ? null : hostNameOf(typed);
      answer({ type: 'made' }, MAKING_MS, () => live.current(host));
    },
    send: () => {
      if (s.turn.at !== 'offer' || s.turn.sending) return;
      act({ type: 'send' });
      answer({ type: 'sent' }, SENDING_MS);
    },
  };
}

/** sc-3963's lines for these figures: Email goes either way and the texts that wait, with no way past them here. */
function waitsView(reach: Reach, waiting: number): WaitsCheck {
  return {
    check: {
      count: reach.guests,
      told: [
        { key: 'email', count: reachedOf(reach) - reach.texts.length },
        { key: 'sms', count: reach.texts.length },
      ],
      cantTell: reach.unreachable,
      smsOff: 0,
      names: [],
      seeAll: false,
      credits: 0,
      after: formatCount(reach.balance),
      whatsApp: false,
    },
    told: '',
    either: true,
    waiting: [{ key: 'sms', count: waiting }],
    way: null,
  };
}

function followKeys({ duration, easing }: KeyboardEvent): void {
  if (duration > 0) LayoutAnimation.configureNext({ duration, update: { type: easing } });
}

/** Up from under the keys while Host 1 is typed in, as Members' handover is. */
function useKeysLift(asking: boolean): number | null {
  const shell = useShell();
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

  return asking && keys && shell.layout !== 'portrait' ? insets.top + tokens.spaceLg : null;
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

/** A's alert on every layout, in its own window so the question can turn into the offer, its title taking focus as it does. */
export function MakeLiveAsk({
  live,
  reach,
  name,
  opener,
  onKeep,
  onConfirm,
  onTyped,
  onSend,
  onChangeDates,
}: {
  live: MakeLive;
  reach: Reach;
  name: string;
  opener: RefObject<ScreenReaderTarget | null>;
  onKeep: () => void;
  onConfirm: (typed: string) => void;
  onTyped: () => void;
  onSend: () => void;
  onChangeDates: () => void;
}) {
  const reduced = useReducedMotion();
  const alert = liveAlertOf(live.turn, reach, name);
  const open = alert != null;
  const { shown, gone } = useWindowTurn(useModalOpen(open));
  const [typed, setTyped] = useState('');
  const host = alert?.host ?? null;
  const making = live.turn.at === 'question' && live.turn.making;
  const top = useKeysLift(host != null);

  useFocusBack(open, opener);

  const confirm = () => {
    if (alert?.turn === 'offer') onSend();
    else if (alert?.turn === 'told') onChangeDates();
    else onConfirm(typed);
  };
  const credits = alert?.credits;
  const parts = [
    host != null && (
      <EventField key="host" label={LIVE.hostLabel} error={host.error} help={LIVE.hostExplainer}>
        <BoxField
          value={typed}
          onChangeText={(text) => {
            setTyped(text.replace(/[\r\n]+/g, ' '));
            onTyped();
          }}
          autoFocus
          multiline
          scrollEnabled={false}
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="go"
          enterKeyHint="go"
          submitBehavior="submit"
          onSubmitEditing={confirm}
          wrong={host.error != null}
          submitting={making}
          accessibilityLabel={LIVE.hostLabel}
          accessibilityHint={LIVE.hostExplainer}
          testID="event.makeLive.host"
        />
      </EventField>
    ),
    alert?.reason != null && (
      <MarkedLine key="reason" words={alert.reason} testID="event.makeLive.reason" />
    ),
    alert?.later != null && (
      <Text
        key="later"
        size={15}
        weight="medium"
        style={[styles.secondary, styles.later]}
        testID="event.makeLive.later"
      >
        {alert.later}
      </Text>
    ),
    credits?.line != null && (
      <Text
        key="credits"
        size={13.5}
        weight="medium"
        style={styles.small}
        testID="event.makeLive.credits"
      >
        {credits.line}
      </Text>
    ),
    credits != null && credits.waiting > 0 && (
      <WaitBlock
        key="waits"
        view={waitsView(reach, credits.waiting)}
        waits={OWNER}
        onWithout={() => {}}
        linesOnly
      />
    ),
    alert?.failedLast != null && (
      <MarkedLine key="failed" words={alert.failedLast} testID="event.makeLive.failed" />
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
            keep={{ ...alert.keep, testID: 'event.makeLive.keep' }}
            confirm={
              alert.confirm == null ? null : { ...alert.confirm, testID: 'event.makeLive.confirm' }
            }
            width={ASK_WIDTH}
            top={top}
            onKeep={onKeep}
            onConfirm={confirm}
            testID={`event.makeLive.${alert.turn}`}
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
  small: { lineHeight: 13.5 * 1.4, fontVariant: ['tabular-nums'] },
  secondary: { color: tokens.colorInkSecondary },
  marked: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  mark: { marginTop: tokens.spaceHair },
  markedWords: { flex: 1, minWidth: 0, lineHeight: 15 * 1.45 },
});
