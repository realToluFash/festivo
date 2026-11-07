import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { type Channel, expiredLine, WORDS } from './AccountModel.ts';
import { Line } from '../../components/Summary.tsx';

/** Seconds until a new code may be sent; an expired code starts with none to wait. */
export function useCountdown(
  seconds: number,
  waiting = true,
): { left: number; restart: () => void } {
  const [left, setLeft] = useState(waiting ? seconds : 0);
  const [round, setRound] = useState(waiting ? 1 : 0);

  useEffect(() => {
    if (round === 0) return undefined;
    const started = Date.now();
    const timer = setInterval(() => {
      const next = Math.max(0, seconds - Math.floor((Date.now() - started) / 1000));
      setLeft(next);
      if (next === 0) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [seconds, round]);

  return {
    left,
    restart: () => {
      setLeft(seconds);
      setRound((value) => value + 1);
    },
  };
}

export const CODE_FIGURES = { fontVariant: ['tabular-nums' as const], letterSpacing: 1.5 };

/** An expired code takes the field's place until a new one is sent. */
export function CodeExpired({ channel }: { channel: Channel }) {
  return (
    <View style={styles.expired}>
      <Text size={16} weight="semibold">
        {WORDS.expiredTitle}
      </Text>
      <Line text={expiredLine(channel)} />
    </View>
  );
}

const styles = StyleSheet.create({
  expired: { gap: tokens.spaceXxs, paddingTop: tokens.spaceXs },
});
