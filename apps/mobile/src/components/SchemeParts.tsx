import { type Ref, useId } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { useTranslation } from 'react-i18next';

import { cardSays, nameOf } from '../kit/personalisation.ts';
import {
  dotsOf,
  lineOf,
  lookOf,
  reachOf,
  type SchemeLook,
  stepOf,
  washStops,
} from '../kit/schemes.ts';
import type { Scheme } from '../theme/tokens.ts';
import { tokens } from '../theme/tokens.ts';
import { Hidden } from './Cover.tsx';
import { Glyph } from './Glyph.tsx';
import { useReadOut } from './ReadOut.tsx';
import { ShapeMark } from './StateTag.tsx';
import { Text } from './Text.tsx';

/** A piece of Confetti: where its middle sits, its shape, size and turn, and which of the scheme's four colours it takes. */
export type Spot = readonly [
  x: number,
  y: number,
  shape: 'half' | 'bar',
  size: number,
  turn: number,
  colour: 0 | 1 | 2 | 3,
];

/** The Settings card's pieces, as shares of the card. */
const CARD_SPOTS: readonly Spot[] = [
  [0.67, 0.05, 'half', 22, -18, 0],
  [0.83, 0.11, 'bar', 26, 24, 1],
  [0.96, 0.2, 'half', 14, 200, 2],
  [0.81, 0.73, 'half', 20, 32, 3],
  [0.92, 0.84, 'bar', 24, -40, 0],
  [0.58, 0.9, 'bar', 16, 62, 1],
];

const PREVIEW_SPOTS: readonly Spot[] = [
  [114, 8, 'half', 22, -18, 0],
  [60, 16, 'bar', 26, 24, 1],
  [14, 30, 'half', 14, 200, 2],
];

/** A swatch's pieces, from its right edge, as the boards cut them for its height. */
export function swatchSpots(height: number): readonly Spot[] {
  return [
    [34, 8, 'half', 16, -18, 0],
    [62, 14, 'bar', 18, 24, 1],
    [16, 30, 'half', 12, 200, 2],
    [46, height - 22, 'half', 14, 32, 3],
    [90, height - 18, 'bar', 14, -40, 0],
  ];
}

/** A scheme's Confetti: its ground, the wash behind words when they sit on it, and its pieces placed by share or from the right. */
export function SchemeGround({
  look,
  washed,
  spots,
  from,
  scale = 1,
}: {
  look: SchemeLook;
  washed: boolean;
  spots: readonly Spot[];
  from: 'share' | 'right';
  scale?: number;
}) {
  const own = useId().replace(/[^a-z0-9]/giu, '');
  const { wash } = look;
  const share = (part: number) => `${part * 100}%`;
  const glows = look.ground.glows.map((glow, index) => ({ ...glow, ...reachOf(glow), index }));

  return (
    <Hidden>
      <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          {glows.map((glow) => (
            <RadialGradient
              key={glow.index}
              id={`${own}g${glow.index}`}
              cx={share(glow.x)}
              cy={share(glow.y)}
              r={share(glow.rx)}
              rx={share(glow.rx)}
              ry={share(glow.ry)}
            >
              <Stop offset="0" stopColor={glow.colour} stopOpacity={1} />
              <Stop offset={String(glow.fade)} stopColor={glow.colour} stopOpacity={0} />
            </RadialGradient>
          ))}
          {wash != null && (
            <LinearGradient id={`${own}wash`} x1="0" y1="0" x2="1" y2="0">
              {washStops(wash).map(([offset, opacity]) => (
                <Stop
                  key={offset}
                  offset={String(offset)}
                  stopColor={wash.band}
                  stopOpacity={opacity}
                />
              ))}
            </LinearGradient>
          )}
        </Defs>
        <Rect width="100" height="100" fill={look.ground.base} />
        {[...glows].reverse().map((glow) => (
          <Rect key={glow.index} width="100" height="100" fill={`url(#${own}g${glow.index})`} />
        ))}
        {washed && wash != null && <Rect width="100" height="100" fill={`url(#${own}wash)`} />}
      </Svg>
      {spots.map(([x, y, shape, size, turn, colour]) => {
        const n = Math.round(size * scale);
        const cut =
          shape === 'half'
            ? { width: n, height: n / 2, borderTopLeftRadius: n / 2, borderTopRightRadius: n / 2 }
            : { width: n, height: Math.max(8, Math.round(n * 0.24)), borderRadius: n };
        const at =
          from === 'share'
            ? { left: `${x * 100}%` as const, top: `${y * 100}%` as const, marginLeft: -n / 2 }
            : { right: x - n / 2, top: y };

        return (
          <View
            key={`${x}:${y}`}
            style={[
              styles.piece,
              cut,
              at,
              { backgroundColor: look.pieces[colour], transform: [{ rotate: `${turn}deg` }] },
            ]}
          />
        );
      })}
    </Hidden>
  );
}

/** The scheme's colours as ringed dots; the name beside them says which scheme it is. */
export function SchemeDots({ look, side }: { look: SchemeLook; side: number }) {
  const { colours, ring } = dotsOf(look);
  const ringed = side + 4;

  return (
    <View
      style={styles.dots}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {colours.map((colour, index) => (
        <View
          key={index}
          style={[
            styles.dotRing,
            { width: ringed, height: ringed, borderRadius: ringed / 2, backgroundColor: ring },
          ]}
        >
          <View
            style={{ width: side, height: side, borderRadius: side / 2, backgroundColor: colour }}
          />
        </View>
      ))}
    </View>
  );
}

