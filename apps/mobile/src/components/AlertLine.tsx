import { StyleSheet, View } from 'react-native';

import { tokens } from '../theme/tokens.ts';
import { Glyph } from './Glyph.tsx';
import { Text } from './Text.tsx';

/** What went wrong, in red after the alert mark, and read out. */
export function AlertLine({ text, small = false }: { text: string; small?: boolean }) {
  return (
    <View style={styles.alert} accessibilityRole="alert">
      <View style={small ? styles.alertMarkSmall : styles.alertMark}>
        <Glyph name="alert" size={15} ink={tokens.colorBroken} weight={2.2} />
      </View>
      <Text
        size={small ? 13.5 : 14}
        weight="medium"
        style={[styles.grow, styles.broken, small ? styles.hint : styles.said]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  broken: { color: tokens.colorBroken },
  alert: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceXs },
  alertMark: { paddingTop: tokens.spaceHair },
  alertMarkSmall: { paddingTop: 1 },
  hint: { lineHeight: 13.5 * 1.4 },
  said: { lineHeight: 14 * 1.45 },
});
