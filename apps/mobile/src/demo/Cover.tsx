import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { tokens } from '../theme/tokens.ts';

type Piece = readonly [
  x: number,
  y: number,
  shape: 'half' | 'bar',
  size: number,
  turn: number,
  tone: Tone,
];
type Tone = 'sun' | 'white' | 'rose' | 'sky';

const TONES: Record<Tone, string> = {
  sun: tokens.optionAmber,
  white: tokens.colorInkOnDark,
  rose: tokens.optionRose,
  sky: tokens.optionBlue,
};

const PIECES: readonly Piece[] = [
  [0.08, 0.17, 'half', 46, -18, 'sun'],
  [0.3, 0.11, 'bar', 44, 24, 'white'],
  [0.6, 0.15, 'half', 20, 200, 'rose'],
  [0.84, 0.27, 'half', 30, 32, 'white'],
  [0.93, 0.44, 'bar', 40, -40, 'sun'],
  [0.05, 0.47, 'bar', 34, 62, 'rose'],
  [0.07, 0.68, 'bar', 26, -30, 'white'],
  [0.95, 0.61, 'half', 24, -70, 'sky'],
  [0.14, 0.8, 'half', 36, 150, 'white'],
  [0.35, 0.89, 'bar', 50, -12, 'sun'],
  [0.64, 0.86, 'half', 40, 12, 'rose'],
  [0.87, 0.77, 'bar', 44, 48, 'white'],
];

const GLOWS = [
  { id: 'nw', x: '0%', y: '0%', r: '70%', colour: tokens.colorInkOnDark, opacity: 0.32 },
  { id: 'ne', x: '100%', y: '8%', r: '62%', colour: tokens.optionRose, opacity: 0.9 },
  { id: 'se', x: '100%', y: '100%', r: '64%', colour: tokens.optionAmber, opacity: 0.85 },
  { id: 'sw', x: '0%', y: '96%', r: '60%', colour: tokens.optionBlue, opacity: 0.8 },
] as const;

/** Soirely's cover for any hour: the brand colour as a soft mesh, and confetti cut from the mark's half disc and bar. */
export function Cover({ scale = 1 }: { scale?: number }) {
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          {GLOWS.map((glow) => (
            <RadialGradient key={glow.id} id={glow.id} cx={glow.x} cy={glow.y} r={glow.r}>
              <Stop offset="0" stopColor={glow.colour} stopOpacity={glow.opacity} />
              <Stop offset="1" stopColor={glow.colour} stopOpacity={0} />
            </RadialGradient>
          ))}
          <LinearGradient id="band" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.1" stopColor={tokens.colorInk} stopOpacity={0} />
            <Stop offset="0.32" stopColor={tokens.colorInk} stopOpacity={0.26} />
            <Stop offset="0.62" stopColor={tokens.colorInk} stopOpacity={0.26} />
            <Stop offset="0.84" stopColor={tokens.colorInk} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100" height="100" fill={tokens.colorAccent} />
        {GLOWS.map((glow) => (
          <Rect key={glow.id} width="100" height="100" fill={`url(#${glow.id})`} />
        ))}
        <Rect width="100" height="100" fill="url(#band)" />
      </Svg>
      {PIECES.map(([x, y, shape, size, turn, tone]) => {
        const n = Math.round(size * scale);
        const piece =
          shape === 'half'
            ? { width: n, height: n / 2, borderTopLeftRadius: n / 2, borderTopRightRadius: n / 2 }
            : { width: n, height: Math.max(8, Math.round(n * 0.24)), borderRadius: n };

        return (
          <View
            key={`${x}:${y}`}
            style={[
              styles.piece,
              piece,
              {
                left: `${x * 100}%`,
                top: `${y * 100}%`,
                marginLeft: -n / 2,
                backgroundColor: TONES[tone],
                opacity: tone === 'white' ? 0.92 : 1,
                transform: [{ rotate: `${turn}deg` }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute' },
});
