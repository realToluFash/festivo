import { type RefObject, useEffect, useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';

import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
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
import {
  type LiveAction,
  type MakeLive,
  MAKING_MS,
  type Reach,
  SENDING_MS,
  liveAlertOf,
  makeLiveStart,
  reduceMakeLive,
} from './MakeLive.ts';

/** Make live's run: the answers come back after a beat, and `onLive` turns the page Live as the offer opens. */
export function useMakeLive(state: string | null, reach: Reach, onLive: () => void) {
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
    open: () => act('open'),
    keep: () => act('keep'),
    closeToast: () => setS((now) => ({ ...now, toast: null })),
    confirm: () => {
      if (s.turn.at !== 'question' || s.turn.making) return;
      act('confirm');
      answer('made', MAKING_MS, () => live.current());
    },
    send: () => {
      if (s.turn.at !== 'offer' || s.turn.sending) return;
      act('send');
      answer('sent', SENDING_MS);
    },
  };
}

/** sc-3963's block for these figures: Email goes either way, the texts that wait, and no way past it here. */
function waitsView(reach: Reach, waiting: number): WaitsCheck {
  const reached = reach.emailOnly + reach.withPhone;

  return {
    check: {
      count: reach.guests,
      told: [
        { key: 'email', count: reached },
        { key: 'sms', count: reach.withPhone },
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

/** A's 340 alert on every layout, in its own window so the same alert can turn into the offer, and its title take focus as it does. */
export function MakeLiveAsk({
  live,
  reach,
  name,
  opener,
  onKeep,
  onConfirm,
  onSend,
}: {
  live: MakeLive;
  reach: Reach;
  name: string;
  opener: RefObject<ScreenReaderTarget | null>;
  onKeep: () => void;
  onConfirm: () => void;
  onSend: () => void;
}) {
  const reduced = useReducedMotion();
  const alert = liveAlertOf(live.turn, reach, name);
  const open = alert != null;
  const { shown, gone } = useWindowTurn(useModalOpen(open));

  useFocusBack(open, opener);

  const { credits, later } = alert ?? { credits: null, later: null };
  const body =
    credits?.line != null || (credits?.waiting ?? 0) > 0 || later != null ? (
      <View style={styles.lines}>
        {later != null && (
          <Text
            size={15}
            weight="medium"
            style={[styles.secondary, styles.later]}
            testID="event.makeLive.later"
          >
            {later}
          </Text>
        )}
        {credits?.line != null && (
          <Text size={13.5} weight="medium" style={styles.small} testID="event.makeLive.credits">
            {credits.line}
          </Text>
        )}
        {credits != null && credits.waiting > 0 && (
          <WaitBlock
            view={waitsView(reach, credits.waiting)}
            waits={OWNER}
            onWithout={() => {}}
            linesOnly
          />
        )}
      </View>
    ) : undefined;

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
            failed={alert.failed}
            body={body}
            keep={{ ...alert.keep, testID: 'event.makeLive.keep' }}
            confirm={
              alert.confirm == null ? null : { ...alert.confirm, testID: 'event.makeLive.confirm' }
            }
            width={ASK_WIDTH}
            onKeep={onKeep}
            onConfirm={alert.turn === 'offer' ? onSend : onConfirm}
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
});