const PADDING = {
  page: { paddingTop: 18, paddingHorizontal: 20, paddingBottom: 20 },
  wide: { paddingTop: 20, paddingHorizontal: 24, paddingBottom: 22 },
} as const;

/** Personalisation's card, in the person's own scheme: what they see, whether it is a choice, the colours, and Choose colours. */
export function SchemeCard({
  scheme,
  line,
  wide,
  stepRef,
  onChoose,
}: {
  scheme: Scheme;
  line: { text: string; done: boolean };
  wide: boolean;
  stepRef: Ref<ViewInstance>;
  onChoose: () => void;
}) {
  const { t } = useTranslation();
  const look = lookOf(scheme);
  const step = stepOf(look);

  useReadOut(line.done ? line.text : null, { quietAtMount: true });

  return (
    <View
      style={[styles.card, PADDING[wide ? 'wide' : 'page'], { backgroundColor: look.ground.base }]}
      testID="personalisation.card"
    >
      <SchemeGround look={look} washed spots={CARD_SPOTS} from="share" scale={wide ? 1.3 : 1} />
      <Text
        size={24}
        weight="bold"
        accessibilityRole="header"
        style={[styles.says, { color: look.on }]}
        testID="personalisation.says"
      >
        {cardSays(t, scheme)}
      </Text>
      {line.done ? (
        <View style={styles.done}>
          <View style={styles.doneMark}>
            <ShapeMark kind="yes" side={16} ink={look.on} />
          </View>
          <Text size={14.5} weight="semibold" style={[styles.line, { color: lineOf(look) }]}>
            {line.text}
          </Text>
        </View>
      ) : (
        <Text size={14.5} weight="medium" style={[styles.line, { color: lineOf(look) }]}>
          {line.text}
        </Text>
      )}
      <SchemeDots look={look} side={24} />
      <Pressable
        ref={stepRef}
        onPress={onChoose}
        style={({ pressed }) => [
          styles.step,
          { backgroundColor: step.fill },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('personalisation.choose')}
        testID="personalisation.choose"
      >
        <Text size={15} weight="semibold" accessible={false} style={{ color: step.ink }}>
          {t('personalisation.choose')}
        </Text>
        <Glyph name="arrow" size={16} ink={step.ink} weight={2.4} />
      </Pressable>
    </View>
  );
}

/** Colours' card in the pick: its name on its own Confetti and its colours, 96 tall; what the pick means is said under it. */
export function PreviewCard({ scheme }: { scheme: Scheme }) {
  const { t } = useTranslation();
  const look = lookOf(scheme);
  const name = nameOf(t, scheme);

  return (
    <View
      style={[styles.preview, { backgroundColor: look.ground.base }]}
      accessible
      accessibilityLabel={t('personalisation.preview', { scheme: name })}
      testID="personalisation.preview"
    >
      <SchemeGround look={look} washed spots={PREVIEW_SPOTS} from="right" />
      <Text
        size={22}
        weight="bold"
        accessible={false}
        numberOfLines={1}
        style={[styles.previewName, { color: look.on }]}
      >
        {name}
      </Text>
      <SchemeDots look={look} side={20} />
    </View>
  );
}

/** Personalisation's tile in the Settings list: a swatch of the person's own colours with the palette on it. */
export function SchemeTile({ side, scheme }: { side: number; scheme: Scheme }) {
  const look = lookOf(scheme);
  const piece: Spot = [
    side * 0.3,
    side * 0.18,
    'half',
    Math.max(8, Math.round(side * 0.36)),
    -18,
    0,
  ];

  return (
    <View
      style={[
        styles.tile,
        {
          width: side,
          height: side,
          borderRadius: Math.round(side * 0.3),
          backgroundColor: look.ground.base,
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="settings.personalisation.tile"
    >
      <SchemeGround look={look} washed={false} spots={[piece]} from="right" />
      <Palette side={Math.round(side * 0.56)} ink={look.on} />
    </View>
  );
}

function Palette({ side, ink }: { side: number; ink: string }) {
  return (
    <Svg
      width={side}
      height={side}
      viewBox="0 0 24 24"
      fill="none"
      stroke={ink}
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" />
      {[
        [13.5, 6.5],
        [17.5, 10.5],
        [6.5, 12.5],
        [8.5, 7.5],
      ].map(([cx, cy]) => (
        <Circle key={`${cx}:${cy}`} cx={cx} cy={cy} r={0.5} fill={ink} />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute' },
  dots: { flexDirection: 'row', gap: tokens.spaceXxs },
  dotRing: { alignItems: 'center', justifyContent: 'center' },
  card: { minHeight: 200, gap: tokens.spaceLg, borderRadius: 26, overflow: 'hidden' },
  says: { maxWidth: '80%', lineHeight: Math.round(24 * 1.15), letterSpacing: 24 * -0.015 },
  line: { maxWidth: '80%', lineHeight: 14.5 * 1.4 },
  done: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  doneMark: { marginTop: tokens.spaceHair },
  step: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: tokens.spaceSm,
    marginTop: 'auto',
    paddingLeft: 18,
    paddingRight: tokens.spaceXl,
    borderRadius: tokens.sizeHit / 2,
  },
  pressed: { opacity: tokens.opacityPressed },
  preview: { height: 96, padding: 18, gap: tokens.spaceMd, borderRadius: 26, overflow: 'hidden' },
  previewName: { lineHeight: Math.round(22 * 1.15), letterSpacing: 22 * -0.015 },
  tile: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
