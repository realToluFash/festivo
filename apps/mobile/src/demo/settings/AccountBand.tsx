import { StyleSheet, View } from 'react-native';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Confetti, Cover, type Piece } from '../Cover.tsx';
import { YOU } from './sample.ts';

const BAND_PIECES: readonly Piece[] = [
  [0.64, 0.06, 'half', 22, -18, 'sun'],
  [0.8, 0.12, 'bar', 26, 24, 'white'],
  [0.95, 0.24, 'half', 14, 200, 'rose'],
  [0.78, 0.74, 'half', 20, 32, 'sky'],
  [0.91, 0.82, 'bar', 24, -40, 'sun'],
  [0.56, 0.88, 'bar', 16, 62, 'white'],
];

/** Settings' Confetti card carried onto the page it opens: no chevron, since it is the page itself. */
export function AccountBand({
  name,
  email,
  portrait,
}: {
  name: string;
  email: string;
  portrait: boolean;
}) {
  const look = portrait
    ? { height: 148, avatar: 68, name: 24, mail: 16, radius: 28, scale: 1.2 }
    : { height: 148, avatar: 60, name: 22, mail: 15, radius: 26, scale: 1 };

  return (
    <View style={[styles.band, { minHeight: look.height, borderRadius: look.radius }]}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: look.radius, overflow: 'hidden' }]}>
        <Cover shade="side" pieces={[]} />
        <Confetti pieces={BAND_PIECES} scale={look.scale} />
      </View>
      <View
        style={[
          styles.avatar,
          { width: look.avatar, height: look.avatar, borderRadius: look.avatar / 2 },
        ]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text
          size={Math.round(look.avatar * 0.36)}
          weight="bold"
          accessible={false}
          style={styles.accent}
        >
          {YOU.initials}
        </Text>
      </View>
      <View style={styles.words}>
        <Text size={look.name} weight="bold" style={[styles.white, styles.tight]}>
          {name}
        </Text>
        <Text size={look.mail} weight="medium" style={styles.white}>
          {email}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXl,
    paddingHorizontal: tokens.spaceXxl,
    paddingVertical: tokens.spaceXl,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInkOnDark,
  },
  words: { flex: 1, minWidth: 0, gap: 3 },
  accent: { color: tokens.colorAccent },
  white: { color: tokens.colorInkOnDark },
  tight: { letterSpacing: -0.3 },
});
