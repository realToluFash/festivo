import type { Ref } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AlertLine } from '../../components/AlertLine.tsx';
import { TextAction } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { W, say } from './GuestsWords.ts';

const TRIANGLE = [
  'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  'M12 9v4',
  'M12 17h.01',
];

/** The web's warning triangle (apps/web Glyph `warn`); the app's Glyph set has none yet, so the developer moves it there. */
function WarnMark() {
  return (
    <Svg
      width={17}
      height={17}
      viewBox="0 0 24 24"
      fill="none"
      stroke={tokens.colorAttentionText}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {TRIANGLE.map((d) => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  );
}

/** Already showing when the details open, so it is a header, never an alert the reader announces. */
export function WrongPerson({
  name,
  notReplaced,
  replaceRef,
  onReplace,
}: {
  name: string;
  notReplaced: boolean;
  replaceRef: Ref<ViewInstance>;
  onReplace: () => void;
}) {
  return (
    <View style={styles.notice} testID="guest.flagged">
      <View style={styles.head}>
        <View style={styles.mark} accessibilityElementsHidden importantForAccessibility="no">
          <WarnMark />
        </View>
        <Text
          size={15.5}
          weight="bold"
          accessibilityRole="header"
          style={[styles.grow, styles.title]}
        >
          {W.flaggedTitle}
        </Text>
      </View>
      <Text size={14} weight="medium" style={styles.line}>
        {say.flaggedLine(name)}
      </Text>
      <TextAction
        ref={replaceRef}
        label={W.replaceLink}
        onPress={onReplace}
        testID="guest.flagged.replace"
      />
      {notReplaced && <AlertLine text={W.notReplaced} />}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  notice: {
    gap: tokens.spaceSm,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: tokens.radiusCardPhone,
    borderWidth: 1.5,
    borderColor: tokens.colorAttentionBorder,
    backgroundColor: tokens.colorAttentionTint,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  mark: { paddingTop: 2 },
  title: { color: tokens.colorInk, lineHeight: 15.5 * 1.35 },
  line: { color: tokens.colorInk, lineHeight: 14 * 1.45 },
});
