import { hostNameOf, makeLiveHostError } from '@soirely/domain';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { MakeLiveAlert } from '../../components/MakeLiveAlert.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { Text } from '../../components/Text.tsx';
import { OWNER, type WaitsCheck } from '../messages/CheckWaits.ts';
import { formatCount } from '../messages/MessagesSample.ts';
import { WaitBlock } from '../messages/WaitBlock.tsx';
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

/** A's alert on every layout, in its own window so the question can turn into the offer, its title taking focus as it does. */
export function MakeLiveAsk({
  live,
  reach,
  name,
  hosts,
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
  hosts: readonly string[];
  opener: RefObject<ScreenReaderTarget | null>;
  onKeep: () => void;
  onConfirm: (typed: string) => void;
  onTyped: () => void;
  onSend: () => void;
  onChangeDates: () => void;
}) {
  const alert = liveAlertOf(live.turn, reach, name, hosts);
  const [typed, setTyped] = useState(() =>
    live.turn.at === 'question' ? (live.turn.host?.kept ?? '') : '',
  );

  const confirm = () => {
    if (alert?.turn === 'offer') onSend();
    else if (alert?.turn === 'told') onChangeDates();
    else onConfirm(typed);
  };
  const credits = alert?.credits;
  const extra = [
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
  ].filter(Boolean);

  return (
    <MakeLiveAlert
      alert={
        alert == null
          ? null
          : {
              ...alert,
              host:
                alert.host == null
                  ? null
                  : { label: LIVE.hostLabel, help: LIVE.hostExplainer, error: alert.host.error },
              hostsNow:
                alert.hostsNow == null ? null : { line: LIVE.hostsNow, names: alert.hostsNow },
            }
      }
      typed={typed}
      opener={opener}
      extra={extra.length > 0 ? extra : undefined}
      onTyped={(text) => {
        setTyped(text);
        onTyped();
      }}
      onKeep={onKeep}
      onConfirm={confirm}
      testID="event.makeLive"
    />
  );
}

const styles = StyleSheet.create({
  small: { lineHeight: 13.5 * 1.4, fontVariant: ['tabular-nums'] },
});
