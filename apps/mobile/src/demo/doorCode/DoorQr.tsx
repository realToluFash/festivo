import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { tokens } from '../../theme/tokens.ts';
import { qrPath } from '../settings/SecuritySample.ts';
import { qrSaid } from './DoorCodeWords.ts';

const MODULES = 29;
const QUIET = 3;

function seedOf(code: string): number {
  return [...code].reduce((total, char) => (total * 31 + char.charCodeAt(0)) % 2147483647, 7);
}

/** A drawn QR, black on white with a quiet zone of 3 modules, as the boards draw it; the build draws the redeem address with the code in it. */
export function DoorQr({
  code,
  side,
  said = true,
}: {
  code: string;
  side: number;
  said?: boolean;
}) {
  const path = useMemo(() => qrPath(MODULES, seedOf(code)), [code]);
  const box = MODULES + QUIET * 2;

  return (
    <View
      style={[styles.qr, { width: side, height: side }]}
      accessible={said}
      accessibilityRole={said ? 'image' : undefined}
      accessibilityLabel={said ? qrSaid(code) : undefined}
      accessibilityElementsHidden={!said}
      importantForAccessibility={said ? 'yes' : 'no-hide-descendants'}
    >
      <Svg width={side} height={side} viewBox={`${-QUIET} ${-QUIET} ${box} ${box}`}>
        <Rect x={-QUIET} y={-QUIET} width={box} height={box} fill={tokens.colorCard} />
        <Path d={path} fill={tokens.colorPrintInk} fillRule="evenodd" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  qr: { backgroundColor: tokens.colorCard },
});
