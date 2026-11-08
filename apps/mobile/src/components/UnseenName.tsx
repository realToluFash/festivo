import { Platform, StyleSheet } from 'react-native';

import { Text } from './Text.tsx';

/** Words that name a field on Android through accessibilityLabelledBy and are never shown. Mount them whenever the field is, changing only their words: TalkBack finds the view a field is labelled by when it builds the field's node, so words mounted with a refusal can be missed (sc-31323). */
export function UnseenName({ nativeID, children }: { nativeID: string; children: string }) {
  if (Platform.OS !== 'android') return null;

  return (
    <Text
      nativeID={nativeID}
      importantForAccessibility="no"
      pointerEvents="none"
      style={styles.unseen}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  unseen: { position: 'absolute', opacity: 0 },
});
