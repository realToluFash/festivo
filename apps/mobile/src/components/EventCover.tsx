import type { EventCover as Cover } from '@soirely/api-client';
import type { EventType } from '@soirely/domain';
import { type ReactNode, useState } from 'react';
import { Image, PixelRatio, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Path, Pattern, Rect } from 'react-native-svg';

import { coverPlacement, coverShown, coverSource, defaultFor } from '../kit/eventCover.ts';
import { tokens } from '../theme/tokens.ts';

const W = 320;
const H = 180;

/** The event's photo, or its type's default pattern as the web draws it (sc-3590), in a 16:9 box reserved before it loads. */
export function EventCover({
  cover,
  type,
  radius = tokens.radiusInset,
  testID,
}: {
  cover: Cover | null;
  type: EventType;
  radius?: number;
  testID?: string;
}) {
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null);
  const [photo, setPhoto] = useState<{ width: number; height: number } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const source =
    cover == null || frame == null
      ? null
      : coverSource(cover.sizes, PixelRatio.getPixelSizeForLayoutSize(frame.width));
  const shown = coverShown(cover, source, failed);
  const placed =
    cover == null || frame == null || photo == null
      ? null
      : coverPlacement(frame, photo, cover.position);
  const described = shown.description;

  return (
    <View
      style={[styles.frame, { borderRadius: radius }]}
      onLayout={({ nativeEvent }) => setFrame(nativeEvent.layout)}
      accessible={described != null}
      accessibilityRole={described == null ? undefined : 'image'}
      accessibilityLabel={described ?? undefined}
      importantForAccessibility={described == null ? 'no-hide-descendants' : 'yes'}
      accessibilityElementsHidden={described == null}
      testID={testID}
    >
      {cover == null || !shown.photo ? (
        <DefaultCover type={type} />
      ) : (
        source != null && (
          <Image
            source={{ uri: source }}
            style={placed == null ? StyleSheet.absoluteFill : [styles.photo, placed]}
            resizeMode="cover"
            onLoad={({ nativeEvent }) => setPhoto(nativeEvent.source)}
            onError={() => setFailed(source)}
          />
        )
      )}
    </View>
  );
}

function DefaultCover({ type }: { type: EventType }) {
  const known = defaultFor(type);
  const { background, shapes } = PATTERNS[known];

  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      testID={`cover-default-${known}`}
    >
      <Rect width={W} height={H} fill={background} />
      {shapes}
    </Svg>
  );
}

function tiled(id: string, size: number, tile: ReactNode, rotate = 0): ReactNode {
  return (
    <>
      <Defs>
        <Pattern
          id={id}
          patternUnits="userSpaceOnUse"
          width={size}
          height={size}
          patternTransform={rotate === 0 ? undefined : `rotate(${rotate})`}
        >
          {tile}
        </Pattern>
      </Defs>
      <Rect width={W} height={H} fill={`url(#${id})`} />
    </>
  );
}

function ring(cx: number, cy: number, inner: number, outer: number, stroke: string): ReactNode {
  return (
    <Circle
      cx={cx}
      cy={cy}
      r={(inner + outer) / 2}
      fill="none"
      stroke={stroke}
      strokeWidth={outer - inner}
    />
  );
}

function wedge(from: number, to: number): string {
  const point = (degrees: number): string => {
    const radians = ((degrees - 90) * Math.PI) / 180;

    return `${W / 2 + 400 * Math.cos(radians)} ${H / 2 + 400 * Math.sin(radians)}`;
  };

  return `M${W / 2} ${H / 2} L${point(from)} L${point(to)} Z`;
}

