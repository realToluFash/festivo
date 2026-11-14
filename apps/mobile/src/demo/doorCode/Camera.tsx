import { Pressable, StyleSheet, View } from 'react-native';

import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { useCoverStatusBar } from '../Welcome.tsx';
import { BAR } from './DoorCodeModel.ts';
import { DoorQr } from './DoorQr.tsx';
import { W } from './DoorCodeWords.ts';

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

const CORNERS = [
  { left: 0, top: 0, rotate: '0deg' },
  { right: 0, top: 0, rotate: '90deg' },
  { right: 0, bottom: 0, rotate: '180deg' },
  { left: 0, bottom: 0, rotate: '270deg' },
] as const;

/** The phone's own camera, standing in: it finds the held-up code, and its chip opens the app on the event (sc-72). */
export function CameraStandIn({ onChip }: { onChip: () => void }) {
  useCoverStatusBar('light', false);

  return (
    <View style={styles.camera}>
      <View style={styles.view} {...hidden}>
        <View style={styles.frame}>
          {CORNERS.map(({ rotate, ...at }) => (
            <View key={rotate} style={[styles.corner, at, { transform: [{ rotate }] }]} />
          ))}
          <View style={styles.held}>
            <View style={styles.heldFace}>
              <DoorQr code={BAR.code} side={150} said={false} />
              <Text size={22} weight="bold" accessible={false} style={styles.code}>
                {BAR.code}
              </Text>
            </View>
          </View>
        </View>
      </View>
      <Pressable
        onPress={onChip}
        style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
        accessibilityRole="link"
        accessibilityLabel={W.address}
        testID="redeem.camera.chip"
      >
        <View style={styles.chipMark}>
          <Glyph name="link" size={16} ink={tokens.colorInkOnDark} weight={2.4} />
        </View>
        <Text size={15} weight="semibold" accessible={false} style={styles.chipWords}>
          {W.address}
        </Text>
      </Pressable>
      <View style={styles.shutter} {...hidden}>
        <View style={styles.shutterFill} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  camera: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space5xl,
    backgroundColor: tokens.colorDark,
  },
  view: { alignItems: 'center' },
  frame: { width: 254, height: 368, alignItems: 'center', justifyContent: 'center' },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderLeftWidth: 4,
    borderTopWidth: 4,
    borderTopLeftRadius: tokens.radiusSmall,
    borderColor: tokens.colorAttentionOnDark,
  },
  held: {
    width: 210,
    height: 330,
    padding: 9,
    borderRadius: 30,
    backgroundColor: tokens.colorDarkInset,
    transform: [{ rotate: '-4deg' }],
  },
  heldFace: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceLg,
    borderRadius: 22,
    backgroundColor: tokens.colorCard,
  },
  code: { letterSpacing: 22 * 0.04, fontVariant: ['tabular-nums'] },
  chip: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingLeft: tokens.spaceSm,
    paddingRight: 18,
    borderRadius: 22,
    backgroundColor: tokens.colorAttentionOnDark,
  },
  pressed: { opacity: tokens.opacityPressed },
  chipMark: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radiusSmall,
    backgroundColor: tokens.colorAccent,
  },
  chipWords: { color: tokens.colorInk },
  shutter: {
    width: 72,
    height: 72,
    padding: tokens.spaceXxs,
    borderWidth: 4,
    borderRadius: 36,
    borderColor: tokens.colorInkOnDark,
  },
  shutterFill: { flex: 1, borderRadius: 32, backgroundColor: tokens.colorInkOnDark },
});
