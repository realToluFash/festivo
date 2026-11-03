import { router } from 'expo-router';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { SecondaryButton } from '../components/Buttons.tsx';
import { Text } from '../components/Text.tsx';
import { config } from '../config.ts';
import { tokens } from '../theme/tokens.ts';
import { demoOpens } from './gate.ts';

export function demoHere(): boolean {
  return demoOpens(config.environment);
}

export function DemoButton() {
  if (!demoHere()) return null;

  return (
    <SecondaryButton
      label="Design demo"
      onPress={() => router.push('/demo')}
      stacked
      link
      testID="home.designDemo"
    />
  );
}

export function DemoRow({ style }: { style: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      style={style}
      onPress={() => router.push('/demo')}
      accessibilityRole="button"
      testID="settings.designDemo"
    >
      <View style={styles.words}>
        <Text size={tokens.typeTitleSection.size} weight="semibold">
          Design demo
        </Text>
        <Text size={tokens.typeBody.size} muted>
          The designs, working on sample data
        </Text>
      </View>
      <Text
        size={tokens.typeTitleDialog.size}
        muted
        accessibilityElementsHidden
        importantForAccessibility="no"
        accessible={false}
      >
        ›
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  words: { flex: 1, minWidth: 0 },
});
