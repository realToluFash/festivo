import { router } from 'expo-router';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from '../components/Text.tsx';
import { tokens } from '../theme/tokens.ts';
import { type LegalDoc, LEGAL_WORDS } from './legalLinks.ts';

/** Terms · Privacy (sc-29938): one centred line of two text links, each 44 high; they leave the app for the in-app browser. */
export function LegalLinks({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.line, style]}>
      <LegalLink doc="terms" />
      <Text
        size={LINK_SIZE}
        accessible={false}
        importantForAccessibility="no"
        style={styles.secondary}
      >
        ·
      </Text>
      <LegalLink doc="privacy" />
    </View>
  );
}

const LINK_SIZE = 13;

function LegalLink({ doc }: { doc: LegalDoc }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/demo/legal-link', params: { doc } })}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
      accessibilityRole="link"
      testID={`demo.legal.${doc}`}
    >
      <Text size={LINK_SIZE} weight="medium" style={styles.secondary}>
        {LEGAL_WORDS[doc]}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  link: {
    minHeight: tokens.sizeHit,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceLg,
  },
  pressed: { opacity: tokens.opacityPressed },
  secondary: { color: tokens.colorInkSecondary },
});