/** Each is the web's `.cover-default-*` at a 320 × 180 frame, so the two clients draw the same default. */
const PATTERNS: Record<EventType, { background: string; shapes: ReactNode }> = {
  wedding: {
    background: tokens.colorAttentionTint,
    shapes: (
      <>
        {ring(134, 90, 41, 47, tokens.colorAttention)}
        {ring(186, 90, 41, 47, tokens.colorAttentionBorder)}
      </>
    ),
  },
  birthday: {
    background: tokens.colorAccentTint,
    shapes: tiled(
      'birthday',
      28,
      <>
        {[0, 28].flatMap((x) =>
          [0, 28].map((y) => (
            <Circle key={`${x}${y}`} cx={x} cy={y} r={3} fill={tokens.colorAccent} />
          )),
        )}
        <Circle cx={14} cy={14} r={3} fill={tokens.colorAttention} />
      </>,
    ),
  },
  anniversary: {
    background: tokens.colorAttentionTint,
    shapes: (
      <>
        <Circle cx={W / 2} cy={H / 2} r={6} fill={tokens.colorAttentionBorder} />
        {Array.from({ length: 11 }, (_, band) => (
          <Circle
            key={band}
            cx={W / 2}
            cy={H / 2}
            r={21 + band * 18}
            fill="none"
            stroke={tokens.colorAttentionBorder}
            strokeWidth={6}
          />
        ))}
      </>
    ),
  },
  engagement: {
    background: tokens.colorAccentTint,
    shapes: ring(160, 99, 34, 40, tokens.colorAccentText),
  },
  baby_shower: {
    background: tokens.colorHeader,
    shapes: tiled(
      'baby_shower',
      48,
      <Rect x={24} width={24} height={48} fill={tokens.colorHeaderBorder} />,
    ),
  },
  graduation: {
    background: tokens.colorHeader,
    shapes: <Path d="M220 0 L280 0 L100 180 L40 180 Z" fill={tokens.colorInkSecondary} />,
  },
  memorial: {
    background: tokens.colorInset,
    shapes: <Rect y={H * 0.62} width={W} height={H * 0.38} fill={tokens.colorInsetBorder} />,
  },
  religious: {
    background: tokens.colorAttentionTint,
    shapes: (
      <Path
        d={`M${W / 2 - 96} ${H} A96 111.6 0 0 1 ${W / 2 + 96} ${H} Z`}
        fill={tokens.colorAttentionBorder}
      />
    ),
  },
  cultural: {
    background: tokens.colorAttentionTint,
    shapes: tiled(
      'cultural',
      32,
      <>
        <Path d="M0 0 L16 0 L0 16 Z" fill={tokens.colorAccent} />
        <Path d="M32 0 L16 0 L32 16 Z" fill={tokens.colorAttention} />
      </>,
    ),
  },
  party: {
    background: tokens.colorCard,
    shapes: (
      <>
        {tiled(
          'party-stripes',
          28,
          <Rect width={14} height={28} fill={tokens.colorAccentTint} />,
          45,
        )}
        {tiled('party-dots', 22, <Circle cx={11} cy={11} r={2.5} fill={tokens.colorAttention} />)}
      </>
    ),
  },
  gala: {
    background: tokens.colorAttentionTint,
    shapes: (
      <>
        {Array.from({ length: 18 }, (_, n) => (
          <Path key={n} d={wedge(10 + n * 20, 20 + n * 20)} fill={tokens.colorAttentionBorder} />
        ))}
        <Circle cx={W / 2} cy={H / 2} r={11} fill={tokens.colorAttention} />
      </>
    ),
  },
  conference: {
    background: tokens.colorHeader,
    shapes: tiled(
      'conference',
      24,
      <>
        <Rect width={24} height={1} fill={tokens.colorHeaderBorder} />
        <Rect width={1} height={24} fill={tokens.colorHeaderBorder} />
      </>,
    ),
  },
  corporate: {
    background: tokens.colorHeader,
    shapes: <Rect y={H * 0.55} width={W} height={H * 0.05} fill={tokens.colorAccentText} />,
  },
  other: {
    background: tokens.colorInset,
    shapes: <Circle cx={224} cy={72} r={50} fill={tokens.colorInsetBorder} />,
  },
};

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 16 / 9,
    overflow: 'hidden',
    backgroundColor: tokens.colorInset,
  },
  photo: {
    position: 'absolute',
  },
});
