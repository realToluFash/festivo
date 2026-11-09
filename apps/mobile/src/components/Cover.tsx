import { createContext, type ReactNode, useId, useState } from 'react';
import { type LayoutChangeEvent, type LayoutRectangle, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import {
  type Box,
  type Piece,
  piecePlacement,
  piecesClearOf,
  pieceSize,
  type Size,
  type Tone,
} from '../kit/confettiClearance.ts';
import { tokens } from '../theme/tokens.ts';

/** True for what sits on the cover, which draws in white. */
export const OnCover = createContext(false);

export { CARD_PIECES, type Piece } from '../kit/confettiClearance.ts';

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
  [0.99, 0.61, 'half', 24, -70, 'sky'],
  [0.14, 0.8, 'half', 36, 150, 'white'],
  [0.35, 0.89, 'bar', 50, -12, 'sun'],
  [0.64, 0.86, 'half', 40, 12, 'rose'],
  [0.87, 0.77, 'bar', 44, 48, 'white'],
];

export interface Glow {
  id: string;
  x: string;
  y: string;
  r: string;
  colour: string;
  opacity: number;
}

const GLOWS: readonly Glow[] = [
  { id: 'nw', x: '0%', y: '0%', r: '70%', colour: tokens.colorInkOnDark, opacity: 0.32 },
  { id: 'ne', x: '100%', y: '8%', r: '62%', colour: tokens.optionRose, opacity: 0.9 },
  { id: 'se', x: '100%', y: '100%', r: '64%', colour: tokens.optionAmber, opacity: 0.85 },
  { id: 'sw', x: '0%', y: '96%', r: '60%', colour: tokens.optionBlue, opacity: 0.8 },
];

/** Where the cover darkens behind white words: a band across the middle, the foot, the left side, or all of it on the day. */
export type Shade = 'band' | 'foot' | 'side' | 'day' | 'none';

const SHADES: Record<
  Exclude<Shade, 'none'>,
  { across: boolean; stops: readonly (readonly [number, number])[] }
> = {
  band: {
    across: false,
    stops: [
      [0.1, 0],
      [0.32, 0.26],
      [0.62, 0.26],
      [0.84, 0],
    ],
  },
  foot: {
    across: false,
    stops: [
      [0.25, 0],
      [0.6, 0.28],
      [1, 0.45],
    ],
  },
  side: {
    across: true,
    stops: [
      [0, 0.42],
      [0.5, 0.26],
      [0.8, 0],
    ],
  },
  day: {
    across: false,
    stops: [
      [0, 0.22],
      [0.28, 0.5],
      [1, 0.56],
    ],
  },
};

export function Mesh({
  base,
  glows,
  shade,
}: {
  base: string;
  glows: readonly Glow[];
  shade: Shade;
}) {
  const fall = shade === 'none' ? null : SHADES[shade];
  // Several meshes share a screen, and an SVG id names its gradient for the whole document on the web.
  const own = useId().replace(/[^a-z0-9]/giu, '');

  return (
    <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
      <Defs>
        {glows.map((glow) => (
          <RadialGradient key={glow.id} id={`${own}${glow.id}`} cx={glow.x} cy={glow.y} r={glow.r}>
            <Stop offset="0" stopColor={glow.colour} stopOpacity={glow.opacity} />
            <Stop offset="1" stopColor={glow.colour} stopOpacity={0} />
          </RadialGradient>
        ))}
        {fall != null && (
          <LinearGradient
            id={`${own}shade`}
            x1="0"
            y1="0"
            x2={fall.across ? '1' : '0'}
            y2={fall.across ? '0' : '1'}
          >
            {fall.stops.map(([offset, opacity]) => (
              <Stop
                key={offset}
                offset={String(offset)}
                stopColor={tokens.colorInk}
                stopOpacity={opacity}
              />
            ))}
          </LinearGradient>
        )}
      </Defs>
      <Rect width="100" height="100" fill={base} />
      {glows.map((glow) => (
        <Rect key={glow.id} width="100" height="100" fill={`url(#${own}${glow.id})`} />
      ))}
      {fall != null && <Rect width="100" height="100" fill={`url(#${own}shade)`} />}
    </Svg>
  );
}

export function Hidden({
  children,
  onLayout,
}: {
  children: ReactNode;
  onLayout?: ((event: LayoutChangeEvent) => void) | undefined;
}) {
  return (
    <View
      onLayout={onLayout}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {children}
    </View>
  );
}

/** Soirely's cover for any hour: the brand colour as a soft mesh, and confetti cut from the mark's half disc and bar. */
export function Cover({
  scale = 1,
  pieces = PIECES,
  shade = 'band',
  words,
}: {
  scale?: number;
  pieces?: readonly Piece[];
  shade?: Shade;
  words?: Box | null | undefined;
}) {
  return (
    <Hidden>
      <Mesh base={tokens.colorAccent} glows={GLOWS} shade={shade} />
      <Confetti pieces={pieces} scale={scale} words={words} />
    </Hidden>
  );
}

/** The pieces alone, placed by share of the box they are given; with `words`, only those clear of them, and none until the words are measured. */
export function Confetti({
  pieces,
  scale = 1,
  words,
}: {
  pieces: readonly Piece[];
  scale?: number;
  words?: Box | null | undefined;
}) {
  const [cover, setCover] = useState<Size | null>(null);
  const shown =
    words === undefined
      ? pieces
      : words == null || cover == null
        ? []
        : piecesClearOf(pieces, cover, scale, words);

  return (
    <Hidden
      onLayout={
        words === undefined
          ? undefined
          : ({ nativeEvent }) =>
              setCover({ width: nativeEvent.layout.width, height: nativeEvent.layout.height })
      }
    >
      {shown.map(([x, y, shape, size, turn, tone]) => {
        const drawn = pieceSize(shape, size, scale);
        const { width: n, height } = drawn;
        const piece =
          shape === 'half'
            ? { width: n, height, borderTopLeftRadius: n / 2, borderTopRightRadius: n / 2 }
            : { width: n, height, borderRadius: n };

        return (
          <View
            key={`${x}:${y}`}
            style={[
              styles.piece,
              piece,
              {
                ...piecePlacement({ x, y }, drawn),
                backgroundColor: TONES[tone],
                opacity: tone === 'white' ? 0.92 : 1,
                transform: [{ rotate: `${turn}deg` }],
              },
            ]}
          />
        );
      })}
    </Hidden>
  );
}

/** The box words take on a cover, from the area they sit in on it and their own place in that area. */
export function useWordsBox() {
  const [area, setArea] = useState<LayoutRectangle | null>(null);
  const [own, setOwn] = useState<LayoutRectangle | null>(null);
  const box: Box | null =
    area == null || own == null
      ? null
      : { x: area.x + own.x, y: area.y + own.y, width: own.width, height: own.height };

  return {
    box,
    onArea: (event: LayoutChangeEvent) => setArea(event.nativeEvent.layout),
    onWords: (event: LayoutChangeEvent) => setOwn(event.nativeEvent.layout),
  };
}

const styles = StyleSheet.create({
  piece: { position: 'absolute' },
});
